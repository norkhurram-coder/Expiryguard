import Spinner from "@/components/ui/Spinner";

/** Shown automatically while a page is loading its data. */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-teal-brand">
      <Spinner />
      <p className="text-sm text-muted">Loading…</p>
    </div>
  );
}
