import { notFound } from "next/navigation";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import SupplierForm from "@/components/suppliers/SupplierForm";
import { getCurrentUser, requireRole } from "@/lib/auth";
import type { Supplier } from "@/lib/types";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  const { data } = await supabase.from("suppliers").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit supplier" subtitle={(data as Supplier).name} />
      <Card>
        <SupplierForm supplier={data as Supplier} />
      </Card>
    </div>
  );
}
