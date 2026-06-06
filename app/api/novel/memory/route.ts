import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { requireNovelOwnership } from '@/lib/novel/auth'

// ========== 世界观 ==========
async function getWorlds(novelId: string) {
  const { data } = await supabase.from('worlds').select('*').eq('novel_id', novelId).order('importance', { ascending: false })
  return data || []
}

async function addWorld(novelId: string, world: any) {
  const id = `world_${crypto.randomUUID().slice(0, 8)}`
  const { data, error } = await supabase.from('worlds').insert({ id, novel_id: novelId, ...world }).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function updateWorld(id: string, updates: any) {
  updates.updated_at = new Date().toISOString()
  const { error } = await supabase.from('worlds').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
}

async function deleteWorld(id: string) {
  const { error } = await supabase.from('worlds').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ========== 角色 ==========
async function getCharacters(novelId: string) {
  const { data } = await supabase.from('characters').select('*').eq('novel_id', novelId).order('first_appearance')
  return data || []
}

async function addCharacter(novelId: string, char: any) {
  const id = `char_${crypto.randomUUID().slice(0, 8)}`
  const { data, error } = await supabase.from('characters').insert({ id, novel_id: novelId, ...char }).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function updateCharacter(id: string, updates: any) {
  updates.updated_at = new Date().toISOString()
  const { error } = await supabase.from('characters').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
}

async function deleteCharacter(id: string) {
  const { error } = await supabase.from('characters').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ========== 时间线 ==========
async function getTimelines(novelId: string, chapter?: number) {
  let query = supabase.from('timelines').select('*').eq('novel_id', novelId)
  if (chapter) query = query.eq('chapter_num', chapter)
  const { data } = await query.order('chapter_num').order('event_order')
  return data || []
}

async function addTimeline(novelId: string, event: any) {
  const { data, error } = await supabase.from('timelines').insert({ novel_id: novelId, ...event }).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function updateTimeline(id: string, updates: any) {
  const { error } = await supabase.from('timelines').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
}

async function deleteTimeline(id: string) {
  const { error } = await supabase.from('timelines').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ========== 剧情状态机 ==========
async function getStoryStates(novelId: string) {
  const { data } = await supabase.from('story_states').select('*').eq('novel_id', novelId).order('category')
  return data || []
}

async function addStoryState(novelId: string, state: any) {
  const id = `state_${crypto.randomUUID().slice(0, 8)}`
  const { data, error } = await supabase.from('story_states').insert({ id, novel_id: novelId, ...state }).select().single()
  if (error) throw new Error(error.message)
  return data
}

async function updateStoryState(id: string, updates: any) {
  updates.updated_at = new Date().toISOString()
  const { error } = await supabase.from('story_states').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
}

async function deleteStoryState(id: string) {
  const { error } = await supabase.from('story_states').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ========== 小说灵魂 ==========
async function getNovelSoul(novelId: string) {
  const { data } = await supabase.from('novel_souls').select('*').eq('novel_id', novelId).single()
  return data || { novel_id: novelId, core_selling_points: [], forbidden_directions: [], tone: '', reader_promise: '', target_audience: '', genre_tags: [] }
}

async function saveNovelSoul(novelId: string, soul: any) {
  soul.updated_at = new Date().toISOString()
  const { data: existing } = await supabase.from('novel_souls').select('id').eq('novel_id', novelId).single()
  if (existing) {
    const { error } = await supabase.from('novel_souls').update(soul).eq('novel_id', novelId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('novel_souls').insert({ id: `soul_${novelId}`, novel_id: novelId, ...soul })
    if (error) throw new Error(error.message)
  }
}

// ========== 路由处理 ==========
function parsePath(req: NextRequest) {
  return (req.nextUrl.searchParams.get('path') || '').split('/').filter(Boolean)
}

async function body(req: NextRequest) {
  try { return await req.json() } catch { return {} }
}

export async function GET(req: NextRequest) {
  try {
    const s = parsePath(req)
    const novelId = req.nextUrl.searchParams.get('novelId') || ''

    if (!novelId) return NextResponse.json({ error: '缺少 novelId' }, { status: 400 })

    // 鉴权
    const { error: authError } = await requireNovelOwnership(req, novelId)
    if (authError) return authError

    // /memory/worlds?novelId=xxx
    if (s[0] === 'worlds') return NextResponse.json(await getWorlds(novelId))
    // /memory/characters?novelId=xxx
    if (s[0] === 'characters') return NextResponse.json(await getCharacters(novelId))
    // /memory/timelines?novelId=xxx&chapter=1
    if (s[0] === 'timelines') {
      const chapter = req.nextUrl.searchParams.get('chapter')
      return NextResponse.json(await getTimelines(novelId, chapter ? parseInt(chapter) : undefined))
    }
    // /memory/story-states?novelId=xxx
    if (s[0] === 'story-states') return NextResponse.json(await getStoryStates(novelId))
    // /memory/soul?novelId=xxx
    if (s[0] === 'soul') return NextResponse.json(await getNovelSoul(novelId))
    // /memory/stats?novelId=xxx
    if (s[0] === 'stats') {
      const worlds = await getWorlds(novelId)
      const characters = await getCharacters(novelId)
      const timelines = await getTimelines(novelId)
      const states = await getStoryStates(novelId)
      return NextResponse.json({
        worlds: worlds.length,
        characters: characters.length,
        events: timelines.length,
        states: states.length,
        activeCharacters: characters.filter(c => c.status === 'active').length,
        categories: {
          rules: worlds.filter(w => w.category === 'rule').length,
          locations: worlds.filter(w => w.category === 'location').length,
          factions: worlds.filter(w => w.category === 'faction').length,
          items: worlds.filter(w => w.category === 'item').length,
          histories: worlds.filter(w => w.category === 'history').length,
        }
      })
    }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = parsePath(req)
    const d = await body(req)
    const novelId = req.nextUrl.searchParams.get('novelId') || ''

    if (!novelId) return NextResponse.json({ error: '缺少 novelId' }, { status: 400 })

    // 鉴权
    const { error: authError } = await requireNovelOwnership(req, novelId)
    if (authError) return authError

    if (s[0] === 'worlds') return NextResponse.json(await addWorld(novelId, d))
    if (s[0] === 'characters') return NextResponse.json(await addCharacter(novelId, d))
    if (s[0] === 'timelines') return NextResponse.json(await addTimeline(novelId, d))
    if (s[0] === 'story-states') return NextResponse.json(await addStoryState(novelId, d))
    if (s[0] === 'soul') { await saveNovelSoul(novelId, d); return NextResponse.json({ ok: true }) }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const s = parsePath(req)
    const d = await body(req)
    const id = req.nextUrl.searchParams.get('id') || ''

    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    // 鉴权：查找记录所属小说并验证所有权
    const tableMap: Record<string, string> = { worlds: 'worlds', characters: 'characters', timelines: 'timelines', 'story-states': 'story_states' }
    const table = tableMap[s[0]]
    if (table) {
      const { data: record } = await supabase.from(table).select('novel_id').eq('id', id).single()
      if (record?.novel_id) {
        const { error: authError } = await requireNovelOwnership(req, record.novel_id)
        if (authError) return authError
      }
    }

    if (s[0] === 'worlds') { await updateWorld(id, d); return NextResponse.json({ ok: true }) }
    if (s[0] === 'characters') { await updateCharacter(id, d); return NextResponse.json({ ok: true }) }
    if (s[0] === 'timelines') { await updateTimeline(id, d); return NextResponse.json({ ok: true }) }
    if (s[0] === 'story-states') { await updateStoryState(id, d); return NextResponse.json({ ok: true }) }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const s = parsePath(req)
    const id = req.nextUrl.searchParams.get('id') || ''

    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    // 鉴权：查找记录所属小说并验证所有权
    const tableMap: Record<string, string> = { worlds: 'worlds', characters: 'characters', timelines: 'timelines', 'story-states': 'story_states' }
    const table = tableMap[s[0]]
    if (table) {
      const { data: record } = await supabase.from(table).select('novel_id').eq('id', id).single()
      if (record?.novel_id) {
        const { error: authError } = await requireNovelOwnership(req, record.novel_id)
        if (authError) return authError
      }
    }

    if (s[0] === 'worlds') { await deleteWorld(id); return NextResponse.json({ ok: true }) }
    if (s[0] === 'characters') { await deleteCharacter(id); return NextResponse.json({ ok: true }) }
    if (s[0] === 'timelines') { await deleteTimeline(id); return NextResponse.json({ ok: true }) }
    if (s[0] === 'story-states') { await deleteStoryState(id); return NextResponse.json({ ok: true }) }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
