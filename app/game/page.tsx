import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ScenarioSelector } from '@/components/game/ScenarioSelector'

export default async function GamePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = await createAdminClient()

  // 并行查询：saves、scenarios、profile 互不依赖
  const [savesResult, allScenariosResult, profileResult] = await Promise.all([
    supabase
      .from('game_saves')
      .select('*, scenario:game_scenarios(id, title, description)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    adminSupabase
      .from('game_scenarios')
      .select('id, title, description, system_prompt, initial_state, background_image_url, created_by, is_published')
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('profiles')
      .select('username, role')
      .eq('id', user.id)
      .single(),
  ])

  const saves = savesResult.data || []
  const allScenarios = allScenariosResult.data || []
  const profile = profileResult.data

  // 只显示已发布 + 自己创建的（未发布的别人看不到）
  const scenarios = allScenarios.filter(
    s => s.is_published || s.created_by === user.id
  )

  return (
    <ScenarioSelector
      saves={saves}
      scenarios={scenarios}
      username={profile?.username || user.email || '冒险者'}
      isAdmin={profile?.role === 'admin'}
      userId={user.id}
    />
  )
}
