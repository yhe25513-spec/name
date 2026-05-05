import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GameClient } from '@/components/game/GameClient'

interface Props {
  params: Promise<{ saveId: string }>
}

export default async function GameSavePage({ params }: Props) {
  const { saveId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: save, error } = await supabase
    .from('game_saves')
    .select('*, scenario:game_scenarios(*)')
    .eq('id', saveId)
    .eq('user_id', user.id)
    .single()

  if (error || !save) redirect('/game')

  return <GameClient initialSave={save} />
}
