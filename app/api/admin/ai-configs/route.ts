import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 检查管理员权限
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', supabase: null, user: null }
  
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden', supabase: null, user: null }
  
  return { error: null, supabase, user }
}

// GET - 获取所有 AI 配置
export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status: 403 })

  const { data, error: dbError } = await supabase
    .from('ai_configs')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ configs: data })
}

// POST - 创建新配置
export async function POST(req: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()
  const { name, provider, model, api_key, api_base_url, temperature, max_tokens, is_default } = body

  if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })

  // 如果设为默认，先取消其他默认
  if (is_default) {
    await supabase.from('ai_configs').update({ is_default: false }).eq('is_default', true)
  }

  const { data, error: dbError } = await supabase
    .from('ai_configs')
    .insert({
      name: name.trim(),
      provider: provider || 'custom',
      model: model || 'gpt-3.5-turbo',
      api_key: api_key || '',
      api_base_url: api_base_url || null,
      temperature: temperature ?? 0.8,
      max_tokens: max_tokens ?? 1024,
      is_default: is_default || false,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ config: data })
}

// PATCH - 更新配置
export async function PATCH(req: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()
  const { id, name, provider, model, api_key, api_base_url, temperature, max_tokens, is_default } = body

  if (!id) return NextResponse.json({ error: '缺少配置 ID' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (provider !== undefined) updates.provider = provider
  if (model !== undefined) updates.model = model
  if (api_key !== undefined) updates.api_key = api_key
  if (api_base_url !== undefined) updates.api_base_url = api_base_url || null
  if (temperature !== undefined) updates.temperature = temperature
  if (max_tokens !== undefined) updates.max_tokens = max_tokens
  if (is_default !== undefined) updates.is_default = is_default

  // 如果设为默认，先取消其他默认
  if (is_default) {
    await supabase.from('ai_configs').update({ is_default: false }).eq('is_default', true)
  }

  const { data, error: dbError } = await supabase
    .from('ai_configs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ config: data })
}

// DELETE - 删除配置
export async function DELETE(req: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: '缺少配置 ID' }, { status: 400 })

  const { error: dbError } = await supabase.from('ai_configs').delete().eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
