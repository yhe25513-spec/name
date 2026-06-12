import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // 直接从环境变量获取 API key，避免查数据库
  const apiKey = process.env.AGNES_API_KEY || ''
  if (!apiKey) {
    return NextResponse.json({ error: '未配置 API Key' }, { status: 400 })
  }

  try {
    const statusUrl = `https://apihub.agnes-ai.com/agnesapi?video_id=${requestId}`
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `查询失败 (${response.status})` },
        { status: 502 }
      )
    }

    const data = await response.json()

    if (data.status) data.status = data.status.toLowerCase()

    if (data.remixed_from_video_id && !data.video_url) {
      data.video_url = data.remixed_from_video_id
    }

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
