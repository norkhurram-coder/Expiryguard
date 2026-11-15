// Shows how the analysis was split across worker threads (used on the Forecast and Alerts pages).
import Badge from "@/components/ui/Badge";

type Props = {
  mode: "threads" | "single";
  poolSize?: number;
  totalMs: number;
  threads: { task: string; threadId: number; ms: number }[];
};

export default function ThreadReportCard({ mode, poolSize, totalMs, threads }: Props) {
  const sumMs = threads.reduce((s, t) => s + t.ms, 0);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        {mode === "threads" ? (
          <>
            The work was split into <b>{threads.length} tasks</b> and run on a pool of <b>{poolSize ?? "?"} Node.js worker threads</b> at the
            same time. Each thread received its own copy of the data, so no locks were needed.
          </>
        ) : (
          <>Worker threads were not available here, so the tasks ran one after another on the main thread.</>
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {threads.map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-teal-line px-3 py-2">
            <span>{t.task}</span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Badge color={t.threadId === 0 ? "grey" : "teal"}>{t.threadId === 0 ? "main thread" : `thread #${t.threadId}`}</Badge>
              <span className="text-xs text-muted">{t.ms} ms</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Work time of all tasks added together: {Math.round(sumMs * 10) / 10} ms · total time including starting the threads: {totalMs} ms.
      </p>
    </div>
  );
}
