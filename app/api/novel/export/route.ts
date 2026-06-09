import { NextRequest } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { requireNovelOwnership } from '@/lib/novel/auth'
import EPub from 'epub-gen'

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
    const { data: novel } = await supabase.from('novels').select('title, genre, soul').eq('id', novelId).single()
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

    // EPUB 格式
    if (format === 'epub') {
      const chapterData = chapters.map(ch => ({
        title: ch.title || `第${ch.chapter_num}章`,
        data: `<h2>${ch.title || `第${ch.chapter_num}章`}</h2>` +
          (ch.content || '').split('\n\n').map((p: string) => `<p>${p.trim()}</p>`).join('\n'),
      }))

      const option = {
        title: novel.title,
        author: 'AI Novel Studio',
        publisher: 'AI Novel Studio',
        description: novel.soul?.reader_promise || `${novel.genre}小说`,
        content: chapterData,
        css: `
          body { font-family: "Noto Serif SC", "Source Han Serif SC", serif; line-height: 1.8; margin: 1em; }
          h1 { text-align: center; margin: 2em 0 1em; }
          h2 { margin: 1.5em 0 0.8em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
          p { text-indent: 2em; margin: 0.5em 0; }
        `,
      }

      const epub = new EPub(option, `/tmp/${novel.title}.epub`)
      await epub.render()

      // 读取生成的 EPUB 文件
      const fs = await import('fs/promises')
      const epubBuffer = await fs.readFile(`/tmp/${novel.title}.epub`)

      // 清理临时文件
      await fs.unlink(`/tmp/${novel.title}.epub`).catch(() => {})

      const filename = `${novel.title}.epub`
      return new Response(epubBuffer, {
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      })
    }

    // TXT / MD 格式
    let output = ''

    if (format === 'md') {
      output += `# ${novel.title}\n\n`
      output += `> 类型：${novel.genre} | 共 ${chapters.length} 章\n\n---\n\n`
      for (const ch of chapters) {
        output += `## ${ch.title || `第${ch.chapter_num}章`}\n\n`
        output += (ch.content || '') + '\n\n---\n\n'
      }
    } else {
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
