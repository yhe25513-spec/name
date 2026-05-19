import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConversationMessage, GameState } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { saveId, state, history, turnCount, scenarioId, title } = await req.json() as {
    saveId?: string
    scenarioId?: string
    state: GameState
    history: ConversationMessage[]
    turnCount: number
    title?: string
  }

  // 自动生成存档标题
  const autoTitle = title || generateSaveTitle(state, turnCount)

  if (saveId) {
    // 更新已有存档
    const { data, error } = await supabase
      .from('game_saves')
      .update({
        current_state: state,
        conversation_history: history,
        turn_count: turnCount,
        title: autoTitle,
        summary: generateSaveSummary(state),
        updated_at: new Date().toISOString(),
      })
      .eq('id', saveId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ save: data })
  } else {
    // 创建新存档
    const { data, error } = await supabase
      .from('game_saves')
      .insert({
        user_id: user.id,
        scenario_id: scenarioId,
        current_state: state,
        conversation_history: history,
        turn_count: turnCount,
        title: autoTitle,
        summary: generateSaveSummary(state),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ save: data })
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { saveId, title } = await req.json() as { saveId: string; title: string }
  if (!saveId || !title?.trim()) {
    return NextResponse.json({ error: 'Missing saveId or title' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('game_saves')
    .update({ title: title.trim() })
    .eq('id', saveId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ save: data })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const saveId = searchParams.get('saveId')

  if (saveId) {
    const { data, error } = await supabase
      .from('game_saves')
      .select('*, scenario:game_scenarios(*)')
      .eq('id', saveId)
      .eq('user_id', user.id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ save: data })
  }

  // 返回用户所有存档
  const { data, error } = await supabase
    .from('game_saves')
    .select('*, scenario:game_scenarios(id, title, description)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saves: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // 只能删除自己的存档
  const { error } = await supabase
    .from('game_saves')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ─── 辅助函数 ───

function generateSaveTitle(state: GameState, turnCount: number): string {
  const location = state.location || '未知之地'
  const realm = state.realm || '凡人'
  const name = state.playerName || '修士'
  return `第${turnCount}回合 · ${name} · ${location}`
}

function generateSaveSummary(state: GameState): string {
  const parts: string[] = []
  if (state.realm) parts.push(`境界:${state.realm}`)
  if (state.hp !== undefined && state.maxHp) {
    const pct = Math.round((state.hp / state.maxHp) * 100)
    parts.push(`HP:${pct}%`)
  }
  if (state.location) parts.push(`位置:${state.location}`)
  if (state.inventory?.length) parts.push(`背包:${state.inventory.length}件`)
  return parts.join(' | ')
}
