/**
 * A box with a soft border, used for forms, tables and dashboard sections.
 * `background` replaces the default white background and border, e.g. for a highlighted card;
 * `titleClassName` changes the title colour (use a light one on a dark background).
 */
export default function Card({
  title,
  action,
  children,
  className = "",
  background = "border-teal-line bg-white",
  titleClassName = "text-teal-brand",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  background?: string;
  titleClassName?: string;
}) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${background} ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className={`text-lg font-bold ${titleClassName}`}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
