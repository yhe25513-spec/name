import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function requireAdmin() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', supabase: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden', supabase: null }
  return { error: null, supabase }
}

// 获取配置
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error: dbError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'cardgame_api_key')
      .single()

    if (dbError || !data) {
      return NextResponse.json({ apiKey: '' })
    }

    // Decrypt and mask the key for display
    const rawKey = data.value || ''
    const decryptedKey = isEncrypted(rawKey) ? decrypt(rawKey) : rawKey
    const masked = decryptedKey.length > 8
      ? decryptedKey.slice(0, 4) + '****' + decryptedKey.slice(-4)
      : decryptedKey ? '****' : ''
    return NextResponse.json({ apiKey: masked })
  } catch {
    return NextResponse.json({ apiKey: '' })
  }
}

// 保存配置
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const { apiKey } = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .eq('key', 'cardgame_api_key')
      .single()

    if (existing) {
      await supabase
        .from('app_config')
        .update({ value: apiKey ? encrypt(apiKey) : '', updated_at: new Date().toISOString() })
        .eq('key', 'cardgame_api_key')
    } else {
      await supabase
        .from('app_config')
        .insert({ key: 'cardgame_api_key', value: apiKey ? encrypt(apiKey) : '' })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
