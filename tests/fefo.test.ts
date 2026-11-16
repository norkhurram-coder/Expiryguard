import { allocateFefo } from "../lib/expiry";

const TODAY = "2026-11-01";
const batches = [
  { id: 3, batch_no: "PN-2503", expiry_date: "2027-12-06", quantity: 300 }, // safe
  { id: 1, batch_no: "PN-2401", expiry_date: "2026-10-17", quantity: 40 }, // expired
  { id: 2, batch_no: "PN-2409", expiry_date: "2026-11-21", quantity: 120 }, // 20 days
];

describe("allocateFefo (FR-04 / FR-05)", () => {
  test("takes everything from the earliest-expiring batch when it is enough", () => {
    const { lines, shortBy } = allocateFefo(batches, 50, TODAY);
    expect(lines.map((l) => [l.batch.batch_no, l.quantity])).toEqual([["PN-2409", 50]]);
    expect(shortBy).toBe(0);
  });

  test("moves on to the next batch when the first runs out", () => {
    const { lines } = allocateFefo(batches, 150, TODAY);
    expect(lines.map((l) => [l.batch.batch_no, l.quantity])).toEqual([
      ["PN-2409", 120],
      ["PN-2503", 30],
    ]);
  });

  test("never uses an expired batch", () => {
    const { lines } = allocateFefo(batches, 420, TODAY);
    expect(lines.some((l) => l.batch.batch_no === "PN-2401")).toBe(false);
  });

  test("reports how many units are missing", () => {
    const { shortBy } = allocateFefo(batches, 500, TODAY);
    expect(shortBy).toBe(80); // only 120 + 300 in-date units
  });

  test("a batch expiring today counts as expired", () => {
    const { shortBy } = allocateFefo([{ id: 9, expiry_date: TODAY, quantity: 10 }], 1, TODAY);
    expect(shortBy).toBe(1);
  });

  test("same expiry date: lower id is sold first (same order as the database)", () => {
    const tie = [
      { id: 8, expiry_date: "2027-01-01", quantity: 5 },
      { id: 4, expiry_date: "2027-01-01", quantity: 5 },
    ];
    expect(allocateFefo(tie, 3, TODAY).lines[0].batch.id).toBe(4);
  });
});
