// RISK FORECAST – FR-09, FR-10, FR-11, FR-12.
// The forecast is calculated live, in parallel WORKER THREADS (lib/threads/pool.ts).
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Table, Td } from "@/components/ui/Table";
import WriteOffButton from "@/components/WriteOffButton";
import ThreadReportCard from "@/components/ThreadReportCard";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { loadAnalysisInput } from "@/lib/analysis-data";
import { runAnalysisInThreads } from "@/lib/threads/pool";
import { todayISO } from "@/lib/expiry";
import { formatDate, formatPKR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  const today = todayISO();
  let analysis;
  try {
    analysis = await runAnalysisInThreads(await loadAnalysisInput(supabase, today, today));
  } catch (error) {
    return <Alert kind="error">Could not calculate the forecast: {(error as Error).message}</Alert>;
  }

  const { forecast, expiry } = analysis;
  const atRisk = forecast.rows.filter((r) => r.unsold_at_expiry > 0);
  const shown = all ? forecast.rows : atRisk;
  const totalRisk = atRisk.reduce((s, r) => s + r.value_at_risk, 0);
  const toReturn = atRisk.filter((r) => r.action === "return");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry Risk Forecast"
        subtitle="Which stock will NOT sell before it expires, based on the last 60 days of sales."
      />

      <div className="rounded-2xl border border-teal-line bg-white p-5 text-sm">
        <p className="font-semibold text-teal-brand">How it works</p>
        <p className="mt-1">
          <b>Unsold at expiry</b> = stock left − (average daily sales × days left to expiry) &nbsp;·&nbsp; <b>Last return date</b> = expiry date −
          supplier&apos;s return window.
        </p>
        <p className="mt-1 text-muted">
          Example from the proposal: 120 tablets left, selling 2 a day, expiring in 45 days → 90 will sell, so <b>30 are at risk</b>. When a
          medicine has several batches, the later batch only starts selling after the earlier one is sold out (FEFO).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Batches at risk" value={String(atRisk.length)} style="border-coral/40 bg-coral-soft text-coral" />
        <Stat label="Value at risk" value={formatPKR(totalRisk)} style="border-red-200 bg-red-50 text-red-700" />
        <Stat label="Can still be returned" value={String(toReturn.length)} style="border-teal-line bg-teal-soft text-teal-brand" />
        <Stat label="Return deadlines ≤ 7 days" value={String(expiry.returnAlerts.length)} style="border-orange-200 bg-orange-50 text-orange-700" />
      </div>

      {expiry.returnAlerts.length > 0 && (
        <Alert kind="warning">
          <b>Return deadlines this week (FR-12):</b>{" "}
          {expiry.returnAlerts.map((r) => `${r.medicine_name} ${r.batch_no} – return to ${r.supplier_name} by ${formatDate(r.last_return_date)}`).join(" · ")}
        </Alert>
      )}

      <Card
        title={all ? "All in-date batches" : "Batches that won't sell in time"}
        action={
          <a href={all ? "/forecast" : "/forecast?all=1"} className="text-sm font-semibold text-teal-brand hover:underline">
            {all ? "Show only batches at risk" : "Show all batches"}
          </a>
        }
      >
        {shown.length === 0 ? (
          <EmptyState title="No stock is at risk 🎉" message="At the current sales speed, every batch sells before it expires." />
        ) : (
          <Table headers={["Medicine", "Batch", "Expiry", "Days left", "Stock", "Avg / day", "Will sell", "Unsold", "Value at risk", "Last return date", "Action"]}>
            {shown.map((r) => (
              <tr key={r.batch_id} className={r.unsold_at_expiry > 0 ? "bg-coral-soft/30" : ""}>
                <Td className="font-semibold">{r.medicine_name}</Td>
                <Td>{r.batch_no}</Td>
                <Td>{formatDate(r.expiry_date)}</Td>
                <Td>{r.days_left}</Td>
                <Td>{r.quantity}</Td>
                <Td>{r.avg_daily_sales}</Td>
                <Td>{r.expected_sales}</Td>
                <Td className={r.unsold_at_expiry > 0 ? "font-bold text-coral" : ""}>{r.unsold_at_expiry}</Td>
                <Td>{r.value_at_risk > 0 ? formatPKR(r.value_at_risk) : "—"}</Td>
                <Td>
                  {r.last_return_date ? (
                    r.last_return_date < today ? (
                      <span className="text-muted line-through">{formatDate(r.last_return_date)}</span>
                    ) : (
                      formatDate(r.last_return_date)
                    )
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  {r.action === "ok" && <Badge color="green">Will sell</Badge>}
                  {r.action === "discount" && <Badge color="orange">Discount / promote</Badge>}
                  {r.action === "return" && (
                    <div className="flex items-center gap-2">
                      <Badge color="teal">Return</Badge>
                      <WriteOffButton batchId={r.batch_id} label={`${r.medicine_name} ${r.batch_no}`} action="return" />
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Calculated with multithreading" action={<Badge color="teal">{analysis.mode === "threads" ? `${analysis.poolSize} threads` : "1 thread"}</Badge>}>
        <ThreadReportCard mode={analysis.mode} poolSize={analysis.poolSize} totalMs={analysis.totalMs} threads={analysis.threads} />
      </Card>
    </div>
  );
}

function Stat({ label, value, style }: { label: string; value: string; style: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${style}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-bold sm:text-3xl">{value}</p>
    </div>
  );
}
