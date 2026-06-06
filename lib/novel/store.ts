import { promises as fs } from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data', 'novels')

// ========== File Operations ==========

export async function readJSON<T>(filePath: string): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    throw new Error(`文件不存在: ${path.relative(process.cwd(), filePath)}`)
  }
}

export async function writeJSON(filePath: string, data: any): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ========== Novel Paths ==========

export function novelDir(novelId: string) {
  return path.join(DATA_DIR, novelId)
}

export function novelMetaPath(novelId: string) {
  return path.join(novelDir(novelId), 'novel.json')
}

export function foreshadowsPath(novelId: string) {
  return path.join(novelDir(novelId), 'foreshadows.json')
}

export function mysteriesPath(novelId: string) {
  return path.join(novelDir(novelId), 'mysteries.json')
}

export function relationshipsPath(novelId: string) {
  return path.join(novelDir(novelId), 'relationships.json')
}

export function powerSystemPath(novelId: string) {
  return path.join(novelDir(novelId), 'power_system.json')
}

export function stylePath(novelId: string) {
  return path.join(novelDir(novelId), 'style-fingerprint.json')
}

export function chapterDir(novelId: string) {
  return path.join(novelDir(novelId), '正文')
}

export function chapterPath(novelId: string, chapter: number) {
  return path.join(chapterDir(novelId), `第${String(chapter).padStart(4, '0')}章.md`)
}

export function objectivePath(novelId: string, chapter: number) {
  return path.join(novelDir(novelId), 'chapter_objectives', `ch${String(chapter).padStart(4, '0')}.json`)
}

export function characterCardPath(novelId: string, characterId: string) {
  return path.join(novelDir(novelId), 'character_cards', `${characterId}.json`)
}

// ========== Current Novel ==========

const CURRENT_NOVEL_FILE = path.join(DATA_DIR, '.current.json')

export async function getCurrentNovel(): Promise<string | null> {
  try {
    const data = await readJSON<{ current_novel_id: string }>(CURRENT_NOVEL_FILE)
    return data.current_novel_id
  } catch {
    return null
  }
}

export async function setCurrentNovel(novelId: string): Promise<void> {
  await writeJSON(CURRENT_NOVEL_FILE, { current_novel_id: novelId, updated_at: new Date().toISOString() })
}

// ========== List All Novels ==========

export async function listNovels() {
  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true })
    const novels = []
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        try {
          const meta = await readJSON<any>(novelMetaPath(entry.name))
          novels.push({
            id: entry.name,
            title: meta.title || '未命名',
            genre: meta.genre || '未分类',
            chapter: meta.progress?.current_chapter || 0,
            words: meta.progress?.total_words || 0,
          })
        } catch { /* skip invalid dirs */ }
      }
    }
    const current = await getCurrentNovel()
    return novels.map(n => ({ ...n, is_current: n.id === current }))
  } catch {
    return []
  }
}

// ========== Default Data ==========

export function defaultForeshadows(novelId: string) {
  return {
    novel_id: novelId,
    foreshadows: [] as any[],
    stats: { total: 0, unresolved: 0, overdue: 0, avg_age_chapters: 0 },
  }
}

export function defaultMysteries(novelId: string) {
  return {
    novel_id: novelId,
    mysteries: [] as any[],
  }
}

export function defaultRelationships(novelId: string) {
  return {
    novel_id: novelId,
    relationships: {} as Record<string, any>,
    trust_decay_rate: 0.5,
    trust_change_alert_threshold: 10,
  }
}

export function defaultPowerSystem(novelId: string) {
  return {
    novel_id: novelId,
    realms: [] as any[],
    characters_current: {} as Record<string, any>,
    power_consistency_rules: [] as string[],
    violations: [] as any[],
  }
}
