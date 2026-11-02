"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { medicineSchema, type MedicineValues } from "@/lib/validation";
import { CATEGORIES, DOSAGE_FORMS } from "@/lib/constants";
import { friendlyError } from "@/lib/format";
import type { Medicine } from "@/lib/types";
import { Input, Select } from "@/components/ui/Input";
import Button, { ButtonLink } from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/** Used for both "Add medicine" and "Edit medicine". */
export default function MedicineForm({ medicine }: { medicine?: Medicine }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MedicineValues>({
    resolver: zodResolver(medicineSchema),
    mode: "onTouched",
    defaultValues: medicine
      ? ({ ...medicine, rack_location: medicine.rack_location ?? "" } as MedicineValues)
      : { brand_name: "", generic_name: "", strength: "", rack_location: "", min_stock_level: 10 },
  });

  async function onSubmit(values: MedicineValues) {
    setServerError("");
    const supabase = createClient();
    const row = { ...values, rack_location: values.rack_location || null };

    const { error } = medicine
      ? await supabase.from("medicines").update(row).eq("id", medicine.id)
      : await supabase.from("medicines").insert(row);

    if (error) {
      setServerError(
        error.code === "23505" ? "A medicine with this brand name, strength and dosage form already exists." : friendlyError(error)
      );
      return;
    }
    setSuccess(medicine ? "Medicine updated." : "Medicine added.");
    router.push(`/medicines?saved=${medicine ? "updated" : "added"}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <Alert kind="error">{serverError}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Brand name"
          placeholder="e.g. Panadol"
          maxLength={100}
          required
          error={errors.brand_name?.message}
          registration={register("brand_name")}
        />
        <Input
          label="Generic name"
          placeholder="e.g. Paracetamol"
          maxLength={100}
          required
          error={errors.generic_name?.message}
          registration={register("generic_name")}
        />
        <Input
          label="Strength"
          placeholder="e.g. 500 mg or 120 mg/5 ml"
          maxLength={30}
          required
          error={errors.strength?.message}
          registration={register("strength")}
        />
        <Select
          label="Dosage form"
          placeholder="Choose a dosage form"
          options={DOSAGE_FORMS.map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))}
          required
          error={errors.dosage_form?.message}
          registration={register("dosage_form")}
        />
        <Select
          label="Category"
          placeholder="Choose a category"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          required
          error={errors.category?.message}
          registration={register("category")}
        />
        <Input
          label="Rack location"
          placeholder="e.g. A-3 (optional)"
          maxLength={20}
          error={errors.rack_location?.message}
          registration={register("rack_location")}
        />
        <Input
          label="Minimum stock level"
          type="number"
          min={0}
          max={10000}
          step={1}
          placeholder="e.g. 50"
          hint="You get a low-stock alert when stock falls below this"
          required
          error={errors.min_stock_level?.message}
          registration={register("min_stock_level", { valueAsNumber: true })}
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "Saving…" : medicine ? "Save changes" : "Add medicine"}
        </Button>
        <ButtonLink href="/medicines" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
