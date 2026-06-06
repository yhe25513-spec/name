import { NextRequest, NextResponse } from 'next/server'
import { createNovel, getNovelStatus, updateProgress, getNovelMeta, saveNovelMeta } from '@/lib/novel/novels'
import { supabase } from '@/lib/novel/store'
import { getForeshadows, addForeshadow, closeForeshadow, checkOverdue } from '@/lib/novel/foreshadows'
import { getMysteries, addMystery, revealMystery, getWritingConstraints } from '@/lib/novel/mysteries'
import { getRelationships, updateTrust, getRelationshipReport } from '@/lib/novel/relationships'
import { generateWritingPrompt } from '@/lib/novel/prompt'
import { listNovels } from '@/lib/novel/novels'
import { createClient } from '@supabase/supabase-js'

// User-facing Supabase client (respects RLS)
function getUserSupabase(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const userClient = getUserSupabase(req)
  if (!userClient) return null
  const { data: { user } } = await userClient.auth.getUser()
  return user?.id || null
}

async function verifyNovelOwnership(novelId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('novels').select('user_id').eq('id', novelId).single()
  return data?.user_id === userId
}

function parsePath(req: NextRequest) {
  return (req.nextUrl.searchParams.get('path') || '').split('/').filter(Boolean)
}

async function body(req: NextRequest) {
  try { return await req.json() } catch { return {} }
}

export async function GET(req: NextRequest) {
  try {
    const s = parsePath(req)

    if (s[0] === 'novels' && !s[1]) {
      const userId = await getUserId(req)
      return NextResponse.json(await listNovels(userId || undefined))
    }
    if (s[0] === 'novels' && s[2] === 'status') return NextResponse.json(await getNovelStatus(s[1]))
    if (s[0] === 'novels' && s[2] === 'health') {
      const st = await getNovelStatus(s[1])
      const overdue = await checkOverdue(s[1], st.chapter || 1)
      return NextResponse.json({ health_score: Math.max(0, 100 - overdue.length * 5), overdue: overdue.length })
    }
    if (s[0] === 'novels' && s[2] === 'foreshadows') return NextResponse.json(await getForeshadows(s[1]))
    if (s[0] === 'novels' && s[2] === 'mysteries') return NextResponse.json(await getMysteries(s[1]))
    if (s[0] === 'novels' && s[2] === 'relationships') return NextResponse.json(await getRelationships(s[1]))
    if (s[0] === 'novels' && s[2] === 'relationships' && s[3] === 'report') return NextResponse.json(await getRelationshipReport(s[1]))
    if (s[0] === 'novels' && s[2] === 'prompt' && s[3]) {
      const prompt = await generateWritingPrompt(s[1], parseInt(s[3]))
      return NextResponse.json({ chapter: parseInt(s[3]), prompt })
    }
    if (s[0] === 'novels' && s[2] === 'prep' && s[3]) {
      const ch = parseInt(s[3])
      return NextResponse.json({ chapter: ch, constraints: await getWritingConstraints(s[1], ch), overdue: await checkOverdue(s[1], ch) })
    }
    if (s[0] === 'novels' && s[2] === 'chapters' && !s[3]) {
      const userId = await getUserId(req)
      if (userId && !(await verifyNovelOwnership(s[1], userId))) {
        return NextResponse.json({ error: '无权访问' }, { status: 403 })
      }
      const { data } = await supabase.from('chapters').select('chapter_num, title, word_count').eq('novel_id', s[1]).order('chapter_num')
      return NextResponse.json((data || []).map(c => ({ chapter: c.chapter_num, title: c.title || `第${c.chapter_num}章`, word_count: c.word_count || 0 })))
    }
    if (s[0] === 'novels' && s[2] === 'chapters' && s[3]) {
      const userId = await getUserId(req)
      if (userId && !(await verifyNovelOwnership(s[1], userId))) {
        return NextResponse.json({ error: '无权访问' }, { status: 403 })
      }
      const { data } = await supabase.from('chapters').select('content').eq('novel_id', s[1]).eq('chapter_num', parseInt(s[3])).single()
      return NextResponse.json({ chapter: parseInt(s[3]), content: data?.content || '' })
    }
    if (s[0] === 'novels' && s[2] === 'soul') {
      const meta = await getNovelMeta(s[1])
      return NextResponse.json(meta.soul || {})
    }
    if (s[0] === 'novels' && s[2] === 'foreshadows' && s[3] === 'check' && s[4]) {
      return NextResponse.json(await checkOverdue(s[1], parseInt(s[4])))
    }
    if (s[0] === 'novels' && s[2] === 'mysteries' && s[3] === 'constraints' && s[4]) {
      return NextResponse.json(await getWritingConstraints(s[1], parseInt(s[4])))
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

    if (s[0] === 'novels' && !s[1]) {
      await createNovel(d.id, d.title, d.genre)
      return NextResponse.json({ ok: true })
    }
    if (s[0] === 'novels' && s[2] === 'switch') {
      // Switch is handled client-side, just return success
      return NextResponse.json({ ok: true })
    }
    if (s[0] === 'novels' && s[2] === 'chapters' && s[3]) {
      const userId = await getUserId(req)
      if (userId && !(await verifyNovelOwnership(s[1], userId))) {
        return NextResponse.json({ error: '无权访问' }, { status: 403 })
      }
      const ch = parseInt(s[3])
      const { error } = await supabase.from('chapters').upsert({
        novel_id: s[1], chapter_num: ch, content: d.content || '',
        title: d.title || `第${ch}章`, word_count: d.content?.length || 0,
      }, { onConflict: 'novel_id,chapter_num' })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (s[0] === 'novels' && s[2] === 'sync' && s[3]) {
      const ch = parseInt(s[3])
      const ext = d.extraction || {}
      const errors: string[] = []

      for (const f of ext.new_foreshadows || []) {
        try {
          await addForeshadow(s[1], f.content, ch, f.importance, f.tier, f.category, f.expected_reveal_range)
        } catch (e: any) {
          errors.push(`伏笔: ${e.message}`)
        }
      }
      for (const id of ext.closed_foreshadows || []) {
        try {
          await closeForeshadow(s[1], id, ch)
        } catch (e: any) {
          errors.push(`关闭伏笔 ${id}: ${e.message}`)
        }
      }
      for (const r of ext.revelations || []) {
        try {
          await revealMystery(s[1], r.mystery_id, ch, r.delta, r.note)
        } catch (e: any) {
          errors.push(`悬念 ${r.mystery_id}: ${e.message}`)
        }
      }
      for (const r of ext.relationship_updates || []) {
        try {
          await updateTrust(s[1], r.from, r.to, r.trust_delta || r.delta || 0, ch, r.reason, r.type)
        } catch (e: any) {
          errors.push(`关系 ${r.from}->${r.to}: ${e.message}`)
        }
      }

      await updateProgress(s[1], ch, ext.word_count || 0)

      if (errors.length > 0) {
        return NextResponse.json({ ok: true, warnings: errors })
      }
      return NextResponse.json({ ok: true })
    }
    if (s[0] === 'novels' && s[2] === 'foreshadows' && !s[3]) {
      return NextResponse.json(await addForeshadow(s[1], d.content, d.chapter, d.importance, d.tier, d.category, d.expected_reveal_range))
    }
    if (s[0] === 'novels' && s[2] === 'foreshadows' && s[4] === 'close') {
      await closeForeshadow(s[1], s[3], d.chapter || 0)
      return NextResponse.json({ ok: true })
    }
    if (s[0] === 'novels' && s[2] === 'mysteries' && !s[3]) {
      return NextResponse.json(await addMystery(s[1], d.name, d.tier))
    }
    if (s[0] === 'novels' && s[2] === 'mysteries' && s[3] === 'reveal') {
      await revealMystery(s[1], d.mystery_id, d.chapter, d.delta, d.note)
      return NextResponse.json({ ok: true })
    }
    if (s[0] === 'novels' && s[2] === 'relationships' && !s[3]) {
      return NextResponse.json(await updateTrust(s[1], d.from_char || d.from, d.to_char || d.to, d.trust_delta || d.delta, d.chapter, d.reason, d.rel_type || d.type))
    }
    if (s[0] === 'novels' && s[2] === 'soul') {
      await saveNovelMeta(s[1], { soul: d })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const s = parsePath(req)

    // DELETE novels/{id}/chapters/{chapterNum} - 删除章节
    if (s[0] === 'novels' && s[2] === 'chapters' && s[3]) {
      const { error } = await supabase.from('chapters')
        .delete()
        .eq('novel_id', s[1])
        .eq('chapter_num', parseInt(s[3]))
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
