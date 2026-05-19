import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CharacterCreator } from '@/components/game/CharacterCreator'

interface Props {
  searchParams: Promise<{ scenarioId?: string }>
}

export default async function CharacterCreatePage({ searchParams }: Props) {
  const { scenarioId } = await searchParams
  if (!scenarioId) redirect('/game')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 使用常规 client + RLS，避免依赖 service_role_key
  const { data: scenario } = await supabase
    .from('game_scenarios')
    .select('id, title, description, system_prompt, initial_state')
    .eq('id', scenarioId)
    .single()

  if (!scenario) redirect('/game')

  const initialAttrs = (scenario.initial_state as { attributes?: Record<string, number> })?.attributes || {}
  const initial_state = scenario.initial_state as Record<string, unknown> | undefined
  const initialHp = (initial_state?.hp as number) || 100
  const initialMaxHp = (initial_state?.maxHp as number) || 100

  return (
    <CharacterCreator
      scenarioId={scenario.id}
      scenarioTitle={scenario.title}
      scenarioDescription={scenario.description || ''}
      scenarioSystemPrompt={scenario.system_prompt || ''}
      initialAttributes={initialAttrs}
      initialHp={initialHp}
      initialMaxHp={initialMaxHp}
    />
  )
}
