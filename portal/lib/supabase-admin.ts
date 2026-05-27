import { createClient } from '@supabase/supabase-js'

// Uses service role key — bypasses RLS. Server-side only. Never expose to browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
