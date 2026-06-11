import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileUrl } = await req.json()
  if (!fileUrl) return NextResponse.json({ error: 'No file URL' }, { status: 400 })

  try {
    const urlParts = fileUrl.split('/')
    const fileName = urlParts[urlParts.length - 1]

    if (!fileName.includes(user.id.slice(0, 8))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminSupabase = await createAdminClient()
    const { error } = await adminSupabase.storage
      .from('scenario-bg-images')
      .remove([fileName])

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
