// AUDIT LOG (Admin only) – NFR-06: every stock change with the user and the time.
// Rows are written by a database trigger on the batches table, so nothing can skip it.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { formatDate, formatPKR } from "@/lib/format";
import type { StockMovement } from "@/lib/types";

const TYPES = ["purchase", "sale", "adjustment", "disposal", "return", "delete"] as const;
const COLORS = { purchase: "green", sale: "teal", adjustment: "yellow", disposal: "red", return: "orange", delete: "grey" } as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const { supabase, role } = await getCurrentUser();
  requireRole(role, ["admin"]);

  let query = supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200);
  if (type && (TYPES as readonly string[]).includes(type)) query = query.eq("movement", type);
  // The log keeps no link to medicines (so history survives deletes) – look the names up separately.
  const [{ data, error }, { data: meds }] = await Promise.all([query, supabase.from("medicines").select("id, brand_name, strength")]);
  const rows = (data ?? []) as StockMovement[];
  const nameOf = new Map(((meds ?? []) as { id: number; brand_name: string; strength: string }[]).map((m) => [m.id, `${m.brand_name} ${m.strength}`]));

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Log" subtitle="Every change to stock: who did it, when, and why (latest 200)." />
      {error && <Alert kind="error">Could not load the audit log: {error.message}</Alert>}

      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/audit" className={`rounded-full px-3 py-1 ring-1 ring-teal-line ${!type ? "bg-teal-brand text-white" : "bg-white text-teal-brand"}`}>
          All
        </a>
        {TYPES.map((t) => (
          <a key={t} href={`/audit?type=${t}`} className={`rounded-full px-3 py-1 capitalize ring-1 ring-teal-line ${type === t ? "bg-teal-brand text-white" : "bg-white text-teal-brand"}`}>
            {t}
          </a>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No stock changes recorded yet.</p>
        ) : (
          <Table headers={["When", "Type", "Medicine", "Batch", "Change", "Value", "Note", "By"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs">
                  {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </Td>
                <Td>
                  <span className="capitalize">
                    <Badge color={COLORS[r.movement]}>{r.movement}</Badge>
                  </span>
                </Td>
                <Td className="font-semibold">{(r.medicine_id && nameOf.get(r.medicine_id)) || "—"}</Td>
                <Td>
                  {r.batch_no ?? "—"}
                  {r.expiry_date && <span className="block text-xs text-muted">exp {formatDate(r.expiry_date)}</span>}
                </Td>
                <Td className={r.quantity_change < 0 ? "font-semibold text-coral" : "font-semibold text-teal-brand"}>
                  {r.quantity_change > 0 ? `+${r.quantity_change}` : r.quantity_change}
                </Td>
                <Td className="text-xs">{r.unit_cost ? formatPKR(Math.abs(r.quantity_change) * Number(r.unit_cost)) : "—"}</Td>
                <Td className="max-w-xs text-xs">{r.note ?? "—"}</Td>
                <Td className="text-xs">{r.user_name ?? "System"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
