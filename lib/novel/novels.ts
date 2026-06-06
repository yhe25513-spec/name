import { promises as fs } from 'fs'
import path from 'path'
import { NovelMeta, StoryState } from './types'
import { readJSON, writeJSON, novelMetaPath, novelDir } from './store'

const DATA_BASE = path.join(process.cwd(), 'data', 'novels')

export async function getNovelMeta(novelId: string): Promise<NovelMeta> {
  return readJSON<NovelMeta>(novelMetaPath(novelId))
}

export async function saveNovelMeta(novelId: string, meta: NovelMeta) {
  meta.updated_at = new Date().toISOString()
  await writeJSON(novelMetaPath(novelId), meta)
}

export async function createNovel(id: string, title: string, genre: string) {
  const dir = path.join(DATA_BASE, id)
  const existing = await fs.readdir(DATA_BASE).catch((): string[] => [])
  if (existing.includes(id)) throw new Error(`小说 '${id}' 已存在`)

  // Create directories
  const dirs = ['正文', '大纲', '设定集', 'chapter_objectives', 'character_cards']
  for (const d of dirs) {
    await fs.mkdir(path.join(dir, d), { recursive: true })
  }

  // Create novel.json
  const meta: NovelMeta = {
    novel_id: id, title, genre,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    progress: { current_chapter: 0, total_words: 0 },
    soul: { core_hooks: [], forbidden_directions: [], tone: '', reader_promise: '' },
    settings: {},
  }
  await writeJSON(path.join(dir, 'novel.json'), meta)

  // Create default data files
  const { defaultForeshadows, defaultMysteries, defaultRelationships, defaultPowerSystem } = await import('./store')
  await writeJSON(path.join(dir, 'foreshadows.json'), defaultForeshadows(id))
  await writeJSON(path.join(dir, 'mysteries.json'), defaultMysteries(id))
  await writeJSON(path.join(dir, 'relationships.json'), defaultRelationships(id))
  await writeJSON(path.join(dir, 'power_system.json'), defaultPowerSystem(id))

  // Create style fingerprint
  await writeJSON(path.join(dir, 'style-fingerprint.json'), {
    novel_id: id, 'genre定位': genre, narrative_voice: '第三人称限制视角',
    pacing_profile: { type: '剧情驱动', 节奏: '中', 信息密度: '中', 悬念密度: '中' },
    chapter_stats: { avg_word_count: 2500, word_count_range: [2000, 3000], avg_paragraphs: 25, avg_dialogue_ratio: 0.3 },
    vocabulary_rules: { forbidden_patterns: [], preferred_patterns: [], banned_ai_phrases: ['不禁感叹', '心中暗道', '一股暖流', '不得不承认'] },
    description_style: { action_density: '中', psychology_depth: '中', environment_detail: '中', dialogue_style: '自然' },
    deviation_thresholds: { word_count_drift: 0.3, dialogue_ratio_drift: 0.15, style_score_minimum: 85 },
  })

  // Create state.json
  await writeJSON(path.join(dir, 'state.json'), {
    progress: { current_chapter: 0, total_words: 0 },
    protagonist_state: {}, entities: {}, alias_index: {},
    recent_changes: [], disambiguation: [],
  })

  return dir
}

export async function getNovelStatus(novelId: string) {
  const meta = await getNovelMeta(novelId)
  const { readJSON: r } = await import('./store')
  const fs = await r<any>(path.join(DATA_BASE, novelId, 'foreshadows.json')).catch(() => ({ stats: {} }))
  const mys = await r<any>(path.join(DATA_BASE, novelId, 'mysteries.json')).catch(() => ({ mysteries: [] }))
  const rels = await r<any>(path.join(DATA_BASE, novelId, 'relationships.json')).catch(() => ({ relationships: {} }))
  return {
    novel_id: novelId, title: meta.title, genre: meta.genre,
    chapter: meta.progress.current_chapter, words: meta.progress.total_words,
    foreshadows: fs.stats, mysteries: mys.mysteries?.length || 0,
    relationships: Object.keys(rels.relationships || {}).length,
    soul: meta.soul,
  }
}

export async function updateProgress(novelId: string, chapter: number, wordCount: number) {
  const meta = await getNovelMeta(novelId)
  meta.progress.current_chapter = chapter
  meta.progress.total_words += wordCount
  await saveNovelMeta(novelId, meta)
}
