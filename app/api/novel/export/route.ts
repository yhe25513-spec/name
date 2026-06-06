import { NextRequest } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { requireNovelOwnership } from '@/lib/novel/auth'

export async function GET(req: NextRequest) {
  try {
    const novelId = req.nextUrl.searchParams.get('novelId')
    const format = req.nextUrl.searchParams.get('format') || 'txt'

    if (!novelId) {
      return new Response(JSON.stringify({ error: '缺少 novelId' }), { status: 400 })
    }

    // 鉴权
    const { error: authError } = await requireNovelOwnership(req, novelId)
    if (authError) return authError

    // Get novel meta
    const { data: novel } = await supabase.from('novels').select('title, genre').eq('id', novelId).single()
    if (!novel) {
      return new Response(JSON.stringify({ error: '小说不存在' }), { status: 404 })
    }

    // Get all chapters sorted by chapter_num
    const { data: chapters } = await supabase
      .from('chapters')
      .select('chapter_num, title, content')
      .eq('novel_id', novelId)
      .order('chapter_num')

    if (!chapters || chapters.length === 0) {
      return new Response(JSON.stringify({ error: '没有章节内容' }), { status: 404 })
    }

    let output = ''

    if (format === 'md') {
      // Markdown format
      output += `# ${novel.title}\n\n`
      output += `> 类型：${novel.genre} | 共 ${chapters.length} 章\n\n---\n\n`
      for (const ch of chapters) {
        output += `## ${ch.title || `第${ch.chapter_num}章`}\n\n`
        output += (ch.content || '') + '\n\n---\n\n'
      }
    } else {
      // Plain text format
      output += `${novel.title}\n`
      output += `${'='.repeat(40)}\n\n`
      for (const ch of chapters) {
        output += `${ch.title || `第${ch.chapter_num}章`}\n`
        output += `${'-'.repeat(30)}\n\n`
        output += (ch.content || '') + '\n\n\n'
      }
    }

    const filename = `${novel.title}.${format === 'md' ? 'md' : 'txt'}`
    const encoder = new TextEncoder()
    const fileContent = encoder.encode(output)

    return new Response(fileContent, {
      headers: {
        'Content-Type': format === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
