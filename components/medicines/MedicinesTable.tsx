"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import type { Medicine } from "@/lib/types";
import { SearchBox, Table, Td } from "@/components/ui/Table";
import Button, { ButtonLink } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";

type MedicineRow = Medicine & { inStock: number };
type Props = { medicines: MedicineRow[]; canEdit: boolean; canDelete: boolean };

export default function MedicinesTable({ medicines, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const term = search.toLowerCase();
  const shown = medicines.filter((m) =>
    [m.brand_name, m.generic_name, m.category, m.rack_location ?? ""].some((v) => v.toLowerCase().includes(term))
  );

  async function handleDelete(m: Medicine) {
    if (!confirm(`Delete "${m.brand_name} ${m.strength}"? This cannot be undone.`)) return;
    setError("");
    setDeletingId(m.id);
    const { error } = await createClient().from("medicines").delete().eq("id", m.id);
    setDeletingId(null);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    router.refresh();
  }

  if (medicines.length === 0) {
    return (
      <EmptyState
        title="No medicines yet – add your first one"
        message="Add each medicine once. Stock is then added as batches."
        action={canEdit ? <ButtonLink href="/medicines/new">+ Add medicine</ButtonLink> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <SearchBox value={search} onChange={setSearch} placeholder="Search by brand, generic, category…" />

      <Table headers={["Brand", "Generic", "Strength", "Form", "Category", "Rack", "In stock", "Actions"]}>
        {shown.map((m) => {
          const low = m.inStock < m.min_stock_level;
          return (
            <tr key={m.id} className="hover:bg-teal-soft/40">
              <Td className="font-semibold">{m.brand_name}</Td>
              <Td>{m.generic_name}</Td>
              <Td>{m.strength}</Td>
              <Td className="capitalize">{m.dosage_form}</Td>
              <Td>{m.category}</Td>
              <Td>{m.rack_location ?? "—"}</Td>
              <Td>
                <span className="mr-2 font-semibold">{m.inStock}</span>
                {low && <Badge color="orange">Low</Badge>}
              </Td>
              <Td>
                <div className="flex gap-2">
                  {canEdit && (
                    <ButtonLink href={`/medicines/${m.id}/edit`} variant="secondary" className="px-3 py-1 text-xs">
                      Edit
                    </ButtonLink>
                  )}
                  {canDelete && (
                    <Button variant="danger" className="px-3 py-1 text-xs" loading={deletingId === m.id} onClick={() => handleDelete(m)}>
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
      {shown.length === 0 && <p className="text-center text-sm text-muted">No medicine matches “{search}”.</p>}
    </div>
  );
}
