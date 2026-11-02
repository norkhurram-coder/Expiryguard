/** Centered card used by the login and sign-up pages. */
export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-teal-soft via-white to-coral-soft/60 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-brand text-2xl text-white shadow-lg">
            ✚
          </div>
          <h1 className="text-3xl font-bold text-teal-brand">ExpiryGuard</h1>
          <p className="mt-1 text-sm text-muted">
            Sell safe stock. <span className="font-semibold text-coral">Lose less to expiry.</span>
          </p>
        </div>
        <div className="rounded-2xl border border-teal-line bg-white p-6 shadow-xl sm:p-8">
          <h2 className="mb-5 text-xl font-bold text-ink">{title}</h2>
          {children}
        </div>
      </div>
    </main>
  );
}
