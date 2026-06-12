import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Step 2: 将剧本保存为分镜列表，并为每个分镜生成英文生图 prompt
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId, script } = await req.json()
  if (!projectId || !script) return NextResponse.json({ error: '缺少参数' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // 更新项目信息
  await adminSupabase
    .from('drama_projects')
    .update({
      title: script.title || '未命名短剧',
      synopsis: script.synopsis || '',
      status: 'editing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  // 为每个分镜生成英文 prompt 并保存
  const scenes = script.scenes || []
  const characters = script.characters || []
  const characterMap = Object.fromEntries(characters.map((c: any) => [c.name, c]))

  const inserts = scenes.map((scene: any, index: number) => {
    const char = characterMap[scene.character] || {}
    // 构建英文生图 prompt
    const imagePrompt = buildImagePrompt(scene, char)

    return {
      project_id: projectId,
      scene_number: index + 1,
      description: scene.description,
      image_prompt: imagePrompt,
      dialogue: scene.dialogue,
      character_name: scene.character || '',
      character_description: char.description || '',
      emotion: scene.emotion || 'neutral',
      subtitle: scene.dialogue,
      duration: scene.duration || 5,
      status: 'pending',
    }
  })

  const { data, error } = await adminSupabase
    .from('drama_scenes')
    .insert(inserts)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ scenes: data })
}

function buildImagePrompt(scene: any, character: any): string {
  const charDesc = character.description || ''
  const emotion = scene.emotion || 'neutral'

  const emotionMap: Record<string, string> = {
    happy: 'smiling, cheerful expression',
    sad: 'sad, melancholy expression',
    angry: 'angry, fierce expression',
    surprised: 'surprised, shocked expression',
    neutral: 'calm, neutral expression',
  }

  // 角色一致性：每次都带上完整的角色外貌描述
  const charConsistency = charDesc
    ? `consistent character design: ${charDesc}`
    : ''

  // 环境一致性：从画面描述中提取环境关键词
  const envKeywords = extractEnvironment(scene.description)

  return `${charConsistency}, ${emotionMap[emotion] || emotionMap.neutral}, ${scene.description}, ${envKeywords}, same art style throughout, cinematic lighting, high quality, detailed, 4k, masterpiece`
}

// 从画面描述中提取环境关键词，保持场景一致
function extractEnvironment(description: string): string {
  const envKeywords: string[] = []

  // 地点
  if (/山|林|树|森林/.test(description)) envKeywords.push('forest setting')
  if (/城|镇|村|街/.test(description)) envKeywords.push('town setting')
  if (/殿|宫|庙/.test(description)) envKeywords.push('temple palace setting')
  if (/荒|野|沙漠/.test(description)) envKeywords.push('wilderness setting')
  if (/夜|月|暗/.test(description)) envKeywords.push('nighttime')
  if (/日|阳|晴/.test(description)) envKeywords.push('daytime')
  if (/雨|雪|风/.test(description)) envKeywords.push('dramatic weather')

  return envKeywords.join(', ')
}
