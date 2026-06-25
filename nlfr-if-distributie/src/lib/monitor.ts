import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNlfr, fetchIf } from "./rss";
import { getInstellingen } from "./settings";
import { sendAlertMail, alertHtml } from "./resend";
import type { Bron, Instellingen, Kanaal, Route } from "./types";

export type AlertType = "stilte" | "foutburst" | "token";

const TOKEN_HINTS = ["auth", "token", "permission", "expired"];

interface AlertCandidate {
  kanaal: Kanaal;
  type: AlertType;
  errorMsg: string | null;
  suggestedAction: string;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** Welke bronnen leveren via actieve routes aan dit kanaal? */
function bronnenForKanaal(kanaalId: string, routes: Route[]): Set<Bron> {
  const set = new Set<Bron>();
  for (const r of routes) {
    if (r.kanaal_id === kanaalId && r.status === "actief") set.add(r.bron);
  }
  return set;
}

export interface MonitorReport {
  gecontroleerd: number;
  alerts_verstuurd: number;
  alerts_overgeslagen_dedup: number;
  details: Array<{ kanaal: string; type: AlertType; verstuurd: boolean; reden?: string }>;
}

export async function runMonitor(db: SupabaseClient): Promise<MonitorReport> {
  const instellingen = await getInstellingen(db);
  const adminEmail = instellingen.admin_email ?? process.env.ADMIN_EMAIL ?? null;

  const { data: kanalenData } = await db
    .from("distributie_kanalen")
    .select("*")
    .eq("status", "actief");
  const kanalen = (kanalenData ?? []) as Kanaal[];

  const { data: routesData } = await db
    .from("distributie_routes")
    .select("*")
    .eq("status", "actief");
  const routes = (routesData ?? []) as Route[];

  // Nieuwste publicatiedatum per bron (voor stilte-check).
  const newest: Record<Bron, number | null> = { nlfr: null, if: null };
  const [nlfr, iff] = await Promise.all([
    fetchNlfr(instellingen.nlfr_feed_url),
    fetchIf(),
  ]);
  newest.nlfr = newestTimestamp(nlfr.items.map((i) => i.gepubliceerd_op));
  newest.if = newestTimestamp(iff.items.map((i) => i.gepubliceerd_op));

  const candidates: AlertCandidate[] = [];

  for (const kanaal of kanalen) {
    const bronnen = bronnenForKanaal(kanaal.id, routes);

    // --- 1) Foutburst -------------------------------------------------
    const sinceBurst = new Date(
      Date.now() - instellingen.foutburst_minuten * 60_000,
    ).toISOString();
    const { count: foutCount } = await db
      .from("distributie_log")
      .select("id", { count: "exact", head: true })
      .eq("kanaal_id", kanaal.id)
      .eq("status", "fout")
      .gte("verzonden_op", sinceBurst);

    if ((foutCount ?? 0) >= instellingen.foutburst_aantal) {
      // Zet kanaal op defect.
      await db
        .from("distributie_kanalen")
        .update({ status: "defect" })
        .eq("id", kanaal.id);
      candidates.push({
        kanaal,
        type: "foutburst",
        errorMsg: kanaal.last_error_msg,
        suggestedAction:
          `${foutCount} fouten in ${instellingen.foutburst_minuten} min. Kanaal is op 'defect' gezet. ` +
          "Controleer de Zapier-Zap en de webhook-URL, los het op en hervat het kanaal in het dashboard.",
      });
      continue; // bij foutburst geen dubbele alerts voor hetzelfde kanaal
    }

    // --- 2) Token-waarschuwing ---------------------------------------
    const lastMsg = (kanaal.last_error_msg ?? "").toLowerCase();
    const hasTokenHint = TOKEN_HINTS.some((h) => lastMsg.includes(h));
    // Alleen relevant als de laatste fout recenter is dan het laatste succes.
    const errorIsRecent =
      kanaal.last_error &&
      (!kanaal.last_success ||
        new Date(kanaal.last_error) > new Date(kanaal.last_success));
    if (hasTokenHint && errorIsRecent) {
      candidates.push({
        kanaal,
        type: "token",
        errorMsg: kanaal.last_error_msg,
        suggestedAction:
          "De foutmelding wijst op een verlopen/ongeldige autorisatie. " +
          "Vernieuw de verbinding (OAuth) van het betreffende kanaal in Zapier.",
      });
      continue;
    }

    // --- 3) Stilte-alert ---------------------------------------------
    // Alleen alerten als er ECHT nieuwe content was sinds last_success
    // maar het kanaal niets verzond → wijst op een storing, niet op rust.
    const stilteSince = new Date(
      Date.now() - instellingen.stilte_uren * 3_600_000,
    ).getTime();
    const lastSuccessMs = kanaal.last_success
      ? new Date(kanaal.last_success).getTime()
      : 0;

    if (lastSuccessMs < stilteSince) {
      const refMs = lastSuccessMs; // na dit moment verwachten we activiteit
      const nieuweContent = [...bronnen].some((b) => {
        const n = newest[b];
        return n !== null && n > refMs;
      });
      if (nieuweContent) {
        candidates.push({
          kanaal,
          type: "stilte",
          errorMsg: kanaal.last_error_msg,
          suggestedAction:
            `Geen succesvolle post sinds ${kanaal.last_success ?? "onbekend"}, ` +
            "terwijl er wél nieuwe bron-items zijn. Controleer de Zap-status en de webhook-URL.",
        });
      }
    }
  }

  // --- Alerts versturen met dedup -----------------------------------
  const report: MonitorReport = {
    gecontroleerd: kanalen.length,
    alerts_verstuurd: 0,
    alerts_overgeslagen_dedup: 0,
    details: [],
  };

  for (const c of candidates) {
    const allowed = await shouldSendAlert(db, c.kanaal.id, c.type, instellingen);
    if (!allowed) {
      report.alerts_overgeslagen_dedup++;
      report.details.push({ kanaal: c.kanaal.naam, type: c.type, verstuurd: false, reden: "dedup" });
      continue;
    }

    if (!adminEmail) {
      report.details.push({
        kanaal: c.kanaal.naam,
        type: c.type,
        verstuurd: false,
        reden: "geen admin-email",
      });
      continue;
    }

    const subject = `[nlfr-if-distributie] ${c.kanaal.naam} — ${c.type}`;
    const text =
      `Kanaal: ${c.kanaal.naam}\n` +
      `Type: ${c.type}\n` +
      `Laatste melding: ${c.errorMsg ?? "—"}\n\n` +
      `Aanbevolen actie: ${c.suggestedAction}\n\n` +
      `Kanalen: ${siteUrl()}/admin/kanalen`;
    const html = alertHtml({
      kanaalNaam: c.kanaal.naam,
      alertType: c.type,
      errorMsg: c.errorMsg,
      suggestedAction: c.suggestedAction,
      kanalenUrl: `${siteUrl()}/admin/kanalen`,
    });

    const sent = await sendAlertMail({ to: adminEmail, subject, html, text });
    if (sent.ok) {
      await recordAlert(db, c.kanaal.id, c.type);
      report.alerts_verstuurd++;
      report.details.push({ kanaal: c.kanaal.naam, type: c.type, verstuurd: true });
    } else {
      report.details.push({
        kanaal: c.kanaal.naam,
        type: c.type,
        verstuurd: false,
        reden: sent.detail,
      });
    }
  }

  return report;
}

function newestTimestamp(dates: Array<string | null>): number | null {
  const ms = dates
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((n) => !isNaN(n));
  return ms.length ? Math.max(...ms) : null;
}

async function shouldSendAlert(
  db: SupabaseClient,
  kanaalId: string,
  type: AlertType,
  instellingen: Instellingen,
): Promise<boolean> {
  const { data } = await db
    .from("alert_dedup")
    .select("laatst_op")
    .eq("kanaal_id", kanaalId)
    .eq("alert_type", type)
    .maybeSingle();

  if (!data?.laatst_op) return true;
  const windowMs = instellingen.alert_dedup_uren * 3_600_000;
  return Date.now() - new Date(data.laatst_op).getTime() > windowMs;
}

async function recordAlert(
  db: SupabaseClient,
  kanaalId: string,
  type: AlertType,
): Promise<void> {
  await db
    .from("alert_dedup")
    .upsert(
      { kanaal_id: kanaalId, alert_type: type, laatst_op: new Date().toISOString() },
      { onConflict: "kanaal_id,alert_type" },
    );
}
