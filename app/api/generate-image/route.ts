import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/images/generations'

export async function POST(req: NextRequest) {
  // 验证登录
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  let prompt: string
  let size = '1024x576' // 16:9 适合横图背景
  try {
    const body = await req.json()
    prompt = body.prompt
    if (body.size) size = body.size
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!prompt?.trim()) {
    return NextResponse.json({ error: '缺少提示词' }, { status: 400 })
  }

  // 获取 API key 和模型名：优先环境变量，降级到 ai_configs
  let apiKey = process.env.SILICONFLOW_API_KEY || ''
  let modelName = ''

  // 先尝试从环境变量直接获取完整配置
  if (apiKey) {
    modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen-Image'
  }

  if (!apiKey) {
    try {
      const adminSupabase = await createAdminClient()
      const { data: config } = await adminSupabase
        .from('ai_configs')
        .select('api_key, model')
        .eq('provider', 'siliconflow')
        .limit(1)
        .single()
      if (config?.api_key) {
        apiKey = config.api_key.trim()
        modelName = config.model || 'Qwen/Qwen-Image'
      }
    } catch {
      // 忽略查询错误
    }
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: '未配置 SiliconFlow API Key。请在 .env.local 中设置 SILICONFLOW_API_KEY，或在 AI 配置中创建 provider 为 siliconflow 的配置' },
      { status: 400 }
    )
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(SILICONFLOW_API, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        n: 1,
        size: size,
      }),
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `图片生成失败 (${response.status})`, detail: errText },
        { status: 502 }
      )
    }

    const data = await response.json()
    const imageUrl = data.data?.[0]?.url

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'AI 返回了空结果' },
        { status: 502 }
      )
    }

    // SiliconFlow 返回的 URL 有时效，需要下载后永久存储到 Supabase
    // 先返回 URL，由客户端决定是否保存
    return NextResponse.json({ url: imageUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `图片生成失败: ${msg}` }, { status: 500 })
  }
}
