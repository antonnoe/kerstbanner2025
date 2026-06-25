import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getInstellingen } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getAdminClient();
  const instellingen = await getInstellingen(db);
  return NextResponse.json({ instellingen });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };

  if (typeof body.admin_email === "string") patch.admin_email = body.admin_email.trim() || null;
  if (Number.isFinite(body.stilte_uren)) patch.stilte_uren = Math.max(1, Math.floor(body.stilte_uren));
  if (Number.isFinite(body.foutburst_aantal))
    patch.foutburst_aantal = Math.max(1, Math.floor(body.foutburst_aantal));
  if (Number.isFinite(body.foutburst_minuten))
    patch.foutburst_minuten = Math.max(1, Math.floor(body.foutburst_minuten));
  if (Number.isFinite(body.alert_dedup_uren))
    patch.alert_dedup_uren = Math.max(1, Math.floor(body.alert_dedup_uren));

  const db = getAdminClient();
  const { data, error } = await db
    .from("distributie_instellingen")
    .upsert(patch, { onConflict: "id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instellingen: data });
}
