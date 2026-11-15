// SALES (FEFO) – FR-04, FR-05, FR-06, FR-16. Every role can sell.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import { Table, Td } from "@/components/ui/Table";
import Checkout, { type CheckoutBatch, type CheckoutMedicine } from "@/components/sales/Checkout";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/analysis-data";
import { todayISO } from "@/lib/expiry";
import { formatPKR } from "@/lib/format";

type SaleRow = {
  id: number;
  sold_at: string;
  total: number;
  cashier_name: string | null;
  sale_items: { quantity: number; medicines: { brand_name: string } | null }[];
};

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const { supabase, role } = await getCurrentUser();

  const startOfToday = `${todayISO()}T00:00:00+05:00`; // midnight in Pakistan
  const [medicines, batches, salesResult] = await Promise.all([
    fetchAll<CheckoutMedicine>((from, to) =>
      supabase
        .from("medicines")
        .select("id, brand_name, generic_name, strength, dosage_form, rack_location, barcode")
        .order("brand_name")
        .range(from, to)
    ),
    fetchAll<CheckoutBatch>((from, to) =>
      supabase
        .from("batches")
        .select("id, medicine_id, batch_no, expiry_date, quantity, sale_price")
        .gt("quantity", 0)
        .order("id")
        .range(from, to)
    ),
    supabase
      .from("sales")
      .select("id, sold_at, total, cashier_name, sale_items(quantity, medicines(brand_name))")
      .gte("sold_at", startOfToday)
      .order("sold_at", { ascending: false })
      .limit(25),
  ]);

  const todaysSales = (salesResult.data ?? []) as unknown as SaleRow[];
  const todaysTotal = todaysSales.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Sales (FEFO checkout)" subtitle="Earliest-expiring stock is sold first. Expired stock is blocked automatically." />
      {denied && <Alert kind="warning">Your role does not have access to that page.</Alert>}

      <Card title="New sale">
        <Checkout medicines={medicines} batches={batches} />
      </Card>

      <Card title={`Today's sales${role === "sales_staff" ? " (yours)" : ""}`}>
        {todaysSales.length === 0 ? (
          <p className="text-sm text-muted">No sales yet today.</p>
        ) : (
          <>
            <Table headers={["Sale", "Time", "Items", "Cashier", "Total"]}>
              {todaysSales.map((s) => (
                <tr key={s.id}>
                  <Td className="font-semibold">#{s.id}</Td>
                  <Td>{new Date(s.sold_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td className="text-xs">{s.sale_items.map((i) => `${i.quantity} × ${i.medicines?.brand_name ?? "?"}`).join(", ")}</Td>
                  <Td>{s.cashier_name ?? "—"}</Td>
                  <Td className="font-semibold">{formatPKR(Number(s.total))}</Td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-right text-sm">
              {todaysSales.length} sale(s) · <b>{formatPKR(todaysTotal)}</b>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
