/** Shown when a list has nothing in it yet. */
export default function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-teal-line bg-teal-soft/40 px-6 py-12 text-center">
      <div className="text-3xl">📦</div>
      <p className="font-semibold text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-muted">{message}</p>}
      {action}
    </div>
  );
}
