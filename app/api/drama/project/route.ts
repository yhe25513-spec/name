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

// 获取用户的短剧项目列表
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase
    .from('drama_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data })
}
