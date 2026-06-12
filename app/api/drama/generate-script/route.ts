import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveAIConfig } from '@/lib/novel/ai-config'

// Step 1: 用 DeepSeek 根据主题生成完整剧本
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId, title, genre, style, synopsis } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  // 获取 DeepSeek API Key
  const apiKey = process.env.DEEPSEEK_API_KEY || ''
  if (!apiKey) return NextResponse.json({ error: '未配置 DeepSeek API Key' }, { status: 400 })

  const systemPrompt = `你是一个专业的 AI 短剧编剧。根据用户给出的主题，创作一个完整的短剧剧本。

要求：
1. 剧本时长控制在 1-3 分钟（约 5-15 个分镜）
2. 每个分镜包含：画面描述、角色台词、情感
3. 每个分镜的时长 3-10 秒
4. 角色数量 2-5 个，每个角色需要外观描述
5. 输出严格 JSON 格式

输出格式（严格 JSON，不要 markdown）：
{
  "title": "剧名",
  "synopsis": "剧情简介",
  "characters": [
    {
      "name": "角色名",
      "description": "外观描述（用于保持角色一致性）",
      "voiceId": "zh-CN-XiaoxiaoNeural"
    }
  ],
  "scenes": [
    {
      "description": "中文画面描述",
      "dialogue": "台词",
      "character": "说话角色名",
      "emotion": "neutral/happy/sad/angry/surprised",
      "duration": 5
    }
  ]
}

可用的声音 ID（Edge TTS）：
- zh-CN-XiaoxiaoNeural（女声，温柔）
- zh-CN-YunxiNeural（男声，年轻）
- zh-CN-YunyangNeural（男声，播音）
- zh-CN-XiaoyiNeural（女声，活泼）
- zh-CN-YunjianNeural（男声，成熟）`

  const userPrompt = `主题：${title}
类型：${genre}
风格：${style}
简介：${synopsis || '自由发挥'}
请生成完整剧本。`

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `DeepSeek API 错误: ${response.status}` }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 解析 JSON
    let script
    try {
      // 尝试从 markdown code block 中提取
      const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
      if (codeBlockMatch) {
        script = JSON.parse(codeBlockMatch[1].trim())
      } else {
        // 直接解析
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          script = JSON.parse(jsonMatch[0])
        } else {
          return NextResponse.json({ error: '无法解析剧本 JSON' }, { status: 500 })
        }
      }
    } catch {
      return NextResponse.json({ error: '剧本 JSON 解析失败', raw: content.slice(0, 500) }, { status: 500 })
    }

    return NextResponse.json({ script })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '生成失败' }, { status: 500 })
  }
}
