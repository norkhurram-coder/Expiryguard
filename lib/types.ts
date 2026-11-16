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
