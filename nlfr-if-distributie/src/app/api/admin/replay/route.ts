import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { postToHook } from "@/lib/dispatch";
import type { WebhookPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Verstuurt de laatste mislukte post voor een kanaal opnieuw.
 * Hergebruikt de opgeslagen payload uit de log-rij.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kanaal_id: string | undefined = body.kanaal_id;
  if (!kanaal_id) return NextResponse.json({ error: "kanaal_id vereist" }, { status: 400 });

  const db = getAdminClient();

  const { data: kanaal } = await db
    .from("distributie_kanalen")
    .select("*")
    .eq("id", kanaal_id)
    .maybeSingle();
  if (!kanaal) return NextResponse.json({ error: "kanaal niet gevonden" }, { status: 404 });
  if (!kanaal.zapier_hook) {
    return NextResponse.json({ error: "geen webhook ingesteld" }, { status: 400 });
  }

  const { data: laatsteFout } = await db
    .from("distributie_log")
    .select("*")
    .eq("kanaal_id", kanaal_id)
    .eq("status", "fout")
    .order("verzonden_op", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!laatsteFout) {
    return NextResponse.json({ error: "geen mislukte post om opnieuw te sturen" }, { status: 404 });
  }

  const payload = (laatsteFout.payload ?? null) as WebhookPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "geen payload bewaard voor deze rij" }, { status: 400 });
  }

  const result = await postToHook(kanaal.zapier_hook, payload);
  const responseText = `HTTP ${result.status} — ${result.body}`;

  if (result.ok) {
    await db
      .from("distributie_log")
      .update({ status: "verzonden", response: responseText, fout_msg: null })
      .eq("id", laatsteFout.id);
    await db
      .from("distributie_kanalen")
      .update({ last_success: new Date().toISOString() })
      .eq("id", kanaal_id);
  } else {
    await db
      .from("distributie_log")
      .update({ response: responseText })
      .eq("id", laatsteFout.id);
    await db
      .from("distributie_kanalen")
      .update({
        last_error: new Date().toISOString(),
        last_error_msg: `Replay mislukt: ${responseText}`.slice(0, 500),
      })
      .eq("id", kanaal_id);
  }

  return NextResponse.json({ ok: result.ok, status: result.status, body: result.body });
}
