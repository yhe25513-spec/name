import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { supabase } from '@/lib/novel/store'
import { getCurrentConfig, parseJsonFromLLM as parseJson, resolveAIConfig, applyAIConfigTemporarily } from '@/lib/novel/ai-config'
import { requireNovelOwnership } from '@/lib/novel/auth'

function getLLM() {
  const config = getCurrentConfig()
  return new ChatOpenAI({
    modelName: config.model,
    apiKey: process.env.AI_API_KEY || process.env[`${config.provider.toUpperCase()}_API_KEY`] || process.env.DEEPSEEK_API_KEY,
    configuration: { baseURL: config.baseUrl },
    temperature: 0.7,
    maxTokens: 4096,
  })
}

const STAGE_SYSTEM_PROMPTS: Record<number, string> = {
  1: `你是一个创意提炼专家。从用户的灵感输入中提炼出完整的故事种子。
输出JSON：
{
  "corePremise": "一句话核心创意",
  "genre": "题材类型",
  "targetReader": "目标读者画像",
  "hook": "故事钩子——吸引读者的第一个悬念",
  "theme": "核心主题",
  "tone": "叙事基调"
}`,

  2: `你是一个世界构建专家。根据创意前提构建完整的世界观。
输出JSON：
{
  "worldName": "",
  "era": "时代背景",
  "rules": [{"name": "", "description": "", "cost": ""}],
  "factions": [{"name": "", "description": "", "goals": ""}],
  "locations": [{"name": "", "type": "", "description": "", "significance": ""}],
  "conflicts": [{"between": "", "nature": "", "stakes": ""}],
  "technology": "科技水平",
  "socialStructure": "社会结构"
}`,

  3: `你是一个角色设计专家。设计主要角色的完整人设。
输出JSON：
{
  "characters": [
    {
      "name": "", "age": 0, "role": "protagonist|antagonist|supporting",
      "appearance": "外貌特征",
      "personality": {"core": "", "strengths": [], "weaknesses": [], "fears": []},
      "motivation": "核心动机",
      "backstory": "背景故事",
      "arc": {"start": "起始状态", "catalyst": "触发事件", "transformation": "转变", "end": "终局状态"},
      "relationships": [{"target": "", "type": "", "dynamic": ""}],
      "voice": {"tone": "", "speechPatterns": [], "vocabulary": "level"}
    }
  ]
}`,

  4: `你是一个剧情架构师。设计完整的故事主线和三幕结构。
输出JSON：
{
  "actStructure": [
    {"act": "第一幕：建置", "chapters": "1-5", "purpose": "", "keyEvents": [], "emotionalArc": ""},
    {"act": "第二幕：对抗", "chapters": "6-20", "purpose": "", "keyEvents": [], "emotionalArc": ""},
    {"act": "第三幕：解决", "chapters": "21-25", "purpose": "", "keyEvents": [], "emotionalArc": ""}
  ],
  "turningPoints": [{"chapter": 0, "event": "", "impact": ""}],
  "subplots": [{"name": "", "thread": "", "resolution": ""}],
  "climax": {"chapter": 0, "description": "", "resolution": ""},
  "first30ChaptersPromise": "前三十章给读者的承诺"
}`,

  5: `你是一个章节规划师。为每一章设计详细大纲。
输出JSON：
{
  "chapters": [
    {
      "index": 0,
      "title": "",
      "pov": "视角角色",
      "setting": "场景地点",
      "summary": "200字以内章节摘要",
      "coreConflict": "本章核心冲突",
      "characterGoals": [{"character": "", "goal": "", "obstacle": ""}],
      "emotionalBeat": "本章情感基调",
      "hook": "章末钩子",
      "wordCount": 2500
    }
  ]
}`,

  6: `你是一个场景设计专家。为章节设计具体场景。
输出JSON：
{
  "scenes": [
    {
      "sceneIndex": 0,
      "location": "",
      "timeOfDay": "",
      "characters": [],
      "openingImage": "开场画面",
      "sensoryDetails": {"visual": "", "auditory": "", "smell": "", "feel": ""},
      "dialogueNotes": "对话要点",
      "actionBeats": ["动作节拍"],
      "subtext": "潜台词",
      "transition": "场景转换方式"
    }
  ]
}`,

  7: `你是一个细节打磨专家。添加伏笔、感官细节、环境氛围。
输出JSON：
{
  "enhancedText": "增强后的完整文本",
  "addedDetails": [{"type": "foreshadowing|sensory|atmosphere|symbol", "location": "", "content": ""}],
  "foreshadowingPlanted": ["新埋设的伏笔"]
}`,

  8: `你是一个情感渲染专家。增强文本的情感共鸣。
输出JSON：
{
  "emotionallyEnhancedText": "增强后的完整文本",
  "emotionalBeats": [{"location": "", "emotion": "", "technique": ""}],
  "readerEmpathyCheck": "读者代入感评估"
}`,

  9: `你是一个小说质检专家。检查逻辑、节奏、AI痕迹。
输出JSON：
{
  "qualityScore": 0,
  "logicIssues": [{"issue": "", "location": "", "suggestion": ""}],
  "pacingAnalysis": {"tooFast": [], "tooSlow": [], "optimal": []},
  "aiPatternDetected": [{"pattern": "", "location": "", "fix": ""}],
  "styleConsistency": 0,
  "finalApprovedText": "通过质检的最终文本",
  "revisionNotes": ""
}`,
}

// 根据阶段保存结果到数据库
async function saveStageResult(novelId: string, stage: number, result: any) {
  const safeInsert = async (table: string, data: any) => {
    try {
      await supabase.from(table).insert(data)
    } catch {}
  }

  switch (stage) {
    case 2: // 世界搭建 → 保存到 worlds 表
      if (result.rules) {
        for (const rule of result.rules) {
          await safeInsert('worlds', {
            id: `world_nine_${crypto.randomUUID().slice(0, 8)}`,
            novel_id: novelId,
            name: rule.name,
            title: rule.name,
            category: 'rule',
            content: rule.description + (rule.cost ? ` (代价: ${rule.cost})` : ''),
            importance: 7,
          })
        }
      }
      if (result.factions) {
        for (const f of result.factions) {
          await safeInsert('worlds', {
            id: `world_nine_${crypto.randomUUID().slice(0, 8)}`,
            novel_id: novelId,
            name: f.name,
            title: f.name,
            category: 'faction',
            content: f.description + (f.goals ? ` (目标: ${f.goals})` : ''),
            importance: 7,
          })
        }
      }
      if (result.locations) {
        for (const loc of result.locations) {
          await safeInsert('worlds', {
            id: `world_nine_${crypto.randomUUID().slice(0, 8)}`,
            novel_id: novelId,
            name: loc.name,
            title: loc.name,
            category: 'location',
            content: loc.description,
            importance: 6,
          })
        }
      }
      break

    case 3: // 角色塑造 → 保存到 characters 表
      if (result.characters) {
        for (const char of result.characters) {
          await safeInsert('characters', {
            id: `char_nine_${crypto.randomUUID().slice(0, 8)}`,
            novel_id: novelId,
            name: char.name,
            identity: char.role || '',
            age: String(char.age || ''),
            personality: char.personality || {},
            beliefs: char.motivation || '',
            weaknesses: char.personality?.weaknesses?.join('、') || '',
            appearance: char.appearance || '',
            realm: '',
            status: 'active',
            first_appearance: 1,
          })
        }
      }
      break

    case 4: // 主线设计 → 保存伏笔
      if (result.foreshadowing) {
        for (const fs of result.foreshadowing) {
          await safeInsert('foreshadows', {
            id: `fs_nine_${crypto.randomUUID().slice(0, 8)}`,
            novel_id: novelId,
            content: fs.planted,
            chapter_planted: 1,
            importance: '主线',
            status: '未回收',
            expected_reveal_range: [fs.payoffChapter || 10, (fs.payoffChapter || 10) + 5],
          })
        }
      }
      break

    case 5: // 章节大纲 → 保存到 chapters 表的 title
      if (result.chapters) {
        for (const ch of result.chapters) {
          await supabase.from('chapters').upsert({
            novel_id: novelId,
            chapter_num: ch.index + 1,
            title: ch.title,
            content: '',
            word_count: 0,
            extraction: { outline: ch },
          }, { onConflict: 'novel_id,chapter_num' })
        }
      }
      break
  }
}

export async function POST(req: NextRequest) {
  let restoreConfig: (() => void) | undefined
  try {
    const { stage, input, previousResults, aiSettings } = await req.json()

    if (!stage || !input) {
      return NextResponse.json({ error: '缺少 stage 或 input' }, { status: 400 })
    }

    // 鉴权：验证小说所有权
    const novelId = req.nextUrl.searchParams.get('novelId') || ''
    if (novelId) {
      const { error: authError } = await requireNovelOwnership(req, novelId)
      if (authError) return authError
    }

    // 安全解析 AI 配置（临时应用，请求结束后自动恢复）
    const aiConfig = resolveAIConfig(aiSettings)
    const restoreConfig = applyAIConfigTemporarily(aiConfig)

    const systemPrompt = STAGE_SYSTEM_PROMPTS[stage]
    if (!systemPrompt) {
      return NextResponse.json({ error: `未知阶段: ${stage}` }, { status: 400 })
    }

    // 构建上下文
    let context = input
    if (previousResults && Object.keys(previousResults).length > 0) {
      const prevContext = Object.entries(previousResults)
        .filter(([k]) => Number(k) < stage)
        .map(([k, v]) => `第${k}段结果：\n${typeof v === 'string' ? v : JSON.stringify(v, null, 2)}`)
        .join('\n\n')
      context = `前文结果：\n${prevContext}\n\n当前输入：\n${input}`
    }

    const llm = getLLM()
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(context),
    ])

    const result = parseJson(response.content as string)

    // 根据阶段保存结果到数据库
    if (novelId) {
      try {
        await saveStageResult(novelId, stage, result)
      } catch (e) {
        // 保存失败不阻断流程
        console.error('Stage result save failed:', e)
      }
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    restoreConfig?.()
  }
}
