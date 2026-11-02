"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { batchSchema, type BatchValues } from "@/lib/validation";
import { addDays, todayISO } from "@/lib/expiry";
import { friendlyError } from "@/lib/format";
import type { Batch } from "@/lib/types";
import { Input, Select } from "@/components/ui/Input";
import Button, { ButtonLink } from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

type Option = { value: number; label: string };
type Props = { batch?: Batch; medicines: Option[]; suppliers: Option[] };

/** Purchase entry (FR-02). Used for both "Add batch" and "Edit batch". */
export default function BatchForm({ batch, medicines, suppliers }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BatchValues>({
    resolver: zodResolver(batchSchema),
    mode: "onTouched",
    defaultValues: batch ?? { batch_no: "", expiry_date: "" },
  });

  // Warning (not an error) if selling below cost
  const purchasePrice = watch("purchase_price");
  const salePrice = watch("sale_price");
  const sellingAtLoss = purchasePrice > 0 && salePrice > 0 && salePrice < purchasePrice;

  async function onSubmit(values: BatchValues) {
    setServerError("");
    const supabase = createClient();
    const row = { ...values, batch_no: values.batch_no.toUpperCase() };

    const { error } = batch
      ? await supabase.from("batches").update(row).eq("id", batch.id)
      : await supabase.from("batches").insert(row);

    if (error) {
      setServerError(
        error.code === "23505" ? "This medicine already has a batch with this batch number." : friendlyError(error)
      );
      return;
    }
    setSuccess(batch ? "Batch updated." : "Batch added to stock.");
    router.push(`/batches?saved=${batch ? "updated" : "added"}`);
    router.refresh();
  }

  const tomorrow = addDays(todayISO(), 1);
  const tenYears = addDays(todayISO(), 3653);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <Alert kind="error">{serverError}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Medicine"
          placeholder={medicines.length ? "Choose a medicine" : "Add a medicine first"}
          options={medicines}
          required
          error={errors.medicine_id?.message}
          registration={register("medicine_id", { valueAsNumber: true })}
        />
        <Select
          label="Supplier"
          placeholder={suppliers.length ? "Choose a supplier" : "Add a supplier first"}
          options={suppliers}
          required
          error={errors.supplier_id?.message}
          registration={register("supplier_id", { valueAsNumber: true })}
        />
        <Input
          label="Batch number"
          placeholder="e.g. PN-2409"
          maxLength={30}
          required
          error={errors.batch_no?.message}
          registration={register("batch_no")}
        />
        <Input
          label="Expiry date"
          type="date"
          min={tomorrow}
          max={tenYears}
          required
          hint="Must be after today (expired stock is rejected)"
          error={errors.expiry_date?.message}
          registration={register("expiry_date")}
        />
        <Input
          label="Quantity (units)"
          type="number"
          min={1}
          max={100000}
          step={1}
          placeholder="e.g. 120"
          required
          error={errors.quantity?.message}
          registration={register("quantity", { valueAsNumber: true })}
        />
        <div className="hidden sm:block" />
        <Input
          label="Purchase price per unit (PKR)"
          type="number"
          min={0.01}
          step={0.01}
          placeholder="e.g. 1.80"
          required
          error={errors.purchase_price?.message}
          registration={register("purchase_price", { valueAsNumber: true })}
        />
        <Input
          label="Sale price per unit (PKR)"
          type="number"
          min={0.01}
          step={0.01}
          placeholder="e.g. 2.50"
          required
          error={errors.sale_price?.message}
          registration={register("sale_price", { valueAsNumber: true })}
        />
      </div>

      {sellingAtLoss && (
        <Alert kind="warning">
          The sale price is lower than the purchase price – this batch will be sold at a loss. You can still save it.
        </Alert>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "Saving…" : batch ? "Save changes" : "Add batch"}
        </Button>
        <ButtonLink href="/batches" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
