import {
  addDays,
  allocateFefo,
  averageDailySales,
  daysUntil,
  expectedUnsoldAtExpiry,
  forecastBatches,
  getExpiryStatus,
  isExpired,
  lastReturnDate,
  needsReturnAlert,
  selectFefoBatch,
  todayISO,
} from "../lib/expiry";

const TODAY = "2026-11-01";

describe("dates", () => {
  test("todayISO returns YYYY-MM-DD in Pakistan time", () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in Pakistan (UTC+5)
    expect(todayISO(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11-01");
  });

  test("addDays works across months and years", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("daysUntil counts whole days", () => {
    expect(daysUntil("2026-11-11", TODAY)).toBe(10);
    expect(daysUntil("2026-10-30", TODAY)).toBe(-2);
  });
});

describe("expiry status (FR-06, FR-07)", () => {
  test("a batch expiring today counts as expired", () => {
    expect(isExpired(TODAY, TODAY)).toBe(true);
    expect(getExpiryStatus(TODAY, TODAY)).toBe("expired");
  });

  test("bands: 30, 60, 90 days and safe", () => {
    expect(getExpiryStatus(addDays(TODAY, 1), TODAY)).toBe("within30");
    expect(getExpiryStatus(addDays(TODAY, 30), TODAY)).toBe("within30");
    expect(getExpiryStatus(addDays(TODAY, 31), TODAY)).toBe("within60");
    expect(getExpiryStatus(addDays(TODAY, 60), TODAY)).toBe("within60");
    expect(getExpiryStatus(addDays(TODAY, 90), TODAY)).toBe("within90");
    expect(getExpiryStatus(addDays(TODAY, 91), TODAY)).toBe("safe");
  });
});

describe("FEFO batch selection (FR-04, FR-05)", () => {
  const batches = [
    { batch_no: "LATE", expiry_date: "2027-06-01", quantity: 50 },
    { batch_no: "EXPIRED", expiry_date: "2026-10-01", quantity: 100 },
    { batch_no: "EMPTY", expiry_date: "2026-11-20", quantity: 0 },
    { batch_no: "SOON", expiry_date: "2026-12-15", quantity: 20 },
  ];

  test("picks the earliest-expiring batch that is not expired and has stock", () => {
    expect(selectFefoBatch(batches, TODAY)?.batch_no).toBe("SOON");
  });

  test("returns null when only expired stock is left", () => {
    expect(selectFefoBatch([batches[1]], TODAY)).toBeNull();
  });
});

describe("risk forecast (FR-09, FR-10)", () => {
  test("average daily sales over 60 days ignores older sales", () => {
    const sales = [
      { sold_on: "2026-10-31", quantity: 60 },
      { sold_on: "2026-09-10", quantity: 60 },
      { sold_on: "2026-06-01", quantity: 500 }, // too old
    ];
    expect(averageDailySales(sales, TODAY)).toBe(2);
  });

  test("proposal example: 120 left, 2/day, 45 days → 30 at risk", () => {
    expect(expectedUnsoldAtExpiry(120, 2, 45)).toBe(30);
  });

  test("never returns a negative number", () => {
    expect(expectedUnsoldAtExpiry(10, 5, 30)).toBe(0);
  });
});

describe("supplier returns (FR-11, FR-12)", () => {
  test("last return date = expiry date − return window", () => {
    expect(lastReturnDate("2026-12-31", 30)).toBe("2026-12-01");
  });

  test("alerts 7 days before the last return date", () => {
    expect(needsReturnAlert("2026-12-06", 30, TODAY)).toBe(true); // deadline 6 Nov, 5 days away
    expect(needsReturnAlert("2026-12-31", 30, TODAY)).toBe(false); // deadline 1 Dec, 30 days away
    expect(needsReturnAlert("2026-11-15", 30, TODAY)).toBe(false); // deadline already passed
  });
});

describe("checkout FEFO allocation (FR-04, FR-05)", () => {
  const batches = [
    { id: 1, batch_no: "EXPIRED", expiry_date: "2026-10-20", quantity: 40 },
    { id: 2, batch_no: "SOON", expiry_date: "2026-11-21", quantity: 120 },
    { id: 3, batch_no: "LATER", expiry_date: "2027-12-05", quantity: 300 },
  ];

  test("takes the earliest-expiring batch first and moves to the next one", () => {
    const { lines, shortBy } = allocateFefo(batches, 130, TODAY);
    expect(lines.map((l) => [l.batch.batch_no, l.quantity])).toEqual([
      ["SOON", 120],
      ["LATER", 10],
    ]);
    expect(shortBy).toBe(0);
  });

  test("never uses expired stock and reports the shortfall", () => {
    const { lines, shortBy } = allocateFefo(batches, 500, TODAY);
    expect(lines.some((l) => l.batch.batch_no === "EXPIRED")).toBe(false);
    expect(shortBy).toBe(80); // 420 in-date units, 500 wanted
  });
});

describe("FEFO-aware forecast (FR-10)", () => {
  test("one batch gives the proposal result: 120 left, 2/day, 45 days -> 30", () => {
    const [row] = forecastBatches([{ expiry_date: addDays(TODAY, 45), quantity: 120 }], 2, TODAY);
    expect(row.expectedSales).toBe(90);
    expect(row.unsold).toBe(30);
  });

  test("a later batch only starts selling when the earlier one is sold out", () => {
    const rows = forecastBatches(
      [
        { batch_no: "B", expiry_date: addDays(TODAY, 60), quantity: 100 },
        { batch_no: "A", expiry_date: addDays(TODAY, 30), quantity: 60 },
      ],
      2,
      TODAY
    );
    expect(rows.map((r) => [r.batch_no, r.unsold])).toEqual([
      ["A", 0],
      ["B", 40],
    ]);
  });

  test("no sales at all -> the whole batch is at risk", () => {
    const [row] = forecastBatches([{ expiry_date: addDays(TODAY, 10), quantity: 15 }], 0, TODAY);
    expect(row.unsold).toBe(15);
  });
});
