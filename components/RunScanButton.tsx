"use client";

import { useState, useTransition } from "react";
import { runScanNow } from "@/app/(app)/alerts/actions";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

export default function RunScanButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="space-y-3">
      <Button
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            setResult(await runScanNow());
          })
        }
      >
        {pending ? "Scanning in worker threads…" : "Run scan now"}
      </Button>
      {result && <Alert kind={result.ok ? "success" : "error"}>{result.message}</Alert>}
    </div>
  );
}
