import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // 检查管理员权限
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 获取请求体
  const { systemPrompt, userMessage } = await req.json()

  if (!systemPrompt?.trim() || !userMessage?.trim()) {
    return NextResponse.json({ error: 'Missing systemPrompt or userMessage' }, { status: 400 })
  }

  // 获取 AI 配置
  const { data: config } = await supabase.from('admin_config').select('*').single()
  const provider = config?.provider || 'deepseek'
  const apiKey = config?.api_key || config?.deepseek_api_key

  if (!apiKey) {
    return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })
  }

  try {
    // 构建请求
    let apiUrl: string
    let headers: Record<string, string>
    let requestBody: Record<string, unknown>

    if (provider === 'anthropic') {
      apiUrl = 'https://api.anthropic.com/v1/messages'
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
      requestBody = {
        model: config?.model || 'claude-3-sonnet-20240229',
        max_tokens: config?.max_tokens || 1024,
        temperature: config?.temperature || 0.8,
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt,
      }
    } else if (provider === 'openrouter') {
      // OpenRouter
      const baseUrl = config?.api_base_url || 'https://openrouter.ai/api/v1'
      apiUrl = baseUrl.replace(/\/$/, '') + '/chat/completions'
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://localhost:3000', // OpenRouter 需要
        'X-Title': 'Text Adventure Game',
      }
      requestBody = {
        model: config?.model || 'meta-llama/llama-3.1-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: config?.temperature || 0.8,
        max_tokens: config?.max_tokens || 1024,
      }
    } else {
      // OpenAI 兼容格式（包括 DeepSeek、自定义）
      const baseUrl = config?.api_base_url ||
        (provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com')
      // 与 streamOpenAIChat 保持一致，只添加 /chat/completions
      apiUrl = baseUrl.replace(/\/$/, '') + '/chat/completions'
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      requestBody = {
        model: config?.model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: config?.temperature || 0.8,
        max_tokens: config?.max_tokens || 1024,
        stream: false,
      }
    }

    // 发送请求
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `API error ${response.status}: ${errorText}` },
        { status: 502 }
      )
    }

    const responseText = await response.text()

    // 检查是否是流式响应（SSE 格式）
    if (responseText.trim().startsWith('data:')) {
      // 解析 SSE 流式响应
      const lines = responseText.split('\n').filter(l => l.trim())
      let fullContent = ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
            fullContent += content
          } catch {
            // 忽略解析错误
          }
        }
      }
      return NextResponse.json({ response: fullContent || responseText })
    } else {
      // 普通 JSON 响应
      try {
        const data = JSON.parse(responseText)
        let content = ''
        if (provider === 'anthropic') {
          content = data.content?.[0]?.text || JSON.stringify(data)
        } else {
          content = data.choices?.[0]?.message?.content || JSON.stringify(data)
        }
        return NextResponse.json({ response: content, raw: data })
      } catch {
        return NextResponse.json({ response: responseText })
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
