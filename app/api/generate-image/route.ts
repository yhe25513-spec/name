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

  // 从 profiles 表读取角色 + 每日计数（使用普通 client，已验证可用）
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, daily_image_count, daily_image_date')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) {
    const today = new Date().toISOString().slice(0, 10)
    const count = profile?.daily_image_date === today ? (profile?.daily_image_count || 0) : 0
    if (count >= 2) {
      return NextResponse.json(
        { error: '今日图片生成次数达到上限，明天再来吧' },
        { status: 429 }
      )
    }
  }

  const adminSupabase = await createAdminClient()

  // 获取 API key 和模型名
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

  // 先更新计数（保证后续请求读到正确的值），如果图片生成失败再回滚
  const today = new Date().toISOString().slice(0, 10)
  if (!isAdmin) {
    const newCount = profile?.daily_image_date === today ? (profile?.daily_image_count || 0) + 1 : 1
    await adminSupabase.from('profiles').update({
      daily_image_count: newCount,
      daily_image_date: today,
    }).eq('id', user.id)
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
      // API 失败 → 回滚计数
      if (!isAdmin) {
        const rollbackCount = profile?.daily_image_date === today ? (profile?.daily_image_count || 0) : 0
        await adminSupabase.from('profiles').update({
          daily_image_count: rollbackCount,
          daily_image_date: profile?.daily_image_date || '',
        }).eq('id', user.id)
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
      // 无 URL → 回滚计数
      if (!isAdmin) {
        const rollbackCount = profile?.daily_image_date === today ? (profile?.daily_image_count || 0) : 0
        await adminSupabase.from('profiles').update({
          daily_image_count: rollbackCount,
          daily_image_date: profile?.daily_image_date || '',
        }).eq('id', user.id)
      }
      return NextResponse.json(
        { error: 'AI 返回了空结果' },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: imageUrl })
  } catch (err) {
    // 异常 → 回滚计数
    if (!isAdmin) {
      const rollbackCount = profile?.daily_image_date === today ? (profile?.daily_image_count || 0) : 0
      await adminSupabase.from('profiles').update({
        daily_image_count: rollbackCount,
        daily_image_date: profile?.daily_image_date || '',
      }).eq('id', user.id)
    }
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `图片生成失败: ${msg}` }, { status: 500 })
  }
}
