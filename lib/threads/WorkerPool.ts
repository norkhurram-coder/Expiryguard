// MULTITHREADING + DESIGN PATTERN 2: SINGLETON (with an Object Pool of threads)
//
// A Web Worker is a real background thread in the browser. Starting a thread is slow, so
// the pool starts at most `size` workers and REUSES them for every task (Object Pool).
// If more tasks arrive than there are free workers, they wait in a queue.
//
// SINGLETON: the whole browser tab shares ONE pool, through WorkerPool.getInstance().
// The constructor is private, so no screen can accidentally create a second pool and
// start dozens of extra threads. (lib/supabase/client.ts uses the same idea for the
// database connection.)
//
// Threads never share memory here: the main thread sends each worker its own copy of
// the data with postMessage and gets the result back the same way, so no locks are needed.

/** The part of a Web Worker the pool uses (lets the Jest tests pass in a fake worker). */
export type WorkerLike = {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: WorkerMessage }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
};

/** Messages a worker sends back: progress updates, then one "done" (or "error"). */
export type WorkerMessage =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; result: unknown }
  | { type: "error"; message: string };

export type TaskResult<T> = { result: T; threadId: number; ms: number };

type Task = {
  payload: unknown;
  onProgress?: (threadId: number, done: number, total: number) => void;
  resolve: (value: TaskResult<unknown>) => void;
  reject: (reason: Error) => void;
};

type PooledWorker = { id: number; worker: WorkerLike; busy: boolean };

export class WorkerPool {
  private static instance: WorkerPool | null = null;

  private readonly workers: PooledWorker[] = [];
  private readonly queue: Task[] = [];
  private threadsStarted = 0;

  private constructor(
    readonly size: number,
    private readonly createWorker: (threadId: number) => WorkerLike
  ) {}

  /** SINGLETON: always returns the same pool. The arguments are only used the first time. */
  static getInstance(size?: number, createWorker?: (threadId: number) => WorkerLike): WorkerPool {
    if (!WorkerPool.instance) {
      const threads = size ?? defaultPoolSize();
      const factory = createWorker ?? ((id: number) => new Worker("/workers/expiry-scanner.js", { name: `scanner-${id}` }) as unknown as WorkerLike);
      WorkerPool.instance = new WorkerPool(threads, factory);
    }
    return WorkerPool.instance;
  }

  /** Stops every thread and forgets the pool (used by tests and when the app unloads). */
  static reset(): void {
    WorkerPool.instance?.workers.forEach((w) => w.worker.terminate());
    WorkerPool.instance = null;
  }

  /** How many real threads have been started so far (proves they are reused). */
  get startedThreads(): number {
    return this.threadsStarted;
  }

  /** Run one task on a free thread. Resolves with the worker's result, its thread id and time taken. */
  run<T>(payload: unknown, onProgress?: Task["onProgress"]): Promise<TaskResult<T>> {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, onProgress, resolve: resolve as Task["resolve"], reject });
      this.next();
    });
  }

  /** Run several tasks at the same time (one per free thread) and wait for all of them. */
  runAll<T>(payloads: unknown[], onProgress?: Task["onProgress"]): Promise<TaskResult<T>[]> {
    return Promise.all(payloads.map((p) => this.run<T>(p, onProgress)));
  }

  /** Give the next waiting task to a free worker, starting a new thread if the pool is not full. */
  private next(): void {
    if (this.queue.length === 0) return;

    let slot = this.workers.find((w) => !w.busy);
    if (!slot && this.workers.length < this.size) {
      this.threadsStarted++;
      slot = { id: this.threadsStarted, worker: this.createWorker(this.threadsStarted), busy: false };
      this.workers.push(slot);
    }
    if (!slot) return; // every thread is busy – the task waits in the queue

    const task = this.queue.shift()!;
    const pooled = slot;
    pooled.busy = true;
    const started = now();

    const finish = () => {
      pooled.busy = false;
      pooled.worker.onmessage = null;
      pooled.worker.onerror = null;
      this.next(); // reuse this thread for the next waiting task
    };

    pooled.worker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "progress") {
        task.onProgress?.(pooled.id, msg.done, msg.total);
      } else if (msg.type === "done") {
        finish();
        task.resolve({ result: msg.result, threadId: pooled.id, ms: Math.round(now() - started) });
      } else if (msg.type === "error") {
        finish();
        task.reject(new Error(msg.message));
      }
    };
    pooled.worker.onerror = (event) => {
      finish();
      task.reject(new Error(event.message || `Thread ${pooled.id} crashed`));
    };

    pooled.worker.postMessage({ ...(task.payload as object), threadId: pooled.id });
  }
}

/** Leave one CPU core for the page itself; use between 2 and 4 background threads. */
function defaultPoolSize(): number {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(2, Math.min(4, cores - 1));
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Split a list into `parts` nearly equal chunks (no empty chunks), one per thread. */
export function splitIntoChunks<T>(items: T[], parts: number): T[][] {
  const count = Math.max(1, Math.min(parts, items.length));
  const chunks: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, i) => chunks[i % count].push(item));
  return items.length === 0 ? [] : chunks;
}
