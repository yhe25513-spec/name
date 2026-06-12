import { NextRequest, NextResponse } from 'next/server'

// Step 5: 配音功能（需要 Python + edge-tts，Vercel 不支持）
export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: '配音功能需要部署 TTS 服务，暂不可用',
    message: '请先完成图片和视频生成',
  }, { status: 501 })
}
