import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Step 4: 为分镜提交视频生成请求（异步，不等待结果）
// 提交后立即返回，通过 /api/drama/check-status 轮询结果
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId, sceneIds } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const apiKey = process.env.AGNES_API_KEY || ''
  if (!apiKey) return NextResponse.json({ error: '未配置 AGNES_API_KEY' }, { status: 400 })

  // 获取有图片但没有视频的分镜
  let query = adminSupabase
    .from('drama_scenes')
    .select('*')
    .eq('project_id', projectId)
    .not('image_url', 'eq', '')
    .eq('video_url', '')

  if (sceneIds?.length) {
    query = query.in('id', sceneIds)
  }

  const { data: scenes, error } = await query.order('scene_number')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!scenes?.length) return NextResponse.json({ results: [], message: '没有待生成视频的分镜' })

  // 逐个提交视频生成请求（不等待结果）
  const results: any[] = []

  for (const scene of scenes) {
    try {
      const result = await submitVideoGeneration(scene, apiKey)
      results.push(result)
    } catch (err: any) {
      results.push({ sceneId: scene.id, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ results })
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

  // 提交请求，8 秒超时（只等提交确认，不等生成结果）
  const response = await fetch('https://apihub.agnes-ai.com/v1/videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Agnes API error: ${response.status} - ${errText.slice(0, 200)}`)
  }

  const data = await response.json()

  // 更新数据库状态
  const adminSupabase = await createAdminClient()
  await adminSupabase
    .from('drama_scenes')
    .update({
      video_request_id: data.request_id || '',
      status: 'generating_video',
    })
    .eq('id', scene.id)

  return { sceneId: scene.id, requestId: data.request_id, status: 'submitted' }
}
