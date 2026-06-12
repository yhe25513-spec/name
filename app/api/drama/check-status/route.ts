import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// 检查分镜的图片/视频生成状态并更新
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const apiKey = process.env.AGNES_API_KEY || ''

  // 获取正在生成中的分镜
  const { data: scenes } = await adminSupabase
    .from('drama_scenes')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['generating_image', 'generating_video'])

  if (!scenes?.length) {
    console.log('[check-status] No generating scenes found for project', projectId)
    return NextResponse.json({ updated: 0 })
  }
  console.log(`[check-status] Found ${scenes.length} generating scenes`)

  const apiKeyVal = apiKey
  let updated = 0

  for (const scene of scenes) {
    try {
      if (scene.status === 'generating_video' && scene.video_request_id) {
        // 复用已有的视频状态查询逻辑
        const statusResponse = await fetch(
          `https://apihub.agnes-ai.com/agnesapi?video_id=${scene.video_request_id}`,
          {
            headers: { 'Authorization': `Bearer ${apiKeyVal}` },
            signal: AbortSignal.timeout(8000),
          }
        )

        if (statusResponse.ok) {
          const data = await statusResponse.json()
          const doneAliases = ['completed', 'done', 'succeed', 'success', 'ready', 'finish', 'finished']
          let videoUrl = data.video_url || data.remixed_from_video_id || ''
          const status = (data.status || '').toLowerCase()

          console.log(`[check-status] Scene ${scene.scene_number}: status=${status}, hasUrl=${!!videoUrl}`)

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
      }
    } catch {
      // 超时或网络错误，跳过这个场景，下次再试
    }
  }

  return NextResponse.json({ updated })
}
