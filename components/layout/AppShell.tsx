"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { roleLabel } from "@/lib/constants";
import LogoutButton from "./LogoutButton";

const MAIN_LINKS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/medicines", label: "Medicines", icon: "💊" },
  { href: "/batches", label: "Batches / Stock", icon: "📦" },
  { href: "/suppliers", label: "Suppliers", icon: "🚚", hideForSales: true },
];

const COMING_SOON = [
  { label: "Sales (FEFO)", icon: "🛒" },
  { label: "Risk Forecast", icon: "📈" },
  { label: "Reports", icon: "📄" },
];

type Props = { fullName: string; role: string; children: React.ReactNode };

/** The page frame after login: sidebar on the left, top bar with the user's name and logout. */
export default function AppShell({ fullName, role, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = MAIN_LINKS.filter((link) => !(link.hideForSales && role === "sales_staff"));

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Dark background behind the menu on small screens */}
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-teal-brand text-white transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-teal-brand">✚</span>
          <div>
            <p className="text-lg font-bold leading-tight">ExpiryGuard</p>
            <p className="text-[11px] text-white/70">Pharmacy stock & expiry</p>
          </div>
        </div>

        <nav className="space-y-1 p-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive(link.href) ? "bg-white text-teal-brand" : "text-white/90 hover:bg-white/10"
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}

          <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/50">Next milestone</p>
          {COMING_SOON.map((item) => (
            <div
              key={item.label}
              title="Coming soon"
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/40"
            >
              <span className="grayscale">{item.icon}</span>
              {item.label}
              <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Soon</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Right side: top bar + page */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-teal-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-teal-line px-3 py-1.5 text-teal-brand lg:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-ink">{fullName}</p>
              <p className="text-xs text-coral">{roleLabel(role)}</p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
