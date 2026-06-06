import { NextRequest } from 'next/server'
import { getCurrentConfig, getHeaders, buildMessages } from '@/lib/novel/ai-config'

export async function POST(req: NextRequest) {
  try {
    const { novelId, chapter, prompt } = await req.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: '缺少写作提示' }), { status: 400 })
    }

    const config = getCurrentConfig()
    if (!config.hasApiKey) {
      return new Response(JSON.stringify({ error: `未配置 ${config.providerName} API Key` }), { status: 500 })
    }

    const url = `${config.baseUrl}/v1/chat/completions`
    const headers = getHeaders()
    const body = buildMessages(
      '你是一位专业的网络小说作家，擅长写长篇小说。请直接输出章节正文，不要输出任何元数据或标注。',
      prompt,
      { temperature: 0.85, maxTokens: 4096 }
    )

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `${config.providerName} API 错误: ${response.status}` }),
        { status: 500 }
      )
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
