// Loads the medicine and supplier dropdown options for the batch form.
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getBatchFormOptions(supabase: ServerClient) {
  const [medResult, supResult] = await Promise.all([
    supabase.from("medicines").select("id, brand_name, strength, dosage_form").order("brand_name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  type MedicineOption = { id: number; brand_name: string; strength: string; dosage_form: string };
  type SupplierOption = { id: number; name: string };

  const medicines = ((medResult.data ?? []) as MedicineOption[]).map((m) => ({
    value: m.id,
    label: `${m.brand_name} ${m.strength} (${m.dosage_form})`,
  }));
  const suppliers = ((supResult.data ?? []) as SupplierOption[]).map((s) => ({ value: s.id, label: s.name }));

  return { medicines, suppliers };
}
