/** A small spinning circle shown while something is loading or saving. */
export default function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? "h-4 w-4 border-2" : "h-8 w-8 border-4";
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${size}`}
    />
  );
}
