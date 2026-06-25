import type { SupabaseClient } from "@supabase/supabase-js";
import type { Instellingen } from "./types";

const DEFAULTS: Omit<Instellingen, "updated_at"> = {
  id: 1,
  admin_email: process.env.ADMIN_EMAIL ?? null,
  stilte_uren: 6,
  foutburst_aantal: 3,
  foutburst_minuten: 60,
  alert_dedup_uren: 24,
  nlfr_feed_url: null,
};

export async function getInstellingen(db: SupabaseClient): Promise<Instellingen> {
  const { data } = await db
    .from("distributie_instellingen")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!data) {
    return { ...DEFAULTS, updated_at: new Date().toISOString() };
  }
  // Val terug op defaults voor eventueel ontbrekende velden.
  return {
    id: 1,
    admin_email: data.admin_email ?? DEFAULTS.admin_email,
    stilte_uren: data.stilte_uren ?? DEFAULTS.stilte_uren,
    foutburst_aantal: data.foutburst_aantal ?? DEFAULTS.foutburst_aantal,
    foutburst_minuten: data.foutburst_minuten ?? DEFAULTS.foutburst_minuten,
    alert_dedup_uren: data.alert_dedup_uren ?? DEFAULTS.alert_dedup_uren,
    nlfr_feed_url: data.nlfr_feed_url ?? null,
    updated_at: data.updated_at ?? new Date().toISOString(),
  };
}

export async function getAdminEmail(db: SupabaseClient): Promise<string | null> {
  const i = await getInstellingen(db);
  return i.admin_email ?? process.env.ADMIN_EMAIL ?? null;
}
