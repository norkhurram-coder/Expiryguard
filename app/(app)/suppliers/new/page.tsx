import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import SupplierForm from "@/components/suppliers/SupplierForm";
import { getCurrentUser, requireRole } from "@/lib/auth";

export default async function NewSupplierPage() {
  const { role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add supplier" subtitle="Fields marked * are required." />
      <Card>
        <SupplierForm />
      </Card>
    </div>
  );
}
