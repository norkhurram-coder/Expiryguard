// The daily expiry analysis, split into independent TASKS so they can run in parallel threads.
//   Task "expiry"   – FR-07, FR-12, FR-13: alert bands, quarantine list, return deadlines
//   Task "stock"    – FR-14: medicines below their minimum stock level
//   Task "forecast" – FR-09, FR-10: average daily sales and stock that won't sell in time
//
// Everything here is a PURE function (data in → result out, no database, no shared state),
// so each task can safely run in its own worker thread (see lib/threads/pool.ts).
//
// NOTE: this file is also loaded directly by Node inside the worker threads, so it may only
// import other files with a ".ts" extension and must not use the "@/..." shortcut.
import {
  addDays,
  averageDailySales,
  daysUntil,
  forecastBatches,
  getExpiryStatus,
  isExpired,
  lastReturnDate,
} from "./expiry.ts";

// ---------- input ----------

export type AnalysisBatch = {
  id: number;
  medicine_id: number;
  medicine_name: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
  supplier_name: string | null;
  return_window_days: number | null;
};

export type AnalysisMedicine = { id: number; name: string; min_stock_level: number };
export type AnalysisSale = { medicine_id: number; sold_on: string; quantity: number };

export type AnalysisInput = {
  today: string;
  /** First day this run is responsible for. Normally = today; earlier if a previous daily scan was missed (NFR-04). */
  coveredFrom: string;
  batches: AnalysisBatch[];
  medicines: AnalysisMedicine[];
  sales: AnalysisSale[];
};

// ---------- task results ----------

export type BatchAlert = {
  id: number;
  medicine_name: string;
  batch_no: string;
  expiry_date: string;
  days_left: number;
  quantity: number;
  value: number; // quantity × purchase price
  supplier_name: string | null;
};

export type ReturnAlert = BatchAlert & {
  last_return_date: string;
  days_to_deadline: number;
  /** true = the deadline passed on a day when the daily scan did not run (NFR-04). */
  missed: boolean;
};

export type ExpiryResult = {
  counts: { expired: number; within30: number; within60: number; within90: number; safe: number };
  quarantine: BatchAlert[]; // FR-13
  newlyExpired: BatchAlert[]; // expired since the last successful scan
  nearExpiry: BatchAlert[]; // FR-07: within 90 days
  returnAlerts: ReturnAlert[]; // FR-12
  expiredValue: number;
  nearExpiryValue: number;
};

export type LowStockRow = { medicine_id: number; medicine_name: string; in_stock: number; min_stock_level: number };
export type StockResult = { lowStock: LowStockRow[]; medicinesChecked: number };

export type ForecastRow = {
  batch_id: number;
  medicine_id: number;
  medicine_name: string;
  batch_no: string;
  supplier_name: string | null;
  expiry_date: string;
  days_left: number;
  quantity: number;
  avg_daily_sales: number;
  expected_sales: number;
  unsold_at_expiry: number;
  value_at_risk: number;
  last_return_date: string | null;
  action: "ok" | "return" | "discount";
};
export type ForecastResult = { rows: ForecastRow[]; medicinesChecked: number };

export type Task =
  | { kind: "expiry"; input: AnalysisInput }
  | { kind: "stock"; input: AnalysisInput }
  | { kind: "forecast"; input: AnalysisInput; medicineIds: number[] };

export type TaskResult = ExpiryResult | StockResult | ForecastResult;

// ---------- helpers ----------

const round2 = (n: number) => Math.round(n * 100) / 100;

function toAlert(b: AnalysisBatch, today: string): BatchAlert {
  return {
    id: b.id,
    medicine_name: b.medicine_name,
    batch_no: b.batch_no,
    expiry_date: b.expiry_date,
    days_left: daysUntil(b.expiry_date, today),
    quantity: b.quantity,
    value: round2(b.quantity * b.purchase_price),
    supplier_name: b.supplier_name,
  };
}

// ---------- TASK 1: expiry scan ----------

export function scanExpiry(input: AnalysisInput): ExpiryResult {
  const { today, coveredFrom } = input;
  const counts = { expired: 0, within30: 0, within60: 0, within90: 0, safe: 0 };
  const result: ExpiryResult = {
    counts,
    quarantine: [],
    newlyExpired: [],
    nearExpiry: [],
    returnAlerts: [],
    expiredValue: 0,
    nearExpiryValue: 0,
  };

  for (const b of input.batches) {
    if (b.quantity <= 0) continue; // sold out / written off – nothing to warn about
    const status = getExpiryStatus(b.expiry_date, today);
    counts[status]++;
    const alert = toAlert(b, today);

    if (status === "expired") {
      result.quarantine.push(alert);
      result.expiredValue += alert.value;
      // Expired since the last successful run (normally: expires today)
      if (b.expiry_date >= coveredFrom) result.newlyExpired.push(alert);
      continue;
    }
    if (status !== "safe") {
      result.nearExpiry.push(alert);
      result.nearExpiryValue += alert.value;
    }

    // FR-12: warn 7 days before the supplier's last return date.
    // If earlier scans were missed, also report deadlines that passed on those days.
    if (b.return_window_days !== null) {
      const deadline = lastReturnDate(b.expiry_date, b.return_window_days);
      const daysToDeadline = daysUntil(deadline, today);
      if (deadline >= coveredFrom && daysToDeadline <= 7) {
        result.returnAlerts.push({ ...alert, last_return_date: deadline, days_to_deadline: daysToDeadline, missed: daysToDeadline < 0 });
      }
    }
  }

  const byDate = (a: BatchAlert, b: BatchAlert) => a.expiry_date.localeCompare(b.expiry_date);
  result.quarantine.sort(byDate);
  result.nearExpiry.sort(byDate);
  result.returnAlerts.sort((a, b) => a.days_to_deadline - b.days_to_deadline);
  result.expiredValue = round2(result.expiredValue);
  result.nearExpiryValue = round2(result.nearExpiryValue);
  return result;
}

// ---------- TASK 2: stock check ----------

export function checkStock(input: AnalysisInput): StockResult {
  const lowStock: LowStockRow[] = [];
  for (const m of input.medicines) {
    const inStock = input.batches
      .filter((b) => b.medicine_id === m.id && !isExpired(b.expiry_date, input.today))
      .reduce((sum, b) => sum + b.quantity, 0);
    if (inStock < m.min_stock_level) {
      lowStock.push({ medicine_id: m.id, medicine_name: m.name, in_stock: inStock, min_stock_level: m.min_stock_level });
    }
  }
  lowStock.sort((a, b) => a.in_stock - b.in_stock);
  return { lowStock, medicinesChecked: input.medicines.length };
}

// ---------- TASK 3: risk forecast (can be split into chunks of medicines) ----------

export function forecastRisk(input: AnalysisInput, medicineIds?: number[]): ForecastResult {
  const { today } = input;
  const ids = medicineIds ?? input.medicines.map((m) => m.id);
  const rows: ForecastRow[] = [];

  for (const medicineId of ids) {
    // FR-09: average units sold per day over the last 60 days
    const avg = averageDailySales(
      input.sales.filter((s) => s.medicine_id === medicineId),
      today
    );
    const batches = input.batches.filter((b) => b.medicine_id === medicineId);

    // FR-10: expected unsold at expiry for each batch (FEFO-aware)
    for (const f of forecastBatches(batches, avg, today)) {
      const returnBy = f.return_window_days === null ? null : lastReturnDate(f.expiry_date, f.return_window_days);
      const canReturn = returnBy !== null && returnBy >= today;
      rows.push({
        batch_id: f.id,
        medicine_id: f.medicine_id,
        medicine_name: f.medicine_name,
        batch_no: f.batch_no,
        supplier_name: f.supplier_name,
        expiry_date: f.expiry_date,
        days_left: f.daysLeft,
        quantity: f.quantity,
        avg_daily_sales: round2(avg),
        expected_sales: f.expectedSales,
        unsold_at_expiry: f.unsold,
        value_at_risk: round2(f.unsold * f.purchase_price),
        last_return_date: returnBy,
        action: f.unsold === 0 ? "ok" : canReturn ? "return" : "discount",
      });
    }
  }
  return { rows, medicinesChecked: ids.length };
}

/** Runs one task. This is what each worker thread calls. */
export function runTask(task: Task): TaskResult {
  if (task.kind === "expiry") return scanExpiry(task.input);
  if (task.kind === "stock") return checkStock(task.input);
  return forecastRisk(task.input, task.medicineIds);
}

/** Splits a list into `parts` nearly equal chunks, e.g. [1..5] into 2 → [[1,2,3],[4,5]]. */
export function splitIntoChunks<T>(items: T[], parts: number): T[][] {
  const n = Math.max(1, Math.min(parts, items.length));
  const size = Math.ceil(items.length / n);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks.length ? chunks : [[]];
}

/** Joins the forecast chunks from several threads back into one list, most money at risk first. */
export function mergeForecasts(parts: ForecastResult[]): ForecastResult {
  const rows = parts.flatMap((p) => p.rows);
  rows.sort((a, b) => b.value_at_risk - a.value_at_risk || a.expiry_date.localeCompare(b.expiry_date));
  return { rows, medicinesChecked: parts.reduce((sum, p) => sum + p.medicinesChecked, 0) };
}

/** NFR-04: the first day a run must cover = day after the last successful run (at most 30 days back). */
export function coveredFromDate(lastSuccessDate: string | null, today: string): string {
  if (!lastSuccessDate) return today;
  const next = addDays(lastSuccessDate, 1);
  if (next > today) return today;
  const limit = addDays(today, -30);
  return next < limit ? limit : next;
}
