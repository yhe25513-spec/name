import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // 验证登录
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }

  // 10MB 限制
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
  }

  try {
    const adminSupabase = await createAdminClient()
    const buffer = Buffer.from(await file.arrayBuffer())
    // 用时间戳 + 用户 ID 保证文件名唯一
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileName = `${Date.now()}_${user.id.slice(0, 8)}_${safeName}`

    // 上传到 Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from('scenario-bg-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    // 如果 bucket 不存在则创建
    if (uploadError && (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found'))) {
      await adminSupabase.storage.createBucket('scenario-bg-images', {
        public: true,
      })
      // 重试上传
      const { error: retryError } = await adminSupabase.storage
        .from('scenario-bg-images')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        })
      if (retryError) throw retryError
    } else if (uploadError) {
      throw uploadError
    }

    const { data: { publicUrl } } = adminSupabase.storage
      .from('scenario-bg-images')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// 限制 body 大小（Next.js 默认 4MB，我们放宽）
export const runtime = 'nodejs'
