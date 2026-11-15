// WORKER THREAD – this file runs inside a separate Node.js thread (worker_threads).
// It waits for a task from the main thread, runs it, and sends the result back.
// It shares NO memory with the main thread: data arrives as a copied message,
// so two threads can never change the same object at the same time (no locks needed).
//
// Node.js runs this .ts file directly (built-in TypeScript support), so it may only
// import files with a ".ts" extension and must not use the "@/..." shortcut.
import { parentPort, threadId } from "node:worker_threads";
import { runTask, type Task } from "../analysis.ts";

if (!parentPort) throw new Error("analysis-worker must be started as a worker thread");
const port = parentPort;

port.on("message", (message: { taskId: number; task: Task }) => {
  const started = performance.now();
  try {
    const result = runTask(message.task);
    port.postMessage({ taskId: message.taskId, ok: true, result, threadId, ms: performance.now() - started });
  } catch (error) {
    port.postMessage({
      taskId: message.taskId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      threadId,
      ms: performance.now() - started,
    });
  }
});
