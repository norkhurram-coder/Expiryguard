"use client";

/** Opens the browser's print dialog – choose "Save as PDF" to keep a copy of the report. */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-teal-brand px-3 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
    >
      Print / PDF
    </button>
  );
}
