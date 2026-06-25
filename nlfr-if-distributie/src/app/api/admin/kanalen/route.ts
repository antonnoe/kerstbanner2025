import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const TYPES = ["facebook_page", "linkedin_profile", "linkedin_company"];
const STATUSSEN = ["actief", "gepauzeerd", "defect"];

async function guard() {
  const check = await requireAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const db = getAdminClient();
  const { data, error } = await db
    .from("distributie_kanalen")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kanalen: data });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { naam, type, zapier_hook } = body;
  if (!naam || !TYPES.includes(type)) {
    return NextResponse.json({ error: "naam en geldig type vereist" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data, error } = await db
    .from("distributie_kanalen")
    .insert({ naam, type, zapier_hook: zapier_hook ?? "" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kanaal: data });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id vereist" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof rest.naam === "string") patch.naam = rest.naam;
  if (TYPES.includes(rest.type)) patch.type = rest.type;
  if (typeof rest.zapier_hook === "string") patch.zapier_hook = rest.zapier_hook;
  if (STATUSSEN.includes(rest.status)) patch.status = rest.status;

  const db = getAdminClient();
  const { data, error } = await db
    .from("distributie_kanalen")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kanaal: data });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id vereist" }, { status: 400 });

  const db = getAdminClient();
  const { error } = await db.from("distributie_kanalen").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
