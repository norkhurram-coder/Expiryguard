import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import SuppliersTable from "@/components/suppliers/SuppliersTable";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { canDelete, canEdit } from "@/lib/constants";
import type { Supplier } from "@/lib/types";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]); // Sales Staff can't see suppliers

  const { data, error } = await supabase.from("suppliers").select("*").order("name");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        subtitle="Distributors you buy from, and how long before expiry they accept returns."
        action={canEdit(role) ? <ButtonLink href="/suppliers/new">+ Add supplier</ButtonLink> : undefined}
      />
      {saved && <Alert kind="success">Supplier {saved === "updated" ? "updated" : "added"} successfully.</Alert>}
      {error && <Alert kind="error">Could not load suppliers: {error.message}</Alert>}
      <Card>
        <SuppliersTable suppliers={(data ?? []) as Supplier[]} canEdit={canEdit(role)} canDelete={canDelete(role)} />
      </Card>
    </div>
  );
}
