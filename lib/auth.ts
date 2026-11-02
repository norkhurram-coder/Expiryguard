// Helper for server pages: who is logged in, and what is their role?
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// cache() means the layout and the page share one lookup per request.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, age, phone, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as Profile | null;

  return {
    supabase,
    user,
    profile,
    role: profile?.role ?? "sales_staff",
  };
});

/** Send users who are not allowed on a page back to the dashboard. */
export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) redirect("/?denied=1");
}
