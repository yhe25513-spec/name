import { NextRequest } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { generateStateSnapshot, formatStateForAgents } from '@/lib/novel/agents/state-machine'

// 动态导入 workflow（避免 SSR 问题）
async function getWorkflow() {
  const mod = await import('@/lib/novel/agents/workflow')
  return mod.runChapterWorkflow
}

// 构建上下文
async function buildContext(novelId: string, chapter: number) {
  // 获取小说元数据
  const { data: novel } = await supabase.from('novels').select('*').eq('id', novelId).single()
  const soul = novel?.soul || {}
  const style = novel?.style || {}

  // 获取世界观
  const { data: worlds } = await supabase.from('worlds').select('title, content, category').eq('novel_id', novelId)
  const worldSetting = (worlds || []).map((w: any) => `【${w.title}】(${w.category})\n${w.content}`).join('\n\n')

  // 获取角色
  const { data: chars } = await supabase.from('characters').select('*').eq('novel_id', novelId)
  const characters = (chars || []).map((c: any) => {
    const traits = c.personality?.traits?.join('、') || ''
    return `【${c.name}】${c.identity ? ' ' + c.identity : ''}${c.faction ? ' · ' + c.faction : ''}${c.realm ? ' · ' + c.realm : ''}\n性格: ${traits || '未知'}\n信念: ${c.beliefs || '未知'}\n弱点: ${c.weaknesses || '未知'}`
  }).join('\n\n')

  // 获取前一章摘要
  let previousSummary = '这是第一章'
  if (chapter > 1) {
    const { data: prevCh } = await supabase.from('chapters').select('content').eq('novel_id', novelId).eq('chapter_num', chapter - 1).single()
    if (prevCh?.content) {
      // 取最后500字作为摘要
      previousSummary = prevCh.content.slice(-500)
    }
  }

  // 获取大纲（如果有）
  const { data: chapters } = await supabase.from('chapters').select('chapter_num, title, extraction').eq('novel_id', novelId).eq('chapter_num', chapter).single()
  const outline = chapters?.title ? `第${chapter}章: ${chapters.title}` : ''

  // 获取伏笔
  const { data: foreshadows } = await supabase.from('foreshadows').select('*').eq('novel_id', novelId).eq('status', '未回收')
  const overdueForeshadows = (foreshadows || [])
    .filter((f: any) => f.expected_reveal_range && chapter >= f.expected_reveal_range[0])
    .map((f: any) => `⚠️ ${f.id}: ${f.content} (埋设于第${f.chapter_planted}章, 期望回收: 第${f.expected_reveal_range[0]}-${f.expected_reveal_range[1]}章)`)
    .join('\n')

  // 获取悬念状态
  const { data: mysteries } = await supabase.from('mysteries').select('*').eq('novel_id', novelId)
  const mysteryState = (mysteries || [])
    .map((m: any) => `${m.name}: 揭露度${m.revelation_progress}%, 当前阶段${m.current_stage}/${m.max_per_chapter || 6}`)
    .join('\n')

  // 获取写作约束
  const constraints = `目标字数: ${style.chapter_stats?.avg_word_count || 2500}字\n对话比例: ${((style.chapter_stats?.avg_dialogue_ratio || 0.3) * 100).toFixed(0)}%\n禁止表达: ${(style.vocabulary_rules?.banned_ai_phrases || []).join('、')}`

  // 【关键】使用状态机生成剧情状态快照
  let storyStateText = ''
  try {
    const snapshot = await generateStateSnapshot(novelId, chapter)
    storyStateText = formatStateForAgents(snapshot)
  } catch (e) {
    // 状态机查询失败时降级为空
    storyStateText = '暂无剧情状态数据'
  }

  return {
    title: novel?.title || '未命名',
    chapter,
    worldSetting,
    characters,
    previousSummary,
    outline,
    constraints,
    overdueForeshadows,
    mysteryState,
    soul,
    style,
    storyStateText, // 新增：结构化剧情状态
  }
}

export async function POST(req: NextRequest) {
  try {
    const { novelId, chapter } = await req.json()

    if (!novelId || !chapter) {
      return new Response(JSON.stringify({ error: '缺少 novelId 或 chapter' }), { status: 400 })
    }

    // 构建上下文
    const context = await buildContext(novelId, chapter)

    // 创建 SSE 流
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendLog = (log: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', log })}\n\n`))
        }

        const sendProgress = (progress: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`))
        }

        try {
          const runWorkflow = await getWorkflow()

          sendLog(`🚀 开始创作第${chapter}章...`)
          sendLog(`📚 书名: 《${context.title}》`)
          sendLog(`🌍 世界观: ${context.worldSetting ? '已加载' : '暂无'}`)
          sendLog(`👤 角色: ${context.characters ? '已加载' : '暂无'}`)
          sendLog(`---`)

          const result = await runWorkflow(novelId, chapter, context, (log) => {
            sendLog(log)
          })

          // 保存最终结果到数据库
          if (result.draft) {
            await supabase.from('chapters').upsert({
              novel_id: novelId,
              chapter_num: chapter,
              content: result.draft,
              title: `第${chapter}章`,
              word_count: result.draft.length,
              extraction: { scores: result.scores },
            }, { onConflict: 'novel_id,chapter_num' })

            // 更新进度
            const { data: novel } = await supabase.from('novels').select('progress').eq('id', novelId).single()
            const progress = novel?.progress || { current_chapter: 0, total_words: 0 }
            if (chapter > progress.current_chapter) {
              progress.current_chapter = chapter
            }
            progress.total_words = (progress.total_words || 0) + result.draft.length
            await supabase.from('novels').update({ progress, updated_at: new Date().toISOString() }).eq('id', novelId)
          }

          sendProgress({
            draft: result.draft,
            scores: result.scores,
            isApproved: result.isApproved,
            status: result.status,
            revisionCount: result.revisionCount,
          })

          sendLog(`---`)
          sendLog(result.isApproved
            ? `✅ 第${chapter}章创作完成！通过质量门禁。`
            : `⚠️ 第${chapter}章以当前版本输出（未完全通过门禁）`)

        } catch (error: any) {
          sendLog(`❌ 工作流错误: ${error.message}`)
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
