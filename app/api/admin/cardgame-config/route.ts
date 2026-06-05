import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// 获取配置
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'cardgame_api_key')
      .single()

    if (error || !data) {
      return NextResponse.json({ apiKey: '' })
    }

    return NextResponse.json({ apiKey: data.value })
  } catch {
    return NextResponse.json({ apiKey: '' })
  }
}

// 保存配置
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 先检查是否存在
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .eq('key', 'cardgame_api_key')
      .single()

    if (existing) {
      // 更新
      await supabase
        .from('app_config')
        .update({ value: apiKey, updated_at: new Date().toISOString() })
        .eq('key', 'cardgame_api_key')
    } else {
      // 插入
      await supabase
        .from('app_config')
        .insert({ key: 'cardgame_api_key', value: apiKey })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
