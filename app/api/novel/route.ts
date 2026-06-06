import { NextRequest, NextResponse } from 'next/server'
import { createNovel, getNovelStatus, updateProgress } from '@/lib/novel/novels'
import { listNovels, setCurrentNovel, getCurrentNovel } from '@/lib/novel/store'
import { getForeshadows, addForeshadow, closeForeshadow, checkOverdue } from '@/lib/novel/foreshadows'
import { getMysteries, addMystery, revealMystery, getWritingConstraints } from '@/lib/novel/mysteries'
import { getRelationships, updateTrust, getRelationshipReport } from '@/lib/novel/relationships'
import { generateWritingPrompt } from '@/lib/novel/prompt'
import { readJSON, writeJSON, chapterPath, chapterDir, stylePath, novelMetaPath } from '@/lib/novel/store'
import { promises as fs } from 'fs'
import path from 'path'

// Helper: parse path segments
function parsePath(req: NextRequest) {
  const pathParam = req.nextUrl.searchParams.get('path') || ''
  return pathParam.split('/').filter(Boolean)
}

// Helper: safe JSON body
async function body(req: NextRequest) {
  try { return await req.json() } catch { return {} }
}

export async function GET(req: NextRequest) {
  try {
    const segs = parsePath(req)

    // /api/novel?path=novels
    if (segs[0] === 'novels' && !segs[1]) {
      return NextResponse.json(await listNovels())
    }

    // /api/novel?path=novels/{id}/status
    if (segs[0] === 'novels' && segs[2] === 'status') {
      return NextResponse.json(await getNovelStatus(segs[1]))
    }

    // /api/novel?path=novels/{id}/health
    if (segs[0] === 'novels' && segs[2] === 'health') {
      const status = await getNovelStatus(segs[1])
      const overdue = await checkOverdue(segs[1], status.chapter || 1)
      const score = Math.max(0, 100 - overdue.length * 5)
      return NextResponse.json({ health_score: score, overdue: overdue.length })
    }

    // /api/novel?path=novels/{id}/foreshadows
    if (segs[0] === 'novels' && segs[2] === 'foreshadows') {
      return NextResponse.json(await getForeshadows(segs[1]))
    }

    // /api/novel?path=novels/{id}/mysteries
    if (segs[0] === 'novels' && segs[2] === 'mysteries') {
      return NextResponse.json(await getMysteries(segs[1]))
    }

    // /api/novel?path=novels/{id}/relationships
    if (segs[0] === 'novels' && segs[2] === 'relationships') {
      return NextResponse.json(await getRelationships(segs[1]))
    }

    // /api/novel?path=novels/{id}/relationships/report
    if (segs[0] === 'novels' && segs[2] === 'relationships' && segs[3] === 'report') {
      return NextResponse.json(await getRelationshipReport(segs[1]))
    }

    // /api/novel?path=novels/{id}/prompt/{chapter}
    if (segs[0] === 'novels' && segs[2] === 'prompt' && segs[3]) {
      const prompt = await generateWritingPrompt(segs[1], parseInt(segs[3]))
      return NextResponse.json({ chapter: parseInt(segs[3]), prompt })
    }

    // /api/novel?path=novels/{id}/prep/{chapter}
    if (segs[0] === 'novels' && segs[2] === 'prep' && segs[3]) {
      const ch = parseInt(segs[3])
      const constraints = await getWritingConstraints(segs[1], ch)
      const overdue = await checkOverdue(segs[1], ch)
      return NextResponse.json({ chapter: ch, constraints, overdue })
    }

    // /api/novel?path=novels/{id}/chapters
    if (segs[0] === 'novels' && segs[2] === 'chapters' && !segs[3]) {
      const dir = chapterDir(segs[1])
      try {
        const files = await fs.readdir(dir)
        const chapters = files
          .filter(f => f.startsWith('第') && f.endsWith('.md'))
          .map(f => {
            const num = parseInt(f.replace('第', '').replace('章', ''))
            return { chapter: num, title: f.replace('.md', ''), file: f }
          })
          .sort((a, b) => a.chapter - b.chapter)
        return NextResponse.json(chapters)
      } catch {
        return NextResponse.json([])
      }
    }

    // /api/novel?path=novels/{id}/chapters/{chapter}
    if (segs[0] === 'novels' && segs[2] === 'chapters' && segs[3]) {
      const file = chapterPath(segs[1], parseInt(segs[3]))
      try {
        const content = await fs.readFile(file, 'utf-8')
        return NextResponse.json({ chapter: parseInt(segs[3]), content })
      } catch {
        return NextResponse.json({ chapter: parseInt(segs[3]), content: '' })
      }
    }

    // /api/novel?path=novels/{id}/soul
    if (segs[0] === 'novels' && segs[2] === 'soul') {
      const meta = await readJSON<any>(novelMetaPath(segs[1]))
      return NextResponse.json(meta.soul || {})
    }

    // /api/novel?path=novels/{id}/foreshadows/check/{chapter}
    if (segs[0] === 'novels' && segs[2] === 'foreshadows' && segs[3] === 'check' && segs[4]) {
      const overdue = await checkOverdue(segs[1], parseInt(segs[4]))
      return NextResponse.json(overdue)
    }

    // /api/novel?path=novels/{id}/mysteries/constraints/{chapter}
    if (segs[0] === 'novels' && segs[2] === 'mysteries' && segs[3] === 'constraints' && segs[4]) {
      return NextResponse.json(await getWritingConstraints(segs[1], parseInt(segs[4])))
    }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const segs = parsePath(req)
    const data = await body(req)

    // /api/novel?path=novels — create novel
    if (segs[0] === 'novels' && !segs[1]) {
      await createNovel(data.id, data.title, data.genre)
      await setCurrentNovel(data.id)
      return NextResponse.json({ ok: true })
    }

    // /api/novel?path=novels/{id}/switch
    if (segs[0] === 'novels' && segs[2] === 'switch') {
      await setCurrentNovel(segs[1])
      return NextResponse.json({ ok: true })
    }

    // /api/novel?path=novels/{id}/chapters/{chapter} — save chapter
    if (segs[0] === 'novels' && segs[2] === 'chapters' && segs[3]) {
      const file = chapterPath(segs[1], parseInt(segs[3]))
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, data.content || '', 'utf-8')
      return NextResponse.json({ ok: true })
    }

    // /api/novel?path=novels/{id}/sync/{chapter} — commit sync
    if (segs[0] === 'novels' && segs[2] === 'sync' && segs[3]) {
      const ch = parseInt(segs[3])
      const ext = data.extraction || {}

      // Update foreshadows
      if (ext.new_foreshadows?.length) {
        for (const fs of ext.new_foreshadows) {
          await addForeshadow(segs[1], fs.content, ch, fs.importance, fs.tier, fs.category, fs.expected_reveal_range)
        }
      }
      if (ext.closed_foreshadows?.length) {
        for (const id of ext.closed_foreshadows) {
          await closeForeshadow(segs[1], id, ch).catch(() => {})
        }
      }

      // Update mysteries
      if (ext.revelations?.length) {
        for (const r of ext.revelations) {
          await revealMystery(segs[1], r.mystery_id, ch, r.delta, r.note)
        }
      }

      // Update relationships
      if (ext.relationship_updates?.length) {
        for (const r of ext.relationship_updates) {
          await updateTrust(segs[1], r.from, r.to, r.trust_delta || r.delta || 0, ch, r.reason, r.type)
        }
      }

      // Update progress
      await updateProgress(segs[1], ch, ext.word_count || 0)

      return NextResponse.json({ ok: true })
    }

    // /api/novel?path=novels/{id}/foreshadows — add foreshadow
    if (segs[0] === 'novels' && segs[2] === 'foreshadows' && !segs[3]) {
      const fs = await addForeshadow(segs[1], data.content, data.chapter, data.importance, data.tier, data.category, data.expected_reveal_range)
      return NextResponse.json(fs)
    }

    // /api/novel?path=novels/{id}/foreshadows/{id}/close
    if (segs[0] === 'novels' && segs[2] === 'foreshadows' && segs[4] === 'close') {
      await closeForeshadow(segs[1], segs[3], data.chapter || 0)
      return NextResponse.json({ ok: true })
    }

    // /api/novel?path=novels/{id}/mysteries — add mystery
    if (segs[0] === 'novels' && segs[2] === 'mysteries' && !segs[3]) {
      const m = await addMystery(segs[1], data.name, data.tier)
      return NextResponse.json(m)
    }

    // /api/novel?path=novels/{id}/mysteries/reveal
    if (segs[0] === 'novels' && segs[2] === 'mysteries' && segs[3] === 'reveal') {
      await revealMystery(segs[1], data.mystery_id, data.chapter, data.delta, data.note)
      return NextResponse.json({ ok: true })
    }

    // /api/novel?path=novels/{id}/relationships — update trust
    if (segs[0] === 'novels' && segs[2] === 'relationships' && !segs[3]) {
      const result = await updateTrust(segs[1], data.from_char || data.from, data.to_char || data.to, data.trust_delta || data.delta, data.chapter, data.reason, data.rel_type || data.type)
      return NextResponse.json(result)
    }

    // /api/novel?path=novels/{id}/soul — update soul
    if (segs[0] === 'novels' && segs[2] === 'soul') {
      const meta = await readJSON<any>(novelMetaPath(segs[1]))
      meta.soul = data
      meta.updated_at = new Date().toISOString()
      await writeJSON(novelMetaPath(segs[1]), meta)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: '未知路径' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
