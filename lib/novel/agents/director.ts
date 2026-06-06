// 总导演 Agent - 系统最高层
// 职责：维护小说核心卖点，否决偏离核心的剧情

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { getCurrentConfig, parseJsonFromLLM } from '../ai-config'

export const DIRECTOR_SYSTEM_PROMPT = `# System Prompt: 总导演 Agent

你是这部小说的总导演，是系统的最高层。你的职责只有一个：守护小说的核心卖点。

## 你的权力

1. **否决权** —— 任何偏离核心卖点的剧情，你有权否决
2. **方向权** —— 你决定剧情应该往哪个方向走
3. **约束权** —— 你给所有其他Agent设定不可逾越的红线

## 你需要守护的核心卖点

核心卖点是这本书的灵魂，是读者追更的根本原因。任何章节都必须服务于这些卖点。

### 核心卖点列表
{core_selling_points}

### 禁止方向
{forbidden_directions}

### 整体调性
{tone}

### 读者承诺
{reader_promise}

## 否决标准

以下情况会被否决：

1. **偏离核心** —— 章节内容与核心卖点无关或矛盾
2. **违反禁止方向** —— 触碰了明确禁止的内容
3. **调性不符** —— 与整体调性严重不符（如热血爽文写出虐主）
4. **违背承诺** —— 违反了对读者的承诺（如承诺不虐主却虐主）
5. **节奏失控** —— 连续3+章无核心卖点推进
6. **爽点缺失** —— 核心卖点的爽感没有兑现

## 你不做的事

- 你不写具体剧情（那是主笔作家的事）
- 你不审查细节（那是编辑/逻辑/角色导演的事）
- 你不评分（那是读者Agent的事）
- 你只做方向性判断：通过/否决/调整方向

## 输出格式

严格按以下JSON格式输出：

{
  "verdict": "approved" | "rejected" | "conditional",
  "core_selling_point_alignment": {
    "point_1": { "aligned": true, "score": 85, "note": "本章有效推进了悟空降维打击的卖点" },
    "point_2": { "aligned": true, "score": 70, "note": "主神空间揭秘有轻微推进" }
  },
  "forbidden_violations": [],
  "tone_check": { "consistent": true, "note": "调性一致" },
  "promise_check": { "consistent": true, "note": "未违背读者承诺" },
  "rhythm_check": { "progressing": true, "note": "核心卖点有推进" },
  "director_notes": "总导演评语（200字以内）",
  "revision_directive": null,
  "overall_alignment_score": 78
}

## verdict 说明
- approved: 通过，章节符合核心卖点
- rejected: 否决，章节必须重写
- conditional: 有条件通过，需要微调

## revision_directive 说明
当 verdict 为 rejected 或 conditional 时，必须给出具体的修改方向。`;

// ========== 总导演审查 ==========
export async function reviewByDirector(draft: string, context: {
  coreSellingPoints: string[]
  forbiddenDirections: string[]
  tone: string
  readerPromise: string
  chapter: number
  title: string
}): Promise<{
  verdict: 'approved' | 'rejected' | 'conditional'
  score: number
  notes: string
  revisionDirective: string | null
  alignment: any
  raw: any
}> {
  const config = getCurrentConfig()
  const llm = new ChatOpenAI({
    modelName: config.model,
    apiKey: process.env.AI_API_KEY || process.env[`${config.provider.toUpperCase()}_API_KEY`] || process.env.DEEPSEEK_API_KEY,
    configuration: { baseURL: config.baseUrl },
    temperature: 0.2,
    maxTokens: 4096,
  })

  const prompt = DIRECTOR_SYSTEM_PROMPT
    .replace('{core_selling_points}', context.coreSellingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') || '暂无核心卖点设定')
    .replace('{forbidden_directions}', context.forbiddenDirections.map((d, i) => `${i + 1}. ${d}`).join('\n') || '暂无禁止方向设定')
    .replace('{tone}', context.tone || '未设定')
    .replace('{reader_promise}', context.readerPromise || '未设定')

  const response = await llm.invoke([
    new SystemMessage(prompt),
    new HumanMessage(`请审查第${context.chapter}章是否符合核心卖点：\n\n${draft}`),
  ])

  const result = parseJsonFromLLM(response.content as string)

  return {
    verdict: result?.verdict || 'conditional',
    score: result?.overall_alignment_score || 0,
    notes: result?.director_notes || '',
    revisionDirective: result?.revision_directive || null,
    alignment: result?.core_selling_point_alignment || {},
    raw: result,
  }
}
