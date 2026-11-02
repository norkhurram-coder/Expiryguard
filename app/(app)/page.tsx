// EXPIRY DASHBOARD (FR-07, FR-13, FR-14) – live data from Supabase.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import Badge, { ExpiryBadge } from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import { ButtonLink } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/constants";
import { daysUntil, getExpiryStatus, isExpired, lastReturnDate, todayISO } from "@/lib/expiry";
import { formatDate } from "@/lib/format";
import type { BatchWithDetails, Medicine } from "@/lib/types";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const { supabase, role } = await getCurrentUser();

  const [batchResult, medicineResult] = await Promise.all([
    supabase
      .from("batches")
      .select("*, medicines(brand_name, strength, dosage_form), suppliers(name, return_window_days)")
      .order("expiry_date", { ascending: true }),
    supabase.from("medicines").select("*").order("brand_name"),
  ]);

  if (batchResult.error || medicineResult.error) {
    return <Alert kind="error">Could not load the dashboard: {(batchResult.error ?? medicineResult.error)?.message}</Alert>;
  }

  const batches = (batchResult.data ?? []) as BatchWithDetails[];
  const medicines = (medicineResult.data ?? []) as Medicine[];

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

  // FR-13: expired batches go to the quarantine list (they must not be sold)
  const quarantine = batches.filter((b) => isExpired(b.expiry_date));

  // FR-14: low stock = sellable (not expired) quantity is below the medicine's minimum level
  const lowStock = medicines
    .map((m) => {
      const inStock = batches
        .filter((b) => b.medicine_id === m.id && !isExpired(b.expiry_date))
        .reduce((sum, b) => sum + b.quantity, 0);
      return { ...m, inStock };
    })
    .filter((m) => m.inStock < m.min_stock_level);

  const statCards = [
    { label: "Expired", value: counts.expired, style: "border-red-200 bg-red-50 text-red-700" },
    { label: "Within 30 days", value: counts.within30, style: "border-orange-200 bg-orange-50 text-orange-700" },
    { label: "Within 60 days", value: counts.within60, style: "border-yellow-200 bg-yellow-50 text-yellow-800" },
    { label: "Within 90 days", value: counts.within90, style: "border-teal-line bg-teal-soft text-teal-brand" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Expiry Dashboard" subtitle={`Live stock status · ${formatDate(todayISO())}`} />

      {denied && <Alert kind="warning">Your role does not have access to that page.</Alert>}

      {batches.length === 0 ? (
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

          {/* Near-expiry table */}
          <Card title="Near-expiry stock (next 90 days)">
            {nearExpiry.length === 0 ? (
              <EmptyState title="Nothing expires in the next 90 days" />
            ) : (
              <Table headers={["Medicine", "Batch", "Expiry date", "Days left", "Qty", "Status", "Last return date"]}>
                {nearExpiry.map((b) => {
                  const returnWindow = b.suppliers?.return_window_days;
                  const returnBy = returnWindow !== undefined ? lastReturnDate(b.expiry_date, returnWindow) : null;
                  const returnPassed = returnBy !== null && daysUntil(returnBy) < 0;
                  return (
                    <tr key={b.id} className="hover:bg-teal-soft/40">
                      <Td className="font-semibold">
                        {b.medicines?.brand_name} <span className="font-normal text-muted">{b.medicines?.strength}</span>
                      </Td>
                      <Td>{b.batch_no}</Td>
                      <Td>{formatDate(b.expiry_date)}</Td>
                      <Td>{daysUntil(b.expiry_date)}</Td>
                      <Td>{b.quantity}</Td>
                      <Td>
                        <ExpiryBadge expiryDate={b.expiry_date} />
                      </Td>
                      <Td>
                        {returnBy === null ? (
                          <span className="text-muted">—</span>
                        ) : returnPassed ? (
                          <span className="text-muted line-through">{formatDate(returnBy)}</span>
                        ) : (
                          formatDate(returnBy)
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Quarantine list */}
            <Card title="Quarantine – expired batches" action={<Badge color="red">Do not sell</Badge>}>
              {quarantine.length === 0 ? (
                <EmptyState title="No expired stock 🎉" />
              ) : (
                <Table headers={["Medicine", "Batch", "Expired on", "Qty", "Supplier"]}>
                  {quarantine.map((b) => (
                    <tr key={b.id} className="bg-red-50/40">
                      <Td className="font-semibold">{b.medicines?.brand_name}</Td>
                      <Td>{b.batch_no}</Td>
                      <Td className="text-red-700">{formatDate(b.expiry_date)}</Td>
                      <Td>{b.quantity}</Td>
                      <Td>{b.suppliers?.name ?? "—"}</Td>
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
        </>
      )}
    </div>
  );
}
