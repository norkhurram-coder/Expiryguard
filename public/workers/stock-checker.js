// THREAD 2 – Stock Checker (runs in its own background thread: a Web Worker).
// For each medicine it adds up the non-expired stock and compares it with the minimum level.

function dayNumber(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

self.onmessage = async (event) => {
  const { medicines, batches, today } = event.data;
  const lowStock = [];

  self.postMessage({ type: "log", text: "Stock Checker thread started – checking " + medicines.length + " medicines" });

  for (const m of medicines) {
    const inStock = batches
      .filter((b) => b.medicine_id === m.id && dayNumber(b.expiry_date) > dayNumber(today))
      .reduce((sum, b) => sum + b.quantity, 0);

    const low = inStock < m.min_stock_level;
    if (low) lowStock.push(m.name + ": " + inStock + " left (minimum " + m.min_stock_level + ")");

    self.postMessage({ type: "log", text: m.name + " → " + inStock + " in stock" + (low ? " (LOW)" : "") });
    await sleep(300);
  }

  self.postMessage({ type: "done", lowStock });
};
