import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  let url: string
  try {
    const body = await req.json()
    url = body.url
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!url) {
    return NextResponse.json({ error: '缺少视频地址' }, { status: 400 })
  }

  try {
    // 服务端请求视频，绕过 CORS
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TextAdventure/1.0',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `获取视频失败 (${response.status})` },
        { status: 502 }
      )
    }

    const contentType = response.headers.get('content-type') || 'video/mp4'
    const contentLength = response.headers.get('content-length')

    // 从原始 URL 中提取文件名，或生成默认名
    const urlPath = new URL(url).pathname
    const filename = urlPath.split('/').pop() || `video-${Date.now()}.mp4`

    const blob = await response.arrayBuffer()

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }
    headers.set('Cache-Control', 'public, max-age=86400')

    return new NextResponse(blob, {
      status: 200,
      headers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: `下载失败: ${msg}` }, { status: 500 })
  }
}
