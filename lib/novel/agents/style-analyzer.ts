// 文风分析 Agent
// 量化分析文本的写作风格特征，不调用 LLM，纯本地计算

export interface StyleProfile {
  // 句长分布
  avgSentenceLength: number      // 平均句长（字）
  shortSentences: number        // 短句数（<10字）
  mediumSentences: number       // 中句数（10-30字）
  longSentences: number         // 长句数（>30字）
  shortRatio: number            // 短句占比

  // 对话分析
  dialogueRatio: number         // 对话占比（引号内容 / 总字数）
  dialogueLines: number         // 对话行数
  avgDialogueLength: number     // 平均对话长度

  // 段落密度
  avgParagraphLength: number    // 平均段落长度（字）
  paragraphs: number            // 总段落数

  // 词汇特征
  vocabularyRichness: number    // 词汇丰富度（unique/total ratio）
  topWords: Array<{ word: string; count: number }>  // 高频词 top 15
  bannedPatternCount: number    // AI化表达数量

  // 节奏
  singleLineParagraphs: number  // 单句段落数（节奏变化指标）
  singleLineRatio: number       // 单句段落占比

  // 综合评分
  overallScore: number          // 0-100 综合文风评分
}

// 停用词列表（不计入高频词）
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '它', '们', '那', '被', '从', '把', '让', '给', '对',
  '但', '而', '又', '却', '虽然', '因为', '所以', '如果', '只是', '不过', '还是',
  '已经', '可能', '应该', '这个', '那个', '什么', '怎么', '为什么', '哪里', '这里',
  '那里', '然后', '于是', '因此', '这时', '此时', '忽然', '突然', '随即', '随即',
])

// AI化表达（检测用）
const BANNED_PATTERNS = [
  /缓缓[地的]?[说问道笑看走来去站坐躺]/g,
  /淡淡[地的]?[说问道笑看]/g,
  /微微[地的]?[一]?[笑皱点头抬]/g,
  /不禁[感叹想起意识到]/g,
  /他[感到觉得感觉到]了?[一股一阵一丝]/g,
  /心中[暗想暗道一凛一惊一喜一沉]/g,
]

// ========== 分析函数 ==========

export function analyzeStyle(text: string): StyleProfile {
  // 分句（按句号、问号、感叹号分）
  const sentences = text
    .split(/[。！？!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  // 分段
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)

  // 对话提取（引号内的内容）
  const dialogues = text.match(/["「『""]([^"」』"]+)["」』"]/g) || []
  const dialogueText = dialogues.join('')
  const totalChars = text.replace(/\s/g, '').length

  // ===== 句长分析 =====
  const sentenceLengths = sentences.map(s => s.replace(/[^一-龥a-zA-Z0-9]/g, '').length)
  const avgSentenceLength = sentenceLengths.length > 0
    ? Math.round(sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length)
    : 0
  const shortSentences = sentenceLengths.filter(l => l < 10).length
  const mediumSentences = sentenceLengths.filter(l => l >= 10 && l <= 30).length
  const longSentences = sentenceLengths.filter(l => l > 30).length
  const shortRatio = sentences.length > 0 ? shortSentences / sentences.length : 0

  // ===== 对话分析 =====
  const dialogueChars = dialogueText.replace(/[^一-龥a-zA-Z0-9]/g, '').length
  const dialogueRatio = totalChars > 0 ? dialogueChars / totalChars : 0
  const avgDialogueLength = dialogues.length > 0
    ? Math.round(dialogueChars / dialogues.length)
    : 0

  // ===== 段落分析 =====
  const paragraphLengths = paragraphs.map(p => p.replace(/\s/g, '').length)
  const avgParagraphLength = paragraphLengths.length > 0
    ? Math.round(paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length)
    : 0
  const singleLineParagraphs = paragraphs.filter(p => {
    const lines = p.split('\n').filter(l => l.trim().length > 0)
    return lines.length === 1 && p.replace(/\s/g, '').length < 30
  }).length
  const singleLineRatio = paragraphs.length > 0 ? singleLineParagraphs / paragraphs.length : 0

  // ===== 词汇分析 =====
  // 简单分词：按标点和空格分割，取2-4字词
  const words: string[] = []
  const wordRegex = /[一-龥]{2,4}/g
  let wordMatch
  while ((wordMatch = wordRegex.exec(text)) !== null) {
    const word = wordMatch[0]
    if (!STOP_WORDS.has(word)) {
      words.push(word)
    }
  }

  const wordCounts = new Map<string, number>()
  for (const w of words) {
    wordCounts.set(w, (wordCounts.get(w) || 0) + 1)
  }
  const vocabularyRichness = words.length > 0 ? wordCounts.size / words.length : 0
  const topWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }))

  // ===== AI痕迹检测 =====
  let bannedPatternCount = 0
  for (const pattern of BANNED_PATTERNS) {
    pattern.lastIndex = 0
    while (pattern.exec(text)) {
      bannedPatternCount++
    }
  }

  // ===== 综合评分 =====
  let score = 100

  // 短句占比越高越好（网文节奏感）
  if (shortRatio < 0.3) score -= 10  // 短句太少，节奏拖沓
  if (shortRatio > 0.7) score -= 5   // 短句太多，碎片化

  // 对话比例（网文30-50%最佳）
  if (dialogueRatio < 0.2) score -= 10
  if (dialogueRatio > 0.6) score -= 5

  // 词汇丰富度（>0.4为佳）
  if (vocabularyRichness < 0.3) score -= 15  // 词汇贫乏
  if (vocabularyRichness > 0.7) score -= 5   // 可能过于花哨

  // AI痕迹扣分
  score -= bannedPatternCount * 5

  // 单句段落占比（10-25%为佳，节奏变化）
  if (singleLineRatio < 0.05) score -= 5   // 缺乏节奏变化
  if (singleLineRatio > 0.4) score -= 5    // 过于碎片

  // 平均句长（15-25字为佳）
  if (avgSentenceLength < 10) score -= 5
  if (avgSentenceLength > 40) score -= 10

  score = Math.max(0, Math.min(100, score))

  return {
    avgSentenceLength,
    shortSentences,
    mediumSentences,
    longSentences,
    shortRatio: Math.round(shortRatio * 100) / 100,
    dialogueRatio: Math.round(dialogueRatio * 100) / 100,
    dialogueLines: dialogues.length,
    avgDialogueLength,
    avgParagraphLength,
    paragraphs: paragraphs.length,
    vocabularyRichness: Math.round(vocabularyRichness * 100) / 100,
    topWords,
    bannedPatternCount,
    singleLineParagraphs,
    singleLineRatio: Math.round(singleLineRatio * 100) / 100,
    overallScore: score,
  }
}

// ========== 格式化报告 ==========

export function formatStyleReport(profile: StyleProfile): string {
  const lines: string[] = []

  lines.push(`📊 文风分析报告（综合评分: ${profile.overallScore}/100）`)
  lines.push('')

  // 句长
  lines.push(`📝 句长分布:`)
  lines.push(`   平均 ${profile.avgSentenceLength} 字/句`)
  lines.push(`   短句(${profile.shortSentences}) : 中句(${profile.mediumSentences}) : 长句(${profile.longSentences})`)
  lines.push(`   短句占比 ${(profile.shortRatio * 100).toFixed(0)}% ${profile.shortRatio >= 0.3 && profile.shortRatio <= 0.6 ? '✅' : '⚠️'}`)
  lines.push('')

  // 对话
  lines.push(`💬 对话分析:`)
  lines.push(`   对话占比 ${(profile.dialogueRatio * 100).toFixed(0)}% ${profile.dialogueRatio >= 0.25 && profile.dialogueRatio <= 0.5 ? '✅' : '⚠️'}`)
  lines.push(`   平均对话长度 ${profile.avgDialogueLength} 字`)
  lines.push('')

  // 段落
  lines.push(`📄 段落密度:`)
  lines.push(`   平均 ${profile.avgParagraphLength} 字/段，共 ${profile.paragraphs} 段`)
  lines.push(`   单句段落 ${(profile.singleLineRatio * 100).toFixed(0)}% ${profile.singleLineRatio >= 0.1 && profile.singleLineRatio <= 0.3 ? '✅ 节奏变化好' : '⚠️'}`)
  lines.push('')

  // 词汇
  lines.push(`📚 词汇特征:`)
  lines.push(`   词汇丰富度 ${profile.vocabularyRichness} ${profile.vocabularyRichness >= 0.4 ? '✅' : '⚠️ 词汇偏贫乏'}`)
  if (profile.topWords.length > 0) {
    lines.push(`   高频词: ${profile.topWords.slice(0, 8).map(w => `${w.word}(${w.count})`).join('、')}`)
  }
  lines.push('')

  // AI痕迹
  if (profile.bannedPatternCount > 0) {
    lines.push(`🤖 AI痕迹: ${profile.bannedPatternCount} 处 ${profile.bannedPatternCount <= 2 ? '✅' : '⚠️'}`)
  } else {
    lines.push(`🤖 AI痕迹: 0 处 ✅`)
  }

  return lines.join('\n')
}

// ========== 将分析结果保存到 novels.style ==========

export function profileToStyleConfig(profile: StyleProfile, genre: string): any {
  return {
    'genre定位': genre || '未分类',
    narrative_voice: profile.dialogueRatio > 0.35 ? '第三人称限制视角（对话驱动）' : '第三人称限制视角',
    pacing_profile: {
      type: profile.shortRatio > 0.4 ? '快节奏' : profile.shortRatio < 0.25 ? '慢热' : '剧情驱动',
      节奏: profile.shortRatio > 0.4 ? '快' : profile.shortRatio < 0.25 ? '慢' : '中',
      信息密度: profile.avgParagraphLength > 100 ? '高' : profile.avgParagraphLength < 50 ? '低' : '中',
      悬念密度: '中',
    },
    chapter_stats: {
      avg_word_count: profile.avgParagraphLength * profile.paragraphs || 2500,
      word_count_range: [2000, 3000],
      avg_paragraphs: profile.paragraphs,
      avg_dialogue_ratio: profile.dialogueRatio,
    },
    vocabulary_rules: {
      forbidden_patterns: [],
      preferred_patterns: profile.topWords.slice(0, 5).map(w => w.word),
      banned_ai_phrases: ['不禁感叹', '心中暗道', '一股暖流', '缓缓说道', '淡淡一笑'],
    },
    description_style: {
      action_density: profile.shortRatio > 0.4 ? '高' : '中',
      psychology_depth: profile.avgSentenceLength > 25 ? '深' : '中',
      environment_detail: profile.avgParagraphLength > 80 ? '详' : '略',
      dialogue_style: profile.dialogueRatio > 0.4 ? '简洁' : '自然',
    },
    deviation_thresholds: {
      word_count_drift: 0.3,
      dialogue_ratio_drift: 0.15,
      style_score_minimum: 70,
    },
    // 分析生成的特征
    analyzed_profile: {
      overallScore: profile.overallScore,
      shortRatio: profile.shortRatio,
      dialogueRatio: profile.dialogueRatio,
      vocabularyRichness: profile.vocabularyRichness,
      avgSentenceLength: profile.avgSentenceLength,
      bannedPatternCount: profile.bannedPatternCount,
    },
  }
}
