import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
  const bron = searchParams.get("bron");
  const kanaal_id = searchParams.get("kanaal_id");
  const status = searchParams.get("status");
  const van = searchParams.get("van"); // ISO date
  const tot = searchParams.get("tot");

  const db = getAdminClient();
  let q = db
    .from("distributie_log")
    .select("*", { count: "exact" })
    .order("verzonden_op", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (bron) q = q.eq("bron", bron);
  if (kanaal_id) q = q.eq("kanaal_id", kanaal_id);
  if (status) q = q.eq("status", status);
  if (van) q = q.gte("verzonden_op", van);
  if (tot) q = q.lte("verzonden_op", tot);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rows: data,
    page,
    page_size: PAGE_SIZE,
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
