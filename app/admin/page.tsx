import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AdminDashboard } from '@/components/admin/AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = await createAdminClient()
  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    console.error('[AdminPage] Failed to get profile:', error)
  }

  // 所有登录用户都可以进入管理/创作页面
  const isAdmin = profile?.role === 'admin'

  return <AdminDashboard username={profile?.username || user.email || '用户'} isAdmin={isAdmin} />
}
