// LangGraph 工作流 - 小说章节创作流水线
// 写→审→改 循环，直到通过质量门禁

import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { WRITER_SYSTEM_PROMPT, buildWriterPrompt } from './writer'
import { READER_SYSTEM_PROMPT, EDITOR_SYSTEM_PROMPT, LOGIC_SYSTEM_PROMPT, CHARACTER_DIRECTOR_SYSTEM_PROMPT } from './reviewers'
import { reviewByDirector } from './director'
import { generateStateSnapshot, formatStateForAgents, checkMysteryConstraints } from './state-machine'
import { parseJsonFromLLM } from '../ai-config'
import { STYLE_GUARD_SYSTEM_PROMPT, FORESHADOW_AGENT_SYSTEM_PROMPT, POWER_SYSTEM_AGENT_PROMPT } from './missing-agents'

// ========== LLM 配置 ==========
import { getCurrentConfig } from '../ai-config'

function getWriterLLM() {
  const config = getCurrentConfig()
  return new ChatOpenAI({
    modelName: config.model,
    apiKey: process.env.AI_API_KEY || process.env[`${config.provider.toUpperCase()}_API_KEY`] || process.env.DEEPSEEK_API_KEY,
    configuration: { baseURL: config.baseUrl },
    temperature: 0.75,
    maxTokens: 8192,
  })
}

function getReviewerLLM() {
  const config = getCurrentConfig()
  return new ChatOpenAI({
    modelName: config.model,
    apiKey: process.env.AI_API_KEY || process.env[`${config.provider.toUpperCase()}_API_KEY`] || process.env.DEEPSEEK_API_KEY,
    configuration: { baseURL: config.baseUrl },
    temperature: 0.2,
    maxTokens: 4096,
  })
}

// ========== 状态定义 ==========
const ChapterState = Annotation.Root({
  // 输入
  novelId: Annotation<string>({ reducer: (_, prev) => prev, default: () => '' }),
  chapter: Annotation<number>({ reducer: (_, prev) => prev, default: () => 1 }),
  context: Annotation<any>({ reducer: (_, prev) => prev, default: () => ({}) }),

  // 中间状态
  draft: Annotation<string>({ reducer: (_, prev) => prev, default: () => '' }),
  revisionCount: Annotation<number>({ reducer: (_, prev) => prev, default: () => 0 }),
  maxRevisions: Annotation<number>({ reducer: (_, prev) => prev, default: () => 3 }),

  // 审查结果
  readerReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  editorReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  logicReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  characterReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  styleGuardReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  foreshadowReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  powerSystemReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  directorReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),

  // 最终结果
  finalDraft: Annotation<string>({ reducer: (_, prev) => prev, default: () => '' }),
  allScores: Annotation<any>({ reducer: (_, prev) => prev, default: () => ({}) }),
  isApproved: Annotation<boolean>({ reducer: (_, prev) => prev, default: () => false }),
  status: Annotation<string>({ reducer: (_, prev) => prev, default: () => '' }),

  // 流式输出用
  logs: Annotation<string[]>({
    reducer: (curr, prev) => curr.concat(prev),
    default: () => [],
  }),
})

type State = typeof ChapterState.State

// ========== 工具函数 ==========
function calculatePassGrade(readerScore: number, editorScores: any, logicIssues: any[], characterIssues: any[]): boolean {
  // 通过条件：读者>=70, 编辑>=65, 无critical问题, 角色无critical OOC
  if (readerScore < 70) return false
  if (editorScores) {
    const avg = (editorScores.pacing + editorScores.commercial_value + editorScores.character_development + editorScores.chapter_structure) / 4
    if (avg < 65) return false
  }
  if (logicIssues?.some((i: any) => i.severity === 'critical' && i.blocking)) return false
  if (characterIssues?.some((i: any) => i.severity === 'critical' && i.blocking)) return false
  return true
}

// ========== 节点函数 ==========

// 1. 主笔写作节点
async function writeChapter(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  const revisionNote = state.revisionCount > 0
    ? `\n\n【修改要求】上一版被审查驳回，请根据以下反馈修改：\n${JSON.stringify(state.allScores?.revisionFeedback || {}, null, 2)}`
    : ''

  const prompt = buildWriterPrompt(state.context) + revisionNote

  logs.push(`✍️ [主笔作家] 开始写作第${state.chapter}章${state.revisionCount > 0 ? `（第${state.revisionCount + 1}次修改）` : ''}...`)

  const llm = getWriterLLM()
  const response = await llm.invoke([
    new SystemMessage(WRITER_SYSTEM_PROMPT),
    new HumanMessage(prompt),
  ])

  const draft = response.content as string
  logs.push(`✅ [主笔作家] 完成初稿，${draft.length}字`)

  return { draft, revisionCount: state.revisionCount + 1, logs }
}

// 2. 读者审查节点
async function reviewByReader(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('📖 [读者Agent] 正在评估章节...')

  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(READER_SYSTEM_PROMPT),
    new HumanMessage(`请评估以下网文章节：\n\n${state.draft}`),
  ])

  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [读者Agent] 评估完成，总分: ${review?.overall_score || '未知'}`)

  return { readerReview: review, logs }
}

// 3. 编辑审查节点
async function reviewByEditor(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('📝 [编辑Agent] 正在审查章节...')

  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(EDITOR_SYSTEM_PROMPT),
    new HumanMessage(`请审查以下网文章节：\n\n${state.draft}`),
  ])

  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [编辑Agent] 审查完成`)

  return { editorReview: review, logs }
}

// 4. 逻辑审查节点
async function reviewByLogic(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🔍 [逻辑Agent] 正在检查一致性...')

  const contextStr = JSON.stringify({
    characters: state.context.characters,
    worldSetting: state.context.worldSetting,
    previousSummary: state.context.previousSummary,
  }, null, 2)

  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(LOGIC_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的一致性：\n\n章节内容：\n${state.draft}\n\n参考数据：\n${contextStr}`),
  ])

  const review = parseJsonFromLLM(response.content as string)
  const issues = review?.issues || []
  const criticalCount = issues.filter((i: any) => i.severity === 'critical').length
  logs.push(`📊 [逻辑Agent] 检查完成，${issues.length}个问题（${criticalCount}个阻断）`)

  return { logicReview: review, logs }
}

// 5. 角色导演审查节点
async function reviewByCharacterDirector(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🎭 [角色导演Agent] 正在检查角色一致性...')

  const charData = state.context.characters || '暂无角色数据'

  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(CHARACTER_DIRECTOR_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的角色一致性：\n\n章节内容：\n${state.draft}\n\n角色数据：\n${charData}`),
  ])

  const review = parseJsonFromLLM(response.content as string)
  const issues = review?.ooc_issues || []
  const criticalCount = issues.filter((i: any) => i.severity === 'critical').length
  logs.push(`📊 [角色导演Agent] 检查完成，${issues.length}个OOC问题（${criticalCount}个阻断）`)

  return { characterReview: review, logs }
}

// 5.5 风格守卫审查节点
async function reviewByStyleGuard(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🎨 [风格守卫Agent] 正在检查文风一致性...')

  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(STYLE_GUARD_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的文风一致性：\n\n${state.draft}`),
  ])

  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [风格守卫Agent] 检查完成，AI痕迹${review?.ai_patterns_detected?.length || 0}处`)

  return { styleGuardReview: review, logs }
}

// 5.6 伏笔审查节点
async function reviewByForeshadow(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('📌 [伏笔Agent] 正在检查伏笔埋设/回收...')

  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(FORESHADOW_AGENT_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的伏笔情况：\n\n章节内容：\n${state.draft}\n\n到期伏笔：\n${state.context.overdueForeshadows || '无'}`),
  ])

  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [伏笔Agent] 检查完成，回收${review?.foreshadows_harvested?.length || 0}个，新埋${review?.foreshadows_planted?.length || 0}个`)

  return { foreshadowReview: review, logs }
}

// 5.7 战力审查节点
async function reviewByPowerSystem(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('⚔️ [战力Agent] 正在检查战力体系...')

  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(POWER_SYSTEM_AGENT_PROMPT),
    new HumanMessage(`请检查以下章节的战力体系：\n\n章节内容：\n${state.draft}\n\n角色数据：\n${state.context.characters || '暂无'}`),
  ])

  const review = parseJsonFromLLM(response.content as string)
  const violations = review?.power_violations || []
  logs.push(`📊 [战力Agent] 检查完成，${violations.length}个战力违规`)

  return { powerSystemReview: review, logs }
}

// 6. 总导演审查节点
async function reviewByDirectorNode(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🎬 [总导演Agent] 正在审查核心卖点对齐...')

  const soul = state.context.soul || {}
  const directorResult = await reviewByDirector(state.draft, {
    coreSellingPoints: soul.core_selling_points || [],
    forbiddenDirections: soul.forbidden_directions || [],
    tone: soul.tone || '',
    readerPromise: soul.reader_promise || '',
    chapter: state.chapter,
    title: state.context.title || '',
  })

  const verdictEmoji = directorResult.verdict === 'approved' ? '✅' : directorResult.verdict === 'rejected' ? '❌' : '⚠️'
  logs.push(`${verdictEmoji} [总导演Agent] 审查完成: ${directorResult.verdict} (对齐度${directorResult.score}分)`)

  if (directorResult.revisionDirective) {
    logs.push(`📋 [总导演Agent] 修改指令: ${directorResult.revisionDirective}`)
  }

  return { directorReview: directorResult, logs }
}

// 7. 汇总判断节点
async function synthesizeReviews(state: State): Promise<Partial<State>> {
  const logs: string[] = []

  const readerScore = state.readerReview?.overall_score || 0
  const editorScores = state.editorReview?.editorial_scores
  const logicIssues = state.logicReview?.issues || []
  const characterIssues = state.characterReview?.ooc_issues || []
  const directorReview = state.directorReview

  // 总导演否决权
  const directorApproved = directorReview?.verdict === 'approved'
  const directorConditional = directorReview?.verdict === 'conditional'

  // 质量门禁
  const qualityApproved = calculatePassGrade(readerScore, editorScores, logicIssues, characterIssues)

  // 最终判断：质量通过 + 总导演通过（或有条件通过）
  const isApproved = qualityApproved && (directorApproved || directorConditional)

  const allScores = {
    reader: state.readerReview,
    editor: state.editorReview,
    logic: state.logicReview,
    character: state.characterReview,
    styleGuard: state.styleGuardReview,
    foreshadow: state.foreshadowReview,
    powerSystem: state.powerSystemReview,
    director: directorReview,
    readerScore,
    editorAvg: editorScores ? Math.round((editorScores.pacing + editorScores.commercial_value + editorScores.character_development + editorScores.chapter_structure) / 4) : 0,
    logicIssueCount: logicIssues.length,
    criticalLogicIssues: logicIssues.filter((i: any) => i.severity === 'critical').length,
    characterOocCount: characterIssues.length,
    criticalOocIssues: characterIssues.filter((i: any) => i.severity === 'critical').length,
    directorScore: directorReview?.score || 0,
    directorVerdict: directorReview?.verdict || 'unknown',
    revisionFeedback: {
      reader: state.readerReview?.problems || [],
      editor: state.editorReview?.issues?.map((i: any) => i.description) || [],
      logic: logicIssues.map((i: any) => `${i.description} - ${i.fix_hint}`),
      character: characterIssues.map((i: any) => `${i.character}: ${i.description} - ${i.fix_hint}`),
      director: directorReview?.revisionDirective ? [directorReview.revisionDirective] : [],
    }
  }

  if (isApproved) {
    logs.push(`✅ [汇总] 章节通过质量门禁！读者:${readerScore}分，编辑:${allScores.editorAvg}分，总导演:${directorReview?.verdict}`)
    return { finalDraft: state.draft, allScores, isApproved: true, status: 'approved', logs }
  } else {
    const reason = []
    if (readerScore < 70) reason.push(`读者评分${readerScore}<70`)
    if (allScores.editorAvg < 65) reason.push(`编辑均分${allScores.editorAvg}<65`)
    if (allScores.criticalLogicIssues > 0) reason.push(`${allScores.criticalLogicIssues}个逻辑阻断`)
    if (allScores.criticalOocIssues > 0) reason.push(`${allScores.criticalOocIssues}个角色阻断`)
    if (!directorApproved) reason.push(`总导演:${directorReview?.verdict || '未审查'}`)

    logs.push(`❌ [汇总] 未通过（${reason.join('；')}），需要修改`)

    if (state.revisionCount >= state.maxRevisions) {
      logs.push(`⚠️ [汇总] 已达最大修改次数(${state.maxRevisions})，以当前版本输出`)
      return { finalDraft: state.draft, allScores, isApproved: false, status: 'max_revisions_reached', logs }
    }

    return { allScores, isApproved: false, status: 'needs_revision', logs }
  }
}

// ========== 路由函数 ==========
function reviewDecision(state: State): string {
  if (state.isApproved) return 'finalize'
  if (state.status === 'max_revisions_reached') return 'finalize'
  if (state.revisionCount >= state.maxRevisions) return 'finalize'
  return 'revise'
}

// ========== 构建图 ==========
function buildChapterWorkflow() {
  const workflow = new StateGraph(ChapterState)
    // 节点
    .addNode('write', writeChapter)
    .addNode('reviewReader', reviewByReader)
    .addNode('reviewEditor', reviewByEditor)
    .addNode('reviewLogic', reviewByLogic)
    .addNode('reviewCharacter', reviewByCharacterDirector)
    .addNode('reviewStyle', reviewByStyleGuard)
    .addNode('reviewForeshadow', reviewByForeshadow)
    .addNode('reviewPower', reviewByPowerSystem)
    .addNode('reviewDirector', reviewByDirectorNode)
    .addNode('synthesize', synthesizeReviews)

    // 边：写→读者→编辑→逻辑→角色→风格→伏笔→战力→总导演→汇总
    .addEdge(START, 'write')
    .addEdge('write', 'reviewReader')
    .addEdge('reviewReader', 'reviewEditor')
    .addEdge('reviewEditor', 'reviewLogic')
    .addEdge('reviewLogic', 'reviewCharacter')
    .addEdge('reviewCharacter', 'reviewStyle')
    .addEdge('reviewStyle', 'reviewForeshadow')
    .addEdge('reviewForeshadow', 'reviewPower')
    .addEdge('reviewPower', 'reviewDirector')
    .addEdge('reviewDirector', 'synthesize')

    // 条件边：汇总后决定是修改还是完成
    .addConditionalEdges('synthesize', reviewDecision, {
      revise: 'write',
      finalize: END,
    })

  return workflow.compile()
}

// ========== 导出函数 ==========
export async function runChapterWorkflow(
  novelId: string,
  chapter: number,
  context: any,
  onLog?: (log: string) => void,
  aiSettings?: { provider?: string; apiKey?: string; baseUrl?: string; model?: string }
) {
  // 一次性设置 AI 配置（避免并发请求竞态）
  if (aiSettings) {
    if (aiSettings.provider) process.env.AI_PROVIDER = aiSettings.provider
    if (aiSettings.apiKey) {
      process.env.AI_API_KEY = aiSettings.apiKey
      process.env[`${aiSettings.provider?.toUpperCase()}_API_KEY`] = aiSettings.apiKey
    }
    if (aiSettings.baseUrl) {
      process.env.AI_BASE_URL = aiSettings.baseUrl
      process.env[`${aiSettings.provider?.toUpperCase()}_BASE_URL`] = aiSettings.baseUrl
    }
    if (aiSettings.model) {
      process.env.AI_MODEL = aiSettings.model
      process.env[`${aiSettings.provider?.toUpperCase()}_MODEL`] = aiSettings.model
    }
  }
  const graph = buildChapterWorkflow()

  const initialState: Partial<State> = {
    novelId,
    chapter,
    context,
    draft: '',
    revisionCount: 0,
    maxRevisions: 3,
    readerReview: null,
    editorReview: null,
    logicReview: null,
    characterReview: null,
    styleGuardReview: null,
    foreshadowReview: null,
    powerSystemReview: null,
    finalDraft: '',
    allScores: {},
    isApproved: false,
    status: '',
    logs: [],
  }

  // 使用 stream 模式获取实时进度
  const stream = await graph.stream(initialState, { streamMode: 'updates' })

  let finalState: any = null

  for await (const chunk of stream) {
    // chunk 是一个对象，key 是节点名，value 是该节点的输出
    for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
      const output = nodeOutput as any
      if (output.logs) {
        for (const log of output.logs) {
          onLog?.(log)
        }
      }
      finalState = { ...finalState, ...output }
    }
  }

  return {
    draft: finalState?.finalDraft || finalState?.draft || '',
    scores: finalState?.allScores || {},
    isApproved: finalState?.isApproved || false,
    status: finalState?.status || 'unknown',
    revisionCount: finalState?.revisionCount || 0,
    logs: finalState?.logs || [],
  }
}

export { ChapterState }
export type { State as ChapterStateType }
