import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { callAI, extractJson, getCurrentConfig } from '@/lib/novel/ai-config'
import { requireNovelOwnership } from '@/lib/novel/auth'

// ========== 分阶段 AI 分析 ==========

// 分析1: 角色 + 世界观 + 事件
async function analyzeCore(text: string): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') return null

  const systemPrompt = `你是小说分析专家。从文本中提取以下信息，输出严格JSON：

{
  "characters": [
    {"name":"", "identity":"身份/职业", "personality":"性格特征(逗号分隔)", "beliefs":"信念/动机", "weaknesses":"弱点", "realm":"修为/等级(如有)"}
  ],
  "worlds": [
    {"name":"", "category":"rule|faction|location|item|history", "content":"详细描述", "importance":1-10}
  ],
  "events": [
    {"chapter_num":0, "title":"", "description":"50字内", "characters":["角色名"], "importance":1-10}
  ]
}

规则：
- 角色必须是具名人物，不要提取无名路人
- 世界观包括：势力组织、地理位置、力量体系、重要物品、历史事件
- 事件按时间顺序排列，chapter_num 是相对章节号（从0开始）
- 只输出JSON，不要其他文字`

  try {
    const content = await callAI(systemPrompt, text, { temperature: 0.2, maxTokens: 3000 })
    return extractJson(content)
  } catch (e: any) {
    console.error('analyzeCore error:', e.message)
    return null
  }
}

// 分析2: 伏笔 + 悬念
async function analyzeForeshadowsAndMysteries(text: string): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') return null

  const systemPrompt = `你是叙事结构分析专家。从文本中识别伏笔和悬念，输出严格JSON：

{
  "foreshadows": [
    {"content":"伏笔内容描述", "chapter_planted":0, "importance":"主线|支线", "expected_reveal_hint":"预计何时回收的线索"}
  ],
  "mysteries": [
    {"name":"悬念名称(简短)", "tier":"核心|主线|支线", "description":"悬念描述", "initial_chapter":0}
  ]
}

伏笔识别标准：
- 文中暗示但未解释的细节（异常行为、神秘物品、未说明的过去）
- 角色说了一半的话、欲言又止
- 环境中不寻常的描写
- 看似无关紧要但反复出现的元素

悬念识别标准：
- 读者会想知道答案的问题
- 角色身上的谜团（真实身份、过去、目的）
- 世界观中的未解之谜
- 两条线索之间的潜在联系

只输出JSON，不要其他文字`

  try {
    const content = await callAI(systemPrompt, text, { temperature: 0.2, maxTokens: 2000 })
    return extractJson(content)
  } catch (e: any) {
    console.error('analyzeForeshadows error:', e.message)
    return null
  }
}

// 分析3: 角色关系
async function analyzeRelationships(text: string, characterNames: string[]): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') return null

  const charList = characterNames.join('、')

  const systemPrompt = `你是角色关系分析专家。分析以下角色之间的关系，输出严格JSON：

{
  "relationships": [
    {"from":"角色A", "to":"角色B", "type":"关系类型", "trust_level":初始信任度(-10到10), "description":"关系描述"}
  ]
}

已知角色：${charList}

关系类型包括：师徒、朋友、敌人、恋人、亲属、上下级、盟友、竞争者、陌生人等
信任度：-10(深仇大恨) 0( neutral) 10(生死之交)

规则：
- 只提取文本中有明确依据的关系
- 每对角色只出现一次（A→B）
- 信任度根据文本中的互动推断

只输出JSON，不要其他文字`

  try {
    const content = await callAI(systemPrompt, text, { temperature: 0.2, maxTokens: 2000 })
    return extractJson(content)
  } catch (e: any) {
    console.error('analyzeRelationships error:', e.message)
    return null
  }
}

// 分析4: 小说灵魂 + 写作风格
async function analyzeSoulAndStyle(text: string, title: string): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') return null

  const systemPrompt = `你是网文商业分析专家。分析这部小说的核心卖点和写作风格，输出严格JSON：

{
  "soul": {
    "core_selling_points":["核心卖点1","核心卖点2","核心卖点3"],
    "forbidden_directions":["禁止方向1","禁止方向2"],
    "tone":"整体调性(如：热血爽文/沉稳大气/轻松幽默)",
    "reader_promise":"对读者的承诺(读者追更的理由)"
  },
  "style": {
    "narrative_voice":"叙事视角(第一人称/第三人称限制/第三人称全知)",
    "pacing":"节奏风格(快节奏/慢热/交替)",
    "dialogue_style":"对话风格(简洁/文学/口语化)",
    "description_density":"描写密度(高/中/低)",
    "avg_chapter_length":0,
    "banned_phrases":["应避免的AI化表达1","应避免的AI化表达2"],
    "signature_patterns":["作者标志性写法1","作者标志性写法2"]
  }
}

分析要求：
- 核心卖点：这本书最吸引读者的2-4个点（如：扮猪吃老虎、升级打脸、世界观新奇）
- 禁止方向：绝对不能出现的内容（如：虐主、圣母、逻辑硬伤）
- 读者承诺：读者期待看到什么（如：持续变强、谜团揭开）
- 签名模式：作者独特的写作习惯（如：特定句式、节奏变化方式）
- 禁止表达：文本中没有出现的、应该避免的网文AI常见表达

只输出JSON，不要其他文字`

  try {
    const content = await callAI(systemPrompt, text, { temperature: 0.3, maxTokens: 2000 })
    return extractJson(content)
  } catch (e: any) {
    console.error('analyzeSoulAndStyle error:', e.message)
    return null
  }
}

// ========== 工具函数 ==========

function uuid8(): string {
  return crypto.randomUUID().slice(0, 8)
}

async function safeInsert(table: string, data: any): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).insert(data)
    if (error) {
      console.error(`Insert ${table} error:`, error.message)
      return false
    }
    return true
  } catch (e: any) {
    console.error(`Insert ${table} exception:`, e.message)
    return false
  }
}

// ========== POST: 上传并分析小说 ==========

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const novelId = formData.get('novelId') as string
    const analyzeWithAI = formData.get('analyze') === 'true'
    const aiProvider = formData.get('aiProvider') as string
    const aiApiKey = formData.get('aiApiKey') as string
    const aiBaseUrl = formData.get('aiBaseUrl') as string
    const aiModel = formData.get('aiModel') as string

    if (!files || files.length === 0 || !novelId) {
      return NextResponse.json({ error: '缺少文件或 novelId' }, { status: 400 })
    }

    // 鉴权
    const { error: authError } = await requireNovelOwnership(req, novelId)
    if (authError) return authError

    // 设置 AI 配置
    if (aiProvider) process.env.AI_PROVIDER = aiProvider
    if (aiApiKey) {
      process.env.AI_API_KEY = aiApiKey
      process.env[`${aiProvider?.toUpperCase()}_API_KEY`] = aiApiKey
    }
    if (aiBaseUrl) {
      process.env.AI_BASE_URL = aiBaseUrl
      process.env[`${aiProvider?.toUpperCase()}_BASE_URL`] = aiBaseUrl
    }
    if (aiModel) {
      process.env.AI_MODEL = aiModel
      process.env[`${aiProvider?.toUpperCase()}_MODEL`] = aiModel
    }

    console.log(`Import started: ${files.length} files, novelId=${novelId}, analyze=${analyzeWithAI}`)

    const { splitChapters, getNovelStats } = await import('@/lib/novel/parser')

    // 解析所有文件
    let allChapters: { title: string; content: string; index: number; wordCount: number }[] = []
    for (const file of files) {
      const text = await file.text()
      const chapters = splitChapters(text)
      allChapters.push(...chapters)
    }
    allChapters.sort((a, b) => a.index - b.index)
    allChapters = allChapters.map((ch, i) => ({ ...ch, index: i }))
    const stats = getNovelStats(allChapters)

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
      if (!error) savedCount++
    }

    // 更新小说进度
    await supabase.from('novels').update({
      progress: { current_chapter: savedCount, total_words: stats.totalWords },
      updated_at: new Date().toISOString(),
    }).eq('id', novelId)

    console.log(`Saved ${savedCount} chapters`)

    // ========== 深度 AI 分析 ==========
    let analysisResult = null
    if (analyzeWithAI && allChapters.length > 0) {
      console.log('Starting deep AI analysis...')

      // 采样策略：取前5章 + 中间1章 + 最后1章，每章取前3000字
      const sampleIndices = new Set<number>()
      const takeN = Math.min(5, allChapters.length)
      for (let i = 0; i < takeN; i++) sampleIndices.add(i)
      if (allChapters.length > 6) sampleIndices.add(Math.floor(allChapters.length / 2))
      if (allChapters.length > 1) sampleIndices.add(allChapters.length - 1)

      const sampledChapters = Array.from(sampleIndices)
        .filter(i => i < allChapters.length)
        .map(i => allChapters[i])

      const sampleText = sampledChapters.map(ch =>
        `【${ch.title}】\n${ch.content.slice(0, 3000)}`
      ).join('\n\n')

      console.log(`Sampling ${sampledChapters.length} chapters, ${sampleText.length} chars total`)

      // 分阶段分析（并行执行独立的分析）
      const [coreResult, foreshadowResult] = await Promise.all([
        analyzeCore(sampleText),
        analyzeForeshadowsAndMysteries(sampleText),
      ])

      // 从核心分析中提取角色名，用于关系分析
      const characterNames = (coreResult?.characters || []).map((c: any) => c.name).filter(Boolean)

      // 关系分析和灵魂分析（依赖角色名或独立）
      const [relationshipResult, soulResult] = await Promise.all([
        characterNames.length >= 2 ? analyzeRelationships(sampleText, characterNames) : null,
        analyzeSoulAndStyle(sampleText, files[0]?.name || ''),
      ])

      // ========== 写入数据库 ==========
      let savedChars = 0, savedWorlds = 0, savedEvents = 0
      let savedForeshadows = 0, savedMysteries = 0, savedRelationships = 0

      // 保存角色
      if (coreResult?.characters) {
        for (const char of coreResult.characters) {
          if (!char.name) continue
          const ok = await safeInsert('characters', {
            id: `char_${uuid8()}`, novel_id: novelId, name: char.name,
            identity: char.identity || '',
            personality: char.personality ? { traits: char.personality.split(/[,，、]/).map((s: string) => s.trim()) } : {},
            beliefs: char.beliefs || '',
            weaknesses: char.weaknesses || '',
            realm: char.realm || '',
            status: 'active', first_appearance: 1,
          })
          if (ok) savedChars++
        }
      }

      // 保存世界观
      if (coreResult?.worlds) {
        for (const w of coreResult.worlds) {
          if (!w.name) continue
          const ok = await safeInsert('worlds', {
            id: `world_${uuid8()}`, novel_id: novelId, name: w.name, title: w.name,
            category: w.category || 'rule', content: w.content || '',
            importance: w.importance || 6,
          })
          if (ok) savedWorlds++
        }
      }

      // 保存事件
      if (coreResult?.events) {
        for (const ev of coreResult.events) {
          if (!ev.title) continue
          const ok = await safeInsert('timelines', {
            novel_id: novelId,
            chapter_num: (ev.chapter_num || 0) + 1,
            event_order: savedEvents + 1,
            event_type: 'plot',
            title: ev.title,
            description: ev.description || '',
            characters_involved: ev.characters || [],
            importance: ev.importance || 5,
          })
          if (ok) savedEvents++
        }
      }

      // 保存伏笔
      if (foreshadowResult?.foreshadows) {
        for (const f of foreshadowResult.foreshadows) {
          if (!f.content) continue
          const planted = (f.chapter_planted || 0) + 1
          const ok = await safeInsert('foreshadows', {
            id: `fs_${uuid8()}`, novel_id: novelId, content: f.content,
            chapter_planted: planted,
            importance: f.importance || '支线',
            tier: f.importance === '主线' ? 'main' : 'sub',
            status: '未回收',
            category: 'plot_hook',
            expected_reveal_range: [planted + 5, planted + 15],
            evidence: f.expected_reveal_hint || '',
          })
          if (ok) savedForeshadows++
        }
      }

      // 保存悬念
      if (foreshadowResult?.mysteries) {
        for (const m of foreshadowResult.mysteries) {
          if (!m.name) continue
          const ok = await safeInsert('mysteries', {
            id: `mystery_${uuid8()}`, novel_id: novelId, name: m.name,
            tier: m.tier || '支线',
            revelation_progress: 0,
            planted_chapter: (m.initial_chapter || 0) + 1,
            current_stage: 1,
            max_per_chapter: 5,
            revelation_stages: [
              { stage: 1, threshold: 0, description: '读者完全不知情' },
              { stage: 2, threshold: 15, description: '暗示存在异常' },
              { stage: 3, threshold: 35, description: '部分真相浮出' },
              { stage: 4, threshold: 60, description: '核心机制揭露' },
              { stage: 5, threshold: 85, description: '完全真相' },
              { stage: 6, threshold: 100, description: '真相大白' },
            ],
            forbidden_chapters: [],
            last_updated_chapter: 1,
          })
          if (ok) savedMysteries++
        }
      }

      // 保存关系
      if (relationshipResult?.relationships) {
        for (const r of relationshipResult.relationships) {
          if (!r.from || !r.to) continue
          const ok = await safeInsert('relationships', {
            novel_id: novelId, from_char: r.from, to_char: r.to,
            rel_type: r.type || '未知',
            trust_level: r.trust_level ?? 0,
            trust_history: [{ chapter: 1, value: r.trust_level ?? 0, reason: r.description || '初始关系' }],
            last_updated_chapter: 1,
          })
          if (ok) savedRelationships++
        }
      }

      // 保存小说灵魂
      if (soulResult?.soul) {
        const s = soulResult.soul
        await supabase.from('novel_souls').upsert({
          id: `soul_${novelId}`, novel_id: novelId,
          core_selling_points: s.core_selling_points || [],
          forbidden_directions: s.forbidden_directions || [],
          tone: s.tone || '',
          reader_promise: s.reader_promise || '',
        }, { onConflict: 'novel_id' })

        // 同时更新 novels.soul 字段（兼容旧逻辑）
        await supabase.from('novels').update({
          soul: {
            core_selling_points: s.core_selling_points || [],
            core_hooks: s.core_selling_points || [],
            forbidden_directions: s.forbidden_directions || [],
            tone: s.tone || '',
            reader_promise: s.reader_promise || '',
          },
          updated_at: new Date().toISOString(),
        }).eq('id', novelId)
      }

      // 保存写作风格
      if (soulResult?.style) {
        const st = soulResult.style
        await supabase.from('novels').update({
          style: {
            'genre定位': '导入小说',
            narrative_voice: st.narrative_voice || '第三人称限制视角',
            pacing_profile: { type: '剧情驱动', 节奏: st.pacing || '中', 信息密度: '中', 悬念密度: '中' },
            chapter_stats: {
              avg_word_count: st.avg_chapter_length || stats.avgWordsPerChapter || 2500,
              word_count_range: [2000, 3000],
              avg_paragraphs: 25,
              avg_dialogue_ratio: 0.3,
            },
            vocabulary_rules: {
              forbidden_patterns: [],
              preferred_patterns: [],
              banned_ai_phrases: st.banned_phrases || ['不禁感叹', '心中暗道', '一股暖流'],
            },
            description_style: {
              action_density: '中',
              psychology_depth: st.description_density === '高' ? '深' : '中',
              environment_detail: st.description_density === '高' ? '详' : '中',
              dialogue_style: st.dialogue_style || '自然',
            },
            deviation_thresholds: { word_count_drift: 0.3, dialogue_ratio_drift: 0.15, style_score_minimum: 85 },
            signature_patterns: st.signature_patterns || [],
          },
          updated_at: new Date().toISOString(),
        }).eq('id', novelId)
      }

      analysisResult = {
        savedChars, savedWorlds, savedEvents,
        savedForeshadows, savedMysteries, savedRelationships,
        hasSoul: !!soulResult?.soul,
        hasStyle: !!soulResult?.style,
      }

      console.log('Deep analysis complete:', analysisResult)
    }

    return NextResponse.json({
      ok: true,
      stats: { ...stats, chapterCount: savedCount },
      savedCount,
      totalChapters: allChapters.length,
      filesCount: files.length,
      analysis: analysisResult,
      message: buildMessage(savedCount, stats.totalWords, files.length, analysisResult),
    })
  } catch (e: any) {
    console.error('Import error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function buildMessage(chapters: number, words: number, files: number, analysis: any): string {
  let msg = `${files}个文件，${chapters}章（${words.toLocaleString()}字）已保存`
  if (analysis) {
    const parts = []
    if (analysis.savedChars) parts.push(`${analysis.savedChars}角色`)
    if (analysis.savedWorlds) parts.push(`${analysis.savedWorlds}世界观`)
    if (analysis.savedEvents) parts.push(`${analysis.savedEvents}事件`)
    if (analysis.savedForeshadows) parts.push(`${analysis.savedForeshadows}伏笔`)
    if (analysis.savedMysteries) parts.push(`${analysis.savedMysteries}悬念`)
    if (analysis.savedRelationships) parts.push(`${analysis.savedRelationships}关系`)
    if (analysis.hasSoul) parts.push('灵魂✓')
    if (analysis.hasStyle) parts.push('风格✓')
    if (parts.length > 0) msg += `，AI分析：${parts.join('，')}`
  }
  return msg
}

// ========== GET: 工具操作 ==========

export async function GET(req: NextRequest) {
  try {
    const novelId = req.nextUrl.searchParams.get('novelId')
    const action = req.nextUrl.searchParams.get('action')

    if (!novelId) {
      return NextResponse.json({ error: '缺少 novelId' }, { status: 400 })
    }

    // 鉴权
    const { error: authError } = await requireNovelOwnership(req, novelId)
    if (authError) return authError

    if (action === 'fix-titles') {
      const { data: chapters } = await supabase.from('chapters')
        .select('id, chapter_num, title, content')
        .eq('novel_id', novelId)
        .order('chapter_num')

      if (!chapters) {
        return NextResponse.json({ error: '没有章节数据' }, { status: 404 })
      }

      let fixedCount = 0
      for (const ch of chapters) {
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
      // 重新分析（复用 POST 的逻辑）
      const aiProvider = req.nextUrl.searchParams.get('aiProvider')
      const aiApiKey = req.nextUrl.searchParams.get('aiApiKey')
      const aiBaseUrl = req.nextUrl.searchParams.get('aiBaseUrl')
      const aiModel = req.nextUrl.searchParams.get('aiModel')
      if (aiProvider) process.env.AI_PROVIDER = aiProvider
      if (aiApiKey) process.env[`${aiProvider?.toUpperCase()}_API_KEY`] = aiApiKey
      if (aiBaseUrl) process.env[`${aiProvider?.toUpperCase()}_BASE_URL`] = aiBaseUrl
      if (aiModel) process.env[`${aiProvider?.toUpperCase()}_MODEL`] = aiModel

      const { data: chapters } = await supabase.from('chapters')
        .select('chapter_num, title, content')
        .eq('novel_id', novelId)
        .order('chapter_num')
        .limit(10)

      if (!chapters || chapters.length === 0) {
        return NextResponse.json({ error: '没有章节数据' }, { status: 404 })
      }

      const sampleText = chapters.map(ch =>
        `【${ch.title || `第${ch.chapter_num}章`}】\n${(ch.content || '').slice(0, 3000)}`
      ).join('\n\n')

      // 并行分析
      const [coreResult, foreshadowResult] = await Promise.all([
        analyzeCore(sampleText),
        analyzeForeshadowsAndMysteries(sampleText),
      ])

      const characterNames = (coreResult?.characters || []).map((c: any) => c.name).filter(Boolean)
      const [relationshipResult, soulResult] = await Promise.all([
        characterNames.length >= 2 ? analyzeRelationships(sampleText, characterNames) : null,
        analyzeSoulAndStyle(sampleText, ''),
      ])

      let savedChars = 0, savedWorlds = 0, savedEvents = 0
      let savedForeshadows = 0, savedMysteries = 0, savedRelationships = 0

      if (coreResult?.characters) {
        for (const char of coreResult.characters) {
          if (!char.name) continue
          const ok = await safeInsert('characters', {
            id: `char_${uuid8()}`, novel_id: novelId, name: char.name,
            identity: char.identity || '',
            personality: char.personality ? { traits: char.personality.split(/[,，、]/).map((s: string) => s.trim()) } : {},
            beliefs: char.beliefs || '', weaknesses: char.weaknesses || '', realm: char.realm || '',
            status: 'active', first_appearance: 1,
          })
          if (ok) savedChars++
        }
      }

      if (coreResult?.worlds) {
        for (const w of coreResult.worlds) {
          if (!w.name) continue
          const ok = await safeInsert('worlds', {
            id: `world_${uuid8()}`, novel_id: novelId, name: w.name, title: w.name,
            category: w.category || 'rule', content: w.content || '', importance: w.importance || 6,
          })
          if (ok) savedWorlds++
        }
      }

      if (coreResult?.events) {
        for (const ev of coreResult.events) {
          if (!ev.title) continue
          const ok = await safeInsert('timelines', {
            novel_id: novelId, chapter_num: (ev.chapter_num || 0) + 1,
            event_order: savedEvents + 1, event_type: 'plot',
            title: ev.title, description: ev.description || '',
            characters_involved: ev.characters || [], importance: ev.importance || 5,
          })
          if (ok) savedEvents++
        }
      }

      if (foreshadowResult?.foreshadows) {
        for (const f of foreshadowResult.foreshadows) {
          if (!f.content) continue
          const planted = (f.chapter_planted || 0) + 1
          const ok = await safeInsert('foreshadows', {
            id: `fs_${uuid8()}`, novel_id: novelId, content: f.content,
            chapter_planted: planted, importance: f.importance || '支线',
            tier: f.importance === '主线' ? 'main' : 'sub',
            status: '未回收', category: 'plot_hook',
            expected_reveal_range: [planted + 5, planted + 15],
            evidence: f.expected_reveal_hint || '',
          })
          if (ok) savedForeshadows++
        }
      }

      if (foreshadowResult?.mysteries) {
        for (const m of foreshadowResult.mysteries) {
          if (!m.name) continue
          const ok = await safeInsert('mysteries', {
            id: `mystery_${uuid8()}`, novel_id: novelId, name: m.name,
            tier: m.tier || '支线', revelation_progress: 0,
            planted_chapter: (m.initial_chapter || 0) + 1,
            current_stage: 1, max_per_chapter: 5,
            revelation_stages: [
              { stage: 1, threshold: 0, description: '读者完全不知情' },
              { stage: 2, threshold: 15, description: '暗示存在异常' },
              { stage: 3, threshold: 35, description: '部分真相浮出' },
              { stage: 4, threshold: 60, description: '核心机制揭露' },
              { stage: 5, threshold: 85, description: '完全真相' },
              { stage: 6, threshold: 100, description: '真相大白' },
            ],
            forbidden_chapters: [], last_updated_chapter: 1,
          })
          if (ok) savedMysteries++
        }
      }

      if (relationshipResult?.relationships) {
        for (const r of relationshipResult.relationships) {
          if (!r.from || !r.to) continue
          const ok = await safeInsert('relationships', {
            novel_id: novelId, from_char: r.from, to_char: r.to,
            rel_type: r.type || '未知', trust_level: r.trust_level ?? 0,
            trust_history: [{ chapter: 1, value: r.trust_level ?? 0, reason: r.description || '初始关系' }],
            last_updated_chapter: 1,
          })
          if (ok) savedRelationships++
        }
      }

      if (soulResult?.soul) {
        const s = soulResult.soul
        await supabase.from('novel_souls').upsert({
          id: `soul_${novelId}`, novel_id: novelId,
          core_selling_points: s.core_selling_points || [],
          forbidden_directions: s.forbidden_directions || [],
          tone: s.tone || '', reader_promise: s.reader_promise || '',
        }, { onConflict: 'novel_id' })
      }

      return NextResponse.json({
        ok: true,
        analysis: { savedChars, savedWorlds, savedEvents, savedForeshadows, savedMysteries, savedRelationships },
        raw: { core: coreResult, foreshadows: foreshadowResult, relationships: relationshipResult, soul: soulResult },
      })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (e: any) {
    console.error('Import GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
