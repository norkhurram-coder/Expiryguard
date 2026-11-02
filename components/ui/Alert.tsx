type Kind = "success" | "error" | "warning" | "info";

const styles: Record<Kind, string> = {
  success: "border-teal-brand/30 bg-teal-soft text-teal-dark",
  error: "border-red-300 bg-red-50 text-red-700",
  warning: "border-coral/40 bg-coral-soft text-coral",
  info: "border-teal-line bg-white text-muted",
};

const icons: Record<Kind, string> = { success: "✓", error: "✕", warning: "!", info: "i" };

/** A coloured message box for success, error and warning messages. */
export default function Alert({ kind, children }: { kind: Kind; children: React.ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>
      <span className="font-bold">{icons[kind]}</span>
      <div>{children}</div>
    </div>
  );
}
