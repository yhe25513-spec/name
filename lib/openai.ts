import { ConversationMessage, GameScenario, GameState } from './types'

/**
 * OpenAI 兼容格式的流式聊天
 * 支持 OpenAI、Anthropic (通过适配)、以及自定义 OpenAI 兼容 API
 */
export async function streamOpenAIChat(
  userInput: string,
  scenario: GameScenario,
  state: GameState,
  history: ConversationMessage[],
  apiKey: string,
  model: string = 'gpt-3.5-turbo',
  temperature: number = 0.8,
  maxTokens: number = 1024,
  baseUrl?: string,
  provider: string = 'openai'
): Promise<ReadableStream> {
  // 确定 API 端点
  let apiUrl: string
  if (baseUrl) {
    // 自定义 base URL，使用 OpenAI 兼容格式
    // Ollama 使用 /v1/chat/completions
    const path = provider === 'ollama' ? '/v1/chat/completions' : '/chat/completions'
    apiUrl = baseUrl.replace(/\/$/, '') + path
  } else if (provider === 'anthropic') {
    // Anthropic API
    apiUrl = 'https://api.anthropic.com/v1/messages'
  } else if (provider === 'openrouter') {
    // OpenRouter 默认地址
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
  } else {
    // 默认 OpenAI
    apiUrl = 'https://api.openai.com/v1/chat/completions'
  }

  // 构建系统提示
  const systemPrompt = scenario.system_prompt || '你是一个文字冒险游戏的GM。'

  // 构建消息历史（保留最近 20 条对话，约 10 个回合）
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: userInput },
  ]

  // 构建请求体
  let requestBody: Record<string, unknown>
  let headers: Record<string, string>

  if (provider === 'anthropic') {
    // Anthropic 格式
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
    requestBody = {
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      system: systemPrompt,
      stream: true,
    }
  } else {
    // OpenAI 兼容格式（包括 OpenRouter、Ollama）
    headers = {
      'Content-Type': 'application/json',
    }
    // Ollama 本地运行不需要认证，但如果提供了 key 也可以使用
    if (apiKey && provider !== 'ollama') {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    // OpenRouter 需要额外的头部
    if (provider === 'openrouter' || apiUrl?.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://localhost:3000'
      headers['X-Title'] = 'Text Adventure Game'
    }
    requestBody = {
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: true,
    }
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error: ${response.status} - ${error}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  // 转换为标准流格式（与 DeepSeek 相同）
  return response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder('utf-8', { stream: true } as TextDecoderOptions).decode(chunk)
      const lines = text.split('\n').filter(l => l.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
            return
          }
          try {
            const parsed = JSON.parse(data)

            if (provider === 'anthropic') {
              // Anthropic 格式转换
              const content = parsed.delta?.text || ''
              if (content) {
                const formatted = JSON.stringify({
                  choices: [{ delta: { content } }]
                })
                controller.enqueue(new TextEncoder().encode(`data: ${formatted}\n\n`))
              }
            } else {
              // OpenAI 格式直接透传
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`))
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }))
}
