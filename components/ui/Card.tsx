/** A white box with a soft border, used for forms, tables and dashboard sections. */
export default function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-teal-line bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold text-teal-brand">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
