"use client";

// "Dispose" (expired batch, FR-13) or "Return to supplier" (before the last return date, FR-12).
// Calls the database function write_off_batch, which checks the role and the dates again
// and writes the change to the audit log.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

type Props = { batchId: number; label: string; action: "disposal" | "return" };

export default function WriteOffButton({ batchId, label, action }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const question =
      action === "disposal"
        ? `Record that expired batch ${label} has been DISPOSED of? Its stock becomes 0 and the loss is recorded.`
        : `Record that batch ${label} has been RETURNED to the supplier? Its stock becomes 0.`;
    if (!confirm(question)) return;
    setLoading(true);
    const { error } = await createClient().rpc("write_off_batch", { p_batch_id: batchId, p_action: action });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant={action === "disposal" ? "danger" : "secondary"} className="px-3 py-1 text-xs" loading={loading} onClick={handleClick}>
      {action === "disposal" ? "Dispose" : "Return"}
    </Button>
  );
}
