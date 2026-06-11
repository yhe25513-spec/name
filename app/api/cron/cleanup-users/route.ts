import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const inactiveNonEmail = (users.users || []).filter(u => {
    const isEmailUser = u.app_metadata?.provider === 'email' || u.app_metadata?.providers?.includes('email')
    const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null
    const isInactive = !lastSignIn || lastSignIn < thirtyDaysAgo
    return !isEmailUser && isInactive
  })

  let deleted = 0
  const errors: string[] = []

  for (const u of inactiveNonEmail) {
    const { error: delError } = await supabase.auth.admin.deleteUser(u.id)
    if (delError) {
      errors.push(`${u.email || u.id}: ${delError.message}`)
    } else {
      deleted++
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    checked: users.users?.length || 0,
    deleted,
    errors,
  })
}
