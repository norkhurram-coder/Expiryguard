import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import BatchForm from "@/components/batches/BatchForm";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { getBatchFormOptions } from "@/lib/batch-options";

export default async function NewBatchPage() {
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);
  const { medicines, suppliers } = await getBatchFormOptions(supabase);

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Add batch (purchase entry)" subtitle="Record new stock with its batch number and expiry date." />
      {(medicines.length === 0 || suppliers.length === 0) && (
        <Alert kind="warning">You need at least one medicine and one supplier before adding a batch.</Alert>
      )}
      <Card>
        <BatchForm medicines={medicines} suppliers={suppliers} />
      </Card>
    </div>
  );
}
