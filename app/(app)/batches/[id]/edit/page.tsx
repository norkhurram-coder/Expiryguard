import { notFound, redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import BatchForm from "@/components/batches/BatchForm";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { getBatchFormOptions } from "@/lib/batch-options";
import { isExpired } from "@/lib/expiry";
import type { Batch } from "@/lib/types";

export default async function EditBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  const { data } = await supabase
    .from("batches")
    .select("id, medicine_id, supplier_id, batch_no, expiry_date, quantity, purchase_price, sale_price")
    .eq("id", Number(id))
    .maybeSingle();
  if (!data) notFound();

  const batch = data as Batch;
  if (isExpired(batch.expiry_date)) redirect("/batches"); // quarantined batches can't be edited

  const { medicines, suppliers } = await getBatchFormOptions(supabase);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit batch" subtitle={`Batch ${batch.batch_no}`} />
      <Card>
        <BatchForm batch={batch} medicines={medicines} suppliers={suppliers} />
      </Card>
    </div>
  );
}
