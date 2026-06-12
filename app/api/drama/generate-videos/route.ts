import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Step 4: 批量为分镜生成视频（并发控制，最多 2 个同时）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId, sceneIds } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const adminSupabase = await createAdminClient()

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
  if (!scenes?.length) return NextResponse.json({ scenes: [], message: '没有待生成视频的分镜' })

  // 并发生成视频（最多 2 个同时）
  const MAX_CONCURRENT = 2
  const results: any[] = []

  for (let i = 0; i < scenes.length; i += MAX_CONCURRENT) {
    const batch = scenes.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map(scene => generateVideoForScene(scene))
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }
  }

  return NextResponse.json({ results })
}

async function generateVideoForScene(scene: any): Promise<any> {
  const apiKey = process.env.AGNES_API_KEY || ''
  if (!apiKey) throw new Error('未配置 AGNES_API_KEY')

  // 用图片作为参考，生成视频
  const response = await fetch('https://apihub.agnes-ai.com/agnesapi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: scene.description,
      model: 'agnes-video-v2.0',
      image_url: scene.image_url,
      duration: Math.min(scene.duration || 5, 18),
    }),
    signal: AbortSignal.timeout(300000),
  })

  if (!response.ok) throw new Error(`Agnes API error: ${response.status}`)

  const data = await response.json()

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
