import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import MedicinesTable from "@/components/medicines/MedicinesTable";
import { getCurrentUser } from "@/lib/auth";
import { canDelete, canEdit } from "@/lib/constants";
import { isExpired } from "@/lib/expiry";
import type { Medicine } from "@/lib/types";

export default async function MedicinesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { supabase, role } = await getCurrentUser();

  const [medResult, batchResult] = await Promise.all([
    supabase.from("medicines").select("*").order("brand_name"),
    supabase.from("batches").select("medicine_id, quantity, expiry_date"),
  ]);

  // Sellable stock per medicine = total quantity of batches that are not expired
  const batches = (batchResult.data ?? []) as { medicine_id: number; quantity: number; expiry_date: string }[];
  const medicines = ((medResult.data ?? []) as Medicine[]).map((m) => ({
    ...m,
    inStock: batches
      .filter((b) => b.medicine_id === m.id && !isExpired(b.expiry_date))
      .reduce((sum, b) => sum + b.quantity, 0),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Medicines"
        subtitle="Your medicine catalogue. Stock shown excludes expired batches."
        action={canEdit(role) ? <ButtonLink href="/medicines/new">+ Add medicine</ButtonLink> : undefined}
      />
      {saved && <Alert kind="success">Medicine {saved === "updated" ? "updated" : "added"} successfully.</Alert>}
      {medResult.error && <Alert kind="error">Could not load medicines: {medResult.error.message}</Alert>}
      <Card>
        <MedicinesTable medicines={medicines} canEdit={canEdit(role)} canDelete={canDelete(role)} />
      </Card>
    </div>
  );
}
