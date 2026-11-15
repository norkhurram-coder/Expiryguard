"use client";

// MULTITHREADING in ExpiryGuard (Lab Exercise 5).
// JavaScript normally runs everything on ONE main thread. A Web Worker is a real
// background thread. Here we start TWO workers at the same time:
//   Thread 1: public/workers/expiry-scanner.js  → expiry status of every batch
//   Thread 2: public/workers/stock-checker.js   → low stock of every medicine
// The threads talk to the main thread only by sending messages (postMessage),
// so they never change the same data at once and need no locking.
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { todayISO } from "@/lib/expiry";
import { formatPKR } from "@/lib/format";
import type { BatchWithDetails, Medicine } from "@/lib/types";

type Counts = { expired: number; within30: number; within60: number; within90: number; safe: number };
type ExpiryResult = { counts: Counts; valueAtRisk: number; returnAlerts: string[] };

export default function BackgroundScan({ batches, medicines }: { batches: BatchWithDetails[]; medicines: Medicine[] }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [expiryResult, setExpiryResult] = useState<ExpiryResult | null>(null);
  const [lowStock, setLowStock] = useState<string[] | null>(null);
  const [running, setRunning] = useState(0); // how many threads are still working
  const [ticks, setTicks] = useState(0); // proves the main thread is not blocked
  const workers = useRef<Worker[]>([]);

  // While threads run, the main thread keeps counting – the page never freezes.
  useEffect(() => {
    if (running === 0) return;
    const timer = setInterval(() => setTicks((t) => t + 1), 100);
    return () => clearInterval(timer);
  }, [running]);

  // Stop the threads if the user leaves the page.
  useEffect(() => () => workers.current.forEach((w) => w.terminate()), []);

  function addLog(thread: string, text: string) {
    const time = new Date().toLocaleTimeString("en-GB");
    setLogs((old) => [...old, `${time}  [${thread}]  ${text}`]);
  }

  function startScan() {
    setLogs([]);
    setExpiryResult(null);
    setLowStock(null);
    setTicks(0);
    setRunning(2);

    const today = todayISO();
    const simpleBatches = batches.map((b) => ({
      medicine_id: b.medicine_id,
      name: `${b.medicines?.brand_name ?? "Medicine"} ${b.medicines?.strength ?? ""}`.trim(),
      batch_no: b.batch_no,
      expiry_date: b.expiry_date,
      quantity: b.quantity,
      purchase_price: Number(b.purchase_price),
      return_window_days: b.suppliers?.return_window_days ?? null,
    }));
    const simpleMedicines = medicines.map((m) => ({
      id: m.id,
      name: `${m.brand_name} ${m.strength}`,
      min_stock_level: m.min_stock_level,
    }));

    addLog("Main", "Starting 2 background threads…");

    // THREAD 1: Expiry Scanner
    const expiryWorker = new Worker("/workers/expiry-scanner.js");
    expiryWorker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "log") addLog("Expiry Scanner", msg.text);
      if (msg.type === "done") {
        setExpiryResult(msg);
        addLog("Expiry Scanner", "Finished ✓");
        expiryWorker.terminate();
        setRunning((r) => r - 1);
      }
    };

    // THREAD 2: Stock Checker
    const stockWorker = new Worker("/workers/stock-checker.js");
    stockWorker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "log") addLog("Stock Checker", msg.text);
      if (msg.type === "done") {
        setLowStock(msg.lowStock);
        addLog("Stock Checker", "Finished ✓");
        stockWorker.terminate();
        setRunning((r) => r - 1);
      }
    };

    workers.current = [expiryWorker, stockWorker];

    // Send each thread its data – both start working at the same time
    expiryWorker.postMessage({ batches: simpleBatches, today });
    stockWorker.postMessage({ medicines: simpleMedicines, batches: simpleBatches, today });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={startScan} loading={running > 0}>
          {running > 0 ? `Scanning… (${running} threads running)` : "Run background scan"}
        </Button>
        {(running > 0 || ticks > 0) && (
          <span className="text-sm text-muted">
            Main thread still responsive: <b className="text-teal-brand">{ticks}</b> ticks
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <pre className="max-h-72 overflow-y-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-teal-soft">
          {logs.join("\n")}
        </pre>
      )}

      {running === 0 && expiryResult && lowStock && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-teal-line p-4">
            <p className="mb-2 font-semibold text-teal-brand">Expiry Scanner result</p>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge color="red">Expired: {expiryResult.counts.expired}</Badge>
              <Badge color="orange">≤ 30 days: {expiryResult.counts.within30}</Badge>
              <Badge color="yellow">≤ 60 days: {expiryResult.counts.within60}</Badge>
              <Badge color="teal">≤ 90 days: {expiryResult.counts.within90}</Badge>
            </div>
            <p className="text-sm">
              Stock value at risk: <b className="text-coral">{formatPKR(expiryResult.valueAtRisk)}</b>
            </p>
            <p className="mt-2 text-sm font-semibold">Return deadlines in the next 7 days:</p>
            <ul className="list-inside list-disc text-sm text-muted">
              {expiryResult.returnAlerts.length === 0 ? <li>None</li> : expiryResult.returnAlerts.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-teal-line p-4">
            <p className="mb-2 font-semibold text-teal-brand">Stock Checker result</p>
            <ul className="list-inside list-disc text-sm text-muted">
              {lowStock.length === 0 ? <li>All medicines above minimum level</li> : lowStock.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
