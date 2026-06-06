import { getNovelMeta } from './novels'
import { getForeshadows, checkOverdue } from './foreshadows'
import { getMysteries, getWritingConstraints } from './mysteries'
import { getRelationships } from './relationships'
import { readJSON, stylePath, characterCardPath } from './store'
import { promises as fs } from 'fs'
import path from 'path'

export async function generateWritingPrompt(novelId: string, chapter: number) {
  const meta = await getNovelMeta(novelId)
  const soul = meta.soul || {}
  const style = await readJSON<any>(stylePath(novelId)).catch(() => ({}))
  const constraints = await getWritingConstraints(novelId, chapter)
  const overdue = await checkOverdue(novelId, chapter)
  const rels = await getRelationships(novelId)

  // Load character cards
  const cardsDir = path.join(process.cwd(), 'data', 'novels', novelId, 'character_cards')
  let cards: any[] = []
  try {
    const files = await fs.readdir(cardsDir)
    for (const f of files) {
      if (f.endsWith('.json')) {
        cards.push(await readJSON(path.join(cardsDir, f)))
      }
    }
  } catch { /* no cards */ }

  const parts: string[] = []

  parts.push(`# 你是一个网文作家

你正在写一本叫《${meta.title}》的小说。

## 作品灵魂
- 核心卖点: ${(soul.core_hooks || []).join(', ')}
- 禁止方向: ${(soul.forbidden_directions || []).join(', ')}
- 调性: ${soul.tone || ''}
- 读者承诺: ${soul.reader_promise || ''}

## 风格要求
- 类型: ${style['genre定位'] || '未设置'}
- 叙事视角: ${style.narrative_voice || '第三人称'}
- 节奏: ${style.pacing_profile?.节奏 || '中'}
- 目标字数: ${style.chapter_stats?.avg_word_count || 2500}字
- 对话比例: ${((style.chapter_stats?.avg_dialogue_ratio || 0.3) * 100).toFixed(0)}%

## 禁止出现的表达
${(style.vocabulary_rules?.banned_ai_phrases || []).map((p: string) => '- ' + p).join('\n')}

## 对话风格
${style.description_style?.dialogue_style || '自然'}`)

  if (cards.length > 0) {
    parts.push('\n## 本章出场角色')
    for (const card of cards) {
      parts.push(`\n### ${card.name || '未知'}
- 性格: ${(card.core_traits || []).join(', ')}
- 核心信念: ${card.core_belief || ''}
- 说话语气: ${card.dialogue_profile?.tone || ''}
- 禁用表达: ${(card.dialogue_profile?.forbidden || []).join(', ')}`)
    }
  }

  const relEntries = Object.entries(rels.relationships || {})
  if (relEntries.length > 0) {
    parts.push('\n## 当前角色关系')
    for (const [key, rel] of relEntries) {
      const [from, to] = key.split('->')
      parts.push(`- ${from}→${to}: ${rel.type} (信任度: ${rel.trust_level > 0 ? '+' : ''}${rel.trust_level})`)
    }
  }

  if (constraints.mysteries.length > 0) {
    parts.push('\n## 悬念控制（重要！）')
    for (const m of constraints.mysteries) {
      parts.push(`\n### ${m.name} (当前揭露度: ${m.current_progress}%)`)
      parts.push(`- 状态: ${m.can_reveal ? '✅ 可以透露' : '❌ 不能透露'}`)
      parts.push(`- 本章最大揭露增量: ${m.max_delta}%`)
    }
  }

  if (overdue.length > 0) {
    parts.push('\n## 伏笔提醒')
    for (const f of overdue) {
      parts.push(`- ⚠️ ${f.id}: ${f.content} (埋设于第${f.chapter_planted}章)`)
    }
  }

  parts.push(`\n## 写作指令

请写第${chapter}章，要求：
1. 字数: ${style.chapter_stats?.avg_word_count || 2500}字左右
2. 遵循以上风格要求和禁止方向
3. 悬念揭露不超过${constraints.max_total_revelation}%
4. 回收到期伏笔（如有）
5. 章末必须有钩子
6. 禁止使用任何"禁止出现的表达"
7. 对话要简洁有力，有潜台词

请直接输出章节正文，不要输出任何元数据或标注。`)

  return parts.join('\n')
}
