import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

// Step 5: 用 Edge TTS 为分镜生成配音
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { projectId, sceneIds } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // 获取需要配音的分镜
  let query = adminSupabase
    .from('drama_scenes')
    .select('*')
    .eq('project_id', projectId)
    .not('dialogue', 'eq', '')

  if (sceneIds?.length) {
    query = query.in('id', sceneIds)
  }

  const { data: scenes, error } = await query.order('scene_number')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!scenes?.length) return NextResponse.json({ scenes: [], message: '没有需要配音的分镜' })

  // 获取项目的角色信息
  const { data: project } = await adminSupabase
    .from('drama_projects')
    .select('synopsis')
    .eq('id', projectId)
    .single()

  const results: any[] = []

  for (const scene of scenes) {
    try {
      // 根据角色选择声音
      const voiceId = getVoiceForCharacter(scene.character_name)

      // 用 Edge TTS 生成音频
      const audioBuffer = await generateTTS(scene.dialogue, voiceId)

      // 上传到 Supabase Storage
      const fileName = `drama/${projectId}/${scene.id}.mp3`
      const { error: uploadError } = await adminSupabase.storage
        .from('drama-audio')
        .upload(fileName, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        })

      if (uploadError) {
        // 如果 bucket 不存在则创建
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          await adminSupabase.storage.createBucket('drama-audio', { public: true })
          await adminSupabase.storage
            .from('drama-audio')
            .upload(fileName, audioBuffer, {
              contentType: 'audio/mpeg',
              upsert: true,
            })
        } else {
          throw uploadError
        }
      }

      const { data: urlData } = adminSupabase.storage
        .from('drama-audio')
        .getPublicUrl(fileName)

      await adminSupabase
        .from('drama_scenes')
        .update({ audio_url: urlData.publicUrl })
        .eq('id', scene.id)

      results.push({ sceneId: scene.id, audioUrl: urlData.publicUrl, status: 'done' })
    } catch (err: any) {
      console.error(`Audio generation failed for scene ${scene.id}:`, err)
      results.push({ sceneId: scene.id, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ results })
}

// 角色→声音映射
function getVoiceForCharacter(character: string): string {
  const voiceMap: Record<string, string> = {
    '旁白': 'zh-CN-YunyangNeural',
    ' narrator': 'zh-CN-YunyangNeural',
  }

  // 默认用不同的声音（根据角色名哈希选择）
  const voices = [
    'zh-CN-XiaoxiaoNeural',
    'zh-CN-YunxiNeural',
    'zh-CN-XiaoyiNeural',
    'zh-CN-YunjianNeural',
    'zh-CN-XiaochenNeural',
  ]

  if (voiceMap[character]) return voiceMap[character]

  let hash = 0
  for (let i = 0; i < character.length; i++) {
    hash = ((hash << 5) - hash + character.charCodeAt(i)) | 0
  }
  return voices[Math.abs(hash) % voices.length]
}

// 调用 edge-tts CLI 生成音频
async function generateTTS(text: string, voice: string): Promise<Buffer> {
  const tmpFile = join(tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)

  try {
    // edge-tts 是 Python 包，需要已安装
    await execAsync(`edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${tmpFile}"`, {
      timeout: 30000,
    })

    const buffer = await readFile(tmpFile)
    return buffer
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}
