// ALERTS & DAILY SCAN – FR-07, FR-08, NFR-04.
// Shows the result of the daily expiry scan (run by Vercel Cron every morning) and its history.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Table, Td } from "@/components/ui/Table";
import RunScanButton from "@/components/RunScanButton";
import ThreadReportCard from "@/components/ThreadReportCard";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { smtpConfigured } from "@/lib/email";
import { formatDate, formatPKR } from "@/lib/format";
import type { ScanRun } from "@/lib/types";

export const dynamic = "force-dynamic";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function AlertsPage() {
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  const { data, error } = await supabase.from("scan_runs").select("*").order("started_at", { ascending: false }).limit(30);
  const runs = (data ?? []) as ScanRun[];
  const latest = runs[0];
  const lastSuccess = runs.find((r) => r.status === "success");
  const summary = lastSuccess?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Daily Scan"
        subtitle="Every morning at 8:00 (Pakistan time) the system scans all stock and emails the owner a summary."
      />
      {error && <Alert kind="error">Could not load the scan history: {error.message}</Alert>}

      {latest?.status === "failed" && (
        <Alert kind="error">
          The last scan ({when(latest.started_at)}) failed: {latest.error}. The next successful scan will also cover the missed day(s).
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Latest successful scan">
          {!lastSuccess || !summary ? (
            <EmptyState
              title="No scan has run yet"
              message={role === "admin" ? "Press “Run scan now” to run the first one." : "Ask the Admin to run the first scan."}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-muted">
                {when(lastSuccess.started_at)} · {lastSuccess.trigger === "cron" ? "automatic (Vercel Cron)" : "started by the Admin"}
                {summary.missedDays > 0 && <> · also covered {summary.missedDays} missed day(s)</>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge color="red">Expired: {summary.counts.expired}</Badge>
                <Badge color="orange">≤ 30 days: {summary.counts.within30}</Badge>
                <Badge color="yellow">≤ 60 days: {summary.counts.within60}</Badge>
                <Badge color="teal">≤ 90 days: {summary.counts.within90}</Badge>
              </div>
              <ul className="list-inside list-disc text-muted">
                <li>Newly expired since the previous scan: {summary.newlyExpired}</li>
                <li>Supplier return deadlines (next 7 days): {summary.returnAlerts}</li>
                <li>Medicines below minimum stock: {summary.lowStock}</li>
                <li>
                  Batches that won&apos;t sell in time: {summary.atRiskBatches} ({formatPKR(summary.valueAtRisk)})
                </li>
                <li>Email: {lastSuccess.email_status ?? "—"}</li>
              </ul>
            </div>
          )}
        </Card>

        <Card title="Run the scan">
          <div className="space-y-3 text-sm">
            {role === "admin" ? <RunScanButton /> : <p className="text-muted">Only the Admin can start a scan by hand.</p>}
            <ul className="list-inside list-disc text-xs text-muted">
              <li>Email alerts: {smtpConfigured() ? "set up ✓" : "not set up – add the SMTP settings to send emails (the scan still works)"}</li>
              <li>Daily automatic scan: {process.env.CRON_SECRET ? "set up ✓ (runs on Vercel)" : "add CRON_SECRET on Vercel to switch it on"}</li>
            </ul>
          </div>
        </Card>
      </div>

      {summary && (
        <Card title="How the last scan used multithreading" action={<Badge color="teal">{summary.mode === "threads" ? "worker threads" : "main thread"}</Badge>}>
          <ThreadReportCard
            mode={summary.mode}
            totalMs={summary.totalMs}
            threads={summary.threads}
            poolSize={new Set(summary.threads.map((t) => t.threadId)).size}
          />
        </Card>
      )}

      <Card title="Scan history (last 30 runs)">
        {runs.length === 0 ? (
          <p className="text-sm text-muted">No runs yet.</p>
        ) : (
          <Table headers={["Started", "Type", "Status", "Covered from", "Expired", "≤ 30 days", "Returns", "Low stock", "Email / error"]}>
            {runs.map((r) => (
              <tr key={r.id} className={r.status === "failed" ? "bg-red-50/50" : ""}>
                <Td>{when(r.started_at)}</Td>
                <Td>{r.trigger === "cron" ? "Automatic" : "Manual"}</Td>
                <Td>{r.status === "success" ? <Badge color="green">Success</Badge> : <Badge color="red">Failed</Badge>}</Td>
                <Td>{r.covered_from ? formatDate(r.covered_from) : "—"}</Td>
                <Td>{r.summary?.counts.expired ?? "—"}</Td>
                <Td>{r.summary?.counts.within30 ?? "—"}</Td>
                <Td>{r.summary?.returnAlerts ?? "—"}</Td>
                <Td>{r.summary?.lowStock ?? "—"}</Td>
                <Td className="max-w-xs text-xs">{r.status === "failed" ? <span className="text-red-700">{r.error}</span> : r.email_status}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
