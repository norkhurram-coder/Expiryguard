/** Centered card used by the login and sign-up pages. */
type Background = "light" | "dark";

// Page background behind the card. Change the colours here to restyle the page.
const backgrounds: Record<Background, string> = {
  light: "bg-linear-to-br from-teal-soft via-white to-coral-soft/60",
  dark: "bg-linear-to-br from-teal-dark via-teal-brand to-[#1b7a6e]",
};

export default function AuthCard({
  title,
  background = "light",
  children,
}: {
  title: string;
  background?: Background;
  children: React.ReactNode;
}) {
  const dark = background === "dark";
  return (
    <main className={`flex min-h-screen items-center justify-center px-4 py-10 ${backgrounds[background]}`}>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg ${
              dark ? "bg-white text-teal-brand" : "bg-teal-brand text-white"
            }`}
          >
            ✚
          </div>
          <h1 className={`text-3xl font-bold ${dark ? "text-white" : "text-teal-brand"}`}>ExpiryGuard</h1>
          <p className={`mt-1 text-sm ${dark ? "text-white/80" : "text-muted"}`}>
            Sell safe stock. <span className={`font-semibold ${dark ? "text-coral-soft" : "text-coral"}`}>Lose less to expiry.</span>
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
