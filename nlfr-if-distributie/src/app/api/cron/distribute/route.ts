import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fetchFeed } from "@/lib/rss";
import { matchingRoutes } from "@/lib/matching";
import { dispatchOne } from "@/lib/dispatch";
import { getInstellingen } from "@/lib/settings";
import { isAuthorizedCron } from "@/lib/cron-auth";
import type { Bron, Kanaal, Route } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BRONNEN: Bron[] = ["nlfr", "if"];

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const instellingen = await getInstellingen(db);

  // Kanalen-cache (id → kanaal). Defecte/gepauzeerde kanalen slaan we over.
  const { data: kanalenData } = await db.from("distributie_kanalen").select("*");
  const kanalen = new Map<string, Kanaal>(
    (kanalenData ?? []).map((k) => [k.id as string, k as Kanaal]),
  );

  const summary = {
    nlfr_feed_url: instellingen.nlfr_feed_url as string | null,
    per_bron: {} as Record<string, unknown>,
    verzonden: 0,
    overgeslagen_dedup: 0,
    fout: 0,
  };

  for (const bron of BRONNEN) {
    const { items, usedUrl } = await fetchFeed(bron, instellingen.nlfr_feed_url);

    // Onthoud de werkende NLFR-feed-URL bij eerste succes.
    if (bron === "nlfr" && usedUrl && usedUrl !== instellingen.nlfr_feed_url) {
      await db
        .from("distributie_instellingen")
        .update({ nlfr_feed_url: usedUrl, updated_at: new Date().toISOString() })
        .eq("id", 1);
      summary.nlfr_feed_url = usedUrl;
    }

    const { data: routesData } = await db
      .from("distributie_routes")
      .select("*")
      .eq("bron", bron)
      .eq("status", "actief");
    const routes = (routesData ?? []) as Route[];

    let bronVerzonden = 0;
    let bronDedup = 0;
    let bronFout = 0;

    for (const item of items) {
      const matched = matchingRoutes(item, routes);
      for (const route of matched) {
        if (!route.kanaal_id) continue;
        const kanaal = kanalen.get(route.kanaal_id);
        if (!kanaal) continue;
        // Niet-actieve kanalen overslaan (gepauzeerd/defect).
        if (kanaal.status !== "actief") continue;

        const outcome = await dispatchOne(db, item, route, kanaal);
        if (outcome.status === "verzonden") bronVerzonden++;
        else if (outcome.status === "overgeslagen_dedup") bronDedup++;
        else bronFout++;
      }
    }

    summary.per_bron[bron] = {
      items: items.length,
      routes: routes.length,
      verzonden: bronVerzonden,
      overgeslagen_dedup: bronDedup,
      fout: bronFout,
      feed_gevonden: items.length > 0,
    };
    summary.verzonden += bronVerzonden;
    summary.overgeslagen_dedup += bronDedup;
    summary.fout += bronFout;
  }

  return NextResponse.json({ ok: true, ...summary });
}
