import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { streamGameChat } from '@/lib/deepseek'
import { streamOpenAIChat } from '@/lib/openai'
import { ConversationMessage, GameScenario, GameState } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body = await req.json()
  const {
    userInput,
    scenario,
    state,
    history,
    saveId,
    isSandbox = false,
  }: {
    userInput: string
    scenario: GameScenario
    state: GameState
    history: ConversationMessage[]
    saveId?: string
    isSandbox?: boolean
  } = body

  if (!userInput?.trim() || !scenario || !state) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
  }

  // 使用 admin client 读取 ai_configs（RLS 保护 API key，普通用户不可见）
  const adminSupabase = await createAdminClient()

  // 获取 AI 配置 - 优先使用场景的专属配置
  let aiConfig: {
    provider: string
    model: string
    api_key: string
    api_base_url?: string
    temperature: number
    max_tokens: number
  } | undefined

  if (scenario.ai_config_id) {
    // 使用场景绑定的 AI 配置
    const { data: customConfig } = await adminSupabase
      .from('ai_configs')
      .select('*')
      .eq('id', scenario.ai_config_id)
      .single()

    if (customConfig) {
      aiConfig = {
        provider: customConfig.provider,
        model: customConfig.model,
        api_key: customConfig.api_key,
        api_base_url: customConfig.api_base_url,
        temperature: customConfig.temperature,
        max_tokens: customConfig.max_tokens,
      }
    }
  }

  // 如果没有场景配置或获取失败，使用默认配置
  if (!aiConfig) {
    const { data: defaultConfig } = await adminSupabase
      .from('ai_configs')
      .select('*')
      .eq('is_default', true)
      .maybeSingle()

    if (defaultConfig) {
      aiConfig = {
        provider: defaultConfig.provider,
        model: defaultConfig.model,
        api_key: defaultConfig.api_key,
        api_base_url: defaultConfig.api_base_url,
        temperature: defaultConfig.temperature,
        max_tokens: defaultConfig.max_tokens,
      }
    }
  }

  // 仍无配置，尝试任意一个 ai_config
  if (!aiConfig) {
    const { data: anyConfig } = await adminSupabase
      .from('ai_configs')
      .select('*')
      .limit(1)
      .maybeSingle()
    if (anyConfig) {
      aiConfig = {
        provider: anyConfig.provider,
        model: anyConfig.model,
        api_key: anyConfig.api_key,
        api_base_url: anyConfig.api_base_url,
        temperature: anyConfig.temperature,
        max_tokens: anyConfig.max_tokens,
      }
    }
  }

  // 如果仍然没有配置，使用 admin_config 作为最后回退
  if (!aiConfig) {
    const { data: adminConfig } = await supabase.from('admin_config').select('*').maybeSingle()
    aiConfig = {
      provider: adminConfig?.provider || 'deepseek',
      model: adminConfig?.model || 'deepseek-chat',
      api_key: adminConfig?.api_key || adminConfig?.deepseek_api_key || process.env.DEEPSEEK_API_KEY || '',
      api_base_url: adminConfig?.api_base_url,
      temperature: adminConfig?.temperature || 0.8,
      max_tokens: adminConfig?.max_tokens || 1024,
    }
  }

  if (!aiConfig.api_key && aiConfig.provider !== 'ollama') {
    return new Response(JSON.stringify({ error: 'AI API key not configured' }), { status: 500 })
  }

  try {
    let stream: ReadableStream

    // 根据provider选择不同的AI服务
    if (aiConfig.provider === 'deepseek') {
      stream = await streamGameChat(
        userInput,
        scenario,
        state,
        history,
        aiConfig.api_key,
        aiConfig.model,
        aiConfig.temperature,
        aiConfig.max_tokens
      )
    } else if (['openai', 'anthropic', 'openrouter', 'ollama', 'siliconflow', 'custom'].includes(aiConfig.provider)) {
      // 确定 base URL
      let baseUrl = aiConfig.api_base_url
      if (!baseUrl) {
        if (aiConfig.provider === 'openrouter') {
          baseUrl = 'https://openrouter.ai/api/v1'
        } else if (aiConfig.provider === 'ollama') {
          baseUrl = 'http://localhost:11434'
        } else if (aiConfig.provider === 'siliconflow') {
          baseUrl = 'https://api.siliconflow.cn/v1'
        }
      }
      stream = await streamOpenAIChat(
        userInput,
        scenario,
        state,
        history,
        aiConfig.api_key,
        aiConfig.model,
        aiConfig.temperature,
        aiConfig.max_tokens,
        baseUrl,
        aiConfig.provider
      )
    } else {
      return new Response(JSON.stringify({ error: 'Unknown AI provider: ' + aiConfig.provider }), { status: 500 })
    }

    // 透传流式响应，并在末尾附加 saveId
    const encoder = new TextEncoder()
    let fullText = ''
    const textDecoder = new TextDecoder('utf-8')
    let lineBuffer = ''

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = textDecoder.decode(chunk, { stream: true })
        const lines = (lineBuffer + text).split('\n')
        // 最后一段可能不完整，缓存到下次
        lineBuffer = lines.pop() || ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) continue
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') {
              // 流结束后记录日志
              if (!isSandbox && saveId) {
                await supabase.from('conversation_logs').insert({
                  save_id: saveId,
                  user_id: user.id,
                  user_input: userInput,
                  ai_response: { raw: fullText },
                  tokens_used: 0,
                })
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              return
            }
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                fullText += content
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      },
    )

    stream.pipeTo(transformStream.writable).catch(() => { })

    return new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
