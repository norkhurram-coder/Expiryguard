"use client";

// DASHBOARD MEDICINE SEARCH
// Type a brand name, generic name, rack or batch number to see that medicine's stock at a glance:
// how much can still be sold, its nearest expiry (with the Factory's colour badge) and every batch.
// Filtering happens in the browser, so results update instantly while typing.
import { useState } from "react";
import { SearchBox } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { ExpiryAlertFactory } from "@/lib/patterns/ExpiryAlertFactory";
import { saleSearchSchema } from "@/lib/validation";
import { formatDate } from "@/lib/format";

export type SearchMedicine = {
  id: number;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  category: string;
  rack_location: string | null;
  min_stock_level: number;
};
export type SearchBatch = { id: number; medicine_id: number; batch_no: string; expiry_date: string; quantity: number };

const MAX_RESULTS = 8;

export default function MedicineSearch({ medicines, batches }: { medicines: SearchMedicine[]; batches: SearchBatch[] }) {
  const [search, setSearch] = useState("");

  // Same input rule as the sales search box (letters, numbers, spaces and - . / +).
  const check = saleSearchSchema.safeParse(search);
  const error = check.success ? "" : check.error.issues[0].message;
  const term = error ? "" : search.trim().toLowerCase();

  const results = term
    ? medicines.filter((m) => {
        const own = batches.filter((b) => b.medicine_id === m.id);
        return [m.brand_name, m.generic_name, m.category, m.rack_location ?? "", ...own.map((b) => b.batch_no)].some((v) =>
          v.toLowerCase().includes(term)
        );
      })
    : [];

  return (
    <div className="space-y-4">
      <div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search medicine, generic name, rack or batch no…" />
        {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
      </div>

      {term && results.length === 0 && (
        <p className="rounded-lg border border-dashed border-teal-line bg-teal-soft/40 px-4 py-6 text-center text-sm text-muted">
          No medicine matches “{search.trim()}”.
        </p>
      )}

      {results.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.slice(0, MAX_RESULTS).map((m) => {
            const own = batches
              .filter((b) => b.medicine_id === m.id && b.quantity > 0)
              .map((b) => ({ ...b, alert: ExpiryAlertFactory.create(b.expiry_date) }))
              .sort((a, b) => a.alert.daysLeft - b.alert.daysLeft);
            const sellable = own.filter((b) => b.alert.canSell);
            const inStock = sellable.reduce((sum, b) => sum + b.quantity, 0);
            const nearest = sellable[0];
            const low = inStock < m.min_stock_level;

            return (
              <li key={m.id} className="rounded-xl border border-teal-line bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {m.brand_name} <span className="font-normal text-muted">{m.strength}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {m.generic_name} · {m.dosage_form} · {m.category}
                      {m.rack_location ? ` · Rack ${m.rack_location}` : ""}
                    </p>
                  </div>
                  {nearest ? <Badge color={nearest.alert.color}>{nearest.alert.label}</Badge> : <Badge color="red">No sellable stock</Badge>}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-teal-soft/60 p-2">
                    <p className="text-muted">Sellable</p>
                    <p className={`text-lg font-bold ${low ? "text-coral" : "text-teal-brand"}`}>{inStock}</p>
                  </div>
                  <div className="rounded-lg bg-teal-soft/60 p-2">
                    <p className="text-muted">Minimum</p>
                    <p className="text-lg font-bold text-ink">{m.min_stock_level}</p>
                  </div>
                  <div className="rounded-lg bg-teal-soft/60 p-2">
                    <p className="text-muted">Next expiry</p>
                    <p className="text-sm font-bold text-ink">{nearest ? formatDate(nearest.expiry_date) : "—"}</p>
                  </div>
                </div>

                {own.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs">
                    {own.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2">
                        <span>
                          Batch <b>{b.batch_no}</b> · {b.quantity} units · {formatDate(b.expiry_date)}
                        </span>
                        <Badge color={b.alert.color}>{b.alert.label}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {low && <p className="mt-2 text-xs font-semibold text-coral">Below minimum stock – reorder.</p>}
              </li>
            );
          })}
        </ul>
      )}
      {results.length > MAX_RESULTS && (
        <p className="text-xs text-muted">
          Showing {MAX_RESULTS} of {results.length} matches – type more to narrow it down.
        </p>
      )}
    </div>
  );
}
