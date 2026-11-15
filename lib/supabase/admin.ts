// Supabase client with the SERVICE ROLE key – used ONLY by the daily Vercel Cron job,
// which runs with no logged-in user. This key skips Row Level Security, so it must
// stay on the server: it is NOT a NEXT_PUBLIC_ variable and is never sent to the browser.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (needed for the daily cron scan).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
