// MONTHLY REPORT – FR-15: expired-stock loss, near-expiry stock value, top-selling medicines
// (+ sales and low stock). Choose a month at the top; "Print / PDF" gives a paper copy.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { Table, Td } from "@/components/ui/Table";
import PrintButton from "@/components/reports/PrintButton";
import { LossTrendChart, StockValueChart, TopSellersChart } from "@/components/reports/ReportCharts";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { fetchAll } from "@/lib/analysis-data";
import { checkStock } from "@/lib/analysis";
import { isExpired, todayISO } from "@/lib/expiry";
import { formatPKR } from "@/lib/format";
import { expiredLoss, lastMonths, monthLabel, monthRange, stockValueByBand, topSellers, type ReportMovement } from "@/lib/reports";

export const dynamic = "force-dynamic";

type BatchRow = { id: number; medicine_id: number; expiry_date: string; quantity: number; purchase_price: number };
type MedicineRow = { id: number; brand_name: string; strength: string; min_stock_level: number };
type ItemRow = { medicine_id: number; quantity: number; unit_price: number; sold_on: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth;
  const { start, end } = monthRange(month);
  const trendMonths = lastMonths(month, 6);

  let batches: BatchRow[], medicines: MedicineRow[], items: ItemRow[], movements: ReportMovement[];
  try {
    [batches, medicines, items, movements] = await Promise.all([
      fetchAll<BatchRow>((f, t) => supabase.from("batches").select("id, medicine_id, expiry_date, quantity, purchase_price").order("id").range(f, t)),
      fetchAll<MedicineRow>((f, t) => supabase.from("medicines").select("id, brand_name, strength, min_stock_level").order("id").range(f, t)),
      fetchAll<ItemRow>((f, t) =>
        supabase.from("sale_items").select("medicine_id, quantity, unit_price, sold_on").gte("sold_on", start).lte("sold_on", end).order("id").range(f, t)
      ),
      fetchAll<ReportMovement>((f, t) =>
        supabase
          .from("stock_movements")
          .select("batch_id, movement, quantity_change, unit_cost, expiry_date, created_at")
          .in("movement", ["disposal", "delete", "return"])
          .order("id")
          .range(f, t)
      ),
    ]);
  } catch (error) {
    return <Alert kind="error">Could not load the report: {(error as Error).message}</Alert>;
  }

  const nameOf = new Map(medicines.map((m) => [m.id, `${m.brand_name} ${m.strength}`]));

  // FR-15 figures
  const loss = expiredLoss(month, batches, movements, today);
  const trend = trendMonths.map((m) => ({ month: m, ...expiredLoss(m, batches, movements, today) }));
  const stockValue = stockValueByBand(batches, today); // near-expiry value is "as of today"
  const sellers = topSellers(items.map((i) => ({ ...i, medicine_name: nameOf.get(i.medicine_id) ?? "Unknown" })), 5);
  const revenue = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
  const unitsSold = items.reduce((s, i) => s + i.quantity, 0);
  const returnedValue = movements
    .filter((m) => m.movement === "return" && m.created_at.slice(0, 10) >= start && m.created_at.slice(0, 10) <= end)
    .reduce((s, m) => s + Math.abs(m.quantity_change) * Number(m.unit_cost ?? 0), 0);
  const lowStock = checkStock({
    today,
    coveredFrom: today,
    sales: [],
    medicines: medicines.map((m) => ({ id: m.id, name: nameOf.get(m.id)!, min_stock_level: m.min_stock_level })),
    batches: batches
      .filter((b) => !isExpired(b.expiry_date, today))
      .map((b) => ({ ...b, medicine_name: "", batch_no: "", sale_price: 0, supplier_name: null, return_window_days: null })),
  }).lowStock;

  const monthOptions = lastMonths(thisMonth, 12).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Report"
        subtitle={`${monthLabel(month)} · losses, near-expiry stock and top sellers`}
        action={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <form className="flex items-center gap-2">
              <select
                name="month"
                defaultValue={month}
                className="rounded-lg border border-teal-line bg-white px-3 py-2 text-sm"
                aria-label="Report month"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              <button className="rounded-lg border border-teal-line bg-white px-3 py-2 text-sm font-semibold text-teal-brand hover:bg-teal-soft">Show</button>
            </form>
            <PrintButton />
            {role === "admin" && (
              <a href="/api/backup" className="rounded-lg border border-teal-line bg-white px-3 py-2 text-sm font-semibold text-teal-brand hover:bg-teal-soft">
                Download backup
              </a>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Expired-stock loss" value={formatPKR(loss.value)} note={`${loss.units} units expired this month`} style="border-red-200 bg-red-50 text-red-700" />
        <Stat label="Near-expiry stock value" value={formatPKR(stockValue.nearExpiryTotal)} note="expires within 90 days (today)" style="border-orange-200 bg-orange-50 text-orange-700" />
        <Stat label="Sales" value={formatPKR(revenue)} note={`${unitsSold} units sold`} style="border-teal-line bg-teal-soft text-teal-brand" />
        <Stat label="Returned to suppliers" value={formatPKR(returnedValue)} note="saved from becoming a loss" style="border-teal-line bg-white text-teal-brand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Top-selling medicines · ${monthLabel(month)}`}>
          {sellers.length === 0 ? (
            <EmptyState title="No sales in this month" />
          ) : (
            <div className="space-y-4">
              <TopSellersChart labels={sellers.map((s) => s.medicine_name)} units={sellers.map((s) => s.units)} />
              <Table headers={["Medicine", "Units", "Revenue"]}>
                {sellers.map((s) => (
                  <tr key={s.medicine_name}>
                    <Td className="font-semibold">{s.medicine_name}</Td>
                    <Td>{s.units}</Td>
                    <Td>{formatPKR(s.revenue)}</Td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Card>

        <Card title="Expired-stock loss · last 6 months">
          <div className="space-y-4">
            <LossTrendChart labels={trend.map((t) => monthLabel(t.month))} values={trend.map((t) => t.value)} />
            <Table headers={["Month", "Units expired", "Loss"]}>
              {trend.map((t) => (
                <tr key={t.month} className={t.month === month ? "bg-teal-soft/50" : ""}>
                  <Td className="font-semibold">{monthLabel(t.month)}</Td>
                  <Td>{t.units}</Td>
                  <Td>{formatPKR(t.value)}</Td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>

        <Card title="Stock value by expiry (today)">
          <div className="space-y-4">
            <StockValueChart values={[stockValue.within30, stockValue.within60, stockValue.within90, stockValue.safe]} />
            <Table headers={["Expires", "Value (purchase price)"]}>
              <tr><Td>Within 30 days</Td><Td>{formatPKR(stockValue.within30)}</Td></tr>
              <tr><Td>31–60 days</Td><Td>{formatPKR(stockValue.within60)}</Td></tr>
              <tr><Td>61–90 days</Td><Td>{formatPKR(stockValue.within90)}</Td></tr>
              <tr><Td>Safe (more than 90 days)</Td><Td>{formatPKR(stockValue.safe)}</Td></tr>
            </Table>
          </div>
        </Card>

        <Card title="Low stock (today)">
          {lowStock.length === 0 ? (
            <EmptyState title="All medicines are above their minimum level" />
          ) : (
            <Table headers={["Medicine", "In stock", "Minimum"]}>
              {lowStock.map((m) => (
                <tr key={m.medicine_id}>
                  <Td className="font-semibold">{m.medicine_name}</Td>
                  <Td className={m.in_stock === 0 ? "font-bold text-red-700" : "font-semibold text-coral"}>{m.in_stock === 0 ? "Out of stock" : m.in_stock}</Td>
                  <Td>{m.min_stock_level}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, note, style }: { label: string; value: string; note: string; style: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${style}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{note}</p>
    </div>
  );
}
