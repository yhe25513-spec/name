// 统一 AI 配置 - 支持多模型切换
// 在 .env.local 中配置默认模型，运行时可在 UI 中切换

export interface AIProvider {
  id: string
  name: string
  baseUrl: string
  models: string[]
  defaultModel: string
}

// 支持的 AI 提供商
export const AI_PROVIDERS: Record<string, AIProvider> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-3-5-sonnet-20241022'],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot (月之暗面)',
    baseUrl: 'https://api.moonshot.cn',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'moonshot-v1-8k',
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4'],
    defaultModel: 'glm-4-flash',
  },
  qwen: {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
    defaultModel: 'qwen-turbo',
  },
  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
    defaultModel: 'deepseek-ai/DeepSeek-V3',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3', 'qwen2', 'mistral', 'codellama'],
    defaultModel: 'qwen2',
  },
}

// 获取当前配置的提供商
function getProvider(): string {
  return process.env.AI_PROVIDER || 'deepseek'
}

// 获取 API Key
function getApiKey(): string {
  const provider = getProvider()
  // 按优先级查找 API Key
  return process.env[`${provider.toUpperCase()}_API_KEY`]
    || process.env.AI_API_KEY
    || process.env.DEEPSEEK_API_KEY
    || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY
    || ''
}

// 获取 Base URL
function getBaseUrl(): string {
  const provider = getProvider()
  return process.env[`${provider.toUpperCase()}_BASE_URL`]
    || process.env.AI_BASE_URL
    || AI_PROVIDERS[provider]?.baseUrl
    || 'https://api.deepseek.com'
}

// 获取模型名
function getModel(): string {
  const provider = getProvider()
  return process.env[`${provider.toUpperCase()}_MODEL`]
    || process.env.AI_MODEL
    || AI_PROVIDERS[provider]?.defaultModel
    || 'deepseek-chat'
}

// 构建请求头
export function getHeaders(): Record<string, string> {
  const provider = getProvider()
  const apiKey = getApiKey()

  // Anthropic 使用不同的认证方式
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
  }

  // Ollama 不需要 API Key
  if (provider === 'ollama') {
    return { 'Content-Type': 'application/json' }
  }

  // 其他提供商使用 Bearer token
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

// 获取聊天补全 URL
export function getChatUrl(): string {
  const provider = getProvider()
  const baseUrl = getBaseUrl()

  // Anthropic 使用不同的端点
  if (provider === 'anthropic') {
    return `${baseUrl}/v1/messages`
  }

  // Ollama
  if (provider === 'ollama') {
    return `${baseUrl}/chat/completions`
  }

  // OpenAI 兼容接口（大多数国产模型都兼容）
  return `${baseUrl}/v1/chat/completions`
}

// 构建消息体
export function buildMessages(
  systemPrompt: string,
  userContent: string,
  options?: { temperature?: number; maxTokens?: number }
): any {
  const provider = getProvider()
  const model = getModel()

  const temperature = options?.temperature ?? 0.7
  const maxTokens = options?.maxTokens ?? 4096

  // Anthropic 格式
  if (provider === 'anthropic') {
    return {
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }
  }

  // OpenAI 兼容格式（适用于 DeepSeek/OpenAI/Moonshot/Qwen 等）
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature,
    max_tokens: maxTokens,
  }
}

// 解析响应
export function parseResponse(data: any): string {
  const provider = getProvider()

  // Anthropic 格式
  if (provider === 'anthropic') {
    return data.content?.[0]?.text || ''
  }

  // OpenAI 兼容格式
  return data.choices?.[0]?.message?.content || ''
}

// 获取当前配置信息（用于 UI 显示）
export function getCurrentConfig() {
  const provider = getProvider()
  return {
    provider,
    providerName: AI_PROVIDERS[provider]?.name || provider,
    model: getModel(),
    baseUrl: getBaseUrl(),
    hasApiKey: !!getApiKey(),
  }
}

// 统一的 AI 调用函数
export async function callAI(
  systemPrompt: string,
  userContent: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const url = getChatUrl()
  const headers = getHeaders()
  const body = buildMessages(systemPrompt, userContent, options)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI API error (${response.status}): ${error}`)
  }

  const data = await response.json()
  return parseResponse(data)
}

// 统一的 JSON 解析（从 AI 输出中提取 JSON）
export function extractJson(text: string): any {
  // 尝试 markdown code block
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()) } catch {}
  }

  // 尝试直接匹配
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {
      try { return JSON.parse(match[0].replace(/\bundefined\b/g, 'null')) } catch {}
    }
  }

  return null
}

// Canonical JSON extraction from LLM output (used by all agents)
// Handles: markdown code blocks, raw JSON, common LLM formatting issues
export function parseJsonFromLLM(text: string): any {
  // Try markdown code block first
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()) } catch {}
  }

  // Try direct JSON match
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {
      // Fix common LLM formatting issues
      try {
        const fixed = match[0]
          .replace(/\bundefined\b/g, 'null')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
        return JSON.parse(fixed)
      } catch {}
    }
  }

  return null
}
