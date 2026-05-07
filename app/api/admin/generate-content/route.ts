import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  let prompt: string
  try {
    const body = await req.json()
    prompt = body.prompt
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
  if (!prompt?.trim()) {
    return NextResponse.json({ error: '缺少提示词' }, { status: 400 })
  }

  // 获取 AI 配置：优先用 ai_configs 中的默认配置，降级到 admin_config
  const adminSupabase = await createAdminClient()
  let apiKey = ''
  let apiUrl = 'https://api.deepseek.com/chat/completions'
  let model = 'deepseek-chat'
  let temperature = 0.8
  let maxTokens = 1024
  let provider = 'deepseek'

  try {
    // 先查 ai_configs 中的默认配置
    const { data: defaultConfig } = await adminSupabase
      .from('ai_configs')
      .select('*')
      .eq('is_default', true)
      .single()

    if (defaultConfig) {
      apiKey = defaultConfig.api_key
      provider = defaultConfig.provider || 'deepseek'
      model = defaultConfig.model || 'deepseek-chat'
      temperature = defaultConfig.temperature || 0.8
      maxTokens = defaultConfig.max_tokens || 1024
    } else {
      // 降级到 admin_config
      const { data: legacyConfig } = await adminSupabase
        .from('admin_config')
        .select('*')
        .single()

      if (legacyConfig) {
        apiKey = legacyConfig.api_key || legacyConfig.deepseek_api_key || ''
        provider = legacyConfig.provider || 'deepseek'
        model = legacyConfig.model || 'deepseek-chat'
        temperature = legacyConfig.temperature || 0.8
        maxTokens = legacyConfig.max_tokens || 1024
      } else {
        // 尝试获取任意一个 ai_config
        const { data: anyConfig } = await adminSupabase
          .from('ai_configs')
          .select('*')
          .limit(1)
          .single()

        if (anyConfig) {
          apiKey = anyConfig.api_key
          provider = anyConfig.provider || 'deepseek'
          model = anyConfig.model || 'deepseek-chat'
          temperature = anyConfig.temperature || 0.8
          maxTokens = anyConfig.max_tokens || 1024
        }
      }
    }
  } catch {
    // 没有配置时静默处理
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: '请先在管理后台配置 AI 服务' },
      { status: 400 }
    )
  }

  // 根据 provider 构建 API 请求
  const systemPrompt = '你是一个专业的游戏文案策划，擅长为文字冒险游戏创作沉浸式内容。回复简洁有创意，直接输出内容，不要添加额外说明。'

  try {
    let baseUrl: string
    let requestBody: Record<string, unknown>
    let requestHeaders: Record<string, string>

    if (provider === 'anthropic') {
      baseUrl = 'https://api.anthropic.com/v1/messages'
      requestHeaders = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
      requestBody = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
        system: systemPrompt,
      }
    } else {
      baseUrl = provider === 'openai' ? 'https://api.openai.com'
        : provider === 'openrouter' ? 'https://openrouter.ai/api/v1'
        : 'https://api.deepseek.com'

      // 自定义 provider 尝试读取 api_base_url
      if (!['openai', 'openrouter', 'deepseek'].includes(provider)) {
        const { data: customConfig } = await adminSupabase
          .from('admin_config')
          .select('api_base_url')
          .single()
        if (customConfig?.api_base_url) baseUrl = customConfig.api_base_url
      }

      requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider === 'openrouter' ? {
          'HTTP-Referer': 'https://localhost:3000',
          'X-Title': 'Text Adventure Game',
        } : {}),
      }
      requestBody = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }
    }

    const apiUrl = provider === 'anthropic' ? baseUrl : `${baseUrl}/chat/completions`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: `AI 服务响应异常 (${response.status})` },
          { status: 502 }
        )
      }

      const data = await response.json()
      let content = ''

      if (provider === 'anthropic') {
        content = data.content?.[0]?.text || ''
      } else {
        content = data.choices?.[0]?.message?.content || ''
      }

      return NextResponse.json({ content: content.trim() })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI 请求失败: ${msg}` }, { status: 500 })
  }
}
