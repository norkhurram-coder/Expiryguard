// Supabase client for the BROWSER (used in "use client" components: forms, delete buttons, logout, sales).
//
// SINGLETON: the whole browser tab shares ONE Supabase connection. The first call creates it;
// every later call to createClient() returns the same object, so forms and the sales screen
// don't each open a new connection and keep separate copies of the login session.
// (The SERVER client in server.ts is NOT a singleton on purpose: on the server every request
// belongs to a different user, so it must get its own client with that user's cookies.)
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

class SupabaseBrowser {
  private static instance: SupabaseClient | null = null;

  private constructor() {} // nobody can call `new SupabaseBrowser()`

  static getInstance(): SupabaseClient {
    if (!SupabaseBrowser.instance) {
      SupabaseBrowser.instance = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return SupabaseBrowser.instance;
  }
}

/** Kept with the old name so every existing form keeps working. */
export function createClient(): SupabaseClient {
  return SupabaseBrowser.getInstance();
}
