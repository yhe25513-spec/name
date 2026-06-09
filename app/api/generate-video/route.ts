import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const AGNES_VIDEO_API = 'https://apihub.agnes-ai.com/v1/videos'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  // 获取用户角色和每日视频次数
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, daily_video_count, daily_video_date')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  // 普通用户每日视频次数限制
  if (!isAdmin) {
    const today = new Date().toISOString().slice(0, 10)
    const count = profile?.daily_video_date === today ? (profile?.daily_video_count || 0) : 0
    if (count >= 1) {
      return NextResponse.json(
        { error: '今日视频生成次数达到上限，明天再来吧' },
        { status: 429 }
      )
    }
  }

  let prompt: string
  let imageUrl: string | undefined
  try {
    const body = await req.json()
    prompt = body.prompt
    imageUrl = body.image_url // 可选：图生视频的参考图片URL
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!prompt?.trim()) {
    return NextResponse.json({ error: '缺少提示词' }, { status: 400 })
  }

  // 获取 API key
  const adminSupabase = await createAdminClient()
  let apiKey = process.env.AGNES_API_KEY || ''
  // 视频使用固定的模型名称，不从配置中读取模型名
  let modelName = 'agnes-video-v2.0'

  if (!apiKey) {
    try {
      const { data: config } = await adminSupabase
        .from('ai_configs')
        .select('api_key')
        .eq('provider', 'agnes')
        .limit(1)
        .single()
      if (config?.api_key) {
        apiKey = config.api_key.trim()
      }
    } catch { /* ignore */ }
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: '未配置 Agnes AI API Key。请在 AI 配置中创建 provider 为 agnes 的配置' },
      { status: 400 }
    )
  }

  // 先更新计数，如果生成失败再回滚
  const today = new Date().toISOString().slice(0, 10)
  if (!isAdmin) {
    const newCount = profile?.daily_video_date === today ? (profile?.daily_video_count || 0) + 1 : 1
    await adminSupabase.from('profiles').update({
      daily_video_count: newCount,
      daily_video_date: today,
    }).eq('id', user.id)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model: modelName,
      prompt: prompt,
      width: 1152,
      height: 768,
      num_frames: 121,
      frame_rate: 24,
    }

    // 如果有参考图片，添加到请求中（图生视频）
    if (imageUrl) {
      requestBody.image = imageUrl
    }

    const response = await fetch(AGNES_VIDEO_API, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    clearTimeout(timeout)

    if (!response.ok) {
      // API 失败 → 回滚计数
      if (!isAdmin) {
        const rollbackCount = profile?.daily_video_date === today ? (profile?.daily_video_count || 0) : 0
        await adminSupabase.from('profiles').update({
          daily_video_count: rollbackCount,
          daily_video_date: profile?.daily_video_date || '',
        }).eq('id', user.id)
      }
      const errText = await response.text()
      return NextResponse.json(
        { error: `视频生成提交失败 (${response.status})`, detail: errText },
        { status: 502 }
      )
    }

    const data = await response.json()
    const taskId = data.id
    const videoId = data.video_id

    if (!taskId && !videoId) {
      // 无任务 ID → 回滚计数
      if (!isAdmin) {
        const rollbackCount = profile?.daily_video_date === today ? (profile?.daily_video_count || 0) : 0
        await adminSupabase.from('profiles').update({
          daily_video_count: rollbackCount,
          daily_video_date: profile?.daily_video_date || '',
        }).eq('id', user.id)
      }
      return NextResponse.json(
        { error: 'AI 未返回任务 ID' },
        { status: 502 }
      )
    }

    // 使用 video_id 作为轮询 ID（Agnes 推荐方式）
    const pollingId = videoId || taskId
    return NextResponse.json({ request_id: pollingId, video_id: videoId })
  } catch (err) {
    // 异常 → 回滚计数
    if (!isAdmin) {
      const rollbackCount = profile?.daily_video_date === today ? (profile?.daily_video_count || 0) : 0
      await adminSupabase.from('profiles').update({
        daily_video_count: rollbackCount,
        daily_video_date: profile?.daily_video_date || '',
      }).eq('id', user.id)
    }
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `视频生成提交失败: ${msg}` }, { status: 500 })
  }
}
