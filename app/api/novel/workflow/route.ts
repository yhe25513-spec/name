import { NextRequest } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { generateStateSnapshot, formatStateForAgents, checkMysteryConstraints } from '@/lib/novel/agents/state-machine'
import { closeForeshadow, addForeshadow } from '@/lib/novel/foreshadows'
import { updateProgress } from '@/lib/novel/novels'
import { requireNovelOwnership } from '@/lib/novel/auth'

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

  // 获取前一章摘要（取最后2000字，让 Agent 有足够的上下文续写）
  let previousSummary = '这是第一章，请从开头写起。'
  if (chapter > 1) {
    const { data: prevCh } = await supabase.from('chapters').select('content').eq('novel_id', novelId).eq('chapter_num', chapter - 1).single()
    if (prevCh?.content) {
      previousSummary = prevCh.content.slice(-2000)
    }
  }

  // 获取大纲：当前章标题 + 相邻章节标题提供上下文
  const { data: chapters } = await supabase.from('chapters').select('chapter_num, title, extraction').eq('novel_id', novelId).eq('chapter_num', chapter).single()
  const { data: nearbyChapters } = await supabase.from('chapters').select('chapter_num, title').eq('novel_id', novelId).gte('chapter_num', Math.max(1, chapter - 1)).lte('chapter_num', chapter + 2).order('chapter_num')

  let outline = chapters?.title ? `第${chapter}章: ${chapters.title}` : ''
  // 附加相邻章节标题作为上下文
  if (nearbyChapters && nearbyChapters.length > 1) {
    const nearby = nearbyChapters.map((c: any) => `第${c.chapter_num}章: ${c.title || '未命名'}`).join('\n')
    outline += `\n\n前后章节参考:\n${nearby}`
  }

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

  // 读取九段式产出的结构化数据
  let chapterOutline: any = null
  let novelSoul: any = soul || {}
  let storyStatesData: any[] = []
  let mysteryConstraints = ''

  try {
    // 章节大纲（九段式阶段5产出）
    const { data: outlineData } = await supabase
      .from('chapters')
      .select('extraction')
      .eq('novel_id', novelId)
      .eq('chapter_num', chapter)
      .single()
    chapterOutline = outlineData?.extraction?.outline || null

    // 小说灵魂（优先用 novel_souls 表，九段式阶段1产出）
    const { data: soulData } = await supabase
      .from('novel_souls')
      .select('*')
      .eq('novel_id', novelId)
      .single()
    if (soulData) {
      novelSoul = {
        core_selling_points: soulData.core_selling_points || [],
        forbidden_directions: soulData.forbidden_directions || [],
        tone: soulData.tone || '',
        reader_promise: soulData.reader_promise || '',
      }
    }

    // 剧情状态机数据
    const { data: statesData } = await supabase
      .from('story_states')
      .select('*')
      .eq('novel_id', novelId)
    storyStatesData = statesData || []

    // 悬念揭露约束
    const snapshot = await generateStateSnapshot(novelId, chapter)
    const constraints = checkMysteryConstraints(snapshot, chapter)
    if (constraints.blockedMysteries.length > 0) {
      mysteryConstraints = `⚠️ 以下悬念不能在本章揭露: ${constraints.blockedMysteries.join('、')}`
    }
    if (constraints.notes.length > 0) {
      mysteryConstraints += (mysteryConstraints ? '\n' : '') + constraints.notes.join('\n')
    }
  } catch {
    // 降级处理：九段式数据缺失不影响写作
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
    soul: novelSoul,
    style,
    storyStateText,
    chapterOutline,
    storyStatesData,
    mysteryConstraints,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { novelId, chapter, aiSettings } = await req.json()

    if (!novelId || !chapter) {
      return new Response(JSON.stringify({ error: '缺少 novelId 或 chapter' }), { status: 400 })
    }

    // 鉴权：验证小说所有权
    const { error: authError } = await requireNovelOwnership(req, novelId)
    if (authError) return authError

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
          }, aiSettings)

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

            // 自动更新故事状态（打通状态机）
            try {
              // 1. 提取伏笔变化并更新
              const foreshadowReview = result.scores?.foreshadow
              if (foreshadowReview?.foreshadows_harvested) {
                for (const f of foreshadowReview.foreshadows_harvested) {
                  if (f.id) {
                    await closeForeshadow(novelId, f.id, chapter).catch((e: any) => {
                      sendLog(`⚠️ 回收伏笔 ${f.id} 失败: ${e.message}`)
                    })
                  }
                }
              }
              if (foreshadowReview?.foreshadows_planted) {
                for (const f of foreshadowReview.foreshadows_planted) {
                  await addForeshadow(novelId, f.content, chapter, f.importance || '支线').catch((e: any) => {
                    sendLog(`⚠️ 埋设伏笔失败: ${e.message}`)
                  })
                }
              }

              // 2. 添加时间线事件
              try {
                await supabase.from('timelines').insert({
                  novel_id: novelId,
                  chapter_num: chapter,
                  event_order: 1,
                  event_type: 'chapter',
                  title: `第${chapter}章完成`,
                  description: result.draft.slice(0, 200),
                  characters_involved: [],
                  importance: 5,
                })
              } catch {}

              // 3. 更新进度
              await updateProgress(novelId, chapter, result.draft.length)

              sendLog(`📊 故事状态已更新: 伏笔回收${foreshadowReview?.foreshadows_harvested?.length || 0}个, 新埋${foreshadowReview?.foreshadows_planted?.length || 0}个`)
            } catch (e: any) {
              sendLog(`⚠️ 状态更新部分失败: ${e.message}`)
            }
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
