// Shapes of the rows we read from Supabase.

export type Profile = {
  id: string;
  full_name: string;
  age: number | null;
  phone: string | null;
  role: "admin" | "pharmacist" | "sales_staff";
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

/** What process_sale returns – used to show the receipt. */
export type SaleReceipt = {
  sale_id: number;
  total: number;
  lines: { medicine: string; batch_no: string; expiry_date: string; quantity: number; unit_price: number }[];
};
