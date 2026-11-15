"use server";

// "Run scan now" button (Admin only). Runs the same daily scan as the Vercel Cron job,
// but with the Admin's own login, so Row Level Security still applies.
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { runDailyScan } from "@/lib/daily-scan";

export async function runScanNow(): Promise<{ ok: boolean; message: string }> {
  const { supabase, role } = await getCurrentUser();
  if (role !== "admin") return { ok: false, message: "Only the Admin can start a scan." };

  const outcome = await runDailyScan(supabase, "manual");
  revalidatePath("/alerts");
  revalidatePath("/");
  if (!outcome.ok) return { ok: false, message: "Scan failed: " + outcome.error };
  const s = outcome.summary;
  return {
    ok: true,
    message:
      `Scan finished in ${s.totalMs} ms (${s.threads.length} tasks, ${s.mode === "threads" ? "worker threads" : "main thread"}) · ` +
      `${s.counts.expired} expired · ${s.returnAlerts} return deadline(s) · ${s.lowStock} low stock · email ${outcome.emailStatus}`,
  };
}
