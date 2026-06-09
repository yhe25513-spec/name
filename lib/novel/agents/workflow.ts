// LangGraph 工作流 - 小说章节创作流水线
// 改进版：并行审查 + 结构化反馈 + 灵魂前置检查

import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { WRITER_SYSTEM_PROMPT, buildWriterPrompt } from './writer'
import { READER_SYSTEM_PROMPT, EDITOR_SYSTEM_PROMPT, LOGIC_SYSTEM_PROMPT, CHARACTER_DIRECTOR_SYSTEM_PROMPT } from './reviewers'
import { reviewByDirector } from './director'
import { generateStateSnapshot, formatStateForAgents, checkMysteryConstraints } from './state-machine'
import { parseJsonFromLLM } from '../ai-config'
import { STYLE_GUARD_SYSTEM_PROMPT, FORESHADOW_AGENT_SYSTEM_PROMPT, POWER_SYSTEM_AGENT_PROMPT, IP_DIRECTOR_SYSTEM_PROMPT } from './missing-agents'
import { detectAiTells, getAiTellScore, formatAiTellReport } from './ai-tells'
import { analyzeStyle, formatStyleReport, profileToStyleConfig } from './style-analyzer'

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

  // 前置检查
  preCheckResult: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),

  // 审查结果（并行写入，互不干扰）
  readerReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  editorReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  logicReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  characterReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  styleGuardReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  foreshadowReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  powerSystemReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  aiTellsResult: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  directorReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),

  // 最终结果
  finalDraft: Annotation<string>({ reducer: (_, prev) => prev, default: () => '' }),
  allScores: Annotation<any>({ reducer: (_, prev) => prev, default: () => ({}) }),
  isApproved: Annotation<boolean>({ reducer: (_, prev) => prev, default: () => false }),
  status: Annotation<string>({ reducer: (_, prev) => prev, default: () => '' }),
  styleConfig: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),

  // 流式输出用
  logs: Annotation<string[]>({
    reducer: (curr, prev) => curr.concat(prev),
    default: () => [],
  }),
})

type State = typeof ChapterState.State

// ========== 工具函数 ==========
function calculatePassGrade(readerScore: number, editorScores: any, logicIssues: any[], characterIssues: any[], aiTellsResult?: any): boolean {
  if (readerScore < 70) return false
  if (editorScores) {
    const avg = (editorScores.pacing + editorScores.commercial_value + editorScores.character_development + editorScores.chapter_structure) / 4
    if (avg < 65) return false
  }
  if (logicIssues?.some((i: any) => i.severity === 'critical' && i.blocking)) return false
  if (characterIssues?.some((i: any) => i.severity === 'critical' && i.blocking)) return false
  // AI痕迹：critical级别超过3个则不通过
  if (aiTellsResult?.tells?.filter((t: any) => t.severity === 'critical').length > 3) return false
  return true
}

// 从所有审查结果中提取结构化修改清单
function buildStructuredFeedback(state: State): string {
  const parts: string[] = []
  let itemNum = 1

  // 读者反馈
  const readerProblems = state.readerReview?.problems || []
  for (const p of readerProblems) {
    parts.push(`${itemNum}. [读者] ${typeof p === 'string' ? p : p.description || JSON.stringify(p)}`)
    itemNum++
  }

  // 编辑反馈
  const editorIssues = state.editorReview?.issues || []
  for (const issue of editorIssues) {
    parts.push(`${itemNum}. [编辑] ${issue.description || ''} → ${issue.fix_hint || '请修改'}`)
    itemNum++
  }

  // 逻辑问题
  const logicIssues = state.logicReview?.issues || []
  for (const issue of logicIssues) {
    const severity = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟡' : ''
    parts.push(`${itemNum}. ${severity}[逻辑] ${issue.description || ''} → ${issue.fix_hint || '请修改'}`)
    itemNum++
  }

  // 角色 OOC
  const charIssues = state.characterReview?.ooc_issues || []
  for (const issue of charIssues) {
    const severity = issue.severity === 'critical' ? '🔴' : ''
    parts.push(`${itemNum}. ${severity}[角色] ${issue.character || ''}: ${issue.description || ''} → ${issue.fix_hint || '请修改'}`)
    itemNum++
  }

  // 风格问题
  const styleDeviations = state.styleGuardReview?.deviations || []
  for (const d of styleDeviations) {
    parts.push(`${itemNum}. [风格] ${d.description || ''}`)
    itemNum++
  }
  const aiPatterns = state.styleGuardReview?.ai_patterns_detected || []
  for (const p of aiPatterns) {
    parts.push(`${itemNum}. [AI痕迹] ${p.pattern || ''} 位置:${p.location || ''} → ${p.fix || '删除'}`)
    itemNum++
  }

  // 战力违规
  const powerViolations = state.powerSystemReview?.power_violations || []
  for (const v of powerViolations) {
    parts.push(`${itemNum}. [战力] ${v.character} 使用了 ${v.used_ability}（需要${v.required_realm}境界）`)
    itemNum++
  }

  // AI 痕迹
  const aiTells = (state.aiTellsResult?.tells || []).slice(0, 10)
  for (const t of aiTells) {
    const sev = t.severity === 'critical' ? '🔴' : t.severity === 'high' ? '🟡' : ''
    parts.push(`${itemNum}. ${sev}[AI痕迹] ${t.location} "${t.pattern}" → ${t.fix}`)
    itemNum++
  }

  // 总导演指令
  if (state.directorReview?.revisionDirective) {
    parts.push(`${itemNum}. [总导演] ${state.directorReview.revisionDirective}`)
    itemNum++
  }

  return parts.length > 0
    ? `请按以下清单逐项修改：\n${parts.join('\n')}`
    : '请根据审查意见微调章节。'
}

// ========== 节点函数 ==========

// 0. 灵魂前置检查（写前）
async function preCheck(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🔍 [前置检查] 检查大纲是否符合核心卖点...')

  const soul = state.context.soul || {}
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') {
    logs.push('⏭️ [前置检查] 跳过（无 API Key）')
    return { preCheckResult: { passed: true }, logs }
  }

  try {
    const llm = getReviewerLLM()
    const outlineInfo = state.context.chapterOutline
      ? `大纲: ${JSON.stringify(state.context.chapterOutline)}`
      : `章节: 第${state.chapter}章, 大纲: ${state.context.outline || '无'}`
    const soulInfo = `核心卖点: ${(soul.core_selling_points || []).join('、')}\n禁止方向: ${(soul.forbidden_directions || []).join('、')}\n调性: ${soul.tone || '未设定'}`

    const response = await llm.invoke([
      new SystemMessage(IP_DIRECTOR_SYSTEM_PROMPT),
      new HumanMessage(`请检查以下章节大纲是否符合小说灵魂：\n\n${soulInfo}\n\n${outlineInfo}`),
    ])

    const result = parseJsonFromLLM(response.content as string)
    if (result?.verdict === 'rejected') {
      logs.push(`❌ [前置检查] 大纲偏离核心卖点: ${result.revision_directive || '请调整大纲'}`)
      return { preCheckResult: { passed: false, directive: result.revision_directive }, logs }
    }
    logs.push(`✅ [前置检查] 大纲通过 (${result?.verdict || 'approved'})`)
    return { preCheckResult: { passed: true, result }, logs }
  } catch (e: any) {
    logs.push(`⚠️ [前置检查] 跳过: ${e.message}`)
    return { preCheckResult: { passed: true }, logs }
  }
}

// 1. 主笔写作节点
async function writeChapter(state: State): Promise<Partial<State>> {
  const logs: string[] = []

  // 构建修改指令（结构化）
  let revisionNote = ''
  if (state.revisionCount > 0) {
    const feedback = buildStructuredFeedback(state)
    revisionNote = `\n\n【修改要求】上一版被审查驳回（第${state.revisionCount}次），请逐项修改：\n${feedback}`
  }

  const prompt = buildWriterPrompt(state.context) + revisionNote

  logs.push(`✍️ [主笔作家] 开始写作第${state.chapter}章${state.revisionCount > 0 ? `（第${state.revisionCount + 1}次修改，共${buildStructuredFeedback(state).split('\n').filter(l => l.match(/^\d/)).length}项待改）` : ''}...`)

  const llm = getWriterLLM()
  const response = await llm.invoke([
    new SystemMessage(WRITER_SYSTEM_PROMPT),
    new HumanMessage(prompt),
  ])

  const draft = response.content as string
  logs.push(`✅ [主笔作家] 完成，${draft.length}字`)

  return { draft, revisionCount: state.revisionCount + 1, logs }
}

// ========== 审查节点（独立函数，并行执行） ==========

async function reviewByReader(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('📖 [读者Agent] 评估中...')
  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(READER_SYSTEM_PROMPT),
    new HumanMessage(`请评估以下网文章节：\n\n${state.draft}`),
  ])
  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [读者Agent] 总分: ${review?.overall_score || '未知'}`)
  return { readerReview: review, logs }
}

async function reviewByEditor(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('📝 [编辑Agent] 审查中...')
  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(EDITOR_SYSTEM_PROMPT),
    new HumanMessage(`请审查以下网文章节：\n\n${state.draft}`),
  ])
  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [编辑Agent] 审查完成`)
  return { editorReview: review, logs }
}

async function reviewByLogic(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🔍 [逻辑Agent] 检查中...')
  const contextStr = JSON.stringify({
    characters: state.context.characters,
    worldSetting: state.context.worldSetting,
    previousSummary: state.context.previousSummary?.slice(-500),
  }, null, 2)
  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(LOGIC_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的一致性：\n\n章节内容：\n${state.draft}\n\n参考数据：\n${contextStr}`),
  ])
  const review = parseJsonFromLLM(response.content as string)
  const issues = review?.issues || []
  const critical = issues.filter((i: any) => i.severity === 'critical').length
  logs.push(`📊 [逻辑Agent] ${issues.length}个问题（${critical}个阻断）`)
  return { logicReview: review, logs }
}

async function reviewByCharacterDirector(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🎭 [角色导演] 检查中...')
  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(CHARACTER_DIRECTOR_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的角色一致性：\n\n章节内容：\n${state.draft}\n\n角色数据：\n${state.context.characters || '暂无'}`),
  ])
  const review = parseJsonFromLLM(response.content as string)
  const issues = review?.ooc_issues || []
  const critical = issues.filter((i: any) => i.severity === 'critical').length
  logs.push(`📊 [角色导演] ${issues.length}个OOC（${critical}个阻断）`)
  return { characterReview: review, logs }
}

async function reviewByStyleGuard(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🎨 [风格守卫] 检查中...')
  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(STYLE_GUARD_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的文风一致性：\n\n${state.draft}`),
  ])
  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [风格守卫] AI痕迹${review?.ai_patterns_detected?.length || 0}处`)
  return { styleGuardReview: review, logs }
}

async function reviewByForeshadow(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('📌 [伏笔Agent] 检查中...')
  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(FORESHADOW_AGENT_SYSTEM_PROMPT),
    new HumanMessage(`请检查以下章节的伏笔情况：\n\n章节内容：\n${state.draft}\n\n到期伏笔：\n${state.context.overdueForeshadows || '无'}`),
  ])
  const review = parseJsonFromLLM(response.content as string)
  logs.push(`📊 [伏笔Agent] 回收${review?.foreshadows_harvested?.length || 0}个，新埋${review?.foreshadows_planted?.length || 0}个`)
  return { foreshadowReview: review, logs }
}

async function reviewByPowerSystem(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('⚔️ [战力Agent] 检查中...')
  const llm = getReviewerLLM()
  const response = await llm.invoke([
    new SystemMessage(POWER_SYSTEM_AGENT_PROMPT),
    new HumanMessage(`请检查以下章节的战力体系：\n\n章节内容：\n${state.draft}\n\n角色数据：\n${state.context.characters || '暂无'}`),
  ])
  const review = parseJsonFromLLM(response.content as string)
  const violations = review?.power_violations || []
  logs.push(`📊 [战力Agent] ${violations.length}个违规`)
  return { powerSystemReview: review, logs }
}

// AI 痕迹检测（本地规则，不调用 LLM）
function reviewByAiTells(state: State): Partial<State> {
  const tells = detectAiTells(state.draft)
  const score = getAiTellScore(tells)
  const critical = tells.filter(t => t.severity === 'critical').length
  const high = tells.filter(t => t.severity === 'high').length
  const logs: string[] = []
  logs.push(`🤖 [AI痕迹] 检测到${tells.length}处（🔴${critical} 🟡${high}），评分${score}/100`)
  return { aiTellsResult: { tells, score, report: formatAiTellReport(tells) }, logs }
}

// 6. 总导演审查（并行审查完成后）
async function reviewByDirectorNode(state: State): Promise<Partial<State>> {
  const logs: string[] = []
  logs.push('🎬 [总导演] 审查核心卖点对齐...')
  const soul = state.context.soul || {}
  const directorResult = await reviewByDirector(state.draft, {
    coreSellingPoints: soul.core_selling_points || [],
    forbiddenDirections: soul.forbidden_directions || [],
    tone: soul.tone || '',
    readerPromise: soul.reader_promise || '',
    chapter: state.chapter,
    title: state.context.title || '',
  })
  const emoji = directorResult.verdict === 'approved' ? '✅' : directorResult.verdict === 'rejected' ? '❌' : '⚠️'
  logs.push(`${emoji} [总导演] ${directorResult.verdict} (对齐度${directorResult.score}分)`)
  if (directorResult.revisionDirective) {
    logs.push(`📋 [总导演] ${directorResult.revisionDirective}`)
  }
  return { directorReview: directorResult, logs }
}

// 7. 汇总判断 + 结构化反馈
async function synthesizeReviews(state: State): Promise<Partial<State>> {
  const logs: string[] = []

  const readerScore = state.readerReview?.overall_score || 0
  const editorScores = state.editorReview?.editorial_scores
  const logicIssues = state.logicReview?.issues || []
  const characterIssues = state.characterReview?.ooc_issues || []
  const directorReview = state.directorReview

  const directorApproved = directorReview?.verdict === 'approved'
  const directorConditional = directorReview?.verdict === 'conditional'
  const qualityApproved = calculatePassGrade(readerScore, editorScores, logicIssues, characterIssues, state.aiTellsResult)
  const isApproved = qualityApproved && (directorApproved || directorConditional)

  // 构建结构化修改清单
  const structuredFeedback = buildStructuredFeedback(state)

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
    // 结构化反馈：每个 Agent 的具体修改建议
    structuredFeedback,
    revisionFeedback: {
      reader: state.readerReview?.problems || [],
      editor: state.editorReview?.issues?.map((i: any) => `[${i.severity || 'medium'}] ${i.description} → ${i.fix_hint || ''}`) || [],
      logic: logicIssues.map((i: any) => `[${i.severity}] ${i.description} → ${i.fix_hint || ''}`),
      character: characterIssues.map((i: any) => `[${i.severity}] ${i.character}: ${i.description} → ${i.fix_hint || ''}`),
      style: (state.styleGuardReview?.deviations || []).map((d: any) => d.description),
      aiPatterns: (state.styleGuardReview?.ai_patterns_detected || []).map((p: any) => `${p.pattern} @${p.location} → ${p.fix}`),
      power: (state.powerSystemReview?.power_violations || []).map((v: any) => `${v.character} 使用 ${v.used_ability}`),
      aiTells: (state.aiTellsResult?.tells || []).slice(0, 10).map((t: any) => `[${t.severity}] ${t.location} "${t.pattern}" → ${t.fix}`),
      director: directorReview?.revisionDirective ? [directorReview.revisionDirective] : [],
    }
  }

  if (isApproved) {
    // 自动分析文风并保存
    const styleProfile = analyzeStyle(state.draft)
    const styleReport = formatStyleReport(styleProfile)
    logs.push(`✅ [汇总] 通过！读者:${readerScore} 编辑:${allScores.editorAvg} 总导演:${directorReview?.verdict}`)
    logs.push(`📊 [文风] ${styleReport.split('\n')[0]}`)

    return {
      finalDraft: state.draft,
      allScores: { ...allScores, styleProfile, styleReport },
      isApproved: true,
      status: 'approved',
      logs,
      styleConfig: profileToStyleConfig(styleProfile, state.context.genre || ''),
    }
  } else {
    const reasons: string[] = []
    if (readerScore < 70) reasons.push(`读者${readerScore}<70`)
    if (allScores.editorAvg < 65) reasons.push(`编辑${allScores.editorAvg}<65`)
    if (allScores.criticalLogicIssues > 0) reasons.push(`${allScores.criticalLogicIssues}逻辑阻断`)
    if (allScores.criticalOocIssues > 0) reasons.push(`${allScores.criticalOocIssues}角色阻断`)
    const aiTellCritical = state.aiTellsResult?.tells?.filter((t: any) => t.severity === 'critical').length || 0
    if (aiTellCritical > 3) reasons.push(`${aiTellCritical}处AI痕迹(critical>3)`)
    if (!directorApproved) reasons.push(`总导演:${directorReview?.verdict}`)

    logs.push(`❌ [汇总] 未通过（${reasons.join('；')}）→ ${structuredFeedback.split('\n').filter(l => l.match(/^\d/)).length}项待改`)

    if (state.revisionCount >= state.maxRevisions) {
      logs.push(`⚠️ [汇总] 达到上限(${state.maxRevisions}次)，以当前版本输出`)
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

function preCheckDecision(state: State): string {
  if (state.preCheckResult?.passed === false) return 'reject'
  return 'proceed'
}

// ========== 构建图 ==========
function buildChapterWorkflow() {
  const workflow = new StateGraph(ChapterState)

    // 节点
    .addNode('preCheck', preCheck)
    .addNode('write', writeChapter)
    .addNode('reviewReader', reviewByReader)
    .addNode('reviewEditor', reviewByEditor)
    .addNode('reviewLogic', reviewByLogic)
    .addNode('reviewCharacter', reviewByCharacterDirector)
    .addNode('reviewStyle', reviewByStyleGuard)
    .addNode('reviewForeshadow', reviewByForeshadow)
    .addNode('reviewPower', reviewByPowerSystem)
    .addNode('reviewAiTells', reviewByAiTells)
    .addNode('reviewDirector', reviewByDirectorNode)
    .addNode('synthesize', synthesizeReviews)

    // 开始 → 前置检查
    .addEdge(START, 'preCheck')

    // 前置检查 → 通过则写作，否则结束
    .addConditionalEdges('preCheck', preCheckDecision, {
      proceed: 'write',
      reject: END,
    })

    // 写作 → 7个审查 Agent 并行（LangGraph 自动并行执行）
    .addEdge('write', 'reviewReader')
    .addEdge('write', 'reviewEditor')
    .addEdge('write', 'reviewLogic')
    .addEdge('write', 'reviewCharacter')
    .addEdge('write', 'reviewStyle')
    .addEdge('write', 'reviewForeshadow')
    .addEdge('write', 'reviewPower')
    .addEdge('write', 'reviewAiTells')

    // 8个审查 Agent → 总导演（等所有审查完成后）
    .addEdge('reviewReader', 'reviewDirector')
    .addEdge('reviewEditor', 'reviewDirector')
    .addEdge('reviewLogic', 'reviewDirector')
    .addEdge('reviewCharacter', 'reviewDirector')
    .addEdge('reviewStyle', 'reviewDirector')
    .addEdge('reviewForeshadow', 'reviewDirector')
    .addEdge('reviewPower', 'reviewDirector')
    .addEdge('reviewAiTells', 'reviewDirector')

    // 总导演 → 汇总
    .addEdge('reviewDirector', 'synthesize')

    // 汇总 → 修改或完成
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
    novelId, chapter, context,
    draft: '', revisionCount: 0, maxRevisions: 3,
    preCheckResult: null,
    readerReview: null, editorReview: null, logicReview: null,
    characterReview: null, styleGuardReview: null,
    foreshadowReview: null, powerSystemReview: null, aiTellsResult: null,
    directorReview: null,
    finalDraft: '', allScores: {}, isApproved: false, status: '',
    logs: [],
  }

  const stream = await graph.stream(initialState, { streamMode: 'updates' })

  let finalState: any = null

  for await (const chunk of stream) {
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
    styleConfig: finalState?.styleConfig || null,
  }
}

export { ChapterState }
export type { State as ChapterStateType }
