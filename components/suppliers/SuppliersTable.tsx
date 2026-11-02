"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import { SearchBox, Table, Td } from "@/components/ui/Table";
import Button, { ButtonLink } from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";

type Props = { suppliers: Supplier[]; canEdit: boolean; canDelete: boolean };

export default function SuppliersTable({ suppliers, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const term = search.toLowerCase();
  const shown = suppliers.filter((s) =>
    [s.name, s.contact_person, s.phone, s.email].some((v) => v.toLowerCase().includes(term))
  );

  async function handleDelete(s: Supplier) {
    if (!confirm(`Delete supplier "${s.name}"? This cannot be undone.`)) return;
    setError("");
    setDeletingId(s.id);
    const { error } = await createClient().from("suppliers").delete().eq("id", s.id);
    setDeletingId(null);
    if (error) {
      setError(friendlyError(error).replace("a medicine that still has batches", "a supplier that still has batches"));
      return;
    }
    router.refresh();
  }

  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="No suppliers yet – add your first one"
        message="Suppliers are needed before you can record purchase batches."
        action={canEdit ? <ButtonLink href="/suppliers/new">+ Add supplier</ButtonLink> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <SearchBox value={search} onChange={setSearch} placeholder="Search by name, contact, phone…" />

      <Table headers={["Supplier", "Contact person", "Phone", "Email", "Return window", "Actions"]}>
        {shown.map((s) => (
          <tr key={s.id} className="hover:bg-teal-soft/40">
            <Td className="font-semibold">{s.name}</Td>
            <Td>{s.contact_person}</Td>
            <Td>{s.phone}</Td>
            <Td>{s.email}</Td>
            <Td>{s.return_window_days} days</Td>
            <Td>
              <div className="flex gap-2">
                {canEdit && (
                  <ButtonLink href={`/suppliers/${s.id}/edit`} variant="secondary" className="px-3 py-1 text-xs">
                    Edit
                  </ButtonLink>
                )}
                {canDelete && (
                  <Button variant="danger" className="px-3 py-1 text-xs" loading={deletingId === s.id} onClick={() => handleDelete(s)}>
                    Delete
                  </Button>
                )}
                {!canEdit && !canDelete && <span className="text-xs text-muted">View only</span>}
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      {shown.length === 0 && <p className="text-center text-sm text-muted">No supplier matches “{search}”.</p>}
    </div>
  );
}
