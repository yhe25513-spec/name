import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireDramaAuth } from '@/lib/drama/auth'

// Step 4: 为下一个分镜提交视频生成请求
// 每次只提交一个视频，完成后再提交下一个
export async function POST(req: NextRequest) {
  const { projectId, sceneId } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const auth = await requireDramaAuth(projectId)
  if (auth.error) return auth.error
  const { adminSupabase } = auth

  const apiKey = process.env.AGNES_API_KEY || ''
  if (!apiKey) return NextResponse.json({ error: '未配置 AGNES_API_KEY' }, { status: 400 })

  // 如果指定了 sceneId，只提交这一个
  // 否则找下一个待生成的分镜
  let scene: any = null

  if (sceneId) {
    const { data } = await adminSupabase
      .from('drama_scenes')
      .select('*')
      .eq('id', sceneId)
      .single()
    scene = data
  } else {
    const { data } = await adminSupabase
      .from('drama_scenes')
      .select('*')
      .eq('project_id', projectId)
      .not('image_url', 'eq', '')
      .eq('video_url', '')
      .in('status', ['pending', 'done'])
      .order('scene_number')
      .limit(1)
      .single()
    scene = data
  }

  if (!scene) {
    return NextResponse.json({ message: '没有待生成视频的分镜', done: true })
  }

  try {
    const result = await submitVideoGeneration(scene, apiKey)
    return NextResponse.json({ result, done: false })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function submitVideoGeneration(scene: any, apiKey: string): Promise<any> {
  const modelName = process.env.AGNES_VIDEO_MODEL || 'agnes-video-v2.0'
  const duration = Math.min(scene.duration || 5, 18)
  const frameMap: Record<number, number> = { 3: 81, 5: 121, 10: 241, 18: 441 }
  const numFrames = frameMap[duration] || 121

  const requestBody: Record<string, unknown> = {
    model: modelName,
    prompt: scene.description,
    width: 1152,
    height: 768,
    num_frames: numFrames,
    frame_rate: 24,
  }

  if (scene.image_url) {
    requestBody.extra_body = { image: [scene.image_url] }
  }

  const response = await fetch('https://apihub.agnes-ai.com/v1/videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Agnes API error: ${response.status} - ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  const taskId = data.id
  const videoId = data.video_id
  const pollingId = videoId || taskId || ''

  if (!pollingId) {
    throw new Error('Agnes AI 未返回任务 ID')
  }

  const adminSupabase = await createAdminClient()
  await adminSupabase
    .from('drama_scenes')
    .update({
      video_request_id: pollingId,
      status: 'generating_video',
    })
    .eq('id', scene.id)

  return { sceneId: scene.id, sceneNumber: scene.scene_number, requestId: pollingId, status: 'submitted' }
}
