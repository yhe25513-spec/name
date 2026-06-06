import { Foreshadow, ForeshadowStore } from './types'
import { readJSON, writeJSON, foreshadowsPath } from './store'

export async function getForeshadows(novelId: string): Promise<ForeshadowStore> {
  try {
    return await readJSON<ForeshadowStore>(foreshadowsPath(novelId))
  } catch {
    return { novel_id: novelId, foreshadows: [], stats: { total: 0, unresolved: 0, overdue: 0, avg_age_chapters: 0 } }
  }
}

export async function saveForeshadows(novelId: string, data: ForeshadowStore) {
  await writeJSON(foreshadowsPath(novelId), data)
}

export async function addForeshadow(novelId: string, content: string, chapter: number, importance = '支线', tier = 'sub', category = 'plot_hook', expectedRevealRange?: [number, number]) {
  const data = await getForeshadows(novelId)
  const today = new Date().toISOString().split('T')[0]

  // Generate ID
  const existingNums = data.foreshadows.map(f => parseInt(f.id.replace('fs_', '')) || 0)
  const nextNum = Math.max(0, ...existingNums) + 1

  const fs: Foreshadow = {
    id: `fs_${String(nextNum).padStart(3, '0')}`,
    chapter_planted: chapter,
    content,
    importance: importance as any,
    tier: tier as any,
    status: '未回收',
    category,
    related_entities: [],
    related_mysteries: [],
    expected_reveal_range: expectedRevealRange || [chapter + 10, chapter + 30],
    actual_reveal_chapter: null,
    urgency_score: 0,
    evidence: '',
    created_at: today,
    updated_at: today,
  }

  data.foreshadows.push(fs)
  updateStats(data)
  await saveForeshadows(novelId, data)
  return fs
}

export async function closeForeshadow(novelId: string, foreshadowId: string, chapter: number) {
  const data = await getForeshadows(novelId)
  const fs = data.foreshadows.find(f => f.id === foreshadowId)
  if (!fs) throw new Error(`伏笔 ${foreshadowId} 不存在`)
  fs.status = '已回收'
  fs.actual_reveal_chapter = chapter
  fs.updated_at = new Date().toISOString().split('T')[0]
  updateStats(data)
  await saveForeshadows(novelId, data)
}

export async function checkOverdue(novelId: string, currentChapter: number) {
  const data = await getForeshadows(novelId)
  const buffer = 10
  return data.foreshadows.filter(f => {
    if (f.status !== '未回收' && f.status !== '部分回收') return false
    const [, maxReveal] = f.expected_reveal_range
    return currentChapter > maxReveal + buffer
  })
}

function updateStats(data: ForeshadowStore) {
  const total = data.foreshadows.length
  const unresolved = data.foreshadows.filter(f => f.status === '未回收' || f.status === '部分回收').length
  data.stats = { total, unresolved, overdue: 0, avg_age_chapters: 0 }
}
