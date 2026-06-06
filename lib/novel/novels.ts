import { supabase } from './store'

export async function listNovels(userId?: string) {
  let query = supabase.from('novels').select('*').order('updated_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  const { data } = await query
  // 获取第一个小说作为当前（简化逻辑）
  const firstId = data?.[0]?.id || null
  return (data || []).map(n => ({
    id: n.id, title: n.title, genre: n.genre,
    chapter: n.progress?.current_chapter || 0,
    words: n.progress?.total_words || 0,
    is_current: n.id === firstId,
  }))
}

export async function createNovel(id: string, title: string, genre: string, userId?: string) {
  const { error } = await supabase.from('novels').insert({
    id, title, genre, user_id: userId,
    soul: { core_selling_points: [], forbidden_directions: [], tone: '', reader_promise: '' },
    progress: { current_chapter: 0, total_words: 0 },
    style: {
      'genre定位': genre, narrative_voice: '第三人称限制视角',
      pacing_profile: { type: '剧情驱动', 节奏: '中', 信息密度: '中', 悬念密度: '中' },
      chapter_stats: { avg_word_count: 2500, word_count_range: [2000, 3000], avg_paragraphs: 25, avg_dialogue_ratio: 0.3 },
      vocabulary_rules: { forbidden_patterns: [], preferred_patterns: [], banned_ai_phrases: ['不禁感叹', '心中暗道', '一股暖流'] },
      description_style: { action_density: '中', psychology_depth: '中', environment_detail: '中', dialogue_style: '自然' },
      deviation_thresholds: { word_count_drift: 0.3, dialogue_ratio_drift: 0.15, style_score_minimum: 85 },
    },
  })
  if (error) throw new Error(error.message)
}

export async function getNovelMeta(novelId: string) {
  const { data, error } = await supabase.from('novels').select('*').eq('id', novelId).single()
  if (error) throw new Error('小说不存在')
  return data
}

export async function saveNovelMeta(novelId: string, updates: Record<string, any>) {
  updates.updated_at = new Date().toISOString()
  const { error } = await supabase.from('novels').update(updates).eq('id', novelId)
  if (error) throw new Error(error.message)
}

export async function getNovelStatus(novelId: string) {
  const meta = await getNovelMeta(novelId)

  // 实时统计章节数和字数（不依赖缓存）
  const { count: chapterCount } = await supabase.from('chapters').select('*', { count: 'exact', head: true }).eq('novel_id', novelId)
  const { data: chapters } = await supabase.from('chapters').select('word_count').eq('novel_id', novelId)
  const totalWords = (chapters || []).reduce((sum, ch) => sum + (ch.word_count || 0), 0)

  const { count: fsCount } = await supabase.from('foreshadows').select('*', { count: 'exact', head: true }).eq('novel_id', novelId)
  const { count: mysCount } = await supabase.from('mysteries').select('*', { count: 'exact', head: true }).eq('novel_id', novelId)
  const { count: relCount } = await supabase.from('relationships').select('*', { count: 'exact', head: true }).eq('novel_id', novelId)

  return {
    novel_id: novelId, title: meta.title, genre: meta.genre,
    chapter: chapterCount || 0,
    words: totalWords,
    foreshadows: { total: fsCount || 0 },
    mysteries: mysCount || 0,
    relationships: relCount || 0,
    soul: meta.soul || {},
  }
}

export async function updateProgress(novelId: string, chapter: number, wordCount: number) {
  const meta = await getNovelMeta(novelId)
  const progress = meta.progress || { current_chapter: 0, total_words: 0 }
  progress.current_chapter = Math.max(progress.current_chapter || 0, chapter)
  // 直接设置总字数（从数据库计算），不累加
  const { count } = await supabase.from('chapters').select('*', { count: 'exact', head: true }).eq('novel_id', novelId)
  progress.total_words = (count || 0) * 2000 // 估算，实际保存时由前端传入
  await saveNovelMeta(novelId, { progress })
}
