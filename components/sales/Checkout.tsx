"use client";

// SALES SCREEN (FR-04, FR-05, FR-06, NFR-05)
// • Type a name or scan a barcode (a scanner "types" the code and presses Enter).
// • For each item the screen shows which batch(es) FEFO will use – earliest expiry first.
// • Expired batches are never offered (FR-05), and batches expiring within 30 days show a warning (FR-06).
// • "Complete sale" calls the database function process_sale, which repeats the FEFO rules
//   inside one locked transaction, so the stock can't be oversold even with two counters.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { allocateFefo, daysUntil, getExpiryStatus, isExpired } from "@/lib/expiry";
import { formatDate, formatPKR } from "@/lib/format";
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
  barcode: string | null;
};
export type CheckoutBatch = { id: number; medicine_id: number; batch_no: string; expiry_date: string; quantity: number; sale_price: number };

type CartLine = { medicineId: number; quantity: number };
type Receipt = {
  sale_id: number;
  total: number;
  lines: { medicine: string; batch_no: string; expiry_date: string; quantity: number; unit_price: number }[];
};

export default function Checkout({ medicines, batches }: { medicines: CheckoutMedicine[]; batches: CheckoutBatch[] }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const byId = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);
  const batchesOf = (medicineId: number) => batches.filter((b) => b.medicine_id === medicineId);
  const inDateStock = (medicineId: number) =>
    batchesOf(medicineId)
      .filter((b) => !isExpired(b.expiry_date))
      .reduce((sum, b) => sum + b.quantity, 0);

  const term = search.trim().toLowerCase();
  const results = term
    ? medicines
        .filter((m) => [m.brand_name, m.generic_name, m.barcode ?? ""].some((v) => v.toLowerCase().includes(term)))
        .slice(0, 8)
    : [];

  function addToCart(medicineId: number) {
    setError("");
    setReceipt(null);
    setCart((old) => {
      const existing = old.find((l) => l.medicineId === medicineId);
      if (existing) return old.map((l) => (l.medicineId === medicineId ? { ...l, quantity: l.quantity + 1 } : l));
      return [...old, { medicineId, quantity: 1 }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  // Enter in the search box: exact barcode first (scanner), otherwise the only match.
  function onSearchEnter() {
    const exact = medicines.find((m) => m.barcode && m.barcode.toLowerCase() === term);
    if (exact) return addToCart(exact.id);
    if (results.length === 1) return addToCart(results[0].id);
    if (results.length === 0 && term) setError(`No medicine matches "${search}".`);
  }

  function setQuantity(medicineId: number, quantity: number) {
    if (!Number.isFinite(quantity)) return;
    setCart((old) => old.map((l) => (l.medicineId === medicineId ? { ...l, quantity: Math.max(1, Math.min(10000, Math.floor(quantity))) } : l)));
  }

  // FEFO plan for every cart line (the same rules process_sale uses)
  const plan = cart.map((line) => {
    const medicine = byId.get(line.medicineId)!;
    const own = batchesOf(line.medicineId);
    const { lines, shortBy } = allocateFefo(own, line.quantity);
    const blockedExpired = own.filter((b) => isExpired(b.expiry_date));
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * Number(l.batch.sale_price), 0);
    return { line, medicine, lines, shortBy, blockedExpired, subtotal };
  });
  const total = plan.reduce((sum, p) => sum + p.subtotal, 0);
  const hasProblem = plan.some((p) => p.shortBy > 0);

  async function completeSale() {
    setError("");
    setSaving(true);
    const { data, error } = await createClient().rpc("process_sale", {
      p_items: cart.map((l) => ({ medicine_id: l.medicineId, quantity: l.quantity })),
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      router.refresh(); // someone else may have sold the stock – reload the latest quantities
      return;
    }
    setReceipt(data as Receipt);
    setCart([]);
    router.refresh();
    searchRef.current?.focus();
  }

  return (
    <div className="space-y-5">
      {/* Search / barcode */}
      <div className="relative">
        <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="sale-search">
          Medicine name or barcode
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
          placeholder="Type e.g. Panadol, or scan the barcode…"
          className="w-full rounded-lg border border-teal-line bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/30"
        />
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
                      <b>{m.brand_name}</b> {m.strength} <span className="text-muted">· {m.generic_name} · {m.dosage_form}</span>
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

      {receipt && (
        <div className="rounded-xl border border-teal-brand/30 bg-teal-soft p-4 print:border-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-teal-dark">✓ Sale #{receipt.sale_id} saved</p>
            <Button variant="secondary" className="px-3 py-1 text-xs print:hidden" onClick={() => window.print()}>
              Print receipt
            </Button>
          </div>
          <ul className="space-y-1 text-sm">
            {receipt.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {l.quantity} × {l.medicine} <span className="text-muted">(batch {l.batch_no}, exp {formatDate(l.expiry_date)})</span>
                </span>
                <span>{formatPKR(l.quantity * Number(l.unit_price))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-teal-line pt-2 text-right font-bold">Total {formatPKR(Number(receipt.total))}</p>
        </div>
      )}

      {/* Cart */}
      {cart.length === 0 ? (
        <p className="rounded-xl border border-dashed border-teal-line bg-teal-soft/40 px-4 py-8 text-center text-sm text-muted">
          The cart is empty. Search for a medicine or scan a barcode to start a sale.
        </p>
      ) : (
        <div className="space-y-3">
          {plan.map(({ line, medicine, lines, shortBy, blockedExpired, subtotal }) => (
            <div key={line.medicineId} className="rounded-xl border border-teal-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">
                  {medicine.brand_name} <span className="font-normal text-muted">{medicine.strength} · {medicine.dosage_form}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="One less" onClick={() => setQuantity(line.medicineId, line.quantity - 1)} className="h-8 w-8 rounded-lg border border-teal-line text-teal-brand hover:bg-teal-soft">
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={line.quantity}
                    onChange={(e) => setQuantity(line.medicineId, e.target.valueAsNumber)}
                    aria-label={`Quantity of ${medicine.brand_name}`}
                    className="w-20 rounded-lg border border-teal-line px-2 py-1 text-center text-sm"
                  />
                  <button type="button" aria-label="One more" onClick={() => setQuantity(line.medicineId, line.quantity + 1)} className="h-8 w-8 rounded-lg border border-teal-line text-teal-brand hover:bg-teal-soft">
                    +
                  </button>
                  <span className="w-28 text-right font-semibold">{formatPKR(subtotal)}</span>
                  <button type="button" onClick={() => setCart((old) => old.filter((l) => l.medicineId !== line.medicineId))} className="text-xs font-semibold text-coral hover:underline">
                    Remove
                  </button>
                </div>
              </div>

              {/* FEFO plan */}
              <ul className="mt-2 space-y-1 text-xs">
                {lines.map(({ batch, quantity }) => {
                  const soon = getExpiryStatus(batch.expiry_date) === "within30";
                  return (
                    <li key={batch.id} className="flex flex-wrap items-center gap-2">
                      <Badge color="teal">FEFO</Badge>
                      <span>
                        {quantity} from batch <b>{batch.batch_no}</b> · expires {formatDate(batch.expiry_date)} · {formatPKR(Number(batch.sale_price))} each
                      </span>
                      {soon && <Badge color="orange">⚠ Expires in {daysUntil(batch.expiry_date)} days – tell the customer (FR-06)</Badge>}
                    </li>
                  );
                })}
                {blockedExpired.length > 0 && (
                  <li className="text-red-700">
                    ⛔ Blocked: {blockedExpired.map((b) => `${b.batch_no} (expired ${formatDate(b.expiry_date)})`).join(", ")} – expired stock cannot be sold.
                  </li>
                )}
                {shortBy > 0 && (
                  <li className="font-semibold text-red-700">
                    Not enough in-date stock: only {line.quantity - shortBy} available. Reduce the quantity.
                  </li>
                )}
              </ul>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-soft p-4">
            <p className="text-lg font-bold text-teal-dark">Total: {formatPKR(total)}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCart([])} disabled={saving}>
                Clear
              </Button>
              <Button onClick={completeSale} loading={saving} disabled={hasProblem}>
                {saving ? "Saving sale…" : "Complete sale"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
