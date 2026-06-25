import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedItem, Kanaal, Route, WebhookPayload } from "./types";

export function buildPayload(item: FeedItem, bron: string): WebhookPayload {
  return {
    post_url: item.link,
    titel: item.titel,
    excerpt: item.excerpt,
    image_url: item.image_url,
    bron,
    gepubliceerd_op: item.gepubliceerd_op,
    categorieen: item.categorieen,
  };
}

export interface PostResult {
  ok: boolean;
  status: number;
  body: string;
}

/** POST de payload naar een Zapier-hook. Faalt nooit met een throw. */
export async function postToHook(
  hook: string,
  payload: WebhookPayload,
): Promise<PostResult> {
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.text()).slice(0, 1000);
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface DispatchOutcome {
  status: "verzonden" | "overgeslagen_dedup" | "fout";
  detail?: string;
}

/**
 * Verwerkt één (item, route, kanaal)-combinatie idempotent:
 *  1. Dedup-check op (post_url, kanaal_id) — bestaat al → overgeslagen_dedup
 *  2. Insert 'wacht'-rij (de unique-constraint voorkomt dubbele posts bij
 *     gelijktijdige cron-runs)
 *  3. POST naar de hook
 *  4. Update de log-rij + kanaalstatus naar verzonden/fout
 */
export async function dispatchOne(
  db: SupabaseClient,
  item: FeedItem,
  route: Route,
  kanaal: Kanaal,
): Promise<DispatchOutcome> {
  const payload = buildPayload(item, route.bron);

  // 1) Dedup — bestaat er al een rij voor (post_url, kanaal)?
  const { data: existing } = await db
    .from("distributie_log")
    .select("id,status")
    .eq("post_url", item.link)
    .eq("kanaal_id", kanaal.id)
    .maybeSingle();

  if (existing) {
    return { status: "overgeslagen_dedup" };
  }

  // 2) Claim de combinatie met een 'wacht'-rij. De unique-constraint
  //    (post_url, kanaal_id) maakt dit de atomaire dedup-grendel.
  const { data: claimed, error: claimErr } = await db
    .from("distributie_log")
    .insert({
      post_url: item.link,
      post_titel: item.titel,
      bron: route.bron,
      kanaal_id: kanaal.id,
      route_id: route.id,
      status: "wacht",
      payload,
    })
    .select("id")
    .single();

  if (claimErr || !claimed) {
    // Waarschijnlijk een race: een andere run claimde net dezelfde rij.
    return { status: "overgeslagen_dedup" };
  }

  // Kanaal zonder hook kan niet posten → markeer als fout (zichtbaar in UI).
  if (!kanaal.zapier_hook || kanaal.zapier_hook.trim() === "") {
    const msg = "Geen zapier_hook ingesteld voor dit kanaal.";
    await db
      .from("distributie_log")
      .update({ status: "fout", fout_msg: msg })
      .eq("id", claimed.id);
    await db
      .from("distributie_kanalen")
      .update({ last_error: new Date().toISOString(), last_error_msg: msg })
      .eq("id", kanaal.id);
    return { status: "fout", detail: msg };
  }

  // 3) POST
  const result = await postToHook(kanaal.zapier_hook, payload);
  const responseText = `HTTP ${result.status} — ${result.body}`;

  // 4) Update log + kanaal
  if (result.ok) {
    await db
      .from("distributie_log")
      .update({ status: "verzonden", response: responseText })
      .eq("id", claimed.id);
    await db
      .from("distributie_kanalen")
      .update({ last_success: new Date().toISOString() })
      .eq("id", kanaal.id);
    return { status: "verzonden" };
  } else {
    const msg = `Zapier weigerde: ${responseText}`;
    await db
      .from("distributie_log")
      .update({ status: "fout", fout_msg: msg, response: responseText })
      .eq("id", claimed.id);
    await db
      .from("distributie_kanalen")
      .update({
        last_error: new Date().toISOString(),
        last_error_msg: msg.slice(0, 500),
      })
      .eq("id", kanaal.id);
    return { status: "fout", detail: msg };
  }
}
