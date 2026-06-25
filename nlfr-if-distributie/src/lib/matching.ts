import type { FeedItem, Route } from "./types";

/** Case-insensitieve, trim-tolerante vergelijking van categorieën. */
function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Bepaalt of een item matcht met een route op basis van match_type:
 *  - 'alle'           : altijd match
 *  - 'categorie_any'  : minstens één match_waarde zit in de item-categorieën
 *  - 'categorie_all'  : alle match_waarden zitten in de item-categorieën
 */
export function itemMatchesRoute(item: FeedItem, route: Route): boolean {
  if (route.match_type === "alle") return true;

  const itemCats = new Set(item.categorieen.map(norm));
  const wanted = route.match_waarden.map(norm).filter((w) => w.length > 0);
  if (wanted.length === 0) return false;

  if (route.match_type === "categorie_any") {
    return wanted.some((w) => itemCats.has(w));
  }
  if (route.match_type === "categorie_all") {
    return wanted.every((w) => itemCats.has(w));
  }
  return false;
}

/** Alle actieve routes die op dit item matchen. */
export function matchingRoutes(item: FeedItem, routes: Route[]): Route[] {
  return routes.filter(
    (r) => r.status === "actief" && itemMatchesRoute(item, r),
  );
}
