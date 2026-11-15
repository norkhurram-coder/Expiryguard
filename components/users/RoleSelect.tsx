"use client";

// Admin changes a user's role. Row Level Security allows this only for the Admin,
// and a database trigger stops the last Admin from being demoted.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLES } from "@/lib/constants";
import { friendlyError } from "@/lib/format";

export default function RoleSelect({ userId, role, isMe }: { userId: string; role: string; isMe: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function change(newRole: string) {
    if (newRole === role) return;
    if (isMe && !confirm("You are changing YOUR OWN role and may lose Admin access. Continue?")) return;
    setSaving(true);
    setError("");
    const { error } = await createClient().from("profiles").update({ role: newRole }).eq("id", userId);
    setSaving(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        value={role}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        aria-label="Role"
        className="rounded-lg border border-teal-line bg-white px-2 py-1 text-sm disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
