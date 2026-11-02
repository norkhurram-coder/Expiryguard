import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import MedicineForm from "@/components/medicines/MedicineForm";
import { getCurrentUser, requireRole } from "@/lib/auth";

export default async function NewMedicinePage() {
  const { role } = await getCurrentUser();
  requireRole(role, ["admin", "pharmacist"]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add medicine" subtitle="Fields marked * are required." />
      <Card>
        <MedicineForm />
      </Card>
    </div>
  );
}
