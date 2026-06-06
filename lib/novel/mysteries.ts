import { supabase } from './store'

export async function getMysteries(novelId: string) {
  const { data } = await supabase.from('mysteries').select('*').eq('novel_id', novelId)
  return { novel_id: novelId, mysteries: data || [] }
}

export async function addMystery(novelId: string, name: string, tier = '支线') {
  const { data: existing } = await supabase.from('mysteries').select('id').eq('novel_id', novelId)
  const nextNum = (existing?.length || 0) + 1
  const id = `mystery_${crypto.randomUUID().slice(0, 8)}`

  const { error } = await supabase.from('mysteries').insert({
    id, novel_id: novelId, name, tier,
    revelation_progress: 0, planted_chapter: 1, current_stage: 1, max_per_chapter: 5,
    revelation_stages: [
      { stage: 1, threshold: 0, description: '读者完全不知情' },
      { stage: 2, threshold: 15, description: '暗示存在异常' },
      { stage: 3, threshold: 35, description: '部分真相浮出' },
      { stage: 4, threshold: 60, description: '核心机制揭露' },
      { stage: 5, threshold: 85, description: '完全真相' },
      { stage: 6, threshold: 100, description: '真相大白' },
    ],
    forbidden_chapters: [], last_updated_chapter: 1,
  })
  if (error) throw new Error(error.message)
  return { id }
}

export async function revealMystery(novelId: string, mysteryId: string, chapter: number, delta: number, note = '') {
  const { data: m } = await supabase.from('mysteries').select('*').eq('id', mysteryId).eq('novel_id', novelId).single()
  if (!m) throw new Error(`悬念 ${mysteryId} 不存在`)

  const newProgress = Math.min(100, (m.revelation_progress || 0) + delta)
  let newStage = m.current_stage
  const stages = m.revelation_stages || []
  for (const s of [...stages].reverse()) {
    if (newProgress >= s.threshold) { newStage = s.stage; break }
  }

  const { error } = await supabase.from('mysteries').update({
    revelation_progress: newProgress, current_stage: newStage,
    last_updated_chapter: chapter, updated_at: new Date().toISOString(),
  }).eq('id', mysteryId)
  if (error) throw new Error(error.message)
}

export async function getWritingConstraints(novelId: string, chapter: number) {
  const { data } = await supabase.from('mysteries').select('*').eq('novel_id', novelId)
  const constraints = (data || []).map(m => ({
    id: m.id, name: m.name,
    current_progress: m.revelation_progress || 0,
    current_stage: m.current_stage,
    can_reveal: !(m.forbidden_chapters || []).includes(chapter) && m.revelation_progress < 100,
    max_delta: Math.min(m.max_per_chapter || 5, 100 - (m.revelation_progress || 0)),
    hints: [],
  }))
  return { chapter, max_total_revelation: 5, mysteries: constraints, warnings: [] }
}
