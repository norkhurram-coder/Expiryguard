"use client";

// PARALLEL EXPIRY SCAN (multithreading demo on the dashboard)
// 1. The batches are split into chunks – one chunk per thread.
// 2. The Singleton WorkerPool runs every chunk on its own Web Worker AT THE SAME TIME.
// 3. Each thread reports its progress; the lanes below fill up in parallel.
// 4. The main thread turns the results into alert objects with the ExpiryAlertFactory.
// While the threads work, the "main thread" counter keeps ticking – the page never freezes.
// Run it with 1 thread and then with 4 to compare the times.
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { WorkerPool, splitIntoChunks } from "@/lib/threads/WorkerPool";
import { ExpiryAlertFactory, type ExpiryAlert } from "@/lib/patterns/ExpiryAlertFactory";
import { todayISO } from "@/lib/expiry";
import { formatPKR } from "@/lib/format";

export type ScanBatch = {
  id: number;
  name: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
};

type Lane = { chunk: number; threadId: number | null; done: number; total: number; ms: number | null };
type ScanResult = { items: { id: number; daysLeft: number }[]; busyMs: number };
type Run = { threads: number; wallMs: number; cpuMs: number };
type Finding = { batch: ScanBatch; alert: ExpiryAlert };

const WORK_MS_PER_BATCH = 180; // simulated heavy work per batch, so the speed-up is visible
const THREAD_OPTIONS = [1, 2, 4];

export default function ParallelExpiryScan({ batches }: { batches: ScanBatch[] }) {
  const [threads, setThreads] = useState(4);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [running, setRunning] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState("");
  const startedThreads = useRef(0);

  // The main thread keeps counting while the workers are busy – proof that it is not blocked.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTicks((t) => t + 1), 50);
    return () => clearInterval(timer);
  }, [running]);

  async function startScan() {
    setError("");
    setFindings(null);
    setTicks(0);
    setRunning(true);

    const pool = WorkerPool.getInstance(4); // Singleton: the same 4-thread pool every time
    const chunks = splitIntoChunks(batches, threads);
    setLanes(chunks.map((c, i) => ({ chunk: i, threadId: null, done: 0, total: c.length, ms: null })));

    const today = todayISO();
    const started = performance.now();
    try {
      const results = await Promise.all(
        chunks.map((chunk, i) =>
          pool
            .run<ScanResult>(
              {
                today,
                workMs: WORK_MS_PER_BATCH,
                batches: chunk.map((b) => ({ id: b.id, expiry_date: b.expiry_date })),
              },
              (threadId, done, total) =>
                setLanes((old) => old.map((l) => (l.chunk === i ? { ...l, threadId, done, total } : l)))
            )
            .then((r) => {
              setLanes((old) => old.map((l) => (l.chunk === i ? { ...l, threadId: r.threadId, ms: r.ms } : l)));
              return r;
            })
        )
      );

      const wallMs = Math.round(performance.now() - started);
      const cpuMs = results.reduce((sum, r) => sum + r.result.busyMs, 0);
      setRuns((old) => [{ threads: chunks.length, wallMs, cpuMs }, ...old].slice(0, 5));
      startedThreads.current = pool.startedThreads;

      // FACTORY: turn every thread's raw "days left" into the right alert object.
      const byId = new Map(batches.map((b) => [b.id, b]));
      const all = results
        .flatMap((r) => r.result.items)
        .map((item) => {
          const batch = byId.get(item.id)!;
          return { batch, alert: ExpiryAlertFactory.fromDaysLeft(item.daysLeft, batch.expiry_date) };
        })
        .sort((a, b) => a.alert.priority - b.alert.priority || a.alert.daysLeft - b.alert.daysLeft);
      setFindings(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan failed.");
    } finally {
      setRunning(false);
    }
  }

  const counts = { expired: 0, within30: 0, within60: 0, within90: 0, safe: 0 };
  let valueAtRisk = 0;
  for (const f of findings ?? []) {
    counts[f.alert.level]++;
    if (f.alert.priority <= 1) valueAtRisk += f.batch.quantity * f.batch.purchase_price;
  }
  const urgent = (findings ?? []).filter((f) => f.alert.priority <= 2);
  const single = runs.find((r) => r.threads === 1);
  const latest = runs[0];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-teal-line bg-white p-1" role="group" aria-label="Number of threads">
          {THREAD_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={running}
              onClick={() => setThreads(n)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                threads === n ? "bg-teal-brand text-white" : "text-teal-brand hover:bg-teal-soft"
              }`}
            >
              {n} {n === 1 ? "thread" : "threads"}
            </button>
          ))}
        </div>
        <Button onClick={startScan} loading={running} disabled={batches.length === 0}>
          {running ? "Scanning in background…" : "Run parallel scan"}
        </Button>
        <span className="flex items-center gap-2 text-sm text-muted">
          <span className={`h-2.5 w-2.5 rounded-full ${running ? "animate-pulse bg-emerald-500" : "bg-gray-300"}`} />
          Main thread responsive: <b className="tabular-nums text-teal-brand">{ticks}</b> ticks
        </span>
      </div>

      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

      {/* One lane per thread */}
      {lanes.length > 0 && (
        <div className="space-y-2">
          {lanes.map((lane) => {
            const pct = lane.total === 0 ? 0 : Math.round((lane.done / lane.total) * 100);
            return (
              <div key={lane.chunk} className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-sm">
                <span className="font-semibold text-ink">
                  Thread {lane.threadId ?? "…"}
                  <span className="block text-xs font-normal text-muted">chunk {lane.chunk + 1}</span>
                </span>
                <div className="h-3 overflow-hidden rounded-full bg-teal-soft">
                  <div
                    className={`h-full rounded-full transition-[width] duration-150 ${lane.ms !== null ? "bg-teal-brand" : "bg-coral"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-muted">
                  {lane.done}/{lane.total} {lane.ms !== null && <b className="text-teal-brand">· {lane.ms} ms</b>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Timing comparison */}
      {latest && !running && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Time taken (wall clock)" value={`${latest.wallMs} ms`} hint={`${latest.threads} thread(s) in parallel`} />
          <Stat label="Work done by all threads" value={`${latest.cpuMs} ms`} hint="what one thread would need" />
          <Stat
            label="Speed-up"
            value={`${(latest.cpuMs / Math.max(1, latest.wallMs)).toFixed(1)}×`}
            hint={single && latest.threads > 1 ? `1 thread took ${single.wallMs} ms` : `pool has started ${startedThreads.current} thread(s) – reused`}
          />
        </div>
      )}

      {/* Results */}
      {findings && (
        <div className="space-y-3 rounded-xl border border-teal-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="red">Expired: {counts.expired}</Badge>
            <Badge color="orange">≤ 30 days: {counts.within30}</Badge>
            <Badge color="yellow">≤ 60 days: {counts.within60}</Badge>
            <Badge color="teal">≤ 90 days: {counts.within90}</Badge>
            <Badge color="green">Safe: {counts.safe}</Badge>
            <span className="ml-auto text-sm">
              Value at risk (expired + 30 days): <b className="text-coral">{formatPKR(valueAtRisk)}</b>
            </span>
          </div>
          {urgent.length > 0 && (
            <ul className="divide-y divide-teal-line text-sm">
              {urgent.map(({ batch, alert }) => (
                <li key={batch.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge color={alert.color}>{alert.label}</Badge>
                  <b>{batch.name}</b>
                  <span className="text-muted">batch {batch.batch_no} · {batch.quantity} units</span>
                  <span className="ml-auto text-xs text-muted">{alert.advice()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-teal-line bg-teal-soft/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-teal-brand">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
