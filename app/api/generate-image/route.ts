import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SILICONFLOW_API = 'https://api.siliconflow.cn/v1/images/generations'

export async function POST(req: NextRequest) {
  // 验证登录
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  let prompt: string
  let size = '1024x576' // 16:9 适合横图背景
  try {
    const body = await req.json()
    prompt = body.prompt
    if (body.size) size = body.size
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!prompt?.trim()) {
    return NextResponse.json({ error: '缺少提示词' }, { status: 400 })
  }

  // 检查管理员权限 / 每日限额（普通用户每天 2 张）
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'
  const adminSupabase = await createAdminClient()

  if (!isAdmin) {
    // 查询今日已生成数量（使用 admin client 绕过 RLS）
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const { data: logs, error: countError } = await adminSupabase
      .from('image_generation_logs')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', today)
      .lte('created_at', today + 'T23:59:59.999Z')

    if (!countError && logs && logs.length >= 2) {
      return NextResponse.json(
        { error: '今日图片生成次数达到上限，明天再来吧' },
        { status: 429 }
      )
    }
  }

  // 获取 API key 和模型名：优先环境变量，降级到 ai_configs
  let apiKey = process.env.SILICONFLOW_API_KEY || ''
  let modelName = ''

  if (apiKey) {
    modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen-Image'
  }

  if (!apiKey) {
    try {
      const { data: config } = await adminSupabase
        .from('ai_configs')
        .select('api_key, model')
        .eq('provider', 'siliconflow')
        .limit(1)
        .single()
      if (config?.api_key) {
        apiKey = config.api_key.trim()
        modelName = config.model || 'Qwen/Qwen-Image'
      }
    } catch {
      // 忽略查询错误
    }
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: '未配置 SiliconFlow API Key。请在 .env.local 中设置 SILICONFLOW_API_KEY，或在 AI 配置中创建 provider 为 siliconflow 的配置' },
      { status: 400 }
    )
  }

  // 先插入日志占位（此时图片尚未生成），确保计数准确
  let logId: string | null = null
  if (!isAdmin) {
    const { data: inserted } = await adminSupabase
      .from('image_generation_logs')
      .insert({ user_id: user.id, prompt })
      .select('id')
      .single()
    logId = inserted?.id || null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(SILICONFLOW_API, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        n: 1,
        size: size,
      }),
    })

    clearTimeout(timeout)

    if (!response.ok) {
      // API 失败 → 删除刚才插入的日志
      if (logId) {
        await adminSupabase.from('image_generation_logs').delete().eq('id', logId)
      }
      const errText = await response.text()
      return NextResponse.json(
        { error: `图片生成失败 (${response.status})`, detail: errText },
        { status: 502 }
      )
    }

    const data = await response.json()
    const imageUrl = data.data?.[0]?.url

    if (!imageUrl) {
      // 无 URL → 删除日志
      if (logId) {
        await adminSupabase.from('image_generation_logs').delete().eq('id', logId)
      }
      return NextResponse.json(
        { error: 'AI 返回了空结果' },
        { status: 502 }
      )
    }

    // 更新日志中的图片 URL
    if (logId) {
      await adminSupabase.from('image_generation_logs').update({ image_url: imageUrl }).eq('id', logId)
    }

    return NextResponse.json({ url: imageUrl })
  } catch (err) {
    // 异常 → 删除日志
    if (logId) {
      await adminSupabase.from('image_generation_logs').delete().eq('id', logId)
    }
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `图片生成失败: ${msg}` }, { status: 500 })
  }
}
