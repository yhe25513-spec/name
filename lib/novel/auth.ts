// 共享鉴权工具 - 所有小说 API 路由使用
// 使用 cookie-based auth（与项目其他路由一致）
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabase } from './store'

// 从 cookie 中获取用户 ID（与 middleware 和游戏路由一致）
export async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}

// 验证用户是否拥有指定小说
export async function verifyNovelOwnership(novelId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('novels').select('user_id').eq('id', novelId).single()
  return data?.user_id === userId
}

// 要求用户登录，否则返回 401
export async function requireAuth(req: NextRequest): Promise<{ userId: string; error?: Response }> {
  const userId = await getUserId(req)
  if (!userId) {
    return { userId: '', error: new Response(JSON.stringify({ error: '请先登录' }), { status: 401 }) }
  }
  return { userId }
}

// 要求用户拥有指定小说，否则返回 403
export async function requireNovelOwnership(req: NextRequest, novelId: string): Promise<{ userId: string; error?: Response }> {
  const { userId, error } = await requireAuth(req)
  if (error) return { userId, error }

  const owned = await verifyNovelOwnership(novelId, userId)
  if (!owned) {
    return { userId, error: new Response(JSON.stringify({ error: '无权访问该小说' }), { status: 403 }) }
  }
  return { userId }
}
