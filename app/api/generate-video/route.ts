import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/video/submit'

// 将通用尺寸映射为视频 API 支持的尺寸
const VIDEO_SIZE_MAP: Record<string, string> = {
  '1024x1024': '960x960',
  '576x1024': '720x1280',
  '1024x576': '1280x720',
  '768x1024': '720x1280',
  '1024x768': '1280x720',
}

function toVideoSize(size: string): string {
  return VIDEO_SIZE_MAP[size] || size
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  // 仅管理员可用
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可用' }, { status: 403 })
  }

  let prompt: string
  let size = '1024x1024'
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

  // 获取 API key
  let apiKey = process.env.SILICONFLOW_API_KEY || ''
  if (!apiKey) {
    try {
      const adminSupabase = await createAdminClient()
      const { data: config } = await adminSupabase
        .from('ai_configs')
        .select('api_key')
        .eq('provider', 'siliconflow')
        .limit(1)
        .single()
      if (config?.api_key) apiKey = config.api_key.trim()
    } catch { /* ignore */ }
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: '未配置 SiliconFlow API Key' },
      { status: 400 }
    )
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(SILICONFLOW_API, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'Wan-AI/Wan2.2-T2V-A14B',
        prompt: prompt,
        image_size: toVideoSize(size),
      }),
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `视频生成提交失败 (${response.status})`, detail: errText },
        { status: 502 }
      )
    }

    const data = await response.json()
    const requestId = data.requestId

    if (!requestId) {
      return NextResponse.json(
        { error: 'AI 未返回任务 ID' },
        { status: 502 }
      )
    }

    return NextResponse.json({ request_id: requestId, requestId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `视频生成提交失败: ${msg}` }, { status: 500 })
  }
}
