// Loads everything the analysis needs from Supabase and turns it into plain data
// (AnalysisInput) that can be copied to the worker threads.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisInput } from "@/lib/analysis";
import { addDays } from "@/lib/expiry";

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Supabase returns at most 1,000 rows per request, so read big tables page by page. */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

type BatchRow = {
  id: number;
  medicine_id: number;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
  medicines: { brand_name: string; strength: string } | null;
  suppliers: { name: string; return_window_days: number } | null;
};
type MedicineRow = { id: number; brand_name: string; strength: string; min_stock_level: number };
type SaleRow = { medicine_id: number; sold_on: string; quantity: number };

export async function loadAnalysisInput(supabase: SupabaseClient, today: string, coveredFrom: string): Promise<AnalysisInput> {
  const [batches, medicines, sales] = await Promise.all([
    fetchAll<BatchRow>((from, to) =>
      supabase
        .from("batches")
        .select("id, medicine_id, batch_no, expiry_date, quantity, purchase_price, sale_price, medicines(brand_name, strength), suppliers(name, return_window_days)")
        .order("id")
        .range(from, to)
        .overrideTypes<BatchRow[], { merge: false }>()
    ),
    fetchAll<MedicineRow>((from, to) =>
      supabase.from("medicines").select("id, brand_name, strength, min_stock_level").order("id").range(from, to)
    ),
    // FR-09: sales of the last 60 full days
    fetchAll<SaleRow>((from, to) =>
      supabase
        .from("sale_items")
        .select("medicine_id, sold_on, quantity")
        .gte("sold_on", addDays(today, -60))
        .lt("sold_on", today)
        .order("id")
        .range(from, to)
    ),
  ]);

  return {
    today,
    coveredFrom,
    medicines: medicines.map((m) => ({ id: m.id, name: `${m.brand_name} ${m.strength}`, min_stock_level: m.min_stock_level })),
    batches: batches.map((b) => ({
      id: b.id,
      medicine_id: b.medicine_id,
      medicine_name: b.medicines ? `${b.medicines.brand_name} ${b.medicines.strength}` : "Unknown medicine",
      batch_no: b.batch_no,
      expiry_date: b.expiry_date,
      quantity: b.quantity,
      purchase_price: Number(b.purchase_price),
      sale_price: Number(b.sale_price),
      supplier_name: b.suppliers?.name ?? null,
      return_window_days: b.suppliers?.return_window_days ?? null,
    })),
    sales: sales.map((s) => ({ medicine_id: s.medicine_id, sold_on: s.sold_on, quantity: s.quantity })),
  };
}
