import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import type { Kanaal, LogRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type Bol = "groen" | "geel" | "rood" | "grijs";

function bepaalStatus(
  k: Kanaal,
  recenteFouten: number,
): { bol: Bol; reden: string } {
  if (k.status === "defect" || recenteFouten >= 3) {
    return { bol: "rood", reden: "foutburst / defect" };
  }
  if (k.status === "gepauzeerd") {
    return { bol: "grijs", reden: "gepauzeerd" };
  }
  if (!k.last_success) {
    return { bol: "grijs", reden: "nog geen succesvolle post" };
  }
  const uren = (Date.now() - new Date(k.last_success).getTime()) / 3_600_000;
  if (uren > 24) return { bol: "rood", reden: ">24u geen succes" };
  if (uren > 4) return { bol: "geel", reden: "4–24u stil" };
  return { bol: "groen", reden: "actueel" };
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: kanalenData } = await db
    .from("distributie_kanalen")
    .select("*")
    .order("created_at", { ascending: true });
  const kanalen = (kanalenData ?? []) as Kanaal[];

  const sinceUur = new Date(Date.now() - 60 * 60_000).toISOString();

  const cards = await Promise.all(
    kanalen.map(async (k) => {
      const { data: recent } = await db
        .from("distributie_log")
        .select("id,post_titel,bron,status,verzonden_op,post_url")
        .eq("kanaal_id", k.id)
        .order("verzonden_op", { ascending: false })
        .limit(5);

      const { count: foutCount } = await db
        .from("distributie_log")
        .select("id", { count: "exact", head: true })
        .eq("kanaal_id", k.id)
        .eq("status", "fout")
        .gte("verzonden_op", sinceUur);

      const status = bepaalStatus(k, foutCount ?? 0);
      const heeftFout = !!k.last_error_msg;

      return {
        kanaal: k,
        status,
        heeft_hook: !!k.zapier_hook,
        kan_replayen: heeftFout,
        recente_posts: (recent ?? []) as Partial<LogRow>[],
      };
    }),
  );

  return NextResponse.json({ cards });
}
