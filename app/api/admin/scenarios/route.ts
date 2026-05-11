import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', user: null, supabase: null }
  return { error: null, user, supabase }
}

async function isAdmin(userId: string) {
  const adminSupabase = await createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return profile?.role === 'admin'
}

export async function GET() {
  const { error, user, supabase } = await requireAuth()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status: 403 })

  const userIsAdmin = await isAdmin(user.id)
  const adminSupabase = await createAdminClient()

  // 使用 adminClient 绕过 RLS（防止表级权限限制）
  // 然后在代码层过滤权限：admin 看全部，普通用户只看自己的
  const { data, error: queryError } = await adminSupabase
    .from('game_scenarios')
    .select('*, ai_config:ai_configs(*)')
    .order('created_at', { ascending: false })

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })

  let scenarios = data || []
  if (!userIsAdmin) {
    scenarios = scenarios.filter(s => s.created_by === user.id)
  }

  return NextResponse.json({ scenarios, isAdmin: userIsAdmin, userId: user.id })
}

export async function POST(req: NextRequest) {
  const { error, user, supabase } = await requireAuth()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()

  // 如果未指定 AI 配置，自动关联默认配置
  if (!body.ai_config_id) {
    const { data: defaultConfig } = await supabase
      .from('ai_configs')
      .select('id')
      .eq('is_default', true)
      .maybeSingle()
    if (defaultConfig) {
      body.ai_config_id = defaultConfig.id
    }
  }

  const { data, error: insertError } = await supabase
    .from('game_scenarios')
    .insert({ ...body, created_by: user.id })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json({ scenario: data })
}

export async function PATCH(req: NextRequest) {
  const { error, user, supabase } = await requireAuth()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status: 403 })

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const userIsAdmin = await isAdmin(user.id)

  // 检查是否是场景创建者
  if (!userIsAdmin) {
    const { data: scenario } = await supabase
      .from('game_scenarios')
      .select('created_by')
      .eq('id', id)
      .single()

    if (scenario?.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Not your scenario' }, { status: 403 })
    }
  }

  const { data, error: updateError } = await supabase
    .from('game_scenarios')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ scenario: data })
}

export async function DELETE(req: NextRequest) {
  const { error, user, supabase } = await requireAuth()
  if (error || !supabase || !user) return NextResponse.json({ error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const userIsAdmin = await isAdmin(user.id)

  // 检查是否是场景创建者
  if (!userIsAdmin) {
    const { data: scenario } = await supabase
      .from('game_scenarios')
      .select('created_by')
      .eq('id', id)
      .single()

    if (scenario?.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Not your scenario' }, { status: 403 })
    }
  }

  const { error: deleteError } = await supabase.from('game_scenarios').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
