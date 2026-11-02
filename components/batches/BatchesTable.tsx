"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isExpired } from "@/lib/expiry";
import { formatDate, formatPKR, friendlyError } from "@/lib/format";
import type { BatchWithDetails } from "@/lib/types";
import { SearchBox, Table, Td } from "@/components/ui/Table";
import Button, { ButtonLink } from "@/components/ui/Button";
import Badge, { ExpiryBadge } from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";

type Props = { batches: BatchWithDetails[]; canEdit: boolean; canDelete: boolean };

export default function BatchesTable({ batches, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const term = search.toLowerCase();
  const shown = batches.filter((b) =>
    [b.batch_no, b.medicines?.brand_name ?? "", b.suppliers?.name ?? ""].some((v) => v.toLowerCase().includes(term))
  );

  async function handleDelete(b: BatchWithDetails) {
    if (!confirm(`Delete batch ${b.batch_no} of ${b.medicines?.brand_name}? This cannot be undone.`)) return;
    setError("");
    setDeletingId(b.id);
    const { error } = await createClient().from("batches").delete().eq("id", b.id);
    setDeletingId(null);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    router.refresh();
  }

  if (batches.length === 0) {
    return (
      <EmptyState
        title="No batches yet – record your first purchase"
        message="Each purchase is saved as a batch with its own expiry date."
        action={canEdit ? <ButtonLink href="/batches/new">+ Add batch</ButtonLink> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <SearchBox value={search} onChange={setSearch} placeholder="Search by batch, medicine, supplier…" />

      <Table headers={["Medicine", "Batch no.", "Expiry", "Status", "Qty", "Buy / Sell", "Supplier", "Actions"]}>
        {shown.map((b) => {
          const expired = isExpired(b.expiry_date);
          return (
            <tr key={b.id} className={expired ? "bg-red-50/50" : "hover:bg-teal-soft/40"}>
              <Td className="font-semibold">
                {b.medicines?.brand_name} <span className="font-normal text-muted">{b.medicines?.strength}</span>
              </Td>
              <Td>{b.batch_no}</Td>
              <Td>{formatDate(b.expiry_date)}</Td>
              <Td>
                <ExpiryBadge expiryDate={b.expiry_date} />
              </Td>
              <Td>{b.quantity}</Td>
              <Td className="whitespace-nowrap text-xs">
                {formatPKR(b.purchase_price)} / {formatPKR(b.sale_price)}
              </Td>
              <Td>{b.suppliers?.name ?? "—"}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  {/* Expired batches are quarantined: they can be deleted but not edited */}
                  {canEdit && !expired && (
                    <ButtonLink href={`/batches/${b.id}/edit`} variant="secondary" className="px-3 py-1 text-xs">
                      Edit
                    </ButtonLink>
                  )}
                  {canEdit && expired && <Badge color="red">Quarantined</Badge>}
                  {canDelete && (
                    <Button variant="danger" className="px-3 py-1 text-xs" loading={deletingId === b.id} onClick={() => handleDelete(b)}>
                      Delete
                    </Button>
                  )}
                  {!canEdit && !canDelete && <span className="text-xs text-muted">View only</span>}
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
      {shown.length === 0 && <p className="text-center text-sm text-muted">No batch matches “{search}”.</p>}
    </div>
  );
}
