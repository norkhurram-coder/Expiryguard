// ExpiryGuard core logic.
// Pure functions only (no database, no React), so they are easy to test with Jest.
// All dates are plain "YYYY-MM-DD" strings, e.g. "2026-12-31".

export type ExpiryStatus = "expired" | "within30" | "within60" | "within90" | "safe";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Today's date in Pakistan time, as "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  // "en-CA" formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);
}

/** Turns "YYYY-MM-DD" into a number of days, so two dates can be subtracted. */
function toDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/** Adds (or subtracts) whole days to a date. */
export function addDays(isoDate: string, days: number): string {
  const result = new Date((toDayNumber(isoDate) + days) * MS_PER_DAY);
  return result.toISOString().slice(0, 10);
}

/** Days from `today` until `expiryDate`. 0 = expires today, negative = already expired. */
export function daysUntil(expiryDate: string, today: string = todayISO()): number {
  return toDayNumber(expiryDate) - toDayNumber(today);
}

/** A batch is expired on its expiry date and after it. */
export function isExpired(expiryDate: string, today: string = todayISO()): boolean {
  return daysUntil(expiryDate, today) <= 0;
}

/** FR-06 / FR-07: which alert band a batch falls in. */
export function getExpiryStatus(expiryDate: string, today: string = todayISO()): ExpiryStatus {
  const days = daysUntil(expiryDate, today);
  if (days <= 0) return "expired";
  if (days <= 30) return "within30";
  if (days <= 60) return "within60";
  if (days <= 90) return "within90";
  return "safe";
}

/** FR-04 / FR-05: pick the earliest-expiring batch that is not expired and still has stock (FEFO). */
export function selectFefoBatch<T extends { expiry_date: string; quantity: number }>(
  batches: T[],
  today: string = todayISO()
): T | null {
  const sellable = batches.filter((b) => b.quantity > 0 && !isExpired(b.expiry_date, today));
  sellable.sort((a, b) => toDayNumber(a.expiry_date) - toDayNumber(b.expiry_date));
  return sellable[0] ?? null;
}

/** FR-09: average units sold per day over the last `periodDays` days (default 60). */
export function averageDailySales(
  sales: { sold_on: string; quantity: number }[],
  today: string = todayISO(),
  periodDays = 60
): number {
  const total = sales
    .filter((s) => {
      const age = daysUntil(today, s.sold_on); // how many days ago the sale happened
      return age >= 0 && age < periodDays;
    })
    .reduce((sum, s) => sum + s.quantity, 0);
  return total / periodDays;
}

/**
 * FR-10: Expected unsold at expiry = stock left − (average daily sales × days left to expiry).
 * Never below 0. Example from the proposal: 120 left, 2/day, 45 days → 30 at risk.
 */
export function expectedUnsoldAtExpiry(stockLeft: number, avgDailySales: number, daysLeft: number): number {
  const willSell = avgDailySales * Math.max(daysLeft, 0);
  return Math.max(0, Math.round(stockLeft - willSell));
}

/** FR-11: Last return date = expiry date − supplier's return window. */
export function lastReturnDate(expiryDate: string, returnWindowDays: number): string {
  return addDays(expiryDate, -returnWindowDays);
}

/** FR-12: true when the last return date is today or within the next `alertDays` days (default 7). */
export function needsReturnAlert(
  expiryDate: string,
  returnWindowDays: number,
  today: string = todayISO(),
  alertDays = 7
): boolean {
  const daysToDeadline = daysUntil(lastReturnDate(expiryDate, returnWindowDays), today);
  return daysToDeadline >= 0 && daysToDeadline <= alertDays;
}
