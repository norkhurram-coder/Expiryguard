"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { roleLabel } from "@/lib/constants";
import LogoutButton from "./LogoutButton";

type Role = "admin" | "pharmacist" | "sales_staff";
const ALL: Role[] = ["admin", "pharmacist", "sales_staff"];
const MANAGERS: Role[] = ["admin", "pharmacist"];

// Which roles see each page (FR-16: Sales Staff only get the sales screen and stock lookup).
const SECTIONS: { title: string; links: { href: string; label: string; icon: string; roles: Role[] }[] }[] = [
  {
    title: "Daily work",
    links: [
      { href: "/", label: "Dashboard", icon: "📊", roles: MANAGERS },
      { href: "/sales", label: "Sales (FEFO)", icon: "🛒", roles: ALL },
      { href: "/medicines", label: "Medicines", icon: "💊", roles: ALL },
      { href: "/batches", label: "Batches / Stock", icon: "📦", roles: ALL },
      { href: "/suppliers", label: "Suppliers", icon: "🚚", roles: MANAGERS },
    ],
  },
  {
    title: "Expiry control",
    links: [
      { href: "/forecast", label: "Risk Forecast", icon: "📈", roles: MANAGERS },
      { href: "/alerts", label: "Alerts & Daily Scan", icon: "🔔", roles: MANAGERS },
      { href: "/reports", label: "Reports", icon: "📄", roles: MANAGERS },
    ],
  },
  {
    title: "Admin",
    links: [
      { href: "/users", label: "Users & Roles", icon: "👥", roles: ["admin"] },
      { href: "/audit", label: "Audit Log", icon: "🧾", roles: ["admin"] },
    ],
  },
];

type Props = { fullName: string; role: string; children: React.ReactNode };

/** The page frame after login: sidebar on the left, top bar with the user's name and logout. */
export default function AppShell({ fullName, role, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const sections = SECTIONS.map((section) => ({
    ...section,
    links: section.links.filter((link) => link.roles.includes(role as Role)),
  })).filter((section) => section.links.length > 0);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Dark background behind the menu on small screens */}
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto bg-teal-brand text-white transition-transform lg:static lg:translate-x-0 ${
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
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-white/50 first:pt-1">
                {section.title}
              </p>
              {section.links.map((link) => (
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
