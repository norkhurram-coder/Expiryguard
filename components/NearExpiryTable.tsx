"use client";

import { useState } from "react";
import { SearchBox, Table, Td } from "@/components/ui/Table";
import { ExpiryBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { daysUntil, lastReturnDate } from "@/lib/expiry";
import { formatDate } from "@/lib/format";
import type { BatchWithDetails } from "@/lib/types";

/** Near-expiry table with a search box. */
export default function NearExpiryTable({ batches }: { batches: BatchWithDetails[] }) {
  const [search, setSearch] = useState("");

  // Keep only the rows whose medicine, batch number or supplier contains the search text
  const term = search.toLowerCase();
  const shown = batches.filter((b) =>
    [b.medicines?.brand_name ?? "", b.batch_no, b.suppliers?.name ?? ""].some((v) =>
      v.toLowerCase().includes(term)
    )
  );

  if (batches.length === 0) {
    return <EmptyState title="Nothing expires in the next 90 days" />;
  }

  return (
    <div className="space-y-4">
      <SearchBox value={search} onChange={setSearch} placeholder="Search by medicine or batch…" />

      <Table headers={["Medicine", "Batch", "Expiry date", "Days left", "Qty", "Status", "Last return date"]}>
        {shown.map((b) => {
          const returnWindow = b.suppliers?.return_window_days;
          const returnBy = returnWindow !== undefined ? lastReturnDate(b.expiry_date, returnWindow) : null;
          const returnPassed = returnBy !== null && daysUntil(returnBy) < 0;
          return (
            <tr key={b.id} className="hover:bg-teal-soft/40">
              <Td className="font-semibold">
                {b.medicines?.brand_name} <span className="font-normal text-muted">{b.medicines?.strength}</span>
              </Td>
              <Td>{b.batch_no}</Td>
              <Td>{formatDate(b.expiry_date)}</Td>
              <Td>{daysUntil(b.expiry_date)}</Td>
              <Td>{b.quantity}</Td>
              <Td>
                <ExpiryBadge expiryDate={b.expiry_date} />
              </Td>
              <Td>
                {returnBy === null ? (
                  <span className="text-muted">—</span>
                ) : returnPassed ? (
                  <span className="text-muted line-through">{formatDate(returnBy)}</span>
                ) : (
                  formatDate(returnBy)
                )}
              </Td>
            </tr>
          );
        })}
      </Table>

      {shown.length === 0 && <p className="text-center text-sm text-muted">No batch matches “{search}”.</p>}
    </div>
  );
}
