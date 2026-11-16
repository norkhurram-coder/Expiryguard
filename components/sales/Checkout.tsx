"use client";

// SALES SCREEN (FR-04, FR-05, FR-06)
// • Search a medicine and add it to the cart.
// • For each item the screen shows LIVE which batch(es) FEFO will use – earliest expiry first,
//   moving to the next batch when one is not enough.
// • Expired batches are never offered (FR-05); batches expiring within 30 days show a
//   "warn the customer" note (FR-06). Both decisions come from the ExpiryAlertFactory.
// • Quantities and the search box are validated with Zod (lib/validation.ts) before anything is sent.
// • "Complete sale" calls the database function process_sale, which repeats the FEFO rules
//   inside one locked transaction, so stock can't be oversold even with two counters at once.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { allocateFefo } from "@/lib/expiry";
import { ExpiryAlertFactory } from "@/lib/patterns/ExpiryAlertFactory";
import { formatDate, formatPKR } from "@/lib/format";
import type { SaleReceipt } from "@/lib/types";
import { saleLineSchema, saleSchema, saleSearchSchema } from "@/lib/validation";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";

export type CheckoutMedicine = {
  id: number;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  rack_location: string | null;
};
export type CheckoutBatch = { id: number; medicine_id: number; batch_no: string; expiry_date: string; quantity: number; sale_price: number };

type CartLine = { medicineId: number; quantity: number };

/** The Zod error for one quantity, or "" when it is valid. */
function quantityError(quantity: number): string {
  const check = saleLineSchema.shape.quantity.safeParse(quantity);
  return check.success ? "" : check.error.issues[0].message;
}

export default function Checkout({ medicines, batches }: { medicines: CheckoutMedicine[]; batches: CheckoutBatch[] }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  const byId = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);
  const batchesOf = (medicineId: number) => batches.filter((b) => b.medicine_id === medicineId);
  const inDateStock = (medicineId: number) =>
    batchesOf(medicineId)
      .filter((b) => ExpiryAlertFactory.create(b.expiry_date).canSell)
      .reduce((sum, b) => sum + b.quantity, 0);

  const searchCheck = saleSearchSchema.safeParse(search);
  const searchError = searchCheck.success ? "" : searchCheck.error.issues[0].message;
  const term = searchError ? "" : search.trim().toLowerCase();
  const results = term
    ? medicines.filter((m) => [m.brand_name, m.generic_name].some((v) => v.toLowerCase().includes(term))).slice(0, 8)
    : [];

  function addToCart(medicineId: number) {
    setError("");
    setReceipt(null);
    setCart((old) => {
      const existing = old.find((l) => l.medicineId === medicineId);
      if (existing) return old.map((l) => (l.medicineId === medicineId ? { ...l, quantity: Math.min(10000, (l.quantity || 0) + 1) } : l));
      return [...old, { medicineId, quantity: 1 }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  function onSearchEnter() {
    const available = results.filter((m) => inDateStock(m.id) > 0);
    if (available.length === 1) return addToCart(available[0].id);
    if (results.length === 0 && term) setError(`No medicine matches "${search}".`);
  }

  function setQuantity(medicineId: number, quantity: number) {
    // Keep what was typed (even if wrong) so the Zod message below the box can explain the problem.
    setCart((old) => old.map((l) => (l.medicineId === medicineId ? { ...l, quantity: Number.isNaN(quantity) ? NaN : quantity } : l)));
  }

  // FEFO plan for every cart line (the same rules process_sale uses in the database)
  const plan = cart.map((line) => {
    const medicine = byId.get(line.medicineId)!;
    const own = batchesOf(line.medicineId);
    const qtyError = quantityError(line.quantity);
    const { lines, shortBy } = qtyError ? { lines: [], shortBy: 0 } : allocateFefo(own, line.quantity);
    const blockedExpired = own.filter((b) => !ExpiryAlertFactory.create(b.expiry_date).canSell);
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * Number(l.batch.sale_price), 0);
    return { line, medicine, lines, shortBy, blockedExpired, subtotal, qtyError };
  });
  const total = plan.reduce((sum, p) => sum + p.subtotal, 0);
  const units = cart.reduce((sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0), 0);
  const hasProblem = plan.some((p) => p.shortBy > 0 || p.qtyError !== "");

  async function completeSale() {
    setError("");
    const check = saleSchema.safeParse(cart);
    if (!check.success) {
      setError(check.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { data, error } = await createClient().rpc("process_sale", {
      p_items: check.data.map((l) => ({ medicine_id: l.medicineId, quantity: l.quantity })),
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      router.refresh(); // someone else may have sold the stock – reload the latest quantities
      return;
    }
    setReceipt(data as SaleReceipt);
    setCart([]);
    router.refresh();
    searchRef.current?.focus();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      {/* LEFT: search + cart */}
      <div className="space-y-5">
        <div className="relative">
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="sale-search">
            Find a medicine
          </label>
          <input
            id="sale-search"
            ref={searchRef}
            autoFocus
            type="search"
            value={search}
            maxLength={50}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchEnter();
              }
            }}
            placeholder="Type a brand or generic name, e.g. Panadol or Paracetamol…"
            aria-invalid={searchError !== ""}
            className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 ${
              searchError ? "border-red-400 focus:ring-red-200" : "border-teal-line focus:border-teal-brand focus:ring-teal-brand/30"
            }`}
          />
          {searchError && <p className="mt-1 text-xs font-medium text-red-700">{searchError}</p>}
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-teal-line bg-white shadow-lg">
              {results.map((m) => {
                const stock = inDateStock(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={stock === 0}
                      onClick={() => addToCart(m.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>
                        <b>{m.brand_name}</b> {m.strength}{" "}
                        <span className="text-muted">
                          · {m.generic_name} · {m.dosage_form}
                        </span>
                      </span>
                      <span className={stock === 0 ? "text-red-700" : "text-muted"}>
                        {stock === 0 ? "No in-date stock" : `${stock} in stock`}
                        {m.rack_location ? ` · Rack ${m.rack_location}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        {cart.length === 0 ? (
          <div className="rounded-xl border border-dashed border-teal-line bg-teal-soft/40 px-4 py-10 text-center text-sm text-muted">
            <p className="text-3xl">🛒</p>
            <p className="mt-2">The cart is empty. Search for a medicine to start a sale.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plan.map(({ line, medicine, lines, shortBy, blockedExpired, subtotal, qtyError }) => (
              <div
                key={line.medicineId}
                className={`rounded-xl border p-4 ${shortBy > 0 || qtyError ? "border-red-300 bg-red-50/40" : "border-teal-line"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">
                    {medicine.brand_name}{" "}
                    <span className="font-normal text-muted">
                      {medicine.strength} · {medicine.dosage_form}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="One less"
                      onClick={() => setQuantity(line.medicineId, Math.max(1, (line.quantity || 1) - 1))}
                      className="h-8 w-8 rounded-lg border border-teal-line text-teal-brand hover:bg-teal-soft"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={Number.isNaN(line.quantity) ? "" : line.quantity}
                      aria-invalid={qtyError !== ""}
                      onChange={(e) => setQuantity(line.medicineId, e.target.valueAsNumber)}
                      aria-label={`Quantity of ${medicine.brand_name}`}
                      className={`w-20 rounded-lg border px-2 py-1 text-center text-sm ${qtyError ? "border-red-400" : "border-teal-line"}`}
                    />
                    <button
                      type="button"
                      aria-label="One more"
                      onClick={() => setQuantity(line.medicineId, Math.min(10000, (line.quantity || 0) + 1))}
                      className="h-8 w-8 rounded-lg border border-teal-line text-teal-brand hover:bg-teal-soft"
                    >
                      +
                    </button>
                    <span className="w-28 text-right font-semibold tabular-nums">{formatPKR(subtotal)}</span>
                    <button
                      type="button"
                      onClick={() => setCart((old) => old.filter((l) => l.medicineId !== line.medicineId))}
                      className="text-xs font-semibold text-coral hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* FEFO plan – which batch each unit comes from */}
                {qtyError && <p className="mt-2 text-xs font-semibold text-red-700">{qtyError}</p>}
                <ol className="mt-3 space-y-1.5 border-l-2 border-teal-line pl-3 text-xs">
                  {lines.map(({ batch, quantity }, i) => {
                    const alert = ExpiryAlertFactory.create(batch.expiry_date);
                    return (
                      <li key={batch.id} className="flex flex-wrap items-center gap-2">
                        <Badge color="teal">FEFO #{i + 1}</Badge>
                        <span>
                          <b>{quantity}</b> from batch <b>{batch.batch_no}</b> · expires {formatDate(batch.expiry_date)} ·{" "}
                          {formatPKR(Number(batch.sale_price))} each
                        </span>
                        {alert.warnCustomer && <Badge color="orange">⚠ Expires in {alert.daysLeft} days – tell the customer</Badge>}
                      </li>
                    );
                  })}
                  {blockedExpired.length > 0 && (
                    <li className="text-red-700">
                      ⛔ Blocked: {blockedExpired.map((b) => `${b.batch_no} (expired ${formatDate(b.expiry_date)})`).join(", ")} – expired
                      stock cannot be sold.
                    </li>
                  )}
                  {shortBy > 0 && (
                    <li className="font-semibold text-red-700">
                      Not enough in-date stock: only {line.quantity - shortBy} available. Reduce the quantity.
                    </li>
                  )}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: summary / receipt */}
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-2xl bg-teal-brand p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Order total</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatPKR(total)}</p>
          <p className="text-sm text-white/80">
            {cart.length} item(s) · {units} unit(s)
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setCart([])}
              disabled={saving || cart.length === 0}
              className="flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              Clear
            </Button>
            <Button
              onClick={completeSale}
              loading={saving}
              disabled={hasProblem || cart.length === 0}
              className="flex-1 bg-white text-teal-brand hover:bg-teal-soft"
            >
              {saving ? "Saving…" : "Complete sale"}
            </Button>
          </div>
          {hasProblem && <p className="mt-2 text-xs text-coral-soft">Fix the items marked in red first.</p>}
        </div>

        {receipt && (
          <div className="rounded-2xl border border-teal-brand/30 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-bold text-teal-dark">✓ Sale #{receipt.sale_id} saved</p>
              <Button variant="secondary" className="px-3 py-1 text-xs print:hidden" onClick={() => window.print()}>
                Print
              </Button>
            </div>
            <ul className="space-y-1 text-sm">
              {receipt.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {l.quantity} × {l.medicine}
                    <span className="block text-xs text-muted">
                      batch {l.batch_no} · exp {formatDate(l.expiry_date)}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatPKR(l.quantity * Number(l.unit_price))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-teal-line pt-2 text-right font-bold">Total {formatPKR(Number(receipt.total))}</p>
          </div>
        )}

        <div className="rounded-2xl border border-teal-line bg-white p-4 text-xs text-muted">
          <p className="mb-1 font-semibold text-ink">How FEFO works</p>
          The earliest-expiring batch is always sold first. When it runs out, the next batch is used. Expired batches are blocked,
          and the database locks the batch rows while saving so two counters can never sell the same unit.
        </div>
      </aside>
    </div>
  );
}
