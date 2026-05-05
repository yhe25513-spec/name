import { AIResponse, ConversationMessage, GameScenario, GameState } from './types'

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

function buildSystemPrompt(scenario: GameScenario, state: GameState): string {
  return `你是一个文字冒险游戏的GM（游戏主持人）。

【世界观】
${scenario.system_prompt}

【当前玩家状态】
- 生命值: ${state.hp}/${state.maxHp}
- 位置: ${state.location || '未知'}
- 背包: ${state.inventory.length > 0 ? state.inventory.join('、') : '空'}
- 属性: ${Object.entries(state.attributes).map(([k, v]) => `${k}:${v}`).join('、') || '无'}

【游戏规则】
1. 用第二人称"你"描述剧情，沉浸感优先
2. 每次回复200-400字剧情描述
3. 提供3-4个有意义的选项，反映真实的情境选择
4. 合理处理状态变化（HP、物品、标记）
5. 保持叙事连贯性和世界观一致性

【重要】每次必须严格返回以下JSON格式，不要有任何其他文字：
{
  "narration": "剧情描述文字",
  "options": ["选项1", "选项2", "选项3"],
  "stateChanges": {
    "hp": HP变化数值或null,
    "addItems": ["新增物品名称"],
    "removeItems": ["移除物品名称"],
    "setFlags": {}
  },
  "atmosphereHint": "danger或normal或mystery或triumph"
}`
}

export async function streamGameChat(
  userInput: string,
  scenario: GameScenario,
  state: GameState,
  history: ConversationMessage[],
  apiKey: string,
  model = 'deepseek-chat',
  temperature = 0.8,
  maxTokens = 1024
): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = buildSystemPrompt(scenario, state)

  // 保留最近 20 条对话（约 10 个回合）
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userInput },
  ]

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
  }

  return response.body!
}

export function parseAIResponse(text: string): AIResponse {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      narration: text,
      options: ['继续...'],
      stateChanges: { addItems: [], removeItems: [], setFlags: {} },
      atmosphereHint: 'normal',
    }
  }
  try {
    return JSON.parse(jsonMatch[0]) as AIResponse
  } catch {
    return {
      narration: text,
      options: ['继续...'],
      stateChanges: { addItems: [], removeItems: [], setFlags: {} },
      atmosphereHint: 'normal',
    }
  }
}

export function applyStateChanges(
  state: GameState,
  changes: AIResponse['stateChanges']
): GameState {
  const newState = { ...state }
  if (changes.hp !== null && changes.hp !== undefined) {
    newState.hp = Math.max(0, Math.min(state.maxHp, state.hp + changes.hp))
  }
  if (changes.addItems?.length) {
    newState.inventory = [...state.inventory, ...changes.addItems]
  }
  if (changes.removeItems?.length) {
    newState.inventory = state.inventory.filter(
      (item) => !changes.removeItems!.includes(item)
    )
  }
  if (changes.setFlags && Object.keys(changes.setFlags).length > 0) {
    newState.flags = { ...state.flags, ...changes.setFlags }
  }
  return newState
}
