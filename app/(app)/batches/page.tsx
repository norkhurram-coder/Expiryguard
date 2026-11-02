import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import BatchesTable from "@/components/batches/BatchesTable";
import { getCurrentUser } from "@/lib/auth";
import { canDelete, canEdit } from "@/lib/constants";
import type { BatchWithDetails } from "@/lib/types";

export default async function BatchesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { supabase, role } = await getCurrentUser();

  const { data, error } = await supabase
    .from("batches")
    .select("*, medicines(brand_name, strength, dosage_form), suppliers(name, return_window_days)")
    .order("expiry_date", { ascending: true });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batches / Stock"
        subtitle="Every purchase batch, earliest expiry first."
        action={canEdit(role) ? <ButtonLink href="/batches/new">+ Add batch</ButtonLink> : undefined}
      />
      {saved && <Alert kind="success">Batch {saved === "updated" ? "updated" : "added to stock"} successfully.</Alert>}
      {error && <Alert kind="error">Could not load batches: {error.message}</Alert>}
      <Card>
        <BatchesTable batches={(data ?? []) as BatchWithDetails[]} canEdit={canEdit(role)} canDelete={canDelete(role)} />
      </Card>
    </div>
  );
}
