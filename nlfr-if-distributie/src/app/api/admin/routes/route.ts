import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BRONNEN = ["nlfr", "if"];
const MATCH_TYPES = ["alle", "categorie_any", "categorie_all"];
const STATUSSEN = ["actief", "gepauzeerd"];

function cleanWaarden(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => String(v).trim()).filter((v) => v.length > 0);
}

export async function GET() {
  const db = getAdminClient();
  const { data, error } = await db
    .from("distributie_routes")
    .select("*")
    .order("bron", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routes: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { bron, match_type, match_waarden, kanaal_id } = body;
  if (!BRONNEN.includes(bron) || !MATCH_TYPES.includes(match_type)) {
    return NextResponse.json({ error: "geldige bron en match_type vereist" }, { status: 400 });
  }
  if (!kanaal_id) {
    return NextResponse.json({ error: "kanaal_id vereist" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data, error } = await db
    .from("distributie_routes")
    .insert({
      bron,
      match_type,
      match_waarden: cleanWaarden(match_waarden),
      kanaal_id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ route: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id vereist" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (BRONNEN.includes(rest.bron)) patch.bron = rest.bron;
  if (MATCH_TYPES.includes(rest.match_type)) patch.match_type = rest.match_type;
  if ("match_waarden" in rest) patch.match_waarden = cleanWaarden(rest.match_waarden);
  if (rest.kanaal_id) patch.kanaal_id = rest.kanaal_id;
  if (STATUSSEN.includes(rest.status)) patch.status = rest.status;

  const db = getAdminClient();
  const { data, error } = await db
    .from("distributie_routes")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ route: data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id vereist" }, { status: 400 });

  const db = getAdminClient();
  const { error } = await db.from("distributie_routes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
