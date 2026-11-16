// SALES (FEFO) – FR-04, FR-05, FR-06. Every role can sell.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { Table, Td } from "@/components/ui/Table";
import Checkout, { type CheckoutBatch, type CheckoutMedicine } from "@/components/sales/Checkout";
import { getCurrentUser } from "@/lib/auth";
import { todayISO } from "@/lib/expiry";
import { formatPKR } from "@/lib/format";

type SaleRow = {
  id: number;
  sold_at: string;
  total: number;
  cashier_name: string | null;
  sale_items: { quantity: number; medicines: { brand_name: string } | null }[];
};

export default async function SalesPage() {
  const { supabase, role } = await getCurrentUser();

  const startOfToday = `${todayISO()}T00:00:00+05:00`; // midnight in Pakistan
  const [medicineResult, batchResult, salesResult] = await Promise.all([
    supabase.from("medicines").select("id, brand_name, generic_name, strength, dosage_form, rack_location").order("brand_name"),
    supabase.from("batches").select("id, medicine_id, batch_no, expiry_date, quantity, sale_price").gt("quantity", 0).order("id"),
    supabase
      .from("sales")
      .select("id, sold_at, total, cashier_name, sale_items(quantity, medicines(brand_name))")
      .gte("sold_at", startOfToday)
      .order("sold_at", { ascending: false })
      .limit(25),
  ]);

  const loadError = medicineResult.error ?? batchResult.error ?? salesResult.error;
  if (loadError) {
    return (
      <Alert kind="error">
        Could not load the sales screen: {loadError.message}. If this says a table is missing, run the latest supabase/schema.sql.
      </Alert>
    );
  }

  const medicines = (medicineResult.data ?? []) as CheckoutMedicine[];
  const batches = (batchResult.data ?? []) as CheckoutBatch[];
  const todaysSales = (salesResult.data ?? []) as unknown as SaleRow[];
  const todaysTotal = todaysSales.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Sales (FEFO checkout)" subtitle="Earliest-expiring stock is sold first. Expired stock is blocked automatically." />

      <Card title="New sale">
        <Checkout medicines={medicines} batches={batches} />
      </Card>

      <Card
        title={`Today's sales${role === "sales_staff" ? " (yours)" : ""}`}
        action={
          todaysSales.length > 0 && (
            <span className="text-sm text-muted">
              {todaysSales.length} sale(s) · <b className="text-teal-brand">{formatPKR(todaysTotal)}</b>
            </span>
          )
        }
      >
        {todaysSales.length === 0 ? (
          <EmptyState title="No sales yet today" message="Completed sales appear here with the batches they came from." />
        ) : (
          <Table headers={["Sale", "Time", "Items", "Cashier", "Total"]}>
            {todaysSales.map((s) => (
              <tr key={s.id} className="hover:bg-teal-soft/40">
                <Td className="font-semibold">#{s.id}</Td>
                <Td>{new Date(s.sold_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })}</Td>
                <Td className="text-xs">{s.sale_items.map((i) => `${i.quantity} × ${i.medicines?.brand_name ?? "?"}`).join(", ")}</Td>
                <Td>{s.cashier_name ?? "—"}</Td>
                <Td className="font-semibold">{formatPKR(Number(s.total))}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
