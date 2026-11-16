// Tests for the Singleton WorkerPool. Jest runs in Node (no browser Web Workers),
// so we pass in a fake worker that answers asynchronously like a real thread would.
import { WorkerPool, splitIntoChunks, type WorkerLike, type WorkerMessage } from "../lib/threads/WorkerPool";

class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: WorkerMessage }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  tasksHandled = 0;
  static running = 0;
  static maxRunning = 0;

  postMessage(message: unknown) {
    const { numbers, fail } = message as { numbers: number[]; fail?: boolean };
    this.tasksHandled++;
    FakeWorker.running++;
    FakeWorker.maxRunning = Math.max(FakeWorker.maxRunning, FakeWorker.running);
    setTimeout(() => {
      FakeWorker.running--;
      if (fail) return this.onmessage?.({ data: { type: "error", message: "boom" } });
      this.onmessage?.({ data: { type: "progress", done: numbers.length, total: numbers.length } });
      this.onmessage?.({ data: { type: "done", result: numbers.reduce((a, b) => a + b, 0) } });
    }, 20);
  }
  terminate() {}
}

let created: FakeWorker[] = [];
function makePool(size: number) {
  return WorkerPool.getInstance(size, () => {
    const w = new FakeWorker();
    created.push(w);
    return w;
  });
}

beforeEach(() => {
  WorkerPool.reset();
  created = [];
  FakeWorker.running = 0;
  FakeWorker.maxRunning = 0;
});

describe("Singleton", () => {
  test("getInstance always returns the same pool", () => {
    const a = makePool(2);
    const b = WorkerPool.getInstance(8); // different size is ignored – it already exists
    expect(b).toBe(a);
    expect(b.size).toBe(2);
  });
});

describe("Object pool + multithreading", () => {
  test("runs tasks in parallel, but never more than the pool size", async () => {
    const pool = makePool(3);
    const results = await pool.runAll<number>([1, 2, 3, 4, 5, 6].map((n) => ({ numbers: [n, n] })));
    expect(results.map((r) => r.result)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(FakeWorker.maxRunning).toBe(3);
  });

  test("reuses threads instead of starting new ones", async () => {
    const pool = makePool(2);
    await pool.runAll([{ numbers: [1] }, { numbers: [2] }, { numbers: [3] }, { numbers: [4] }]);
    await pool.run({ numbers: [5] });
    expect(pool.startedThreads).toBe(2);
    expect(created.reduce((sum, w) => sum + w.tasksHandled, 0)).toBe(5);
  });

  test("reports which thread did the work and its progress", async () => {
    const pool = makePool(2);
    const progress: number[] = [];
    const r = await pool.run<number>({ numbers: [1, 2, 3] }, (threadId) => progress.push(threadId));
    expect(r.threadId).toBeGreaterThanOrEqual(1);
    expect(progress).toEqual([r.threadId]);
  });

  test("an error in one thread rejects only that task, and the thread is reused", async () => {
    const pool = makePool(1);
    await expect(pool.run({ numbers: [], fail: true })).rejects.toThrow("boom");
    await expect(pool.run<number>({ numbers: [7] })).resolves.toMatchObject({ result: 7 });
    expect(pool.startedThreads).toBe(1);
  });
});

describe("splitIntoChunks", () => {
  test("splits evenly between threads", () => {
    expect(splitIntoChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 3, 5], [2, 4]]);
  });
  test("never makes empty chunks", () => {
    expect(splitIntoChunks([1, 2], 4)).toEqual([[1], [2]]);
    expect(splitIntoChunks([], 4)).toEqual([]);
  });
});
