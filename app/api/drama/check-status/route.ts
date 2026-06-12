import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireDramaAuth } from '@/lib/drama/auth'

// 检查视频状态（每次只检查 1 个分镜，避免 Vercel 超时）
export async function POST(req: NextRequest) {
  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const auth = await requireDramaAuth(projectId)
  if (auth.error) return auth.error
  const { adminSupabase } = auth

  const apiKey = process.env.AGNES_API_KEY || ''

  // 只取第一个生成中的分镜（避免 Vercel 10 秒超时）
  const { data: scene } = await adminSupabase
    .from('drama_scenes')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'generating_video')
    .order('scene_number')
    .limit(1)
    .single()

  if (!scene || !scene.video_request_id) {
    return NextResponse.json({ updated: 0, message: '没有需要检查的分镜' })
  }

  let updated = 0

  try {
    const statusResponse = await fetch(
      `https://apihub.agnes-ai.com/agnesapi?video_id=${scene.video_request_id}`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (statusResponse.ok) {
      const data = await statusResponse.json()

      // 和 /api/generate-video/status 一样的字段转换
      // 视频 URL 实际在 remixed_from_video_id 字段中
      if (data.remixed_from_video_id && !data.video_url) {
        data.video_url = data.remixed_from_video_id
      }

      // 统一状态名为 succeeded
      const doneAliases = new Set(['completed', 'done', 'succeed', 'success', 'ready', 'finish', 'finished'])
      if (data.status && doneAliases.has(data.status.toLowerCase())) {
        data.status = 'succeeded'
      }

      const videoUrl = data.video_url || ''
      const status = (data.status || '').toLowerCase()

      if (videoUrl && status === 'succeeded') {
        await adminSupabase
          .from('drama_scenes')
          .update({ video_url: videoUrl, status: 'done' })
          .eq('id', scene.id)
        updated++
      } else if (['failed', 'error', 'cancelled'].includes(status)) {
        await adminSupabase
          .from('drama_scenes')
          .update({ status: 'error', error: data.error || '视频生成失败' })
          .eq('id', scene.id)
        updated++
      }
    }
  } catch {
    // 超时或网络错误，跳过
  }

  return NextResponse.json({ updated })
}
