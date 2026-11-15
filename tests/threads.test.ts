// Runs the REAL worker-thread pool (Node.js worker_threads) and checks that the
// parallel result is exactly the same as running every task on the main thread.
import { buildTasks, runAnalysisInThreads, runTasksInPool } from "../lib/threads/pool";
import { checkStock, forecastRisk, scanExpiry } from "../lib/analysis";
import { sampleInput } from "./fixtures/sample-input";

jest.setTimeout(30000);

describe("multithreading (worker_threads pool)", () => {
  test("tasks run on separate worker threads, not the main thread", async () => {
    const tasks = buildTasks(sampleInput(), 2);
    const { threads } = await runTasksInPool(tasks, 4);
    expect(threads).toHaveLength(4); // expiry + stock + 2 forecast parts
    const ids = new Set(threads.map((t) => t.threadId));
    expect(ids.has(0)).toBe(false); // threadId 0 is the main thread
    expect(ids.size).toBe(4); // 4 different threads worked at the same time
  });

  test("parallel result equals the single-thread result", async () => {
    const input = sampleInput();
    const parallel = await runAnalysisInThreads(input);
    expect(parallel.mode).toBe("threads");
    expect(parallel.expiry).toEqual(scanExpiry(input));
    expect(parallel.stock).toEqual(checkStock(input));
    const single = forecastRisk(input).rows.map((r) => r.batch_no).sort();
    expect(parallel.forecast.rows.map((r) => r.batch_no).sort()).toEqual(single);
  });

  test("a pool smaller than the number of tasks reuses its threads", async () => {
    const tasks = buildTasks(sampleInput(), 3); // expiry + stock + forecast parts
    const { results, threads } = await runTasksInPool(tasks, 2);
    expect(results).toHaveLength(tasks.length);
    expect(new Set(threads.map((t) => t.threadId)).size).toBeLessThanOrEqual(2);
  });
});
