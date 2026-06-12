import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// 创建短剧项目
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { title, genre, style, synopsis } = await req.json()

  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase
    .from('drama_projects')
    .insert({
      user_id: user.id,
      title: title || '未命名短剧',
      genre: genre || '其他',
      style: style || '写实',
      synopsis: synopsis || '',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}

// 获取用户的短剧项目列表，或获取某个项目的分镜
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  const adminSupabase = await createAdminClient()

  // 如果指定了 projectId，返回该项目的分镜（需验证归属）
  if (projectId) {
    const { data: project } = await adminSupabase
      .from('drama_projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) return NextResponse.json({ error: '无权访问' }, { status: 403 })

    const { data: scenes, error } = await adminSupabase
      .from('drama_scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('scene_number')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ scenes })
  }

  // 否则返回项目列表
  const { data, error } = await adminSupabase
    .from('drama_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data })
}

// 删除短剧项目
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // 先验证项目归属
  const { data: project } = await adminSupabase
    .from('drama_projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: '无权删除该项目' }, { status: 403 })

  // 删除分镜
  await adminSupabase
    .from('drama_scenes')
    .delete()
    .eq('project_id', projectId)

  // 删除项目
  const { error } = await adminSupabase
    .from('drama_projects')
    .delete()
    .eq('id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
