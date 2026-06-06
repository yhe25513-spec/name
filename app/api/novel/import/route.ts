import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { callAI, extractJson, getCurrentConfig } from '@/lib/novel/ai-config'

// 简单的 AI 分析 - 使用统一 AI 配置
async function simpleAIAnalyze(text: string): Promise<any> {
  const config = getCurrentConfig()
  console.log(`Using AI provider: ${config.providerName} (${config.model})`)

  if (!config.hasApiKey && config.provider !== 'ollama') {
    console.log(`No API key found for ${config.provider}`)
    return null
  }

  try {
    const systemPrompt = `分析小说文本，提取：角色(名字/身份/性格)、世界观(名称/类型/描述)、事件(标题/描述/角色)。输出JSON：
{"characters":[{"name":"","identity":"","traits":""}],"worlds":[{"name":"","category":"rule|faction|location","content":""}],"events":[{"title":"","description":"","characters":[]}]}`

    const content = await callAI(systemPrompt, text.slice(0, 4000), {
      temperature: 0.3,
      maxTokens: 2000,
    })

    console.log('AI response length:', content.length)
    const parsed = extractJson(content)
    if (parsed) {
      console.log('Parsed result:', { characters: parsed.characters?.length, worlds: parsed.worlds?.length })
    }
    return parsed
  } catch (e: any) {
    console.error('AI analysis error:', e.message)
    return null
  }
}

// POST: 上传并解析小说文件
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const novelId = formData.get('novelId') as string
    const analyzeWithAI = formData.get('analyze') === 'true'

    if (!files || files.length === 0 || !novelId) {
      return NextResponse.json({ error: '缺少文件或 novelId' }, { status: 400 })
    }

    console.log(`Import started: ${files.length} files, novelId=${novelId}, analyze=${analyzeWithAI}`)

    const { splitChapters, getNovelStats } = await import('@/lib/novel/parser')

    // 合并所有文件的章节
    let allChapters: { title: string; content: string; index: number; wordCount: number }[] = []
    for (const file of files) {
      const text = await file.text()
      const chapters = splitChapters(text)
      console.log(`File ${file.name}: ${chapters.length} chapters parsed`)
      allChapters.push(...chapters)
    }

    // 按章节号排序并重新编号
    allChapters.sort((a, b) => a.index - b.index)
    allChapters = allChapters.map((ch, i) => ({ ...ch, index: i }))
    const stats = getNovelStats(allChapters)

    console.log(`Total chapters: ${allChapters.length}, total words: ${stats.totalWords}`)

    // 保存所有章节
    let savedCount = 0
    for (const ch of allChapters) {
      const { error } = await supabase.from('chapters').upsert({
        novel_id: novelId,
        chapter_num: ch.index + 1,
        title: ch.title,
        content: ch.content,
        word_count: ch.wordCount,
      }, { onConflict: 'novel_id,chapter_num' })
      if (error) console.error('Chapter save error:', error.message)
      else savedCount++
    }

    // 更新小说进度
    await supabase.from('novels').update({
      progress: { current_chapter: savedCount, total_words: stats.totalWords },
      updated_at: new Date().toISOString(),
    }).eq('id', novelId)

    console.log(`Saved ${savedCount} chapters`)

    // AI 分析
    let analysisResult = null
    if (analyzeWithAI && allChapters.length > 0) {
      console.log('Starting AI analysis...')

      // 取前3章的前2000字进行分析
      const sampleText = allChapters.slice(0, 3).map(ch =>
        `【${ch.title}】\n${ch.content.slice(0, 1500)}`
      ).join('\n\n')

      const analysis = await simpleAIAnalyze(sampleText)

      if (analysis) {
        let savedChars = 0
        let savedWorlds = 0
        let savedEvents = 0

        // 保存角色
        if (analysis.characters) {
          for (const char of analysis.characters) {
            if (!char.name) continue
            const charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
            const { error } = await supabase.from('characters').insert({
              id: charId, novel_id: novelId, name: char.name,
              identity: char.identity || '', personality: char.traits ? { traits: char.traits.split('、') } : {},
              status: 'active', first_appearance: 1, last_appearance: savedCount,
            })
            if (!error) savedChars++
            else console.error('Char insert error:', error.message)
          }
        }

        // 保存世界观
        if (analysis.worlds) {
          for (const w of analysis.worlds) {
            if (!w.name) continue
            const worldId = `world_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
            const { error } = await supabase.from('worlds').insert({
              id: worldId, novel_id: novelId, name: w.name, title: w.name,
              category: w.category || 'rule', content: w.content || '', importance: 6,
            })
            if (!error) savedWorlds++
            else console.error('World insert error:', error.message)
          }
        }

        // 保存事件
        if (analysis.events) {
          for (const ev of analysis.events) {
            if (!ev.title) continue
            const { error } = await supabase.from('timelines').insert({
              novel_id: novelId, chapter_num: 1, event_order: savedEvents + 1,
              event_type: ev.event_type || 'plot', title: ev.title,
              description: ev.description || '', characters_involved: ev.characters || [],
              importance: 6,
            })
            if (!error) savedEvents++
            else console.error('Event insert error:', error.message)
          }
        }

        analysisResult = { savedChars, savedWorlds, savedEvents }
        console.log('AI analysis complete:', analysisResult)
      } else {
        console.log('AI analysis returned null')
      }
    }

    return NextResponse.json({
      ok: true,
      stats: { ...stats, chapterCount: savedCount },
      savedCount,
      totalChapters: allChapters.length,
      filesCount: files.length,
      analysis: analysisResult,
      message: `${files.length}个文件，${savedCount}章已保存${analysisResult ? `，AI分析：${analysisResult.savedChars}角色，${analysisResult.savedWorlds}世界观` : ''}`,
    })
  } catch (e: any) {
    console.error('Import error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET: 修复已有章节的标题（从内容中提取）
export async function GET(req: NextRequest) {
  try {
    const novelId = req.nextUrl.searchParams.get('novelId')
    const action = req.nextUrl.searchParams.get('action')

    if (!novelId) {
      return NextResponse.json({ error: '缺少 novelId' }, { status: 400 })
    }

    if (action === 'fix-titles') {
      // 获取所有章节
      const { data: chapters } = await supabase.from('chapters')
        .select('id, chapter_num, title, content')
        .eq('novel_id', novelId)
        .order('chapter_num')

      if (!chapters) {
        return NextResponse.json({ error: '没有章节数据' }, { status: 404 })
      }

      let fixedCount = 0
      for (const ch of chapters) {
        // 从内容开头提取标题
        const content = ch.content || ''
        const titleMatch = content.match(/^#\s*(第[一二三四五六七八九十百千零\d]+章[\s\S]{0,30})/m)
        if (titleMatch) {
          const newTitle = titleMatch[1].trim()
          if (newTitle !== ch.title) {
            await supabase.from('chapters').update({ title: newTitle }).eq('id', ch.id)
            fixedCount++
          }
        }
      }

      return NextResponse.json({ ok: true, fixedCount, totalChapters: chapters.length })
    }

    if (action === 'analyze') {
      // 重新分析所有章节并填充记忆层
      const { data: chapters } = await supabase.from('chapters')
        .select('chapter_num, title, content')
        .eq('novel_id', novelId)
        .order('chapter_num')
        .limit(5) // 只分析前5章

      if (!chapters || chapters.length === 0) {
        return NextResponse.json({ error: '没有章节数据' }, { status: 404 })
      }

      const sampleText = chapters.map(ch =>
        `【${ch.title || `第${ch.chapter_num}章`}】\n${(ch.content || '').slice(0, 1500)}`
      ).join('\n\n')

      const analysis = await simpleAIAnalyze(sampleText)

      if (!analysis) {
        return NextResponse.json({ error: 'AI 分析失败，请检查 DEEPSEEK_API_KEY' }, { status: 500 })
      }

      let savedChars = 0
      let savedWorlds = 0
      let savedEvents = 0

      if (analysis.characters) {
        for (const char of analysis.characters) {
          if (!char.name) continue
          const charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
          const { error } = await supabase.from('characters').insert({
            id: charId, novel_id: novelId, name: char.name,
            identity: char.identity || '', personality: char.traits ? { traits: char.traits.split('、') } : {},
            status: 'active', first_appearance: 1,
          })
          if (!error) savedChars++
        }
      }

      if (analysis.worlds) {
        for (const w of analysis.worlds) {
          if (!w.name) continue
          const worldId = `world_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
          const { error } = await supabase.from('worlds').insert({
            id: worldId, novel_id: novelId, name: w.name, title: w.name,
            category: w.category || 'rule', content: w.content || '', importance: 6,
          })
          if (!error) savedWorlds++
        }
      }

      if (analysis.events) {
        for (const ev of analysis.events) {
          if (!ev.title) continue
          const { error } = await supabase.from('timelines').insert({
            novel_id: novelId, chapter_num: 1, event_order: savedEvents + 1,
            event_type: 'plot', title: ev.title,
            description: ev.description || '', characters_involved: ev.characters || [],
            importance: 6,
          })
          if (!error) savedEvents++
        }
      }

      return NextResponse.json({
        ok: true,
        analysis: { savedChars, savedWorlds, savedEvents },
        raw: analysis,
      })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (e: any) {
    console.error('Import GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
