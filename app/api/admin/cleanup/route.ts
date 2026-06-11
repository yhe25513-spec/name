import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const inactiveNonEmail = (users.users || []).filter(u => {
    const isEmailUser = u.app_metadata?.provider === 'email' || u.app_metadata?.providers?.includes('email')
    const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null
    const isInactive = !lastSignIn || lastSignIn < thirtyDaysAgo
    return !isEmailUser && isInactive
  })

  return NextResponse.json({
    total: users.users?.length || 0,
    inactiveNonEmailCount: inactiveNonEmail.length,
    users: inactiveNonEmail.map(u => ({
      id: u.id,
      email: u.email,
      provider: u.app_metadata?.provider || 'unknown',
      lastSignIn: u.last_sign_in_at,
      createdAt: u.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const inactiveNonEmail = (users.users || []).filter(u => {
    const isEmailUser = u.app_metadata?.provider === 'email' || u.app_metadata?.providers?.includes('email')
    const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null
    const isInactive = !lastSignIn || lastSignIn < thirtyDaysAgo
    return !isEmailUser && isInactive
  })

  const results = { deleted: 0, errors: [] as string[] }

  for (const u of inactiveNonEmail) {
    const { error: delError } = await supabase.auth.admin.deleteUser(u.id)
    if (delError) {
      results.errors.push(`Failed to delete ${u.email || u.id}: ${delError.message}`)
    } else {
      results.deleted++
    }
  }

  return NextResponse.json({
    message: `Deleted ${results.deleted} inactive non-email users`,
    ...results,
  })
}
