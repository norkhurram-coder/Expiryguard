import { batchSchema, medicineSchema, saleSchema, saleSearchSchema, supplierSchema } from "../lib/validation";

describe("sales checkout validation", () => {
  test("accepts a normal cart", () => {
    expect(saleSchema.safeParse([{ medicineId: 1, quantity: 3 }]).success).toBe(true);
  });
  test.each([
    [[], "empty"],
    [[{ medicineId: 1, quantity: 0 }], "at least 1"],
    [[{ medicineId: 1, quantity: 2.5 }], "whole number"],
    [[{ medicineId: 1, quantity: 20000 }], "at most"],
    [[{ medicineId: 1, quantity: NaN }], "required"],
    [[{ medicineId: 1, quantity: 1 }, { medicineId: 1, quantity: 2 }], "twice"],
  ])("rejects %j", (cart, message) => {
    const result = saleSchema.safeParse(cart);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toMatch(new RegExp(message));
  });
  test("search box allows names but not symbols like < >", () => {
    expect(saleSearchSchema.safeParse("Calpol 120 mg/5 ml").success).toBe(true);
    expect(saleSearchSchema.safeParse("<script>").success).toBe(false);
  });
});

describe("other forms keep their rules", () => {
  test("supplier phone must be 03XXXXXXXXX", () => {
    const base = { name: "Test Pharma", contact_person: "Ali Khan", email: "a@b.com", address: "", return_window_days: 30 };
    expect(supplierSchema.safeParse({ ...base, phone: "03001234567" }).success).toBe(true);
    expect(supplierSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
  });
  test("medicine rack location only letters, numbers and hyphens", () => {
    const base = { brand_name: "Panadol", generic_name: "Paracetamol", strength: "500 mg", dosage_form: "tablet", category: "Analgesic", min_stock_level: 10 };
    expect(medicineSchema.safeParse({ ...base, rack_location: "A-1" }).success).toBe(true);
    expect(medicineSchema.safeParse({ ...base, rack_location: "A 1!" }).success).toBe(false);
  });
  test("batch cannot be added with a past expiry date (FR-03)", () => {
    const base = { medicine_id: 1, supplier_id: 1, batch_no: "PN-1", quantity: 10, purchase_price: 1, sale_price: 2 };
    expect(batchSchema.safeParse({ ...base, expiry_date: "2020-01-01" }).success).toBe(false);
  });
});
