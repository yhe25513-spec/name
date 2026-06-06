import { Relationship, RelationshipStore } from './types'
import { readJSON, writeJSON, relationshipsPath } from './store'

export async function getRelationships(novelId: string): Promise<RelationshipStore> {
  try {
    return await readJSON<RelationshipStore>(relationshipsPath(novelId))
  } catch {
    return { novel_id: novelId, relationships: {}, trust_decay_rate: 0.5, trust_change_alert_threshold: 10 }
  }
}

export async function saveRelationships(novelId: string, data: RelationshipStore) {
  await writeJSON(relationshipsPath(novelId), data)
}

export async function updateTrust(novelId: string, from: string, to: string, delta: number, chapter: number, reason = '', relType?: string) {
  const data = await getRelationships(novelId)
  const key = `${from}->${to}`
  const alertThreshold = data.trust_change_alert_threshold
  const warnings: string[] = []

  if (!data.relationships[key]) {
    data.relationships[key] = {
      type: relType || '未知', trust_level: 0, trust_history: [],
      emotional_distance: 50, power_dynamic: '', tags: [],
      last_updated_chapter: chapter,
    }
  }

  const rel = data.relationships[key]
  if (Math.abs(delta) > alertThreshold) {
    warnings.push(`关系 ${key} 单章变化 ${delta} 超过阈值 ${alertThreshold}`)
    delta = Math.max(-alertThreshold, Math.min(alertThreshold, delta))
  }

  const newTrust = Math.max(-100, Math.min(100, rel.trust_level + delta))
  rel.trust_history.push({ chapter, value: newTrust, reason })
  rel.trust_level = newTrust
  rel.last_updated_chapter = chapter
  if (relType) rel.type = relType

  await saveRelationships(novelId, data)
  return { success: true, new_value: newTrust, warnings }
}

export async function getRelationshipReport(novelId: string) {
  const data = await getRelationships(novelId)
  const sorted = Object.entries(data.relationships)
    .sort((a, b) => b[1].trust_level - a[1].trust_level)
  return {
    most_trusted: sorted.slice(0, 3).map(([k, v]) => ({ key: k, ...v })),
    least_trusted: sorted.slice(-3).map(([k, v]) => ({ key: k, ...v })),
    recent_changes: sorted.flatMap(([k, v]) =>
      v.trust_history.slice(-1).map(h => ({ key: k, ...h }))
    ).sort((a, b) => b.chapter - a.chapter).slice(0, 5),
  }
}
