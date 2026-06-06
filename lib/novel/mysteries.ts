import { Mystery, MysteryStore } from './types'
import { readJSON, writeJSON, mysteriesPath } from './store'

export async function getMysteries(novelId: string): Promise<MysteryStore> {
  try {
    return await readJSON<MysteryStore>(mysteriesPath(novelId))
  } catch {
    return { novel_id: novelId, mysteries: [] }
  }
}

export async function saveMysteries(novelId: string, data: MysteryStore) {
  await writeJSON(mysteriesPath(novelId), data)
}

export async function addMystery(novelId: string, name: string, tier = '支线') {
  const data = await getMysteries(novelId)
  const existingNums = data.mysteries.map(m => parseInt(m.id.replace('mystery_', '')) || 0)
  const nextNum = Math.max(0, ...existingNums) + 1

  const m: Mystery = {
    id: `mystery_${String(nextNum).padStart(3, '0')}`,
    name, tier: tier as any,
    revelation_progress: 0, revelation_budget: 100,
    planted_chapter: 1, key_foreshadows: [],
    revelation_stages: [
      { stage: 1, threshold: 0, description: '读者完全不知情' },
      { stage: 2, threshold: 15, description: '暗示存在异常' },
      { stage: 3, threshold: 35, description: '部分真相浮出' },
      { stage: 4, threshold: 60, description: '核心机制揭露' },
      { stage: 5, threshold: 85, description: '完全真相' },
      { stage: 6, threshold: 100, description: '真相大白' },
    ],
    current_stage: 1, max_per_chapter: 5,
    forbidden_chapters: [], last_updated_chapter: 1,
  }

  data.mysteries.push(m)
  await saveMysteries(novelId, data)
  return m
}

export async function revealMystery(novelId: string, mysteryId: string, chapter: number, delta: number, note = '') {
  const data = await getMysteries(novelId)
  const m = data.mysteries.find(x => x.id === mysteryId)
  if (!m) throw new Error(`悬念 ${mysteryId} 不存在`)
  m.revelation_progress = Math.min(100, m.revelation_progress + delta)
  m.last_updated_chapter = chapter
  // Update stage
  for (const stage of [...m.revelation_stages].reverse()) {
    if (m.revelation_progress >= stage.threshold) {
      m.current_stage = stage.stage
      break
    }
  }
  await saveMysteries(novelId, data)
}

export async function getWritingConstraints(novelId: string, chapter: number) {
  const data = await getMysteries(novelId)
  const constraints: any[] = []
  for (const m of data.mysteries) {
    constraints.push({
      id: m.id, name: m.name,
      current_progress: m.revelation_progress,
      current_stage: m.current_stage,
      can_reveal: !m.forbidden_chapters.includes(chapter) && m.revelation_progress < 100,
      max_delta: Math.min(m.max_per_chapter, 100 - m.revelation_progress),
      hints: [],
    })
  }
  return { chapter, max_total_revelation: 5, mysteries: constraints, warnings: [] }
}
