import { supabase } from './store'

export async function getRelationships(novelId: string) {
  const { data } = await supabase.from('relationships').select('*').eq('novel_id', novelId)
  const rels: Record<string, any> = {}
  for (const r of (data || [])) {
    rels[`${r.from_char}->${r.to_char}`] = {
      type: r.rel_type, trust_level: r.trust_level,
      trust_history: r.trust_history || [],
      last_updated_chapter: r.last_updated_chapter,
    }
  }
  return { novel_id: novelId, relationships: rels, trust_change_alert_threshold: 10 }
}

export async function updateTrust(novelId: string, from: string, to: string, delta: number, chapter: number, reason = '', relType?: string) {
  const alertThreshold = 10
  const warnings: string[] = []

  if (Math.abs(delta) > alertThreshold) {
    warnings.push(`关系 ${from}->${to} 单章变化 ${delta} 超过阈值`)
    delta = Math.max(-alertThreshold, Math.min(alertThreshold, delta))
  }

  // Check if relationship exists
  const { data: existing } = await supabase.from('relationships')
    .select('*').eq('novel_id', novelId).eq('from_char', from).eq('to_char', to).single()

  if (existing) {
    const newTrust = Math.max(-100, Math.min(100, (existing.trust_level || 0) + delta))
    const history = [...(existing.trust_history || []), { chapter, value: newTrust, reason }]
    const { error } = await supabase.from('relationships').update({
      trust_level: newTrust, trust_history: history,
      rel_type: relType || existing.rel_type,
      last_updated_chapter: chapter, updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
    if (error) throw new Error(error.message)
    return { success: true, new_value: newTrust, warnings }
  } else {
    const newTrust = Math.max(-100, Math.min(100, delta))
    const { error } = await supabase.from('relationships').insert({
      novel_id: novelId, from_char: from, to_char: to,
      rel_type: relType || '未知', trust_level: newTrust,
      trust_history: [{ chapter, value: newTrust, reason }],
      last_updated_chapter: chapter,
    })
    if (error) throw new Error(error.message)
    return { success: true, new_value: newTrust, warnings }
  }
}

export async function getRelationshipReport(novelId: string) {
  const { data } = await supabase.from('relationships').select('*').eq('novel_id', novelId)
  const sorted = (data || []).sort((a, b) => (b.trust_level || 0) - (a.trust_level || 0))
  return {
    most_trusted: sorted.slice(0, 3),
    least_trusted: sorted.slice(-3),
  }
}
