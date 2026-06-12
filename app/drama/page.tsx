import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DramaStudio } from '@/components/drama/DramaStudio'

export default async function DramaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <DramaStudio userId={user.id} />
}
