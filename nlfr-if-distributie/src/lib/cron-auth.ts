import { NextRequest } from "next/server";

/**
 * Beveiliging voor cron-endpoints. Vercel stuurt automatisch
 * `Authorization: Bearer ${CRON_SECRET}` mee bij geplande cron-runs.
 * Handmatig aanroepen kan met dezelfde header.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Geen secret ingesteld: blokkeer (fail closed) behalve in development.
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
