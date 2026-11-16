// EXPIRY SCANNER THREAD (a Web Worker = a real background thread in the browser).
// The WorkerPool (lib/threads/WorkerPool.ts) starts a few of these and gives each one
// its own chunk of batches. Each thread works on its chunk at the same time as the others
// and talks to the main thread only through messages (postMessage), so no data is shared.

function dayNumber(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

// Simulated heavy work for each batch (in a real store this would be thousands of batches).
// It is a busy CPU loop, not a timer, so this thread is truly busy – which is exactly why it
// must run off the main thread: the page stays responsive while the threads calculate.
function heavyWork(ms) {
  const end = Date.now() + ms;
  let x = 0;
  while (Date.now() < end) x += Math.sqrt(x + 1);
  return x;
}

self.onmessage = (event) => {
  try {
    const { batches, today, workMs = 0 } = event.data;
    const started = Date.now();
    const items = [];

    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      heavyWork(workMs);
      items.push({
        id: b.id,
        daysLeft: dayNumber(b.expiry_date) - dayNumber(today),
      });
      self.postMessage({ type: "progress", done: i + 1, total: batches.length });
    }

    self.postMessage({ type: "done", result: { items, busyMs: Date.now() - started } });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err && err.message ? err.message : err) });
  }
};
