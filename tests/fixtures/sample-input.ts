// A small pharmacy used by the analysis and thread tests (same idea as supabase/seed.sql).
import { addDays } from "../../lib/expiry";
import type { AnalysisInput } from "../../lib/analysis";

export const TODAY = "2026-11-01";

function batch(
  id: number,
  medicine_id: number,
  medicine_name: string,
  batch_no: string,
  days: number,
  quantity: number,
  purchase_price: number
) {
  return {
    id,
    medicine_id,
    medicine_name,
    batch_no,
    expiry_date: addDays(TODAY, days),
    quantity,
    purchase_price,
    sale_price: purchase_price * 1.3,
    supplier_name: "Mehran Pharma",
    return_window_days: 30,
  };
}

/** Sales of `perDay` units every day for the last 60 days. */
function dailySales(medicine_id: number, perDay: number) {
  return Array.from({ length: 60 }, (_, i) => ({ medicine_id, sold_on: addDays(TODAY, -(i + 1)), quantity: perDay }));
}

export function sampleInput(): AnalysisInput {
  return {
    today: TODAY,
    coveredFrom: TODAY,
    medicines: [
      { id: 1, name: "Panadol 500 mg", min_stock_level: 100 },
      { id: 2, name: "Augmentin 625 mg", min_stock_level: 40 },
      { id: 3, name: "Calpol 120 mg/5 ml", min_stock_level: 30 },
      { id: 4, name: "Softin 10 mg", min_stock_level: 30 },
    ],
    batches: [
      batch(1, 1, "Panadol 500 mg", "PN-2401", -15, 40, 1.8), // expired
      batch(2, 1, "Panadol 500 mg", "PN-2409", 20, 120, 1.8), // within 30 days
      batch(3, 1, "Panadol 500 mg", "PN-2503", 400, 300, 1.85), // safe
      batch(4, 2, "Augmentin 625 mg", "AG-2407", 45, 120, 38), // proposal example
      batch(5, 3, "Calpol 120 mg/5 ml", "CP-2408", 35, 24, 95), // return deadline in 5 days
      batch(6, 3, "Calpol 120 mg/5 ml", "CP-0000", 50, 0, 95), // sold out – ignored
    ],
    sales: [...dailySales(1, 6), ...dailySales(2, 2)],
  };
}
