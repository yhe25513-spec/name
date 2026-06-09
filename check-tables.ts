import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const key = readFileSync('.env.local', 'utf-8').split('SUPABASE_SERVICE_ROLE_KEY=')[1]?.trim()
const supabase = createClient('https://gdlliyflahcaqiseuwel.supabase.co', key)

async function check() {
  const tables = ['novels', 'chapters', 'foreshadows', 'characters', 'worlds', 'mysteries', 'relationships', 'timelines', 'story_states', 'novel_souls', 'power_systems']
  for (const t of tables) {
    const { error } = await supabase.from(t).select('*').limit(1)
    console.log(t + ': ' + (error ? 'MISSING' : 'EXISTS'))
  }
}
check()
