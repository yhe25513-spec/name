import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 保存视频生成的 request_id 到数据库（前端已通过 /api/generate-video 提交）
export async function POST(req: NextRequest) {
  const { projectId, sceneId, requestId } = await req.json()
  if (!projectId || !sceneId) return NextResponse.json({ error: '缺少参数' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  await adminSupabase
    .from('drama_scenes')
    .update({
      video_request_id: requestId || '',
      status: 'generating_video',
    })
    .eq('id', sceneId)

  return NextResponse.json({ ok: true })
}
