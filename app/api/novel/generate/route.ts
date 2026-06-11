import { NextRequest } from 'next/server'
import { getCurrentConfig, getHeaders, buildMessages, getChatUrl, resolveAIConfig } from '@/lib/novel/ai-config'
import { requireNovelOwnership } from '@/lib/novel/auth'
import { supabase } from '@/lib/novel/store'

// 不同编辑模式的 system prompt
const MODE_PROMPTS: Record<string, { system: string; buildUser: (prompt: string, content?: string, extra?: string) => string }> = {
  // 默认写作
  write: {
    system: '你是一位专业的网络小说作家，擅长写长篇小说。请直接输出章节正文，不要输出任何元数据或标注。',
    buildUser: (prompt) => prompt,
  },
  // 单章重写：保留核心事件，重新组织文笔
  rewrite: {
    system: `你是一位资深网文编辑，擅长重写章节。
重写规则：
1. 保留原文的核心事件、对话要点、情节推进
2. 改善文笔：替换重复用词、优化句式节奏、增强画面感
3. 消除AI痕迹：去掉"缓缓""微微""不禁"等万能副词
4. 增强角色差异化：不同角色用不同说话方式
5. 章末保留钩子
直接输出重写后的完整章节正文。`,
    buildUser: (prompt, content) => `请重写以下章节（保留核心事件，改善文笔）：\n\n${content}`,
  },
  // 局部润色：用户选中一段文字，AI 润色
  polish: {
    system: `你是文字润色专家。用户会给你一段文字，请润色它。
规则：
1. 保持原意不变
2. 替换重复用词和AI化表达（"缓缓""微微""不禁""淡淡"）
3. 让句子更生动有力
4. 保持与上下文风格一致
5. 只输出润色后的文字，不要解释`,
    buildUser: (_, content) => `请润色以下文字：\n\n${content}`,
  },
  // 扩写：把简短的内容扩展成详细描写
  expand: {
    system: `你是网文扩写专家。用户会给你一段简短的文字，请将其扩展成丰富的描写。
规则：
1. 增加感官细节（视觉、听觉、触觉、嗅觉）
2. 加入角色的内心活动和微表情
3. 丰富环境氛围描写
4. 保持原文的核心信息不变
5. 扩展后约为原文的2-3倍长度
6. 直接输出扩写后的内容`,
    buildUser: (_, content) => `请扩写以下文字：\n\n${content}`,
  },
  // 缩写：把冗长的内容精简
  condense: {
    system: `你是网文精简专家。用户会给你一段冗长的文字，请精简它。
规则：
1. 保留核心信息和关键动作
2. 删除冗余描写和重复表达
3. 用更少的字表达同样的意思
4. 保持文笔质量，不要变成流水账
5. 直接输出精简后的内容`,
    buildUser: (_, content) => `请精简以下文字：\n\n${content}`,
  },
  // 续写：接着用户写的最后几句话继续写
  continue: {
    system: `你是一位专业的网络小说作家。用户会给你一段已写好的文字和写作要求，请接着最后一句继续写。
规则：
1. 紧接用户文字的最后几句，自然衔接
2. 保持文风一致
3. 按照写作要求推进
4. 写500-1000字
5. 直接输出续写内容，不要重复用户已写的内容`,
    buildUser: (prompt, content) => `写作要求：${prompt}\n\n已写好的内容：\n${content}\n\n请接着最后一句继续写：`,
  },
  // 风格迁移：按指定风格重写
  style: {
    system: `你是风格迁移专家。用户会给你一段文字和目标风格，请按目标风格重写。
规则：
1. 保留原文的核心事件和信息
2. 按目标风格彻底改写文笔
3. 改变叙事节奏、用词习惯、句式结构
4. 直接输出改写后的内容`,
    buildUser: (prompt, content) => `目标风格：${prompt}\n\n请按此风格重写以下内容：\n\n${content}`,
  },
}

export async function POST(req: NextRequest) {
  try {
    const { novelId, chapter, prompt, mode, selectedText, aiSettings } = await req.json()

    if (!prompt && !selectedText) {
      return new Response(JSON.stringify({ error: '缺少 prompt 或 selectedText' }), { status: 400 })
    }

    // 鉴权
    if (novelId) {
      const { error: authError } = await requireNovelOwnership(req, novelId)
      if (authError) return authError
    }

    // 安全解析 AI 配置（不写入 process.env）
    const aiConfig = resolveAIConfig(aiSettings)
    const config = getCurrentConfig(aiConfig)
    if (!config.hasApiKey) {
      return new Response(JSON.stringify({ error: `未配置 ${config.providerName} API Key` }), { status: 500 })
    }

    // 获取当前章节内容（用于重写/润色等模式）
    let currentContent = ''
    if (novelId && chapter && ['rewrite', 'style', 'continue'].includes(mode || 'write')) {
      const { data } = await supabase.from('chapters').select('content').eq('novel_id', novelId).eq('chapter_num', chapter).single()
      currentContent = data?.content || ''
    }

    // 根据模式构建 prompt
    const modeConfig = MODE_PROMPTS[mode || 'write'] || MODE_PROMPTS.write
    const userContent = mode === 'polish' || mode === 'expand' || mode === 'condense'
      ? modeConfig.buildUser(prompt, selectedText)
      : modeConfig.buildUser(prompt, currentContent, selectedText)

    const url = getChatUrl(aiConfig)
    const headers = getHeaders(aiConfig)
    const body = buildMessages(modeConfig.system, userContent, {
      temperature: mode === 'rewrite' ? 0.8 : mode === 'polish' ? 0.6 : 0.85,
      maxTokens: mode === 'polish' || mode === 'condense' ? 2048 : 8192,
      config: aiConfig,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `${config.providerName} API 错误: ${response.status}` }),
        { status: 500 }
      )
    }

    return new Response(response.body, {
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
