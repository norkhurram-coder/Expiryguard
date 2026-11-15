// MULTITHREADING on the server – a small THREAD POOL built on Node.js worker_threads.
//
// The daily scan has independent jobs (expiry scan, stock check, forecast). Instead of
// running them one after another on the main thread, we:
//   1. split the work into tasks (the forecast is split again into chunks of medicines),
//   2. start a pool of worker threads (one per CPU core, at most 4),
//   3. each thread takes the next task from a shared queue until the queue is empty,
//   4. the main thread waits for all results (Promise) and merges them.
// Threads only communicate by messages (postMessage), so there is no shared data to lock.
//
// If threads can't be started (e.g. an unusual hosting environment), the same tasks run
// one after another on the main thread, so the scan still works ("single" mode).
import { Worker } from "node:worker_threads";
import os from "node:os";
import path from "node:path";
import {
  mergeForecasts,
  runTask,
  splitIntoChunks,
  type AnalysisInput,
  type ExpiryResult,
  type ForecastResult,
  type StockResult,
  type Task,
  type TaskResult,
} from "../analysis.ts";

export type ThreadReport = { task: string; threadId: number; ms: number };

export type ParallelAnalysis = {
  expiry: ExpiryResult;
  stock: StockResult;
  forecast: ForecastResult;
  mode: "threads" | "single";
  poolSize: number;
  threads: ThreadReport[];
  totalMs: number;
};

const WORKER_FILE = path.join(process.cwd(), "lib", "threads", "analysis-worker.ts");

function taskLabel(task: Task, index: number): string {
  if (task.kind === "forecast") return `forecast (part ${index}, ${task.medicineIds.length} medicines)`;
  return task.kind === "expiry" ? "expiry scan" : "stock check";
}

/** Runs every task on a pool of worker threads and returns the results in the same order. */
export function runTasksInPool(tasks: Task[], poolSize: number): Promise<{ results: TaskResult[]; threads: ThreadReport[] }> {
  return new Promise((resolve, reject) => {
    const results: TaskResult[] = new Array(tasks.length);
    const threads: ThreadReport[] = new Array(tasks.length);
    const workers: Worker[] = [];
    let nextTask = 0; // shared queue position (only the main thread touches it)
    let finished = 0;
    let failed = false;

    const stopAll = () => workers.forEach((w) => void w.terminate());

    function giveNextTask(worker: Worker) {
      if (nextTask >= tasks.length) {
        void worker.terminate(); // queue empty → this thread is done
        return;
      }
      const taskId = nextTask++;
      worker.postMessage({ taskId, task: tasks[taskId] });
    }

    const size = Math.max(1, Math.min(poolSize, tasks.length));
    for (let i = 0; i < size; i++) {
      // (the flag only hides Node's note that it detected "import" syntax in a .ts file)
      const worker = new Worker(WORKER_FILE, { execArgv: ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"] });
      workers.push(worker);

      worker.on("message", (msg: { taskId: number; ok: boolean; result?: TaskResult; error?: string; threadId: number; ms: number }) => {
        if (failed) return;
        if (!msg.ok) {
          failed = true;
          stopAll();
          reject(new Error(`Worker thread ${msg.threadId} failed: ${msg.error}`));
          return;
        }
        results[msg.taskId] = msg.result!;
        threads[msg.taskId] = { task: taskLabel(tasks[msg.taskId], msg.taskId - 1), threadId: msg.threadId, ms: Math.round(msg.ms * 10) / 10 };
        finished++;
        if (finished === tasks.length) {
          stopAll();
          resolve({ results, threads });
        } else {
          giveNextTask(worker);
        }
      });

      worker.on("error", (error) => {
        if (failed) return;
        failed = true;
        stopAll();
        reject(error);
      });

      giveNextTask(worker);
    }
  });
}

/** Builds the task list: 1 expiry task, 1 stock task and the forecast split into chunks. */
export function buildTasks(input: AnalysisInput, forecastParts: number): Task[] {
  const medicineIds = input.medicines.map((m) => m.id);
  return [
    { kind: "expiry", input },
    { kind: "stock", input },
    ...splitIntoChunks(medicineIds, forecastParts).map((ids) => ({ kind: "forecast" as const, input, medicineIds: ids })),
  ];
}

function combine(tasks: Task[], results: TaskResult[]) {
  const forecastParts = results.filter((_, i) => tasks[i].kind === "forecast") as ForecastResult[];
  return {
    expiry: results[0] as ExpiryResult,
    stock: results[1] as StockResult,
    forecast: mergeForecasts(forecastParts),
  };
}

/** The whole daily analysis, done in parallel worker threads. */
export async function runAnalysisInThreads(input: AnalysisInput): Promise<ParallelAnalysis> {
  const started = performance.now();
  const poolSize = Math.max(2, Math.min(4, os.availableParallelism()));
  const tasks = buildTasks(input, poolSize - 2 || 1);

  try {
    const { results, threads } = await runTasksInPool(tasks, poolSize);
    return { ...combine(tasks, results), mode: "threads", poolSize, threads, totalMs: Math.round(performance.now() - started) };
  } catch (error) {
    // Fallback: same tasks, one after another on the main thread.
    console.error("Worker threads unavailable, running on the main thread instead:", error);
    const threads: ThreadReport[] = [];
    const results = tasks.map((task, i) => {
      const t0 = performance.now();
      const result = runTask(task);
      threads.push({ task: taskLabel(task, i - 1), threadId: 0, ms: Math.round((performance.now() - t0) * 10) / 10 });
      return result;
    });
    return { ...combine(tasks, results), mode: "single", poolSize: 1, threads, totalMs: Math.round(performance.now() - started) };
  }
}
