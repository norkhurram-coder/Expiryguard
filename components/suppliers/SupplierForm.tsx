"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { supplierSchema, type SupplierValues } from "@/lib/validation";
import { friendlyError } from "@/lib/format";
import type { Supplier } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import Button, { ButtonLink } from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/** Used for both "Add supplier" (no `supplier`) and "Edit supplier" (with `supplier`). */
export default function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
    mode: "onTouched",
    defaultValues: supplier
      ? { ...supplier, address: supplier.address ?? "" }
      : { name: "", contact_person: "", phone: "", email: "", address: "", return_window_days: 30 },
  });

  async function onSubmit(values: SupplierValues) {
    setServerError("");
    const supabase = createClient();
    const row = { ...values, address: values.address || null };

    const { error } = supplier
      ? await supabase.from("suppliers").update(row).eq("id", supplier.id)
      : await supabase.from("suppliers").insert(row);

    if (error) {
      setServerError(friendlyError(error));
      return;
    }
    setSuccess(supplier ? "Supplier updated." : "Supplier added.");
    router.push(`/suppliers?saved=${supplier ? "updated" : "added"}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <Alert kind="error">{serverError}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <Input
        label="Supplier name"
        placeholder="e.g. Mehran Pharma Distributors"
        maxLength={100}
        required
        error={errors.name?.message}
        registration={register("name")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Contact person"
          placeholder="e.g. Ahmed Raza"
          maxLength={50}
          required
          error={errors.contact_person?.message}
          registration={register("contact_person")}
        />
        <Input
          label="Phone"
          type="tel"
          inputMode="numeric"
          placeholder="03001234567"
          maxLength={11}
          required
          error={errors.phone?.message}
          registration={register("phone")}
        />
        <Input
          label="Email"
          type="email"
          placeholder="orders@supplier.com"
          maxLength={100}
          required
          error={errors.email?.message}
          registration={register("email")}
        />
        <Input
          label="Return window (days)"
          type="number"
          min={0}
          max={365}
          step={1}
          placeholder="e.g. 30"
          hint="How many days before expiry this supplier still accepts returns"
          required
          error={errors.return_window_days?.message}
          registration={register("return_window_days", { valueAsNumber: true })}
        />
      </div>
      <Input
        label="Address"
        placeholder="e.g. Saddar, Karachi (optional)"
        maxLength={200}
        error={errors.address?.message}
        registration={register("address")}
      />

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
        </Button>
        <ButtonLink href="/suppliers" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
