"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_RULES, signupSchema, type SignupValues } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

export default function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema), mode: "onTouched" });

  const password = watch("password") ?? "";

  async function onSubmit(values: SignupValues) {
    setServerError("");
    const supabase = createClient();

    // The extra details go into "data"; a database trigger copies them into the profiles table.
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          age: values.age,
          phone: values.phone,
          role: values.role,
        },
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    if (data.session) {
      // "Confirm email" is OFF → the user is logged in straight away.
      setSuccess("Account created! Opening your dashboard…");
      router.push("/");
      router.refresh();
    } else {
      // "Confirm email" is ON → the user must click the link in their email first.
      setSuccess("Account created! Check your email to confirm it, then log in.");
      setTimeout(() => router.push("/login?signedup=1"), 2500);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <Alert kind="error">{serverError}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <Input
        label="Full name"
        placeholder="e.g. Noor ul Haya"
        autoComplete="name"
        maxLength={50}
        required
        error={errors.full_name?.message}
        registration={register("full_name")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Age"
          type="number"
          min={18}
          max={70}
          step={1}
          placeholder="18–70"
          required
          error={errors.age?.message}
          registration={register("age", { valueAsNumber: true })}
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
      </div>

      <Select
        label="Role"
        placeholder="Choose your role"
        options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
        required
        error={errors.role?.message}
        registration={register("role")}
      />

      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        maxLength={100}
        required
        error={errors.email?.message}
        registration={register("email")}
      />

      <Input
        label="Password"
        type="password"
        placeholder="Create a strong password"
        autoComplete="new-password"
        maxLength={72}
        required
        error={errors.password?.message}
        registration={register("password")}
      />

      {/* Live checklist: each rule turns green when it is met */}
      <ul className="grid gap-1 rounded-lg bg-teal-soft/60 p-3 text-xs sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className={ok ? "font-semibold text-teal-brand" : "text-muted"}>
              {ok ? "✓" : "○"} {rule.label}
            </li>
          );
        })}
      </ul>

      <Input
        label="Confirm password"
        type="password"
        placeholder="Type the password again"
        autoComplete="new-password"
        maxLength={72}
        required
        error={errors.confirm_password?.message}
        registration={register("confirm_password")}
      />

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-teal-brand hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
