// NFR-07: the Admin can download a full copy of the pharmacy data as a JSON file.
// (Supabase also keeps its own automatic daily backups of the database.)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/analysis-data";
import { todayISO } from "@/lib/expiry";

export const dynamic = "force-dynamic";

const TABLES = ["suppliers", "medicines", "batches", "sales", "sale_items", "stock_movements", "scan_runs"] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Only the Admin can download a backup." }, { status: 403 });
  }

  const backup: Record<string, unknown> = { app: "ExpiryGuard", created_at: new Date().toISOString() };
  try {
    for (const table of TABLES) {
      backup[table] = await fetchAll((from, to) => supabase.from(table).select("*").order("id").range(from, to));
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="expiryguard-backup-${todayISO()}.json"`,
    },
  });
}
