import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 验证用户登录 + projectId 归属校验
export async function requireDramaAuth(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) }

  const adminSupabase = await createAdminClient()
  const { data: project } = await adminSupabase
    .from('drama_projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return { error: NextResponse.json({ error: '无权访问该项目' }, { status: 403 }) }

  return { user, adminSupabase }
}
