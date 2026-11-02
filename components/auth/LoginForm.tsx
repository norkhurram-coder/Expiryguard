"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginValues } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

export default function LoginForm({ justSignedUp }: { justSignedUp: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setServerError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setServerError(
        error.message === "Invalid login credentials" ? "Wrong email or password. Please try again." : error.message
      );
      return;
    }
    setSuccess("Logged in! Opening your dashboard…");
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {justSignedUp && <Alert kind="success">Account created. Please log in.</Alert>}
      {serverError && <Alert kind="error">{serverError}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

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
        placeholder="Your password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        registration={register("password")}
      />

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-teal-brand hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
