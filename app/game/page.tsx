import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ScenarioSelector } from '@/components/game/ScenarioSelector'

export default async function GamePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: saves } = await supabase
    .from('game_saves')
    .select('*, scenario:game_scenarios(id, title, description)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const { data: scenarios } = await supabase
    .from('game_scenarios')
    .select('id, title, description, initial_state, background_image_url, created_by, is_published')
    .or(`is_published.eq.true,created_by.eq.${user.id}`)

  const adminSupabase = await createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('username, role')
    .eq('id', user.id)
    .single()

  return (
    <ScenarioSelector
      saves={saves || []}
      scenarios={scenarios || []}
      username={profile?.username || user.email || '冒险者'}
      isAdmin={profile?.role === 'admin'}
      userId={user.id}
    />
  )
}
