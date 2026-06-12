import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// 检查视频状态 + 自动提交下一个分镜
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const apiKey = process.env.AGNES_API_KEY || ''

  // 获取正在生成中的分镜
  const { data: generatingScenes } = await adminSupabase
    .from('drama_scenes')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'generating_video')

  let updated = 0

  // 检查每个生成中的分镜状态
  for (const scene of (generatingScenes || [])) {
    if (!scene.video_request_id) continue
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
        const doneAliases = ['completed', 'done', 'succeed', 'success', 'ready', 'finish', 'finished']
        let videoUrl = data.video_url || data.remixed_from_video_id || ''
        const status = (data.status || '').toLowerCase()

        if (videoUrl && (status === 'succeeded' || doneAliases.includes(status))) {
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
  }

  // 如果有视频完成或失败了，自动提交下一个分镜
  if (updated > 0) {
    const { data: nextScene } = await adminSupabase
      .from('drama_scenes')
      .select('*')
      .eq('project_id', projectId)
      .not('image_url', 'eq', '')
      .eq('video_url', '')
      .in('status', ['pending', 'done'])
      .order('scene_number')
      .limit(1)
      .single()

    if (nextScene && apiKey) {
      try {
        const modelName = process.env.AGNES_VIDEO_MODEL || 'agnes-video-v2.0'
        const duration = Math.min(nextScene.duration || 5, 18)
        const frameMap: Record<number, number> = { 3: 81, 5: 121, 10: 241, 18: 441 }
        const numFrames = frameMap[duration] || 121

        const requestBody: Record<string, unknown> = {
          model: modelName,
          prompt: nextScene.description,
          width: 1152,
          height: 768,
          num_frames: numFrames,
          frame_rate: 24,
        }
        if (nextScene.image_url) {
          requestBody.extra_body = { image: [nextScene.image_url] }
        }

        const submitResponse = await fetch('https://apihub.agnes-ai.com/v1/videos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(8000),
        })

        if (submitResponse.ok) {
          const submitData = await submitResponse.json()
          await adminSupabase
            .from('drama_scenes')
            .update({
              video_request_id: submitData.request_id || '',
              status: 'generating_video',
            })
            .eq('id', nextScene.id)
        }
      } catch {
        // 下一个提交失败，等下次轮询再试
      }
    }
  }

  return NextResponse.json({ updated })
}
