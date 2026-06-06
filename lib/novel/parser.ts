// 小说文本解析器 - 支持导入已有小说续写

interface ParsedChapter {
  title: string
  content: string
  index: number
  wordCount: number
}

// 中文章节检测模式
const CHAPTER_PATTERNS = [
  /^#{0,3}\s*第[一二三四五六七八九十百千零\d]+章[\s：:—\-|｜]*.{0,30}$/gm,
  /^#{0,3}\s*第[一二三四五六七八九十百千零\d]+节[\s：:—\-|｜]*.{0,30}$/gm,
  /^#{0,3}\s*第[一二三四五六七八九十百千零\d]+回[\s：:—\-|｜]*.{0,30}$/gm,
  /^#{0,3}\s*第[一二三四五六七八九十百千零\d]+卷[\s：:—\-|｜]*.{0,30}$/gm,
  /^#{0,3}\s*Chapter\s+\d+[\s:—\-|｜]*.{0,30}$/gim,
  /^\d+\.\s+.{2,40}$/gm,
  /^[一二三四五六七八九十]+[、.．]\s*.{2,40}$/gm,
]

// 从文本中分割章节
export function splitChapters(text: string): ParsedChapter[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  const chapters: ParsedChapter[] = []
  let currentTitle = ''
  let currentStart = 0
  let currentIndex = 0
  let contentBuffer: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      contentBuffer.push('')
      continue
    }

    const isChapterHead = line.length < 50 && CHAPTER_PATTERNS.some(pattern => {
      pattern.lastIndex = 0
      return pattern.test(line)
    })

    if (isChapterHead) {
      // 保存上一章
      if (contentBuffer.length > 0 || currentTitle) {
        const content = contentBuffer.join('\n').trim()
        if (content.length > 50) { // 过滤太短的段落
          chapters.push({
            title: currentTitle || `第${currentIndex + 1}章`,
            content,
            index: currentIndex,
            wordCount: content.replace(/\s/g, '').length,
          })
          currentIndex++
        }
      }
      // 清理标题：去掉 # 前缀和多余空格
      currentTitle = line.replace(/^#+\s*/, '').trim()
      currentStart = i
      contentBuffer = []
    } else {
      contentBuffer.push(lines[i])
    }
  }

  // 保存最后一章
  if (contentBuffer.length > 0 || currentTitle) {
    const content = contentBuffer.join('\n').trim()
    if (content.length > 50) {
      chapters.push({
        title: currentTitle || `第${currentIndex + 1}章`,
        content,
        index: currentIndex,
        wordCount: content.replace(/\s/g, '').length,
      })
    }
  }

  return chapters
}

// 统计小说信息
export function getNovelStats(chapters: ParsedChapter[]) {
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0)
  const avgWordsPerChapter = chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0

  return {
    chapterCount: chapters.length,
    totalWords,
    avgWordsPerChapter,
    firstChapter: chapters[0]?.title || '',
    lastChapter: chapters[chapters.length - 1]?.title || '',
  }
}

// 提取角色名（简单启发式）
export function extractCharacterNames(text: string): string[] {
  const names = new Set<string>()

  // 匹配中文人名模式：2-4个汉字，后面跟着对话或动作
  const namePatterns = [
    /["「『"]([^"」』"]{1,6})["」』"]/g,  // 对话中提到的名字
    /([一-龥]{2,4})(?:说|道|笑|叹|怒|喝|问|答|点头|摇头|转身|走|来|去)/g,
  ]

  for (const pattern of namePatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]
      // 过滤常见非人名词汇
      if (!['这个', '那个', '什么', '怎么', '为什么', '哪里', '这里', '那里', '他们', '我们', '你们', '自己', '大家'].includes(name)) {
        names.add(name)
      }
    }
  }

  return Array.from(names).slice(0, 50) // 限制数量
}

// 提取世界观关键词
export function extractWorldKeywords(text: string): string[] {
  const keywords = new Set<string>()

  const patterns = [
    /(?:宗门|门派|家族|势力|帝国|王朝|种族|门派)(?:：|:)?\s*([一-龥]{2,8})/g,
    /(?:境界|修为|实力)(?:：|:)?\s*([一-龥]{2,10})/g,
    /(?:法宝|神兵|武器|灵器)(?:：|:)?\s*([一-龥]{2,8})/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      keywords.add(match[1])
    }
  }

  return Array.from(keywords).slice(0, 30)
}
