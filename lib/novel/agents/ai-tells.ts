// AI 痕迹检测 Agent
// 扫描文本中的 AI 写作痕迹，返回具体问题和修改建议

export interface AiTell {
  pattern: string       // 匹配到的模式
  location: string      // 大概位置（第几段）
  severity: 'critical' | 'high' | 'medium'
  fix: string           // 修改建议
}

// ========== 正则检测规则 ==========

const DETECTION_RULES: Array<{
  name: string
  regex: RegExp
  severity: AiTell['severity']
  fix: string
}> = [
  // 万能副词
  { name: '缓缓', regex: /缓缓[地的]?[说问道笑看走来去站坐躺]/g, severity: 'high', fix: '删除"缓缓"，用具体动作替代（如"他放下杯子"而非"他缓缓放下杯子"）' },
  { name: '淡淡', regex: /淡淡[地的]?[说问道笑看]/g, severity: 'high', fix: '删除"淡淡"，改为具体神态（如"他瞥了一眼"而非"他淡淡地看了一眼"）' },
  { name: '微微', regex: /微微[地的]?[一]?[笑皱点头抬]/g, severity: 'high', fix: '删除"微微"，用更精确的动作' },
  { name: '轻轻', regex: /轻轻[地的]?[说问道叹放拍]/g, severity: 'medium', fix: '删除"轻轻"或替换为具体描写' },
  { name: '静静', regex: /静静[地的]?[等待坐站看]/g, severity: 'medium', fix: '删除"静静"，改为具体状态描写' },
  { name: '默默', regex: /默默[地的]?[想记住忍受]/g, severity: 'medium', fix: '删除"默默"，改为具体行动' },
  { name: '不禁', regex: /不禁[感叹想起意识到]/g, severity: 'high', fix: '删除"不禁"，改为直接描写（如"他笑了"而非"他不禁笑了"）' },

  // 情绪标签（他感到X）
  { name: '他感到', regex: /他[感到觉得感觉到]了?[一股一阵一丝]?(温暖|寒冷|愤怒|悲伤|快乐|失落|紧张|不安|恐惧|希望|绝望|无奈|尴尬|羞耻|骄傲|满足)/g, severity: 'critical', fix: '删除情绪标签，改为生理反应+微动作（如"指节捏得发白"而非"他感到愤怒"）' },
  { name: '心中', regex: /心中[暗想暗道一凛一惊一喜一沉]/g, severity: 'high', fix: '删除"心中X"，改为外部可见的反应' },

  // 段末总结
  { name: '终于明白', regex: /[他她][终于]?明白了|他终于理解了|由此可见|这让他|这使[他她]/g, severity: 'critical', fix: '删除段末总结句，信任读者理解力' },
  { name: '原来如此', regex: /原来如此|原来[他她]是|难怪/g, severity: 'medium', fix: '删除或改为角色的自然反应' },

  // 四段闭环（检测"于是/因此/所以"结尾的段落）
  { name: '四段闭环', regex: /于是[，,].*[。！]|因此[，,].*[。！]|所以[，,].*[。！].*\n\n/g, severity: 'high', fix: '删除"于是/因此/所以"总结句，让段落在动作或对话中结束' },

  // 全员同一反应
  { name: '瞳孔微缩', regex: /瞳孔[微]?缩|心中一凛|倒吸一口凉气|不禁[感叹]/g, severity: 'high', fix: '给不同角色设计专属微动作，避免全员同一反应' },
  { name: '倒吸凉气', regex: /倒吸[了]?(一口)?凉气/g, severity: 'medium', fix: '替换为该角色特有的震惊反应' },

  // 展示后解释
  { name: '展示后解释', regex: /[。！]["""]\s*[这那]是|[。！]["""]\s*意味著|[。！]["""]\s*表示/g, severity: 'medium', fix: '删除动作后的解释句，信任读者理解力' },

  // 信息均匀（连续3段以上相同句式）
  // 这个用简单启发式检测：连续以"他"开头的句子
  { name: '句式重复', regex: /(他[走来到去说看])\n.*\n.*\n.*\n.*\n(他[走来到去说看])/g, severity: 'medium', fix: '变换句式开头，避免连续以"他"起句' },
]

// ========== 检测函数 ==========

export function detectAiTells(text: string): AiTell[] {
  const tells: AiTell[] = []
  const paragraphs = text.split(/\n\n+/)

  for (const rule of DETECTION_RULES) {
    let match
    // 重置 lastIndex
    rule.regex.lastIndex = 0

    while ((match = rule.regex.exec(text)) !== null) {
      // 找到匹配在哪个段落
      const matchPos = match.index
      let charCount = 0
      let paragraphIndex = 0
      for (let i = 0; i < paragraphs.length; i++) {
        charCount += paragraphs[i].length + 2 // +2 for \n\n
        if (charCount >= matchPos) {
          paragraphIndex = i + 1
          break
        }
      }

      tells.push({
        pattern: match[0],
        location: `第${paragraphIndex}段`,
        severity: rule.severity,
        fix: rule.fix,
      })
    }
  }

  // 去重（同一模式在同一段只报一次）
  const seen = new Set<string>()
  return tells.filter(t => {
    const key = `${t.pattern}:${t.location}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ========== 统计函数 ==========

export function getAiTellScore(tells: AiTell[]): number {
  // 从100分开始扣分
  let score = 100
  for (const t of tells) {
    if (t.severity === 'critical') score -= 15
    else if (t.severity === 'high') score -= 8
    else score -= 3
  }
  return Math.max(0, score)
}

export function formatAiTellReport(tells: AiTell[]): string {
  if (tells.length === 0) return '✅ 未检测到AI写作痕迹'

  const critical = tells.filter(t => t.severity === 'critical')
  const high = tells.filter(t => t.severity === 'high')
  const medium = tells.filter(t => t.severity === 'medium')

  const parts: string[] = []
  if (critical.length) parts.push(`🔴 严重: ${critical.length}处`)
  if (high.length) parts.push(`🟡 较重: ${high.length}处`)
  if (medium.length) parts.push(`🟢 轻微: ${medium.length}处`)

  let report = `检测到 ${tells.length} 处AI痕迹（${parts.join('，')}）\n\n`

  // 按严重程度排列，每类最多显示5个
  for (const t of critical.slice(0, 5)) {
    report += `🔴 ${t.location} "${t.pattern}" → ${t.fix}\n`
  }
  for (const t of high.slice(0, 5)) {
    report += `🟡 ${t.location} "${t.pattern}" → ${t.fix}\n`
  }
  for (const t of medium.slice(0, 3)) {
    report += `🟢 ${t.location} "${t.pattern}" → ${t.fix}\n`
  }

  return report
}
