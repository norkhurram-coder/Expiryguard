import { getExpiryStatus, type ExpiryStatus } from "@/lib/expiry";

type Color = "red" | "orange" | "yellow" | "teal" | "green" | "grey";

const colors: Record<Color, string> = {
  red: "bg-red-100 text-red-700 ring-red-200",
  orange: "bg-orange-100 text-orange-700 ring-orange-200",
  yellow: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  teal: "bg-teal-soft text-teal-brand ring-teal-line",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  grey: "bg-gray-100 text-gray-600 ring-gray-200",
};

/** A small coloured label. */
export default function Badge({ color, children }: { color: Color; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${colors[color]}`}>
      {children}
    </span>
  );
}

const expiryLook: Record<ExpiryStatus, { color: Color; label: string }> = {
  expired: { color: "red", label: "Expired" },
  within30: { color: "orange", label: "≤ 30 days" },
  within60: { color: "yellow", label: "≤ 60 days" },
  within90: { color: "teal", label: "≤ 90 days" },
  safe: { color: "green", label: "Safe" },
};

/** Expiry badge: red = expired, orange = 30 days, yellow = 60 days, teal = 90 days. */
export function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const look = expiryLook[getExpiryStatus(expiryDate)];
  return <Badge color={look.color}>{look.label}</Badge>;
}
