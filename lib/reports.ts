// FR-15: monthly report calculations. Pure functions, tested in tests/reports.test.ts.
import { addDays, getExpiryStatus, isExpired } from "./expiry";

/** "2026-11" → { start: "2026-11-01", end: "2026-11-30" } */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, end: addDays(nextMonth, -1) };
}

/** The `count` months ending with `month`, oldest first: ("2026-11", 3) → ["2026-09", "2026-10", "2026-11"] */
export function lastMonths(month: string, count: number): string[] {
  const [y, m] = month.split("-").map(Number);
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    result.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`);
  }
  return result;
}

/** "2026-11" → "Nov 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export type ReportBatch = { id: number; expiry_date: string; quantity: number; purchase_price: number };
export type ReportMovement = {
  batch_id: number | null;
  movement: string;
  quantity_change: number;
  unit_cost: number | null;
  expiry_date: string | null;
  created_at: string;
};

/**
 * Expired-stock loss for a month = stock that EXPIRED in that month, valued at purchase price.
 * It counts what is still in quarantine plus what was disposed of or deleted after expiring.
 * Stock returned to the supplier is NOT a loss (the supplier refunds it).
 */
export function expiredLoss(month: string, batches: ReportBatch[], movements: ReportMovement[], today: string): { value: number; units: number } {
  const { start, end } = monthRange(month);
  const inMonth = (d: string | null) => d !== null && d >= start && d <= end && d <= today;
  let value = 0;
  let units = 0;

  for (const b of batches) {
    if (inMonth(b.expiry_date) && isExpired(b.expiry_date, today) && b.quantity > 0) {
      value += b.quantity * Number(b.purchase_price);
      units += b.quantity;
    }
  }
  for (const m of movements) {
    const writtenOffAfterExpiry = m.expiry_date !== null && m.created_at.slice(0, 10) >= m.expiry_date;
    if ((m.movement === "disposal" || (m.movement === "delete" && writtenOffAfterExpiry)) && inMonth(m.expiry_date)) {
      const qty = Math.abs(m.quantity_change);
      value += qty * Number(m.unit_cost ?? 0);
      units += qty;
    }
  }
  return { value: Math.round(value * 100) / 100, units };
}

/** Value (purchase price) of in-date stock by expiry band – for the stock value chart. */
export function stockValueByBand(batches: ReportBatch[], today: string) {
  const bands = { within30: 0, within60: 0, within90: 0, safe: 0 };
  for (const b of batches) {
    if (b.quantity <= 0) continue;
    const status = getExpiryStatus(b.expiry_date, today);
    if (status !== "expired") bands[status] += b.quantity * Number(b.purchase_price);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    within30: round(bands.within30),
    within60: round(bands.within60),
    within90: round(bands.within90),
    safe: round(bands.safe),
    nearExpiryTotal: round(bands.within30 + bands.within60 + bands.within90),
  };
}

export type ReportSaleItem = { medicine_id: number; medicine_name: string; quantity: number; unit_price: number };

/** Top-selling medicines by units sold. */
export function topSellers(items: ReportSaleItem[], limit = 5) {
  const map = new Map<number, { medicine_name: string; units: number; revenue: number }>();
  for (const it of items) {
    const row = map.get(it.medicine_id) ?? { medicine_name: it.medicine_name, units: 0, revenue: 0 };
    row.units += it.quantity;
    row.revenue += it.quantity * Number(it.unit_price);
    map.set(it.medicine_id, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, limit);
}
