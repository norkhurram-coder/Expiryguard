// EXPIRY DASHBOARD (FR-07, FR-12, FR-13, FR-14, NFR-04) – live data from Supabase.
import Link from "next/link";
import { redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import { ButtonLink } from "@/components/ui/Button";
import NearExpiryTable from "@/components/NearExpiryTable";
import BackgroundScan from "@/components/BackgroundScan";
import WriteOffButton from "@/components/WriteOffButton";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/analysis-data";
import { canEdit } from "@/lib/constants";
import { addDays, daysUntil, getExpiryStatus, isExpired, lastReturnDate, needsReturnAlert, todayISO } from "@/lib/expiry";
import { formatDate } from "@/lib/format";
import type { BatchWithDetails, Medicine, ScanRun } from "@/lib/types";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const { supabase, role } = await getCurrentUser();

  // FR-16: Sales Staff work on the sales screen.
  if (role === "sales_staff") redirect(denied ? "/sales?denied=1" : "/sales");

  let allBatches: BatchWithDetails[], medicines: Medicine[];
  try {
    [allBatches, medicines] = await Promise.all([
      fetchAll<BatchWithDetails>((from, to) =>
        supabase
          .from("batches")
          .select("*, medicines(brand_name, strength, dosage_form), suppliers(name, return_window_days)")
          .order("expiry_date", { ascending: true })
          .order("id")
          .range(from, to)
      ),
      fetchAll<Medicine>((from, to) => supabase.from("medicines").select("*").order("brand_name").range(from, to)),
    ]);
  } catch (error) {
    return <Alert kind="error">Could not load the dashboard: {(error as Error).message}</Alert>;
  }
  const { data: lastRun } = await supabase.from("scan_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const latestScan = lastRun as ScanRun | null;

  const today = todayISO();
  // Sold-out or written-off batches (quantity 0) need no warnings.
  const batches = allBatches.filter((b) => b.quantity > 0);

  // Count batches in each alert band
  const counts = { expired: 0, within30: 0, within60: 0, within90: 0 };
  for (const b of batches) {
    const status = getExpiryStatus(b.expiry_date);
    if (status !== "safe") counts[status]++;
  }

  const nearExpiry = batches.filter((b) => {
    const s = getExpiryStatus(b.expiry_date);
    return s === "within30" || s === "within60" || s === "within90";
  });

  // FR-13: expired batches go to the quarantine list (they cannot be sold)
  const quarantine = batches.filter((b) => isExpired(b.expiry_date));

  // FR-12: supplier return deadline within the next 7 days
  const returnAlerts = batches.filter(
    (b) => !isExpired(b.expiry_date) && b.suppliers && needsReturnAlert(b.expiry_date, b.suppliers.return_window_days)
  );

  // FR-14: low stock = sellable (not expired) quantity is below the medicine's minimum level
  const lowStock = medicines
    .map((m) => {
      const inStock = batches
        .filter((b) => b.medicine_id === m.id && !isExpired(b.expiry_date))
        .reduce((sum, b) => sum + b.quantity, 0);
      return { ...m, inStock };
    })
    .filter((m) => m.inStock < m.min_stock_level);

  // NFR-04: warn when the daily scan failed or has not run since yesterday
  const scanProblem =
    latestScan?.status === "failed"
      ? `The last daily scan failed (${latestScan.error}). The next run will also cover the missed day(s).`
      : !latestScan
        ? "The daily expiry scan has not run yet."
        : latestScan.run_date < addDays(today, -1)
          ? `The daily expiry scan has not run since ${formatDate(latestScan.run_date)}.`
          : null;

  const statCards = [
    { label: "Expired", value: counts.expired, style: "border-red-200 bg-red-50 text-red-700" },
    { label: "Within 30 days", value: counts.within30, style: "border-orange-200 bg-orange-50 text-orange-700" },
    { label: "Within 60 days", value: counts.within60, style: "border-yellow-200 bg-yellow-50 text-yellow-800" },
    { label: "Within 90 days", value: counts.within90, style: "border-teal-line bg-teal-soft text-teal-brand" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Expiry Dashboard" subtitle={`Live stock status · ${formatDate(today)}`} />

      {denied && <Alert kind="warning">Your role does not have access to that page.</Alert>}
      {scanProblem && (
        <Alert kind={latestScan?.status === "failed" ? "error" : "warning"}>
          {scanProblem}{" "}
          <Link href="/alerts" className="font-semibold underline">
            Open Alerts & Daily Scan
          </Link>
        </Alert>
      )}

      {allBatches.length === 0 ? (
        <EmptyState
          title="No stock yet – add your first batch"
          message="Add suppliers and medicines, then record a purchase batch to see expiry alerts here."
          action={canEdit(role) ? <ButtonLink href="/batches/new">+ Add batch</ButtonLink> : undefined}
        />
      ) : (
        <>
          {/* Summary counts */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((c) => (
              <div key={c.label} className={`rounded-2xl border p-5 ${c.style}`}>
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="mt-2 text-4xl font-bold">{c.value}</p>
                <p className="text-xs opacity-80">batches</p>
              </div>
            ))}
          </div>

          {/* FR-12: return deadlines */}
          {returnAlerts.length > 0 && (
            <Card title="Supplier return deadlines this week" action={<Badge color="orange">Return soon</Badge>}>
              <Table headers={["Medicine", "Batch", "Supplier", "Qty", "Expiry", "Return by", "Action"]}>
                {returnAlerts.map((b) => {
                  const returnBy = lastReturnDate(b.expiry_date, b.suppliers!.return_window_days);
                  const left = daysUntil(returnBy);
                  return (
                    <tr key={b.id} className="bg-orange-50/40">
                      <Td className="font-semibold">{b.medicines?.brand_name}</Td>
                      <Td>{b.batch_no}</Td>
                      <Td>{b.suppliers?.name}</Td>
                      <Td>{b.quantity}</Td>
                      <Td>{formatDate(b.expiry_date)}</Td>
                      <Td className="font-semibold text-orange-700">
                        {formatDate(returnBy)} ({left === 0 ? "today" : `${left} day${left === 1 ? "" : "s"}`})
                      </Td>
                      <Td>
                        <WriteOffButton batchId={b.id} label={`${b.medicines?.brand_name} ${b.batch_no}`} action="return" />
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            </Card>
          )}

          {/* Near-expiry table with search */}
          <Card
            title="Near-expiry stock (next 90 days)"
            action={
              <Link href="/forecast" className="text-sm font-semibold text-teal-brand hover:underline">
                Which of these won&apos;t sell in time? →
              </Link>
            }
          >
            <NearExpiryTable batches={nearExpiry} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Quarantine list */}
            <Card title="Quarantine – expired batches" action={<Badge color="red">Do not sell</Badge>}>
              {quarantine.length === 0 ? (
                <EmptyState title="No expired stock 🎉" />
              ) : (
                <Table headers={["Medicine", "Batch", "Expired on", "Qty", "Supplier", ""]}>
                  {quarantine.map((b) => (
                    <tr key={b.id} className="bg-red-50/40">
                      <Td className="font-semibold">{b.medicines?.brand_name}</Td>
                      <Td>{b.batch_no}</Td>
                      <Td className="text-red-700">{formatDate(b.expiry_date)}</Td>
                      <Td>{b.quantity}</Td>
                      <Td>{b.suppliers?.name ?? "—"}</Td>
                      <Td>
                        <WriteOffButton batchId={b.id} label={`${b.medicines?.brand_name} ${b.batch_no}`} action="disposal" />
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            {/* Low stock list */}
            <Card title="Low stock" action={<Badge color="orange">Reorder</Badge>}>
              {lowStock.length === 0 ? (
                <EmptyState title="All medicines are above their minimum level" />
              ) : (
                <Table headers={["Medicine", "In stock", "Minimum", "Rack"]}>
                  {lowStock.map((m) => (
                    <tr key={m.id}>
                      <Td className="font-semibold">
                        {m.brand_name} <span className="font-normal text-muted">{m.strength}</span>
                      </Td>
                      <Td className={m.inStock === 0 ? "font-bold text-red-700" : "font-semibold text-coral"}>
                        {m.inStock === 0 ? "Out of stock" : m.inStock}
                      </Td>
                      <Td>{m.min_stock_level}</Td>
                      <Td>{m.rack_location ?? "—"}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>

          {/* Multithreading demo in the browser: two Web Workers scan the stock at the same time */}
          <Card title="Background scan in the browser (multithreading)" action={<Badge color="teal">2 Web Worker threads</Badge>}>
            <BackgroundScan batches={batches} medicines={medicines} />
          </Card>
        </>
      )}
    </div>
  );
}
