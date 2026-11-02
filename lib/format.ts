/** "2026-12-31" → "31 Dec 2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** 1234.5 → "Rs 1,234.50" */
export function formatPKR(amount: number): string {
  return "Rs " + Number(amount).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Turns Supabase error codes into simple messages. */
export function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "This record already exists (duplicate).";
  if (error.code === "23503") return "This record is still used elsewhere (for example, a medicine that still has batches), so it can't be deleted.";
  if (error.code === "42501") return "Your role is not allowed to do this.";
  return error.message;
}
