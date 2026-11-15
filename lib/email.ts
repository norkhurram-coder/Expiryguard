// FR-08: the daily email summary, sent with Nodemailer over SMTP (e.g. a Gmail App Password).
// If SMTP is not set up, the scan still runs and the summary is shown on the dashboard;
// the email is simply marked as "skipped".
import nodemailer from "nodemailer";
import type { ParallelAnalysis } from "@/lib/threads/pool";
import { formatDate, formatPKR } from "@/lib/format";

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(to: string[], subject: string, html: string, text: string): Promise<string> {
  if (!smtpConfigured()) return "skipped – SMTP is not set up";
  if (to.length === 0) return "skipped – no recipient (add an Admin email or ALERT_EMAIL_TO)";

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM || `ExpiryGuard <${process.env.SMTP_USER}>`,
    to: to.join(", "),
    subject,
    html,
    text,
  });
  return `sent to ${to.join(", ")}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return `<p style="color:#5e6b6b">None 🎉</p>`;
  const th = headers.map((h) => `<th style="text-align:left;padding:6px 8px;background:#e6f4f1;color:#0f5257">${h}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td style="padding:6px 8px;border-top:1px solid #cfe3df">${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table style="border-collapse:collapse;font-size:13px;width:100%">${`<tr>${th}</tr>`}${body}</table>`;
}

/** Builds the daily summary email from the analysis result. */
export function buildDailyEmail(a: ParallelAnalysis, today: string, missedDays: number, appUrl?: string) {
  const { expiry, stock, forecast } = a;
  const atRisk = forecast.rows.filter((r) => r.unsold_at_expiry > 0);
  const subject =
    `ExpiryGuard daily summary – ${formatDate(today)}: ` +
    `${expiry.counts.expired} expired, ${expiry.counts.within30} within 30 days` +
    (expiry.returnAlerts.length ? `, ${expiry.returnAlerts.length} return deadline(s)` : "");

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e2b2b;max-width:720px">
    <h2 style="color:#0f5257;margin-bottom:4px">ExpiryGuard – daily expiry summary</h2>
    <p style="margin-top:0;color:#5e6b6b">${formatDate(today)}${missedDays > 0 ? ` · also covers ${missedDays} missed day(s)` : ""}</p>
    <p>
      <b style="color:#b91c1c">${expiry.counts.expired} expired</b> ·
      <b style="color:#c2410c">${expiry.counts.within30} within 30 days</b> ·
      ${expiry.counts.within60} within 60 days · ${expiry.counts.within90} within 90 days
    </p>
    <h3 style="color:#e4572e">Expired – quarantine, do not sell (${expiry.quarantine.length})</h3>
    ${table(["Medicine", "Batch", "Expired on", "Qty", "Value"], expiry.quarantine.map((b) => [b.medicine_name, b.batch_no, formatDate(b.expiry_date), String(b.quantity), formatPKR(b.value)]))}
    <h3 style="color:#0f5257">Supplier return deadlines (${expiry.returnAlerts.length})</h3>
    ${table(["Medicine", "Batch", "Supplier", "Return by", "Qty"], expiry.returnAlerts.map((r) => [r.medicine_name, r.batch_no, r.supplier_name ?? "—", formatDate(r.last_return_date) + (r.missed ? " (MISSED)" : ` (${r.days_to_deadline} days)`), String(r.quantity)]))}
    <h3 style="color:#0f5257">Expiring within 30 days</h3>
    ${table(["Medicine", "Batch", "Expiry", "Days left", "Qty"], expiry.nearExpiry.filter((b) => b.days_left <= 30).map((b) => [b.medicine_name, b.batch_no, formatDate(b.expiry_date), String(b.days_left), String(b.quantity)]))}
    <h3 style="color:#0f5257">Stock that won't sell before expiry (${atRisk.length})</h3>
    ${table(["Medicine", "Batch", "Unsold at expiry", "Value at risk", "Action"], atRisk.slice(0, 15).map((r) => [r.medicine_name, r.batch_no, String(r.unsold_at_expiry), formatPKR(r.value_at_risk), r.action === "return" ? `Return by ${formatDate(r.last_return_date!)}` : "Discount / promote"]))}
    <h3 style="color:#0f5257">Low stock (${stock.lowStock.length})</h3>
    ${table(["Medicine", "In stock", "Minimum"], stock.lowStock.map((m) => [m.medicine_name, String(m.in_stock), String(m.min_stock_level)]))}
    <p style="color:#5e6b6b;font-size:12px;margin-top:24px">
      Analysed by ${a.mode === "threads" ? `${a.threads.length} tasks on ${a.poolSize} worker threads` : "the main thread"} in ${a.totalMs} ms.
      ${appUrl ? `<a href="${appUrl}" style="color:#0f5257">Open ExpiryGuard</a>` : ""}
    </p>
  </div>`;

  const text = [
    `ExpiryGuard daily summary – ${formatDate(today)}`,
    `Expired: ${expiry.counts.expired} | ≤30 days: ${expiry.counts.within30} | ≤60: ${expiry.counts.within60} | ≤90: ${expiry.counts.within90}`,
    `Return deadlines: ${expiry.returnAlerts.map((r) => `${r.medicine_name} ${r.batch_no} by ${r.last_return_date}`).join("; ") || "none"}`,
    `Low stock: ${stock.lowStock.map((m) => `${m.medicine_name} (${m.in_stock})`).join("; ") || "none"}`,
    `At risk: ${atRisk.length} batch(es)`,
  ].join("\n");

  return { subject, html, text };
}
