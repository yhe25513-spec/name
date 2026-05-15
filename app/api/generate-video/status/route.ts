import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/video/status'

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

    // 兼容多种 SiliconFlow 返回格式，提取视频 URL
    if (!data.video_url) {
      // results 为数组: [{ video_url: "..." }, ...]
      if (Array.isArray(data.results) && data.results.length > 0) {
        const videoResult = data.results.find((r: any) => r.video_url || (r.url && /\.(mp4|webm|mov)/i.test(r.url)))
        data.video_url = videoResult
          ? (videoResult.video_url || videoResult.url)
          : (data.results[0].url || data.results[0].video_url)
      }
      // results 为对象: { video_url: "...", videos: [...] }
      else if (data.results && typeof data.results === 'object' && !Array.isArray(data.results)) {
        // 优先取 results.videos[0] 嵌套数组
        const videosArr = data.results.videos || data.results.data || []
        if (Array.isArray(videosArr) && videosArr.length > 0) {
          data.video_url = videosArr[0].video_url || videosArr[0].url
        }
        if (!data.video_url) {
          data.video_url = data.results.video_url || data.results.url || data.results.video
        }
      }
      // result (单数)
      else if (data.result?.video_url || data.result?.url) {
        data.video_url = data.result.video_url || data.result.url
      }
      // output 包装
      else if (data.output?.video_url) {
        data.video_url = data.output.video_url
      } else if (data.output?.video) {
        data.video_url = typeof data.output.video === 'string' ? data.output.video : data.output.video.url
      }
      // video 字段
      else if (data.video?.url) {
        data.video_url = data.video.url
      } else if (typeof data.video === 'string') {
        data.video_url = data.video
      }
      // 顶层 url 可能是视频链接
      else if (data.url && /\.(mp4|webm|mov)/i.test(data.url)) {
        data.video_url = data.url
      }
    }

    // 兼容不同状态命名 → 统一为 succeeded
    const doneAliases = new Set(['succeed', 'success', 'done', 'completed', 'ready', 'finish', 'finished'])
    if (data.status && doneAliases.has(data.status.toLowerCase())) {
      data.status = 'succeeded'
    }

    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `查询失败: ${msg}` }, { status: 500 })
  }
}
