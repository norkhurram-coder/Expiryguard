// FR-07 / FR-08 / NFR-04: the daily expiry scan.
// Started every morning by Vercel Cron (app/api/cron/daily-scan) or by the Admin
// with "Run scan now" (app/(app)/alerts). Steps:
//   1. find the last successful run → which days this run must cover (missed days too)
//   2. load the data and analyse it in parallel WORKER THREADS
//   3. email the summary to the owner
//   4. save the result (or the failure) in scan_runs, shown on the dashboard
import type { SupabaseClient } from "@supabase/supabase-js";
import { coveredFromDate } from "@/lib/analysis";
import { loadAnalysisInput } from "@/lib/analysis-data";
import { buildDailyEmail, sendEmail } from "@/lib/email";
import { daysUntil, todayISO } from "@/lib/expiry";
import { runAnalysisInThreads } from "@/lib/threads/pool";
import type { ScanSummary } from "@/lib/types";

export type ScanOutcome =
  | { ok: true; runId: number | null; summary: ScanSummary; emailStatus: string }
  | { ok: false; error: string };

async function recipients(supabase: SupabaseClient): Promise<string[]> {
  const fromEnv = (process.env.ALERT_EMAIL_TO ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const { data } = await supabase.from("profiles").select("email").eq("role", "admin");
  return ((data ?? []) as { email: string | null }[]).map((p) => p.email).filter((e): e is string => !!e);
}

export async function runDailyScan(supabase: SupabaseClient, trigger: "cron" | "manual"): Promise<ScanOutcome> {
  const startedAt = new Date().toISOString();
  const today = todayISO();

  // 1. NFR-04: if yesterday's run failed or didn't happen, cover those days as well.
  const { data: last } = await supabase
    .from("scan_runs")
    .select("run_date")
    .eq("status", "success")
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const coveredFrom = coveredFromDate((last as { run_date: string } | null)?.run_date ?? null, today);
  const missedDays = daysUntil(today, coveredFrom);

  try {
    // 2. Load + analyse in worker threads
    const input = await loadAnalysisInput(supabase, today, coveredFrom);
    const analysis = await runAnalysisInThreads(input);

    const atRisk = analysis.forecast.rows.filter((r) => r.unsold_at_expiry > 0);
    const summary: ScanSummary = {
      counts: analysis.expiry.counts,
      newlyExpired: analysis.expiry.newlyExpired.length,
      returnAlerts: analysis.expiry.returnAlerts.length,
      lowStock: analysis.stock.lowStock.length,
      atRiskBatches: atRisk.length,
      valueAtRisk: Math.round(atRisk.reduce((sum, r) => sum + r.value_at_risk, 0) * 100) / 100,
      missedDays,
      threads: analysis.threads,
      mode: analysis.mode,
      totalMs: analysis.totalMs,
    };

    // 3. Email (a failed email does not fail the scan – it is recorded instead)
    let emailStatus: string;
    try {
      const mail = buildDailyEmail(analysis, today, missedDays, process.env.APP_URL);
      emailStatus = await sendEmail(await recipients(supabase), mail.subject, mail.html, mail.text);
    } catch (error) {
      emailStatus = "failed – " + (error instanceof Error ? error.message : String(error));
    }

    // 4. Save the run
    const { data: run, error } = await supabase
      .from("scan_runs")
      .insert({
        run_date: today,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        trigger,
        status: "success",
        covered_from: coveredFrom,
        summary,
        email_status: emailStatus,
      })
      .select("id")
      .single();
    if (error) throw new Error("Could not save the scan result: " + error.message);

    return { ok: true, runId: (run as { id: number }).id, summary, emailStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Record the failure so the Admin sees it on the dashboard (NFR-04).
    await supabase.from("scan_runs").insert({
      run_date: today,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      trigger,
      status: "failed",
      covered_from: coveredFrom,
      error: message,
    });
    return { ok: false, error: message };
  }
}
