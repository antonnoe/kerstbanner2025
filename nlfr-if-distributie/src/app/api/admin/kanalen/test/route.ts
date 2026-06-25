import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { postToHook } from "@/lib/dispatch";
import type { WebhookPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Stuurt een dummy-payload (bron='test') naar de hook van een kanaal,
 * of naar een meegegeven `hook`-URL. Toont HTTP-status + body.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  let hook: string | undefined = body.hook;

  if (!hook && body.kanaal_id) {
    const db = getAdminClient();
    const { data } = await db
      .from("distributie_kanalen")
      .select("zapier_hook")
      .eq("id", body.kanaal_id)
      .maybeSingle();
    hook = data?.zapier_hook;
  }

  if (!hook) {
    return NextResponse.json(
      { error: "Geen webhook-URL ingesteld voor dit kanaal." },
      { status: 400 },
    );
  }

  const payload: WebhookPayload = {
    post_url: "https://example.com/test",
    titel: "Testbericht — nlfr-if-distributie",
    excerpt:
      "Dit is een testpayload vanuit het distributie-dashboard. Als je dit in Zapier ziet, werkt de webhook.",
    image_url: null,
    bron: "test",
    gepubliceerd_op: new Date().toISOString(),
    categorieen: ["test"],
  };

  const result = await postToHook(hook, payload);
  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    body: result.body,
  });
}
