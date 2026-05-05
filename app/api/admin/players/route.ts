import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminSupabase = await createAdminClient()

  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, username, role, created_at')
    .order('created_at', { ascending: false })

  const { data: saveCounts } = await adminSupabase
    .from('game_saves')
    .select('user_id, turn_count, updated_at')

  const players = (profiles || []).map((p) => {
    const userSaves = (saveCounts || []).filter((s) => s.user_id === p.id)
    const totalTurns = userSaves.reduce((acc, s) => acc + (s.turn_count || 0), 0)
    const lastActive = userSaves.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0]?.updated_at

    return {
      ...p,
      save_count: userSaves.length,
      total_turns: totalTurns,
      last_active: lastActive || null,
    }
  })

  return NextResponse.json({ players })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { playerId, role } = await req.json()
  if (!playerId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const { error } = await adminSupabase.from('profiles').update({ role }).eq('id', playerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
