// THREAD 1 – Expiry Scanner (runs in a separate background thread: a Web Worker).
// It receives the batches from the main thread, checks each one's expiry status,
// and sends its progress and results back with postMessage.

function dayNumber(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

self.onmessage = async (event) => {
  const { batches, today } = event.data;
  const counts = { expired: 0, within30: 0, within60: 0, within90: 0, safe: 0 };
  let valueAtRisk = 0;
  const returnAlerts = [];

  self.postMessage({ type: "log", text: "Expiry Scanner thread started – checking " + batches.length + " batches" });

  for (const b of batches) {
    const days = dayNumber(b.expiry_date) - dayNumber(today);

    let status;
    if (days <= 0) status = "expired";
    else if (days <= 30) status = "within30";
    else if (days <= 60) status = "within60";
    else if (days <= 90) status = "within90";
    else status = "safe";
    counts[status]++;

    // Money at risk = stock that is expired or expires within 30 days
    if (status === "expired" || status === "within30") {
      valueAtRisk += b.quantity * b.purchase_price;
    }

    // Supplier return deadline (expiry date − return window) within the next 7 days
    if (b.return_window_days !== null && status !== "expired") {
      const daysToDeadline = days - b.return_window_days;
      if (daysToDeadline >= 0 && daysToDeadline <= 7) {
        returnAlerts.push(b.name + " (" + b.batch_no + ") – return within " + daysToDeadline + " days");
      }
    }

    const label = status === "expired" ? "EXPIRED" : status === "safe" ? "safe" : "expires in " + days + " days";
    self.postMessage({ type: "log", text: b.name + " " + b.batch_no + " → " + label });
    await sleep(300); // slow down a little so we can see both threads working at the same time
  }

  self.postMessage({ type: "done", counts, valueAtRisk, returnAlerts });
};
