import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-teal-brand">404</p>
      <p className="text-muted">This page or record does not exist.</p>
      <Link href="/" className="font-semibold text-coral hover:underline">
        Back to the dashboard
      </Link>
    </main>
  );
}
