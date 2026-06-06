import { NextRequest, NextResponse } from 'next/server'
import { createNovel, getNovelStatus, updateProgress, getNovelMeta, saveNovelMeta, listNovels } from '@/lib/novel/novels'
import { supabase } from '@/lib/novel/store'
import { getForeshadows, addForeshadow, closeForeshadow, checkOverdue } from '@/lib/novel/foreshadows'
import { getMysteries, addMystery, revealMystery, getWritingConstraints } from '@/lib/novel/mysteries'
import { getRelationships, updateTrust, getRelationshipReport } from '@/lib/novel/relationships'
import { generateWritingPrompt } from '@/lib/novel/prompt'
import { getUserId, requireNovelOwnership } from '@/lib/novel/auth'

function parsePath(req: NextRequest) {
  return (req.nextUrl.searchParams.get('path') || '').split('/').filter(Boolean)
}

async function body(req: NextRequest) {
  try { return await req.json() } catch { return {} }
}

// 统一的鉴权响应
function unauthorized(msg = '请先登录') {
  return NextResponse.json({ error: msg }, { status: 401 })
}
function forbidden(msg = '无权访问该小说') {
  return NextResponse.json({ error: msg }, { status: 403 })
}

export async function GET(req: NextRequest) {
  try {
    const s = parsePath(req)

    // ===== 小说列表（需要登录） =====
    if (s[0] === 'novels' && !s[1]) {
      const userId = await getUserId(req)
      if (!userId) return unauthorized()
      return NextResponse.json(await listNovels(userId))
    }

    // ===== 以下所有路由都需要小说所有权验证 =====
    const novelId = s[1]
    if (s[0] === 'novels' && novelId) {
      const { userId, error } = await requireNovelOwnership(req, novelId)
      if (error) return error

      if (s[2] === 'status') return NextResponse.json(await getNovelStatus(novelId))
      if (s[2] === 'health') {
        const st = await getNovelStatus(novelId)
        const overdue = await checkOverdue(novelId, st.chapter || 1)
        return NextResponse.json({ health_score: Math.max(0, 100 - overdue.length * 5), overdue: overdue.length })
      }
      if (s[2] === 'foreshadows' && !s[3]) return NextResponse.json(await getForeshadows(novelId))
      if (s[2] === 'mysteries' && !s[3]) return NextResponse.json(await getMysteries(novelId))
      if (s[2] === 'relationships' && !s[3]) return NextResponse.json(await getRelationships(novelId))
      if (s[2] === 'relationships' && s[3] === 'report') return NextResponse.json(await getRelationshipReport(novelId))
      if (s[2] === 'prompt' && s[3]) {
        const prompt = await generateWritingPrompt(novelId, parseInt(s[3]))
        return NextResponse.json({ chapter: parseInt(s[3]), prompt })
      }
      if (s[2] === 'prep' && s[3]) {
        const ch = parseInt(s[3])
        return NextResponse.json({ chapter: ch, constraints: await getWritingConstraints(novelId, ch), overdue: await checkOverdue(novelId, ch) })
      }
      if (s[2] === 'chapters' && !s[3]) {
        const { data } = await supabase.from('chapters').select('chapter_num, title, word_count').eq('novel_id', novelId).order('chapter_num')
        return NextResponse.json((data || []).map(c => ({ chapter: c.chapter_num, title: c.title || `第${c.chapter_num}章`, word_count: c.word_count || 0 })))
      }
      if (s[2] === 'chapters' && s[3]) {
        const { data } = await supabase.from('chapters').select('content').eq('novel_id', novelId).eq('chapter_num', parseInt(s[3])).single()
        return NextResponse.json({ chapter: parseInt(s[3]), content: data?.content || '' })
      }
      if (s[2] === 'soul') {
        const meta = await getNovelMeta(novelId)
        return NextResponse.json(meta.soul || {})
      }
      if (s[2] === 'foreshadows' && s[3] === 'check' && s[4]) {
        return NextResponse.json(await checkOverdue(novelId, parseInt(s[4])))
      }
      if (s[2] === 'mysteries' && s[3] === 'constraints' && s[4]) {
        return NextResponse.json(await getWritingConstraints(novelId, parseInt(s[4])))
      }
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

    // ===== 创建小说（需要登录） =====
    if (s[0] === 'novels' && !s[1]) {
      const userId = await getUserId(req)
      if (!userId) return unauthorized()
      await createNovel(d.id, d.title, d.genre, userId)
      return NextResponse.json({ ok: true })
    }

    // ===== 以下路由需要小说所有权验证 =====
    const novelId = s[1]
    if (s[0] === 'novels' && novelId) {
      // switch 不需要鉴权（只是客户端状态切换）
      if (s[2] === 'switch') return NextResponse.json({ ok: true })

      const { userId, error } = await requireNovelOwnership(req, novelId)
      if (error) return error

      if (s[2] === 'chapters' && s[3]) {
        const ch = parseInt(s[3])
        const { error } = await supabase.from('chapters').upsert({
          novel_id: novelId, chapter_num: ch, content: d.content || '',
          title: d.title || `第${ch}章`, word_count: d.content?.length || 0,
        }, { onConflict: 'novel_id,chapter_num' })
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
      if (s[2] === 'sync' && s[3]) {
        const ch = parseInt(s[3])
        const ext = d.extraction || {}
        const errors: string[] = []

        for (const f of ext.new_foreshadows || []) {
          try { await addForeshadow(novelId, f.content, ch, f.importance, f.tier, f.category, f.expected_reveal_range) }
          catch (e: any) { errors.push(`伏笔: ${e.message}`) }
        }
        for (const id of ext.closed_foreshadows || []) {
          try { await closeForeshadow(novelId, id, ch) }
          catch (e: any) { errors.push(`关闭伏笔 ${id}: ${e.message}`) }
        }
        for (const r of ext.revelations || []) {
          try { await revealMystery(novelId, r.mystery_id, ch, r.delta, r.note) }
          catch (e: any) { errors.push(`悬念 ${r.mystery_id}: ${e.message}`) }
        }
        for (const r of ext.relationship_updates || []) {
          try { await updateTrust(novelId, r.from, r.to, r.trust_delta || r.delta || 0, ch, r.reason, r.type) }
          catch (e: any) { errors.push(`关系 ${r.from}->${r.to}: ${e.message}`) }
        }

        await updateProgress(novelId, ch, ext.word_count || 0)
        if (errors.length > 0) return NextResponse.json({ ok: true, warnings: errors })
        return NextResponse.json({ ok: true })
      }
      if (s[2] === 'foreshadows' && !s[3]) {
        return NextResponse.json(await addForeshadow(novelId, d.content, d.chapter, d.importance, d.tier, d.category, d.expected_reveal_range))
      }
      if (s[2] === 'foreshadows' && s[4] === 'close') {
        await closeForeshadow(novelId, s[3], d.chapter || 0)
        return NextResponse.json({ ok: true })
      }
      if (s[2] === 'mysteries' && !s[3]) {
        return NextResponse.json(await addMystery(novelId, d.name, d.tier))
      }
      if (s[2] === 'mysteries' && s[3] === 'reveal') {
        await revealMystery(novelId, d.mystery_id, d.chapter, d.delta, d.note)
        return NextResponse.json({ ok: true })
      }
      if (s[2] === 'relationships' && !s[3]) {
        return NextResponse.json(await updateTrust(novelId, d.from_char || d.from, d.to_char || d.to, d.trust_delta || d.delta, d.chapter, d.reason, d.rel_type || d.type))
      }
      if (s[2] === 'soul') {
        await saveNovelMeta(novelId, { soul: d })
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const s = parsePath(req)
    const novelId = s[1]

    if (s[0] === 'novels' && novelId) {
      const { userId, error } = await requireNovelOwnership(req, novelId)
      if (error) return error

      // DELETE novels/{id}/chapters/{chapterNum}
      if (s[2] === 'chapters' && s[3]) {
        const { error } = await supabase.from('chapters')
          .delete()
          .eq('novel_id', novelId)
          .eq('chapter_num', parseInt(s[3]))
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }

      // DELETE novels/{id} - 删除整本小说及所有相关数据
      if (!s[2]) {
        await supabase.from('chapters').delete().eq('novel_id', novelId)
        await supabase.from('foreshadows').delete().eq('novel_id', novelId)
        await supabase.from('mysteries').delete().eq('novel_id', novelId)
        await supabase.from('relationships').delete().eq('novel_id', novelId)
        await supabase.from('timelines').delete().eq('novel_id', novelId)
        await supabase.from('story_states').delete().eq('novel_id', novelId)
        await supabase.from('worlds').delete().eq('novel_id', novelId)
        await supabase.from('characters').delete().eq('novel_id', novelId)
        await supabase.from('novel_souls').delete().eq('novel_id', novelId)
        const { error } = await supabase.from('novels').delete().eq('id', novelId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
