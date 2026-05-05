import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 未登录访问游戏或管理页面 → 重定向到登录页
  if (!user && (pathname.startsWith('/game') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 已登录访问登录页 → 重定向到游戏页
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/game', request.url))
  }

  // 管理页面只需要登录（权限控制在页面和 API 层处理）
  if (user && pathname.startsWith('/admin')) {
    // 所有登录用户都可以访问 /admin，具体权限由页面和 API 控制
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/game/:path*', '/admin/:path*', '/login'],
}
