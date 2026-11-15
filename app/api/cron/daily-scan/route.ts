// Vercel Cron calls this every morning (see vercel.json) – FR-07, FR-08, NFR-04.
// Vercel sends "Authorization: Bearer <CRON_SECRET>", so nobody else can start the scan.
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyScan } from "@/lib/daily-scan";

export const runtime = "nodejs"; // worker_threads need the Node.js runtime
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }

  const outcome = await runDailyScan(supabase, "cron");
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 500 });
}
