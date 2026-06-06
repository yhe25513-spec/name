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

  // SSRF protection: validate URL
  try {
    const parsed = new URL(url)
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: '只支持 http/https 协议' }, { status: 400 })
    }
    // Block internal/private IPs
    const hostname = parsed.hostname
    const blocked = [
      'localhost', '127.0.0.1', '0.0.0.0', '::1',
      '169.254.169.254', // cloud metadata
      'metadata.google.internal',
    ]
    if (blocked.includes(hostname)) {
      return NextResponse.json({ error: '不允许访问内部地址' }, { status: 400 })
    }
    // Block private IP ranges
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number)
      if (a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 0) {
        return NextResponse.json({ error: '不允许访问内部地址' }, { status: 400 })
      }
    }
  } catch {
    return NextResponse.json({ error: '无效的 URL' }, { status: 400 })
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
