// 剧情状态机管理器
// 追踪主线/支线/谜团进度，生成状态快照供 Agent 使用

import { supabase } from '../store'

// ========== 类型定义 ==========
interface StoryStateSnapshot {
  novelId: string
  chapter: number
  mainPlots: PlotState[]
  sidePlots: PlotState[]
  characterMysteries: MysteryState[]
  worldMysteries: MysteryState[]
  timeline: TimelineEvent[]
  characters: CharacterSnapshot[]
  worldSummary: string
  generatedAt: string
}

interface PlotState {
  id: string
  name: string
  description: string
  progress: number
  currentStage: number
  maxStages: number
  lastUpdatedChapter: number
}

interface MysteryState {
  id: string
  name: string
  description: string
  progress: number
  currentStage: number
  maxStages: number
  lastUpdatedChapter: number
}

interface TimelineEvent {
  chapter: number
  title: string
  description: string
  characters: string[]
  importance: number
}

interface CharacterSnapshot {
  name: string
  identity: string
  realm: string
  status: string
  traits: string[]
  beliefs: string
}

// ========== 生成状态快照 ==========
export async function generateStateSnapshot(novelId: string, chapter: number): Promise<StoryStateSnapshot> {
  // 并行获取所有数据
  const [
    storyStates,
    timelines,
    characters,
    worlds,
  ] = await Promise.all([
    supabase.from('story_states').select('*').eq('novel_id', novelId),
    supabase.from('timelines').select('*').eq('novel_id', novelId).lte('chapter_num', chapter).order('chapter_num'),
    supabase.from('characters').select('*').eq('novel_id', novelId),
    supabase.from('worlds').select('title, content, category').eq('novel_id', novelId),
  ])

  const states = storyStates.data || []
  const events = timelines.data || []
  const chars = characters.data || []
  const worldData = worlds.data || []

  // 分类剧情状态
  const mainPlots = states
    .filter(s => s.category === 'main_plot')
    .map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      progress: s.progress || 0,
      currentStage: s.current_stage || 1,
      maxStages: s.max_stages || 6,
      lastUpdatedChapter: s.last_updated_chapter || 0,
    }))

  const sidePlots = states
    .filter(s => s.category === 'side_plot')
    .map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      progress: s.progress || 0,
      currentStage: s.current_stage || 1,
      maxStages: s.max_stages || 6,
      lastUpdatedChapter: s.last_updated_chapter || 0,
    }))

  const characterMysteries = states
    .filter(s => s.category === 'character_mystery')
    .map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      progress: s.progress || 0,
      currentStage: s.current_stage || 1,
      maxStages: s.max_stages || 6,
      lastUpdatedChapter: s.last_updated_chapter || 0,
    }))

  const worldMysteries = states
    .filter(s => s.category === 'world_mystery')
    .map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      progress: s.progress || 0,
      currentStage: s.current_stage || 1,
      maxStages: s.max_stages || 6,
      lastUpdatedChapter: s.last_updated_chapter || 0,
    }))

  // 时间线事件
  const timeline = events.map(e => ({
    chapter: e.chapter_num,
    title: e.title,
    description: e.description,
    characters: e.characters_involved || [],
    importance: e.importance || 5,
  }))

  // 角色快照
  const charSnapshots = chars.map(c => ({
    name: c.name,
    identity: c.identity || '',
    realm: c.realm || '',
    status: c.status || 'active',
    traits: c.personality?.traits || [],
    beliefs: c.beliefs || '',
  }))

  // 世界观摘要
  const worldSummary = worldData
    .slice(0, 20)  // 限制数量
    .map(w => `【${w.title}】(${w.category}) ${w.content?.slice(0, 100) || ''}`)
    .join('\n')

  return {
    novelId,
    chapter,
    mainPlots,
    sidePlots,
    characterMysteries,
    worldMysteries,
    timeline,
    characters: charSnapshots,
    worldSummary,
    generatedAt: new Date().toISOString(),
  }
}

// ========== 格式化状态为文本 ==========
export function formatStateForAgents(snapshot: StoryStateSnapshot): string {
  const parts: string[] = []

  // 主线进度
  if (snapshot.mainPlots.length > 0) {
    parts.push('## 主线剧情进度')
    for (const p of snapshot.mainPlots) {
      parts.push(`- ${p.name}: ${p.progress}% (阶段${p.currentStage}/${p.maxStages})${p.description ? ' - ' + p.description : ''}`)
    }
    parts.push('')
  }

  // 支线进度
  if (snapshot.sidePlots.length > 0) {
    parts.push('## 支线剧情进度')
    for (const p of snapshot.sidePlots) {
      parts.push(`- ${p.name}: ${p.progress}% (阶段${p.currentStage}/${p.maxStages})`)
    }
    parts.push('')
  }

  // 角色谜团
  if (snapshot.characterMysteries.length > 0) {
    parts.push('## 角色谜团')
    for (const m of snapshot.characterMysteries) {
      parts.push(`- ${m.name}: 揭露度${m.progress}% (阶段${m.currentStage}/${m.maxStages})`)
    }
    parts.push('')
  }

  // 世界谜团
  if (snapshot.worldMysteries.length > 0) {
    parts.push('## 世界谜团')
    for (const m of snapshot.worldMysteries) {
      parts.push(`- ${m.name}: 揭露度${m.progress}% (阶段${m.currentStage}/${m.maxStages})`)
    }
    parts.push('')
  }

  // 最近事件
  if (snapshot.timeline.length > 0) {
    parts.push('## 最近事件')
    const recent = snapshot.timeline.slice(-10)
    for (const e of recent) {
      parts.push(`- 第${e.chapter}章: ${e.title}${e.characters.length > 0 ? ' (' + e.characters.join('、') + ')' : ''}`)
    }
    parts.push('')
  }

  // 角色状态
  if (snapshot.characters.length > 0) {
    parts.push('## 角色状态')
    for (const c of snapshot.characters) {
      parts.push(`- ${c.name}${c.identity ? ' (' + c.identity + ')' : ''}: ${c.realm || '未知境界'} [${c.status}]`)
      if (c.traits.length > 0) parts.push(`  性格: ${c.traits.join('、')}`)
      if (c.beliefs) parts.push(`  信念: ${c.beliefs}`)
    }
    parts.push('')
  }

  // 世界观
  if (snapshot.worldSummary) {
    parts.push('## 世界观摘要')
    parts.push(snapshot.worldSummary)
    parts.push('')
  }

  return parts.join('\n')
}

// ========== 检查悬念揭露约束 ==========
export function checkMysteryConstraints(snapshot: StoryStateSnapshot, chapter: number): {
  canReveal: boolean
  maxRevelationAllowed: number
  blockedMysteries: string[]
  notes: string[]
} {
  const notes: string[] = []
  const blockedMysteries: string[] = []
  let totalMaxDelta = 0

  // 检查每个谜团的揭露约束
  const allMysteries = [...snapshot.characterMysteries, ...snapshot.worldMysteries]

  for (const mystery of allMysteries) {
    // 如果揭露度已达100%，跳过
    if (mystery.progress >= 100) {
      notes.push(`${mystery.name} 已完全揭露`)
      continue
    }

    // 检查是否在禁止章节
    // (这里简化处理，实际应该检查 constraints 中的 forbidden_chapters)

    // 检查阶段约束
    if (mystery.currentStage >= mystery.maxStages) {
      notes.push(`${mystery.name} 已达最大阶段，不能继续揭露`)
      blockedMysteries.push(mystery.name)
      continue
    }

    // 计算本章最大揭露增量
    const remainingProgress = 100 - mystery.progress
    const remainingStages = mystery.maxStages - mystery.currentStage
    const maxDelta = remainingStages > 0 ? Math.min(remainingProgress, 100 / mystery.maxStages) : 0

    notes.push(`${mystery.name}: 本章最多揭露 ${maxDelta.toFixed(0)}%`)
    totalMaxDelta += maxDelta
  }

  return {
    canReveal: blockedMysteries.length === 0,
    maxRevelationAllowed: totalMaxDelta,
    blockedMysteries,
    notes,
  }
}

// ========== 更新剧情状态 ==========
export async function updateStoryStates(
  novelId: string,
  chapter: number,
  updates: {
    progressChanges?: { id: string; delta: number; note?: string }[]
    newEvents?: { title: string; description: string; characters: string[]; type: string }[]
  }
): Promise<void> {
  // 更新进度
  if (updates.progressChanges) {
    for (const change of updates.progressChanges) {
      const { data: state } = await supabase.from('story_states').select('progress, current_stage, max_stages').eq('id', change.id).single()
      if (!state) continue

      const newProgress = Math.min(100, Math.max(0, state.progress + change.delta))
      const newStage = Math.ceil((newProgress / 100) * (state.max_stages || 6))

      await supabase.from('story_states').update({
        progress: newProgress,
        current_stage: newStage,
        last_updated_chapter: chapter,
        updated_at: new Date().toISOString(),
      }).eq('id', change.id)
    }
  }

  // 添加新事件
  if (updates.newEvents) {
    for (const event of updates.newEvents) {
      // 获取当前最大 event_order
      const { data: maxOrder } = await supabase
        .from('timelines')
        .select('event_order')
        .eq('novel_id', novelId)
        .eq('chapter_num', chapter)
        .order('event_order', { ascending: false })
        .limit(1)
        .single()

      const nextOrder = (maxOrder?.event_order || 0) + 1

      await supabase.from('timelines').insert({
        novel_id: novelId,
        chapter_num: chapter,
        event_order: nextOrder,
        event_type: event.type || 'plot',
        title: event.title,
        description: event.description,
        characters_involved: event.characters,
        importance: 5,
      })
    }
  }
}
