import { checkStock, coveredFromDate, forecastRisk, scanExpiry, splitIntoChunks } from "../lib/analysis";
import { addDays } from "../lib/expiry";
import { sampleInput, TODAY } from "./fixtures/sample-input";

describe("expiry scan task (FR-07, FR-12, FR-13)", () => {
  test("counts bands, quarantines expired stock and ignores sold-out batches", () => {
    const r = scanExpiry(sampleInput());
    expect(r.counts).toEqual({ expired: 1, within30: 1, within60: 2, within90: 0, safe: 1 });
    expect(r.quarantine.map((b) => b.batch_no)).toEqual(["PN-2401"]);
    expect(r.expiredValue).toBe(72); // 40 × 1.80
  });

  test("return alert 7 days before the supplier's last return date", () => {
    const r = scanExpiry(sampleInput());
    expect(r.returnAlerts.map((a) => [a.batch_no, a.days_to_deadline, a.missed])).toEqual([["CP-2408", 5, false]]);
  });

  test("NFR-04: after missed scans, the next run also reports what happened on the missed days", () => {
    const input = { ...sampleInput(), coveredFrom: addDays(TODAY, -20) }; // last good scan was 21 days ago
    const r = scanExpiry(input);
    expect(r.newlyExpired.map((b) => b.batch_no)).toEqual(["PN-2401"]); // expired 15 days ago, never reported
    // Panadol PN-2409: deadline = expiry − 30 days = 10 days ago → reported as missed
    expect(r.returnAlerts.find((a) => a.batch_no === "PN-2409")?.missed).toBe(true);
  });
});

describe("stock check task (FR-14)", () => {
  test("lists medicines below their minimum, out of stock first", () => {
    const r = checkStock(sampleInput());
    expect(r.lowStock.map((m) => [m.medicine_name, m.in_stock])).toEqual([
      ["Softin 10 mg", 0],
      ["Calpol 120 mg/5 ml", 24],
    ]);
  });
});

describe("forecast task (FR-09, FR-10)", () => {
  test("proposal example appears with a 'return' recommendation", () => {
    const row = forecastRisk(sampleInput()).rows.find((r) => r.batch_no === "AG-2407")!;
    expect(row.avg_daily_sales).toBe(2);
    expect(row.unsold_at_expiry).toBe(30);
    expect(row.value_at_risk).toBe(30 * 38);
    expect(row.action).toBe("return"); // last return date is still 15 days away
  });

  test("can be split by medicine and gives the same rows", () => {
    const input = sampleInput();
    const whole = forecastRisk(input).rows.length;
    const parts = splitIntoChunks([1, 2, 3, 4], 2).map((ids) => forecastRisk(input, ids).rows.length);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(whole);
  });
});

describe("helpers", () => {
  test("splitIntoChunks", () => {
    expect(splitIntoChunks([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
    expect(splitIntoChunks([1], 3)).toEqual([[1]]);
  });

  test("coveredFromDate", () => {
    expect(coveredFromDate(null, TODAY)).toBe(TODAY);
    expect(coveredFromDate(addDays(TODAY, -1), TODAY)).toBe(TODAY); // ran yesterday → nothing missed
    expect(coveredFromDate(addDays(TODAY, -4), TODAY)).toBe(addDays(TODAY, -3)); // 3 days missed
    expect(coveredFromDate(TODAY, TODAY)).toBe(TODAY); // second run today
    expect(coveredFromDate("2020-01-01", TODAY)).toBe(addDays(TODAY, -30)); // capped at 30 days
  });
});
