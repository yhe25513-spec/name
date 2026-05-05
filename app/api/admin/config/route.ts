import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden', supabase: null }
  return { error: null, supabase }
}

export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status: 403 })

  const { data } = await supabase.from('admin_config').select('*').single()
  if (data) {
    // 确定当前使用的provider
    const provider = data.provider || 'deepseek'

    // 遮蔽 API Key 中间部分
    const key = data.api_key || data.deepseek_api_key || ''
    data.api_key_display = key.length > 8
      ? key.slice(0, 4) + '****' + key.slice(-4)
      : key ? '****' : ''

    // 确保provider字段存在
    data.provider = provider
  }
  return NextResponse.json({ config: data })
}

export async function PATCH(req: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // 支持新的多模型配置
  if (body.provider !== undefined) updates.provider = body.provider
  if (body.api_key !== undefined) {
    updates.api_key = body.api_key
    // 同时更新旧字段保持兼容
    updates.deepseek_api_key = body.api_key
  }
  if (body.api_base_url !== undefined) updates.api_base_url = body.api_base_url

  // 模型参数
  if (body.model !== undefined) updates.model = body.model
  if (body.temperature !== undefined) updates.temperature = body.temperature
  if (body.max_tokens !== undefined) updates.max_tokens = body.max_tokens

  // 先获取现有记录的 id（如果存在）
  const { data: existing } = await supabase.from('admin_config').select('id').limit(1).single()

  let result
  if (existing?.id) {
    // 更新现有记录
    result = await supabase
      .from('admin_config')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    // 插入新记录
    result = await supabase
      .from('admin_config')
      .insert({ id: crypto.randomUUID(), ...updates })
      .select()
      .single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ config: result.data })
}
