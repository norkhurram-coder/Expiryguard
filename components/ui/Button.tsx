import Link from "next/link";
import Spinner from "./Spinner";

type Variant = "primary" | "secondary" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-teal-brand text-white hover:bg-teal-dark",
  secondary: "border border-teal-line bg-white text-teal-brand hover:bg-teal-soft",
  danger: "border border-coral/40 bg-white text-coral hover:bg-coral-soft",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

/** A button. While `loading` is true it shows a spinner and can't be clicked. */
export default function Button({ variant = "primary", loading = false, className = "", children, disabled, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${styles[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

/** A link that looks like a button. */
export function ButtonLink({ href, variant = "primary", className = "", children }: { href: string; variant?: Variant; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}
