// Shapes of the rows we read from Supabase.

export type Profile = {
  id: string;
  full_name: string;
  age: number | null;
  phone: string | null;
  role: "admin" | "pharmacist" | "sales_staff";
  email?: string | null;
};

export type Supplier = {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string | null;
  return_window_days: number;
};

export type Medicine = {
  id: number;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  category: string;
  rack_location: string | null;
  min_stock_level: number;
  barcode: string | null;
};

export type Batch = {
  id: number;
  medicine_id: number;
  supplier_id: number;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
};

/** A batch together with its medicine and supplier (from a Supabase join). */
export type BatchWithDetails = Batch & {
  medicines: Pick<Medicine, "brand_name" | "strength" | "dosage_form"> | null;
  suppliers: Pick<Supplier, "name" | "return_window_days"> | null;
};

/** One sale at the counter (created only by the database function process_sale). */
export type Sale = {
  id: number;
  sold_by: string | null;
  cashier_name: string | null;
  sold_at: string;
  total: number;
};

export type SaleItem = {
  id: number;
  sale_id: number;
  batch_id: number;
  medicine_id: number;
  quantity: number;
  unit_price: number;
  sold_on: string;
};

/** One row of the audit log (NFR-06). */
export type StockMovement = {
  id: number;
  batch_id: number | null;
  medicine_id: number | null;
  batch_no: string | null;
  expiry_date: string | null;
  movement: "purchase" | "sale" | "adjustment" | "disposal" | "return" | "delete";
  quantity_change: number;
  unit_cost: number | null;
  note: string | null;
  user_name: string | null;
  created_at: string;
};

/** One run of the daily expiry scan (FR-07, FR-08, NFR-04). */
export type ScanRun = {
  id: number;
  run_date: string;
  started_at: string;
  finished_at: string | null;
  trigger: "cron" | "manual";
  status: "success" | "failed";
  covered_from: string | null;
  summary: ScanSummary | null;
  email_status: string | null;
  error: string | null;
};

/** What we store about each scan (small, so the history table stays light). */
export type ScanSummary = {
  counts: { expired: number; within30: number; within60: number; within90: number; safe: number };
  newlyExpired: number;
  returnAlerts: number;
  lowStock: number;
  atRiskBatches: number;
  valueAtRisk: number;
  missedDays: number;
  threads: { task: string; threadId: number; ms: number }[];
  mode: "threads" | "single";
  totalMs: number;
};
