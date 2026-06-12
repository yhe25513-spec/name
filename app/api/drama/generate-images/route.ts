import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Step 3: 批量为分镜生成图片（并发控制，最多 3 张同时）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId, sceneIds } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // 获取需要生成图片的分镜
  let query = adminSupabase
    .from('drama_scenes')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending')

  if (sceneIds?.length) {
    query = query.in('id', sceneIds)
  }

  const { data: scenes, error } = await query.order('scene_number')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!scenes?.length) return NextResponse.json({ scenes: [], message: '没有待生成的分镜' })

  // 并发生成图片（最多 3 张同时）
  const MAX_CONCURRENT = 3
  const results: any[] = []

  for (let i = 0; i < scenes.length; i += MAX_CONCURRENT) {
    const batch = scenes.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map(scene => generateImageForScene(scene))
    )

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      } else {
        const scene = batch[j]
        await adminSupabase
          .from('drama_scenes')
          .update({ status: 'error', error: '图片生成失败' })
          .eq('id', scene.id)
        results.push({ sceneId: scene.id, status: 'error' })
      }
    }
  }

  return NextResponse.json({ results })
}

async function generateImageForScene(scene: any): Promise<any> {
  const apiKey = process.env.AGNES_API_KEY || ''
  if (!apiKey) throw new Error('未配置 AGNES_API_KEY')

  const modelName = process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.1-flash'

  // 调用 Agnes AI 生成图片（OpenAI 兼容格式）
  const response = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      prompt: scene.image_prompt,
      size: '1024x576',
      extra_body: {
        response_format: 'url',
      },
    }),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Agnes API error: ${response.status} - ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  const imageUrl = data.data?.[0]?.url || data.image_url || data.url

  // 更新数据库
  const adminSupabase = await createAdminClient()
  await adminSupabase
    .from('drama_scenes')
    .update({
      image_url: imageUrl || '',
      image_request_id: data.request_id || '',
      status: imageUrl ? 'pending' : 'generating_image',
    })
    .eq('id', scene.id)

  return { sceneId: scene.id, imageUrl, status: 'done' }
}
