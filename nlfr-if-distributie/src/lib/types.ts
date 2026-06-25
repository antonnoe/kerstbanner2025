export type Bron = "nlfr" | "if";

export type KanaalType =
  | "facebook_page"
  | "linkedin_profile"
  | "linkedin_company";

export type KanaalStatus = "actief" | "gepauzeerd" | "defect";

export type MatchType = "alle" | "categorie_any" | "categorie_all";

export type RouteStatus = "actief" | "gepauzeerd";

export type LogStatus =
  | "verzonden"
  | "overgeslagen_dedup"
  | "fout"
  | "wacht";

export interface Kanaal {
  id: string;
  naam: string;
  type: KanaalType;
  zapier_hook: string;
  status: KanaalStatus;
  last_success: string | null;
  last_error: string | null;
  last_error_msg: string | null;
  created_at: string;
}

export interface Route {
  id: string;
  bron: Bron;
  match_type: MatchType;
  match_waarden: string[];
  kanaal_id: string | null;
  status: RouteStatus;
  created_at: string;
}

export interface LogRow {
  id: number;
  post_url: string;
  post_titel: string | null;
  bron: string | null;
  kanaal_id: string | null;
  route_id: string | null;
  status: LogStatus;
  fout_msg: string | null;
  payload: WebhookPayload | null;
  response: string | null;
  verzonden_op: string;
}

export interface Instellingen {
  id: number;
  admin_email: string | null;
  stilte_uren: number;
  foutburst_aantal: number;
  foutburst_minuten: number;
  alert_dedup_uren: number;
  nlfr_feed_url: string | null;
  updated_at: string;
}

/** Een genormaliseerd item uit een RSS-feed. */
export interface FeedItem {
  link: string;
  titel: string;
  excerpt: string;
  image_url: string | null;
  gepubliceerd_op: string | null; // ISO 8601
  categorieen: string[];
}

/** Het vaste, platform-agnostische webhook-schema (zie briefing §7). */
export interface WebhookPayload {
  post_url: string;
  titel: string;
  excerpt: string;
  image_url: string | null;
  bron: string;
  gepubliceerd_op: string | null;
  categorieen: string[];
}
