import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client gebonden aan de request-cookies (auth-sessie).
 * Gebruik dit in Server Components / Route Handlers om de ingelogde
 * gebruiker te bepalen. Respecteert RLS.
 */
export async function getServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Record<string, unknown>),
            );
          } catch {
            // setAll kan falen in een pure Server Component (read-only).
            // De middleware ververst de sessie, dus dat is hier veilig.
          }
        },
      },
    },
  );
}
