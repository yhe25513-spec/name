// AI 短剧创作工作室 - 类型定义

export interface DramaProject {
  id: string
  user_id: string
  title: string
  synopsis: string
  genre: string
  style: string
  status: 'draft' | 'generating' | 'editing' | 'composing' | 'done'
  created_at: string
  updated_at: string
}

export interface DramaScene {
  id: string
  project_id: string
  scene_number: number
  description: string       // 画面描述（中文）
  image_prompt: string      // 生图 prompt（英文）
  dialogue: string          // 台词文本
  character: string         // 说话角色
  character_description: string  // 角色外观描述（保持一致性）
  emotion: string           // 情感
  imageUrl?: string         // 生成的图片 URL
  videoUrl?: string         // 生成的视频 URL
  audioUrl?: string         // TTS 配音 URL
  subtitle: string          // 字幕文本
  duration: number          // 预期时长（秒）
  imageRequestId?: string   // 图片生成任务 ID
  videoRequestId?: string   // 视频生成任务 ID
  status: 'pending' | 'generating_image' | 'generating_video' | 'generating_audio' | 'done' | 'error'
  error?: string
  created_at: string
  updated_at: string
}

export interface DramaCharacter {
  name: string
  description: string       // 角色外观描述
  voiceId: string           // TTS 声音 ID
}

export interface ScriptOutput {
  title: string
  synopsis: string
  characters: DramaCharacter[]
  scenes: {
    description: string
    dialogue: string
    character: string
    emotion: string
    duration: number
  }[]
}
