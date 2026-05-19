import { AIResponse, ConversationMessage, GameScenario, GameState } from './types'

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

function buildSystemPrompt(scenario: GameScenario, state: GameState): string {
  const memorySummary = state.flags?.memorySummary as string | undefined
  const visitedLocations = state.flags?.visitedLocations as string[] | undefined
  const locationHistory = Array.isArray(visitedLocations) ? visitedLocations.join(' → ') : ''

  return `你是一个文字冒险游戏的GM（游戏主持人）。

【世界观】
${scenario.system_prompt}

【当前玩家状态】
- 生命值: ${state.hp}/${state.maxHp}
- 位置: ${state.location || '未知'}
- 境界: ${state.realm || '凡人'}
- 背包: ${state.inventory.length > 0 ? state.inventory.join('、') : '空'}
- 属性: ${Object.entries(state.attributes).map(([k, v]) => `${k}:${v}`).join('、') || '无'}
${locationHistory ? `- 已探索: ${locationHistory}` : ''}

${memorySummary ? `【长期记忆】\n${memorySummary}\n` : ''}

【游戏规则】
1. 用第二人称"你"描述剧情，沉浸感优先
2. 每次回复200-400字剧情描述
3. 提供3-4个有意义的选项，反映真实的情境选择
4. 合理处理状态变化（HP、物品、标记）
5. 保持叙事连贯性和世界观一致性

【记忆管理】
1. 在 setFlags 中使用 memorySummary 字段记录关键剧情节点（每5回合左右更新一次）
2. 每次玩家到达新地点时，在 setFlags 的 visitedLocations 数组（字符串数组）中添加当前 location
3. memorySummary 保持在100字以内，只记录最重要的剧情进展

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
  // 注意: history 已包含用户输入的最新消息, 不需要再追加 userInput
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
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

/** 从文本中提取第一个最外层 JSON 对象（支持嵌套大括号和 markdown code block） */
function extractJSON(text: string): string | null {
  // 1. 优先尝试 markdown code block: ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim()
    if (inner.startsWith('{')) {
      const extracted = extractBraceJSON(inner)
      if (extracted) return extracted
    }
  }

  // 2. 从文本中按大括号匹配
  return extractBraceJSON(text)
}

/** 逐字符匹配大括号，正确处理嵌套 */
function extractBraceJSON(text: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (inString) {
      if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1)
        try {
          JSON.parse(candidate)
          return candidate
        } catch {
          // JSON 无效时尝试修复常见问题：模型有时会输出 `undefined`（非合法 JSON 值）
          try {
            const fixed = candidate.replace(/\bundefined\b/g, 'null')
            JSON.parse(fixed)
            return fixed
          } catch {
            // 继续找更大的
          }
        }
      }
    }
  }

  return null
}

/** 从叙事文本中提取 AI 描述但忘了放 stateChanges 的获得物品 */
function extractItemsFromNarration(narration: string): string[] {
  const items: string[] = []
  const sectionMatch = narration.match(/【你?[获得到]+[了得]?[物道]?[品具]?】([\s\S]*?)(?=【|\n{3,}|$)/)
  if (sectionMatch) {
    const lines = sectionMatch[1].split('\n')
    for (const line of lines) {
      const m = line.match(/^[-•*]\s*(.+?)(?:[（(][\s\S]*?[）)])?\s*$/)
      if (m && m[1].trim().length > 0) {
        items.push(m[1].trim())
      }
    }
  }
  return items
}

/** 从叙事文本中提取 AI 描述但忘了放 stateChanges 的消耗物品 */
function extractRemovedItemsFromNarration(narration: string): string[] {
  const items: string[] = []
  // 匹配 【消耗物品】或【使用物品】等提示下的列表项
  const sectionMatch = narration.match(/【[消耗使用][耗用].*?】([\s\S]*?)(?=【|\n{3,}|$)/)
  if (sectionMatch) {
    const lines = sectionMatch[1].split('\n')
    for (const line of lines) {
      const m = line.match(/^[-•*]\s*(.+?)(?:[（(][\s\S]*?[）)])?\s*$/)
      if (m && m[1].trim().length > 0) {
        items.push(m[1].trim())
      }
    }
  }
  return items
}

export function parseAIResponse(text: string): AIResponse {
  const fallback: AIResponse = {
    narration: text,
    options: ['继续...'],
    stateChanges: { addItems: [], removeItems: [], setFlags: {} },
    atmosphereHint: 'normal',
  }

  const jsonStr = extractJSON(text)
  if (!jsonStr) return fallback

  try {
    const parsed = JSON.parse(jsonStr) as AIResponse

    // 从 JSON 中提取的物品
    const jsonAddItems = Array.isArray(parsed.stateChanges?.addItems) ? parsed.stateChanges.addItems : []
    const jsonRemoveItems = Array.isArray(parsed.stateChanges?.removeItems) ? parsed.stateChanges.removeItems : []
    // 从叙事文本中补充提取（AI 常忘了放 stateChanges）
    const narration = parsed.narration || text
    const narrAddItems = extractItemsFromNarration(narration)
    const narrRemoveItems = extractRemovedItemsFromNarration(narration)

    return {
      narration,
      options: Array.isArray(parsed.options) && parsed.options.length > 0 ? parsed.options : ['继续...'],
      stateChanges: {
        hp: typeof parsed.stateChanges?.hp === 'number' ? parsed.stateChanges.hp : undefined,
        addItems: [...new Set([...jsonAddItems, ...narrAddItems])],
        removeItems: [...new Set([...jsonRemoveItems, ...narrRemoveItems])],
        setFlags: typeof parsed.stateChanges?.setFlags === 'object' ? parsed.stateChanges.setFlags : {},
      },
      atmosphereHint: ['danger', 'normal', 'mystery', 'triumph'].includes(parsed.atmosphereHint as string)
        ? parsed.atmosphereHint : 'normal',
    }
  } catch {
    return fallback
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
