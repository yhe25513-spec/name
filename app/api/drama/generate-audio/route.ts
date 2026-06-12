import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

// Step 5: 用 Edge TTS 为分镜生成配音
// 注意：需要在有 Python + edge-tts 的服务器上运行，Vercel 不支持
export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: '配音功能需要部署 TTS 服务，暂不可用',
    message: '请先完成图片和视频生成',
  }, { status: 501 })
}
