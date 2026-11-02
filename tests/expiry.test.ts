import {
  addDays,
  averageDailySales,
  daysUntil,
  expectedUnsoldAtExpiry,
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
