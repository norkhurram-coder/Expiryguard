import { notFound } from "next/navigation";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import MedicineForm from "@/components/medicines/MedicineForm";
import { getCurrentUser, requireRole } from "@/lib/auth";
import type { Medicine } from "@/lib/types";

export default async function EditMedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  const { data } = await supabase.from("medicines").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) notFound();
  const medicine = data as Medicine;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit medicine" subtitle={`${medicine.brand_name} ${medicine.strength}`} />
      <Card>
        <MedicineForm medicine={medicine} />
      </Card>
    </div>
  );
}
