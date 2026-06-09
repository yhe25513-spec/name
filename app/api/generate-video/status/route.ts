import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  let requestId: string
  try {
    const body = await req.json()
    requestId = body.requestId
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!requestId) {
    return NextResponse.json({ error: '缺少 requestId' }, { status: 400 })
  }

  // 获取 API key
  const adminSupabase = await createAdminClient()
  let apiKey = process.env.AGNES_API_KEY || ''
  if (!apiKey) {
    try {
      const { data: config } = await adminSupabase
        .from('ai_configs')
        .select('api_key')
        .eq('provider', 'agnes')
        .limit(1)
        .single()
      if (config?.api_key) apiKey = config.api_key.trim()
    } catch { /* ignore */ }
  }

  if (!apiKey) {
    return NextResponse.json({ error: '未配置 API Key' }, { status: 400 })
  }

  try {
    // Agnes 使用 GET 请求查询视频状态
    const statusUrl = `https://apihub.agnes-ai.com/agnesapi?video_id=${requestId}`
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `查询失败 (${response.status})`, detail: errText },
        { status: 502 }
      )
    }

    const data = await response.json()

    // 标准化返回格式
    if (data.status) data.status = data.status.toLowerCase()

    // Agnes 视频 URL 在 remixed_from_video_id 字段中
    if (data.remixed_from_video_id && !data.video_url) {
      data.video_url = data.remixed_from_video_id
    }

    // 兼容不同状态命名 → 统一为 succeeded
    const doneAliases = new Set(['completed', 'done', 'succeed', 'success', 'ready', 'finish', 'finished'])
    if (data.status && doneAliases.has(data.status.toLowerCase())) {
      data.status = 'succeeded'
    }

    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `查询失败: ${msg}` }, { status: 500 })
  }
}
