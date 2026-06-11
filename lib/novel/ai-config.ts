// 统一 AI 配置 - 支持多模型切换
// 在 .env.local 中配置默认模型，运行时可在 UI 中切换

export interface AIProvider {
  id: string
  name: string
  baseUrl: string
  models: string[]
  defaultModel: string
}

// 支持的 AI 提供商（2026年6月最新）
export const AI_PROVIDERS: Record<string, AIProvider> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-v4-flash',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3-5'],
    defaultModel: 'claude-sonnet-4',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    defaultModel: 'gemini-2.5-flash',
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot (月之暗面/Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-latest', 'kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'kimi-latest',
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-z1', 'glm-4-flash', 'glm-4-long'],
    defaultModel: 'glm-4-plus',
  },
  qwen: {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'Qwen3-32B', 'Qwen3-14B'],
    defaultModel: 'qwen-turbo',
  },
  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Pro/deepseek-ai/DeepSeek-V3'],
    defaultModel: 'deepseek-ai/DeepSeek-V3',
  },
  xiaomi: {
    id: 'xiaomi',
    name: '小米 MiMo',
    baseUrl: 'https://api.siliconflow.cn/v1', // MiMo 托管在 SiliconFlow
    models: ['xiaomi/MiMo-7B'],
    defaultModel: 'xiaomi/MiMo-7B',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['qwen2', 'llama3', 'mistral', 'codellama'],
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
  const key = process.env[`${provider.toUpperCase()}_API_KEY`]
    || process.env.AI_API_KEY
    || process.env.DEEPSEEK_API_KEY
    || ''

  return key
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
export function getHeaders(cfg?: ResolvedAIConfig): Record<string, string> {
  const provider = cfg?.provider || getProvider()
  const apiKey = cfg?.apiKey || getApiKey()

  // Anthropic 使用不同的认证方式
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
  }

  // Google Gemini 使用 URL 参数认证
  if (provider === 'google') {
    return { 'Content-Type': 'application/json' }
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
export function getChatUrl(cfg?: ResolvedAIConfig): string {
  const provider = cfg?.provider || getProvider()
  const baseUrl = cfg?.baseUrl || getBaseUrl()
  const apiKey = cfg?.apiKey || getApiKey()
  const model = cfg?.model || getModel()

  // Anthropic 使用不同的端点
  if (provider === 'anthropic') {
    return `${baseUrl}/v1/messages`
  }

  // Google Gemini 使用不同的端点格式
  if (provider === 'google') {
    return `${baseUrl}/models/${model}:generateContent?key=${apiKey}`
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
  options?: { temperature?: number; maxTokens?: number; config?: ResolvedAIConfig }
): any {
  const provider = options?.config?.provider || getProvider()
  const model = options?.config?.model || getModel()

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

  // Google Gemini 格式
  if (provider === 'google') {
    return {
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
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

  // Google Gemini 格式
  if (provider === 'google') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  // OpenAI 兼容格式
  return data.choices?.[0]?.message?.content || ''
}

// 获取当前配置信息（用于 UI 显示）
export function getCurrentConfig(cfg?: ResolvedAIConfig) {
  const provider = cfg?.provider || getProvider()
  return {
    provider,
    providerName: AI_PROVIDERS[provider]?.name || provider,
    model: cfg?.model || getModel(),
    baseUrl: cfg?.baseUrl || getBaseUrl(),
    hasApiKey: !!(cfg?.apiKey || getApiKey()),
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

// 安全地解析 AI 配置 — 不写入 process.env，通过返回值传递
export interface ResolvedAIConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}

export function resolveAIConfig(aiSettings?: {
  provider?: string
  apiKey?: string
  baseUrl?: string
  model?: string
}): ResolvedAIConfig {
  const provider = aiSettings?.provider || getProvider()
  const providerUpper = provider.toUpperCase()

  const apiKey = aiSettings?.apiKey
    || process.env[`${providerUpper}_API_KEY`]
    || process.env.AI_API_KEY
    || process.env.DEEPSEEK_API_KEY
    || ''

  const baseUrl = aiSettings?.baseUrl
    || process.env[`${providerUpper}_BASE_URL`]
    || process.env.AI_BASE_URL
    || AI_PROVIDERS[provider]?.baseUrl
    || 'https://api.deepseek.com'

  const model = aiSettings?.model
    || process.env[`${providerUpper}_MODEL`]
    || process.env.AI_MODEL
    || AI_PROVIDERS[provider]?.defaultModel
    || 'deepseek-chat'

  return { provider, apiKey, baseUrl, model }
}

// 临时应用 AI 配置到 process.env（请求作用域，用完自动恢复）
export function applyAIConfigTemporarily(config: ResolvedAIConfig): () => void {
  const prev: Record<string, string | undefined> = {}
  const keys = ['AI_PROVIDER', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL',
    `${config.provider.toUpperCase()}_API_KEY`,
    `${config.provider.toUpperCase()}_BASE_URL`,
    `${config.provider.toUpperCase()}_MODEL`]

  for (const key of keys) {
    prev[key] = process.env[key]
  }

  process.env.AI_PROVIDER = config.provider
  process.env.AI_API_KEY = config.apiKey
  process.env.AI_BASE_URL = config.baseUrl
  process.env.AI_MODEL = config.model
  process.env[`${config.provider.toUpperCase()}_API_KEY`] = config.apiKey
  process.env[`${config.provider.toUpperCase()}_BASE_URL`] = config.baseUrl
  process.env[`${config.provider.toUpperCase()}_MODEL`] = config.model

  return () => {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key]
      else process.env[key] = prev[key]
    }
  }
}
