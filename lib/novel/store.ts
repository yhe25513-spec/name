import { createClient } from '@supabase/supabase-js'

// Server-side: single Supabase client instance using service role key
// All novel API routes are server-side, so service role is appropriate here
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
