import { NextResponse, type NextRequest } from "next/server";
import { isValidBasicAuth, challengeHeaders } from "@/lib/basic-auth";

/**
 * HTTP Basic Authentication op /admin/* en /api/admin/*.
 * Bij ontbrekende/ongeldige credentials → 401 met WWW-Authenticate, zodat
 * de browser een login-dialoog toont en de credentials onthoudt.
 *
 * De cron-routes (/api/cron/*) vallen hier buiten; die gebruiken CRON_SECRET.
 */
export function middleware(req: NextRequest) {
  if (!isValidBasicAuth(req.headers.get("authorization"))) {
    return new NextResponse("Authenticatie vereist.", {
      status: 401,
      headers: challengeHeaders(),
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
