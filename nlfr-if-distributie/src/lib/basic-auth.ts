/**
 * HTTP Basic Authentication voor het admin-dashboard.
 * Eén login: ADMIN_USER + ADMIN_PASS (env-vars). Geen user-sessies,
 * geen Supabase-auth, geen Resend voor login — de browser onthoudt de
 * credentials zelf.
 */

const REALM = "nlfr-if-distributie";

/** Constante-tijd string-vergelijking (voorkomt timing-lekken). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valideert de Authorization-header tegen ADMIN_USER/ADMIN_PASS. */
export function isValidBasicAuth(authHeader: string | null): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  // Fail closed: zonder ingestelde credentials is er geen toegang.
  if (!user || !pass) return false;
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6).trim());
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const u = decoded.slice(0, sep);
  const p = decoded.slice(sep + 1);

  // Beide vergelijkingen altijd uitvoeren (geen short-circuit).
  const okUser = safeEqual(u, user);
  const okPass = safeEqual(p, pass);
  return okUser && okPass;
}

/** Headers voor een 401-challenge (browser toont login-dialoog). */
export function challengeHeaders(): Record<string, string> {
  return { "WWW-Authenticate": `Basic realm="${REALM}"` };
}
