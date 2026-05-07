import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
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
    let response: Response

    if (provider === 'anthropic') {
      const baseUrl = 'https://api.anthropic.com/v1/messages'
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }],
          system: systemPrompt,
        }),
      })
    } else {
      let baseUrl = 'https://api.deepseek.com'
      if (provider === 'openai') baseUrl = 'https://api.openai.com'
      else if (provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1'
      // custom provider uses default baseUrl

      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(provider === 'openrouter' ? {
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'Text Adventure Game',
          } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      })
    }

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI 请求失败: ${msg}` }, { status: 500 })
  }
}
