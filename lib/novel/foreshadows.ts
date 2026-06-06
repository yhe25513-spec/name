import { supabase } from './store'

export async function getForeshadows(novelId: string) {
  const { data } = await supabase.from('foreshadows').select('*').eq('novel_id', novelId).order('chapter_planted')
  const fs = data || []
  return {
    novel_id: novelId,
    foreshadows: fs,
    stats: {
      total: fs.length,
      unresolved: fs.filter(f => f.status === '未回收' || f.status === '部分回收').length,
      overdue: 0,
      avg_age_chapters: 0,
    },
  }
}

export async function addForeshadow(novelId: string, content: string, chapter: number, importance = '支线', tier = 'sub', category = 'plot_hook', expectedRevealRange?: [number, number]) {
  // Use timestamp + random suffix to avoid ID collisions in concurrent requests
  const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('foreshadows').insert({
    id, novel_id: novelId, content, chapter_planted: chapter,
    importance, tier, status: '未回收', category,
    expected_reveal_range: expectedRevealRange || [chapter + 10, chapter + 30],
    evidence: '', created_at: today, updated_at: today,
  })
  if (error) throw new Error(error.message)
  return { id }
}

export async function closeForeshadow(novelId: string, foreshadowId: string, chapter: number) {
  const { error } = await supabase.from('foreshadows').update({
    status: '已回收', actual_reveal_chapter: chapter, updated_at: new Date().toISOString().split('T')[0],
  }).eq('id', foreshadowId).eq('novel_id', novelId)
  if (error) throw new Error(error.message)
}

export async function checkOverdue(novelId: string, currentChapter: number) {
  const { data } = await supabase.from('foreshadows').select('*').eq('novel_id', novelId).in('status', ['未回收', '部分回收'])
  return (data || []).filter(f => {
    const range = f.expected_reveal_range || [0, 999]
    return currentChapter > (range[1] || 999) + 10
  })
}
