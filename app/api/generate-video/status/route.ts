import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/video/status'

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
    return NextResponse.json({ error: '未配置 API Key' }, { status: 400 })
  }

  try {
    const response = await fetch(SILICONFLOW_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ requestId }),
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
    if (data.results?.length > 0) {
      data.video_url = data.results[0].url
    }

    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `查询失败: ${msg}` }, { status: 500 })
  }
}
