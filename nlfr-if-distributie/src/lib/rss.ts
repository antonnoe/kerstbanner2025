import { XMLParser } from "fast-xml-parser";
import type { Bron, FeedItem } from "./types";

const NLFR_PRIMARY =
  "https://www.nederlanders.fr/profiles/blog/feed?xn_auth=no";
const NLFR_FALLBACK = "https://www.nederlanders.fr/profiles/blog/feed";
const IF_FEED = "https://infofrankrijk.com/feed/";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Behoud arrays voor velden die meerdere keren kunnen voorkomen.
  isArray: (name) => ["item", "category", "media:content", "enclosure"].includes(name),
});

function stripHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFrom(description: string): string {
  const text = stripHtml(description ?? "");
  return text.length > 300 ? text.slice(0, 300).trimEnd() + "…" : text;
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"] ?? "");
  }
  return String(v);
}

function extractImage(item: Record<string, unknown>): string | null {
  // 1) media:content
  const media = item["media:content"] as Array<Record<string, string>> | undefined;
  if (Array.isArray(media)) {
    for (const m of media) {
      const url = m?.["@_url"];
      if (url) return url;
    }
  }
  // 2) enclosure
  const enc = item["enclosure"] as Array<Record<string, string>> | undefined;
  if (Array.isArray(enc)) {
    for (const e of enc) {
      const url = e?.["@_url"];
      const type = e?.["@_type"] ?? "";
      if (url && (type.startsWith("image") || /\.(jpg|jpeg|png|webp|gif)/i.test(url))) {
        return url;
      }
    }
    // anders: eerste enclosure-url
    if (enc[0]?.["@_url"]) return enc[0]["@_url"];
  }
  // 3) media:thumbnail
  const thumb = item["media:thumbnail"] as Record<string, string> | undefined;
  if (thumb?.["@_url"]) return thumb["@_url"];
  return null;
}

function toIso(pubDate: string | undefined): string | null {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseItems(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const channel = (doc?.rss as Record<string, unknown>)?.channel as
    | Record<string, unknown>
    | undefined;
  const rawItems = (channel?.item ?? []) as Array<Record<string, unknown>>;

  return rawItems
    .map((item): FeedItem | null => {
      const link = asText(item.link).trim();
      const titel = stripHtml(asText(item.title));
      if (!link || !titel) return null;

      const categories = (item.category as unknown[] | undefined) ?? [];
      const categorieen = categories
        .map((c) => stripHtml(asText(c)))
        .filter((c) => c.length > 0);

      const description = asText(item.description) || asText(item["content:encoded"]);

      return {
        link,
        titel,
        excerpt: excerptFrom(description),
        image_url: extractImage(item),
        gepubliceerd_op: toIso(asText(item.pubDate)),
        categorieen,
      };
    })
    .filter((i): i is FeedItem => i !== null);
}

async function fetchXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "nlfr-if-distributie/1.0 (+vercel-cron)" },
      // RSS mag gerust kort gecachet worden, maar cron wil verse data.
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text && text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}

export interface FeedResult {
  items: FeedItem[];
  /** De feed-URL die uiteindelijk werkte (voor NLFR-fallback-logging). */
  usedUrl: string | null;
}

/**
 * Haal de NLFR-feed op. Probeert eerst de primaire URL (met xn_auth=no),
 * valt bij 404/leeg terug op de variant zonder query-string.
 * `knownUrl` (uit instellingen) wordt eerst geprobeerd indien aanwezig.
 */
export async function fetchNlfr(knownUrl?: string | null): Promise<FeedResult> {
  const candidates = [knownUrl, NLFR_PRIMARY, NLFR_FALLBACK].filter(
    (u, i, arr): u is string => !!u && arr.indexOf(u) === i,
  );

  for (const url of candidates) {
    const xml = await fetchXml(url);
    if (!xml) continue;
    const items = parseItems(xml);
    if (items.length > 0) return { items, usedUrl: url };
  }
  return { items: [], usedUrl: null };
}

export async function fetchIf(): Promise<FeedResult> {
  const xml = await fetchXml(IF_FEED);
  if (!xml) return { items: [], usedUrl: null };
  return { items: parseItems(xml), usedUrl: IF_FEED };
}

export async function fetchFeed(
  bron: Bron,
  knownNlfrUrl?: string | null,
): Promise<FeedResult> {
  return bron === "nlfr" ? fetchNlfr(knownNlfrUrl) : fetchIf();
}
