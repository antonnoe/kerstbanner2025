import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export interface AdminCheck {
  ok: boolean;
  email: string | null;
}

/**
 * Controleert of de huidige request van een ingelogde admin komt.
 * Gebruik in /api/admin/* route-handlers (de middleware dekt alleen /admin/*).
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { ok: false, email: null };

  const db = getAdminClient();
  const { data } = await db
    .from("admin_gebruikers")
    .select("email")
    .ilike("email", user.email)
    .maybeSingle();

  return { ok: !!data, email: user.email };
}
