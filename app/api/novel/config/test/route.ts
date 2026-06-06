import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, baseUrl, model } = await req.json()

    if (!provider) {
      return NextResponse.json({ error: '缺少 provider' }, { status: 400 })
    }

    // Ollama 不需要 API Key
    if (provider === 'ollama') {
      try {
        const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(5000) })
        if (res.ok) return NextResponse.json({ ok: true, message: 'Ollama 连接成功' })
        return NextResponse.json({ error: 'Ollama 连接失败' })
      } catch {
        return NextResponse.json({ error: '无法连接到 Ollama，请确保已启动' })
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: '缺少 API Key' }, { status: 400 })
    }

    // 构建请求
    let url = `${baseUrl}/v1/chat/completions`
    let headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let body: any

    if (provider === 'anthropic') {
      url = `${baseUrl}/v1/messages`
      headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      body = { model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`
      body = { model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `API 错误 (${response.status}): ${error.slice(0, 200)}` })
    }

    return NextResponse.json({ ok: true, message: '连接成功' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
