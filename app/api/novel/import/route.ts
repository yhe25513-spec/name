import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/novel/store'
import { callAI, extractJson, getCurrentConfig, resolveAIConfig, applyAIConfigTemporarily } from '@/lib/novel/ai-config'
import { requireNovelOwnership } from '@/lib/novel/auth'

// ========== 设定文件识别 ==========

// 已知的设定文件名关键词（不作为章节导入）
const SETTING_FILE_KEYWORDS = [
  '世界观', '角色', '势力', '地点', '物品', '法宝', '禁忌', '灵魂',
  '时间线', '剧情', '状态机', '核心', '主线', '历史', '种族', '设定',
  '大纲', '人物', '地图', '系统', '体系', '规则', '背景',
]

// 判断文件名是否为设定文件（非章节）
function isSettingFile(filename: string): boolean {
  const name = filename.replace(/\.(md|txt)$/i, '')
  return SETTING_FILE_KEYWORDS.some(kw => name.includes(kw))
}

// 从文件名提取章节标题
function extractTitleFromFilename(filename: string): string {
  let name = filename.replace(/\.(md|txt)$/i, '').trim()
  // 去掉序号前缀如 "第0006章" → 保留 "第六章 猎窝座"
  // 如果文件名本身就是 "第0006章第六章 猎窝座"，提取有意义部分
  const chapterMatch = name.match(/第[零一二三四五六七八九十百千\d]+章[\s：:—\-|｜]*(.+)/)
  if (chapterMatch && chapterMatch[1].trim()) {
    return `第${name.match(/第([零一二三四五六七八九十百千\d]+)章/)?.[1] || ''}章 ${chapterMatch[1].trim()}`
  }
  return name
}

// 判断文件名是否像章节文件
function looksLikeChapterFile(filename: string): boolean {
  const name = filename.replace(/\.(md|txt)$/i, '')
  return /第[零一二三四五六七八九十百千\d]+章/.test(name) || /Chapter\s+\d+/i.test(name) || /^\d+[\.、]/.test(name)
}

// ========== 设定文件写入记忆层 ==========

const SETTING_TABLE_MAP: Record<string, { table: string; mapFn: (content: string, filename: string, novelId: string) => any }> = {
  '世界观': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: filename.replace(/\.(md|txt)$/i, ''),
      title: filename.replace(/\.(md|txt)$/i, ''),
      category: 'rule', content, importance: 8,
    }),
  },
  '角色': {
    table: 'characters',
    mapFn: (content, filename, novelId) => ({
      id: `char_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '角色设定（详见内容）',
      identity: '角色总表', personality: { traits: [] },
      beliefs: content.slice(0, 500), status: 'active', first_appearance: 1,
    }),
  },
  '势力': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '势力设定',
      title: '势力设定', category: 'faction', content, importance: 8,
    }),
  },
  '地点': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '地点设定',
      title: '地点设定', category: 'location', content, importance: 7,
    }),
  },
  '物品': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '物品法宝',
      title: '物品法宝', category: 'item', content, importance: 6,
    }),
  },
  '禁忌': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '禁忌设定',
      title: '禁忌设定', category: 'rule', content, importance: 9,
    }),
  },
  '灵魂': {
    table: 'novel_souls',
    mapFn: (content, filename, novelId) => ({
      id: `soul_${novelId}`, novel_id: novelId,
      core_selling_points: [], forbidden_directions: [],
      tone: '', reader_promise: content.slice(0, 1000),
    }),
  },
  '时间线': {
    table: 'timelines',
    mapFn: (content, filename, novelId) => ({
      novel_id: novelId, chapter_num: 1, event_order: 1,
      event_type: 'timeline', title: '时间线总览',
      description: content.slice(0, 2000), characters_involved: [], importance: 9,
    }),
  },
  '历史': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '历史事件',
      title: '历史事件', category: 'history', content, importance: 7,
    }),
  },
  '种族': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '种族设定',
      title: '种族设定', category: 'faction', content, importance: 7,
    }),
  },
  '核心': {
    table: 'worlds',
    mapFn: (content, filename, novelId) => ({
      id: `world_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: filename.replace(/\.(md|txt)$/i, ''),
      title: filename.replace(/\.(md|txt)$/i, ''),
      category: 'rule', content, importance: 9,
    }),
  },
  '剧情': {
    table: 'story_states',
    mapFn: (content, filename, novelId) => ({
      id: `state_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: filename.replace(/\.(md|txt)$/i, ''),
      category: 'main_plot', description: content.slice(0, 2000),
      progress: 0, current_stage: 1, max_stages: 6,
    }),
  },
  '主线': {
    table: 'story_states',
    mapFn: (content, filename, novelId) => ({
      id: `state_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '核心主线',
      category: 'main_plot', description: content.slice(0, 2000),
      progress: 0, current_stage: 1, max_stages: 6,
    }),
  },
  '人物': {
    table: 'characters',
    mapFn: (content, filename, novelId) => ({
      id: `char_${crypto.randomUUID().slice(0, 8)}`,
      novel_id: novelId, name: '角色总表',
      identity: '角色设定文件', personality: { traits: [] },
      beliefs: content.slice(0, 500), status: 'active', first_appearance: 1,
    }),
  },
}

// ========== 分阶段 AI 分析 ==========

async function analyzeCore(text: string): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') {
    console.warn('[Import] analyzeCore skipped: provider=' + config.provider + ', hasApiKey=false')
    return null
  }

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

async function analyzeForeshadowsAndMysteries(text: string): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') {
    console.warn('[Import] analyzeForeshadowsAndMysteries skipped: no API key')
    return null
  }

  const systemPrompt = `你是叙事结构分析专家。从文本中识别伏笔和悬念，输出严格JSON：

{
  "foreshadows": [
    {"content":"伏笔内容描述", "chapter_planted":0, "importance":"主线|支线", "expected_reveal_hint":"预计何时回收的线索"}
  ],
  "mysteries": [
    {"name":"悬念名称(简短)", "tier":"核心|主线|支线", "description":"悬念描述", "initial_chapter":0}
  ]
}

只输出JSON，不要其他文字`

  try {
    const content = await callAI(systemPrompt, text, { temperature: 0.2, maxTokens: 2000 })
    return extractJson(content)
  } catch (e: any) {
    console.error('analyzeForeshadows error:', e.message)
    return null
  }
}

async function analyzeRelationships(text: string, characterNames: string[]): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') {
    console.warn('[Import] analyzeRelationships skipped: no API key')
    return null
  }

  const charList = characterNames.join('、')
  const systemPrompt = `你是角色关系分析专家。分析以下角色之间的关系，输出严格JSON：

{
  "relationships": [
    {"from":"角色A", "to":"角色B", "type":"关系类型", "trust_level":初始信任度(-10到10), "description":"关系描述"}
  ]
}

已知角色：${charList}
只输出JSON，不要其他文字`

  try {
    const content = await callAI(systemPrompt, text, { temperature: 0.2, maxTokens: 2000 })
    return extractJson(content)
  } catch (e: any) {
    console.error('analyzeRelationships error:', e.message)
    return null
  }
}

async function analyzeSoulAndStyle(text: string, title: string): Promise<any> {
  const config = getCurrentConfig()
  if (!config.hasApiKey && config.provider !== 'ollama') {
    console.warn('[Import] analyzeSoulAndStyle skipped: no API key')
    return null
  }

  const systemPrompt = `你是网文商业分析专家。分析这部小说的核心卖点和写作风格，输出严格JSON：

{
  "soul": {
    "core_selling_points":["核心卖点1","核心卖点2"],
    "forbidden_directions":["禁止方向1"],
    "tone":"整体调性",
    "reader_promise":"对读者的承诺"
  },
  "style": {
    "narrative_voice":"叙事视角",
    "pacing":"节奏风格",
    "dialogue_style":"对话风格",
    "description_density":"描写密度",
    "avg_chapter_length":0,
    "banned_phrases":["应避免的AI化表达"],
    "signature_patterns":["作者标志性写法"]
  }
}
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
  let restoreConfig: (() => void) | undefined
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

    const { error: authError } = await requireNovelOwnership(req, novelId)
    if (authError) return authError

    // 安全解析 AI 配置（临时应用，请求结束后自动恢复）
    const aiConfig = resolveAIConfig({ provider: aiProvider, apiKey: aiApiKey, baseUrl: aiBaseUrl, model: aiModel })
    const restoreConfig = applyAIConfigTemporarily(aiConfig)

    console.log(`Import started: ${files.length} files, novelId=${novelId}, analyze=${analyzeWithAI}`)

    const { splitChapters, getNovelStats } = await import('@/lib/novel/parser')

    // ====== 分流：设定文件 vs 章节文件 ======
    const settingFiles: { filename: string; content: string }[] = []
    const chapterFiles: File[] = []

    for (const file of files) {
      const filename = file.name
      if (isSettingFile(filename)) {
        const text = await file.text()
        settingFiles.push({ filename, content: text })
      } else {
        chapterFiles.push(file)
      }
    }

    console.log(`Files: ${settingFiles.length} setting files, ${chapterFiles.length} chapter files`)

    // ====== 处理设定文件 → 直接写入记忆层 ======
    let savedSettings = 0
    for (const sf of settingFiles) {
      const name = sf.filename.replace(/\.(md|txt)$/i, '')
      // 找到匹配的设定类型
      const matchedKey = SETTING_FILE_KEYWORDS.find(kw => name.includes(kw))
      if (matchedKey && SETTING_TABLE_MAP[matchedKey]) {
        const { table, mapFn } = SETTING_TABLE_MAP[matchedKey]
        const data = mapFn(sf.content, sf.filename, novelId)
        const ok = await safeInsert(table, data)
        if (ok) {
          savedSettings++
          console.log(`Setting saved: ${sf.filename} → ${table}`)
        }
      } else {
        // 未知类型的设定文件，存为通用世界观
        const ok = await safeInsert('worlds', {
          id: `world_${uuid8()}`, novel_id: novelId,
          name: name, title: name,
          category: 'general', content: sf.content, importance: 5,
        })
        if (ok) savedSettings++
      }
    }

    // ====== 处理章节文件 ======
    let allChapters: { title: string; content: string; index: number; wordCount: number }[] = []
    for (const file of chapterFiles) {
      const text = await file.text()
      const filename = file.name
      const chapters = splitChapters(text)

      // 如果解析出的章节标题太短或为空，用文件名
      for (const ch of chapters) {
        if (!ch.title || ch.title.length < 4) {
          ch.title = extractTitleFromFilename(filename)
        }
      }

      // 如果整个文件没解析出章节（没有章节标题模式），用文件名作为标题
      if (chapters.length === 0) {
        const title = extractTitleFromFilename(filename)
        const wordCount = text.replace(/\s/g, '').length
        if (wordCount > 50) {
          allChapters.push({ title, content: text.trim(), index: allChapters.length, wordCount })
        }
      } else {
        // 如果只有一个章节且标题是默认的，用文件名
        if (chapters.length === 1 && chapters[0].title.startsWith('第') && chapters[0].title.endsWith('章')) {
          chapters[0].title = extractTitleFromFilename(filename)
        }
        allChapters.push(...chapters)
      }
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

    console.log(`Saved ${savedCount} chapters, ${savedSettings} settings`)

    // ========== 深度 AI 分析（仅对章节内容） ==========
    let analysisResult: any = null
    if (analyzeWithAI && allChapters.length > 0) {
      console.log('Starting deep AI analysis...')

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

      const [coreResult, foreshadowResult] = await Promise.all([
        analyzeCore(sampleText),
        analyzeForeshadowsAndMysteries(sampleText),
      ])

      const characterNames = (coreResult?.characters || []).map((c: any) => c.name).filter(Boolean)
      const [relationshipResult, soulResult] = await Promise.all([
        characterNames.length >= 2 ? analyzeRelationships(sampleText, characterNames) : null,
        analyzeSoulAndStyle(sampleText, files[0]?.name || ''),
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

        await supabase.from('novels').update({
          soul: {
            core_selling_points: s.core_selling_points || [],
            core_hooks: s.core_selling_points || [],
            forbidden_directions: s.forbidden_directions || [],
            tone: s.tone || '', reader_promise: s.reader_promise || '',
          },
          updated_at: new Date().toISOString(),
        }).eq('id', novelId)
      }

      if (soulResult?.style) {
        const st = soulResult.style
        await supabase.from('novels').update({
          style: {
            'genre定位': '导入小说',
            narrative_voice: st.narrative_voice || '第三人称限制视角',
            pacing_profile: { type: '剧情驱动', 节奏: st.pacing || '中', 信息密度: '中', 悬念密度: '中' },
            chapter_stats: {
              avg_word_count: st.avg_chapter_length || stats.avgWordsPerChapter || 2500,
              word_count_range: [2000, 3000], avg_paragraphs: 25, avg_dialogue_ratio: 0.3,
            },
            vocabulary_rules: {
              forbidden_patterns: [], preferred_patterns: [],
              banned_ai_phrases: st.banned_phrases || ['不禁感叹', '心中暗道', '一股暖流'],
            },
            description_style: {
              action_density: '中', psychology_depth: st.description_density === '高' ? '深' : '中',
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
        hasSoul: !!soulResult?.soul, hasStyle: !!soulResult?.style,
      }
      console.log('Deep analysis complete:', analysisResult)
    }

    return NextResponse.json({
      ok: true,
      stats: { ...stats, chapterCount: savedCount },
      savedCount,
      savedSettings,
      totalChapters: allChapters.length,
      filesCount: files.length,
      analysis: analysisResult,
      hasApiKey: !!getCurrentConfig().hasApiKey,
      message: buildMessage(savedCount, savedSettings, stats.totalWords, files.length, analysisResult, getCurrentConfig().hasApiKey),
    })
  } catch (e: any) {
    console.error('Import error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    restoreConfig?.()
  }
}

function buildMessage(chapters: number, settings: number, words: number, files: number, analysis: any, hasApiKey?: boolean): string {
  let msg = `${files}个文件`
  if (settings > 0) msg += `，${settings}个设定文件已写入记忆层`
  if (chapters > 0) msg += `，${chapters}章（${words.toLocaleString()}字）已保存`
  if (!hasApiKey && !analysis) {
    msg += '（AI分析未执行：请在API设置中配置API Key，然后点击「AI分析填充记忆层」）'
  } else if (analysis) {
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
  let restoreConfig: (() => void) | undefined
  try {
    const novelId = req.nextUrl.searchParams.get('novelId')
    const action = req.nextUrl.searchParams.get('action')

    if (!novelId) {
      return NextResponse.json({ error: '缺少 novelId' }, { status: 400 })
    }

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
      const aiProvider = req.nextUrl.searchParams.get('aiProvider')
      const aiApiKey = req.nextUrl.searchParams.get('aiApiKey')
      const aiBaseUrl = req.nextUrl.searchParams.get('aiBaseUrl')
      const aiModel = req.nextUrl.searchParams.get('aiModel')
      const aiConfig = resolveAIConfig({ provider: aiProvider || undefined, apiKey: aiApiKey || undefined, baseUrl: aiBaseUrl || undefined, model: aiModel || undefined })
      const restoreConfig = applyAIConfigTemporarily(aiConfig)

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
      })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (e: any) {
    console.error('Import GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    restoreConfig?.()
  }
}

