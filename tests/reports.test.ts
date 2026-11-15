import { expiredLoss, lastMonths, monthRange, stockValueByBand, topSellers } from "../lib/reports";

const TODAY = "2026-11-15";

describe("monthly report (FR-15)", () => {
  test("month helpers", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(lastMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  test("expired loss counts quarantined + disposed stock, but not supplier returns", () => {
    const batches = [
      { id: 1, expiry_date: "2026-11-05", quantity: 10, purchase_price: 2 }, // in quarantine → 20
      { id: 2, expiry_date: "2026-11-25", quantity: 50, purchase_price: 2 }, // not expired yet
      { id: 3, expiry_date: "2026-10-30", quantity: 5, purchase_price: 2 }, // October → 10
    ];
    const movements = [
      // disposed after expiring → 30 × 1.50 = 45
      { batch_id: 4, movement: "disposal", quantity_change: -30, unit_cost: 1.5, expiry_date: "2026-11-02", created_at: "2026-11-03T10:00:00Z" },
      // returned to the supplier → refund, not a loss
      { batch_id: 5, movement: "return", quantity_change: -100, unit_cost: 9, expiry_date: "2026-11-10", created_at: "2026-10-01T10:00:00Z" },
      // deleted after expiring → 4 × 10 = 40
      { batch_id: 6, movement: "delete", quantity_change: -4, unit_cost: 10, expiry_date: "2026-11-01", created_at: "2026-11-02T10:00:00Z" },
    ];
    expect(expiredLoss("2026-11", batches, movements, TODAY)).toEqual({ value: 105, units: 44 });
    expect(expiredLoss("2026-10", batches, movements, TODAY)).toEqual({ value: 10, units: 5 });
  });

  test("stock value by expiry band", () => {
    const v = stockValueByBand(
      [
        { id: 1, expiry_date: "2026-11-20", quantity: 10, purchase_price: 1 },
        { id: 2, expiry_date: "2027-06-01", quantity: 10, purchase_price: 3 },
        { id: 3, expiry_date: "2026-11-01", quantity: 99, purchase_price: 9 }, // expired: excluded
      ],
      TODAY
    );
    expect(v).toEqual({ within30: 10, within60: 0, within90: 0, safe: 30, nearExpiryTotal: 10 });
  });

  test("top sellers by units", () => {
    const top = topSellers([
      { medicine_id: 1, medicine_name: "Panadol", quantity: 6, unit_price: 2.5 },
      { medicine_id: 2, medicine_name: "Augmentin", quantity: 2, unit_price: 45 },
      { medicine_id: 1, medicine_name: "Panadol", quantity: 4, unit_price: 2.5 },
    ]);
    expect(top[0]).toEqual({ medicine_name: "Panadol", units: 10, revenue: 25 });
    expect(top[1].medicine_name).toBe("Augmentin");
  });
});
