# nlfr-if-distributie

Eigen distributiesysteem voor **NLFR**- (nederlanders.fr) en **IF**-
(infofrankrijk.com) blogposts naar social kanalen. Vervangt de gestopte
Zapier-RSS→Facebook-koppeling.

De **slimme laag** (RSS ophalen, categoriseren, routeren, dedupliceren,
loggen, monitoren) zit in dit systeem. Zapier doet alleen nog het **domme
publiceren**: catch hook → kanaal-API. Zo blijven we platform-agnostisch en
toekomstbestendig.

> Norm: 10+ jaar zonder omkijken. Minimale dependencies, geen externe state
> buiten Supabase, alle bewegende delen waarneembaar in het dashboard.

---

## Architectuur

```
NLFR RSS ─┐
          ├─► Vercel cron (/api/cron/distribute, elke 15 min)
IF RSS  ──┘     ├─ parse items
                ├─ categoriseer (<category>-tags)
                ├─ match tegen distributie_routes
                ├─ dedup tegen distributie_log (unique post_url+kanaal)
                ├─ POST webhook → Zapier per match
                └─ schrijf log + update kanaalstatus
                        │
                        ▼
                Zapier (catch hook → FB/LinkedIn)

Monitor cron (/api/cron/monitor, elk uur):
  └─ stilte / foutburst / token-expiry → Resend-alert (met dedup)

Admin /admin (HTTP Basic Auth):
  overzicht · routes · kanalen · log · instellingen
```

## Stack

- **Next.js 15** (App Router, TypeScript) op **Vercel** (hosting + cron)
- **Supabase** (project `communities-tools`) — database (service-role)
- **Resend** — monitor-alerts
- **Zapier** — domme publish-engine (Anton beheert de Zaps)
- Dependencies: `@supabase/supabase-js`, `fast-xml-parser`

---

## Setup (eenmalig)

### 1. Supabase
1. Open het project **communities-tools** → SQL Editor.
2. Draai `supabase/migrations/0001_schema.sql` (tabellen + RLS).
3. Draai `supabase/migrations/0002_seed.sql` (3 kanalen, 4 routes).

> Geen Supabase-Auth nodig: het dashboard logt in met HTTP Basic Auth en
> praat met de database via de service-role-key. RLS staat deny-by-default aan.

### 2. Vercel
1. Koppel deze repo als nieuw Vercel-project (Anton, via de Vercel-UI).
2. Zet de env-vars (zie hieronder) — kies een sterk `ADMIN_PASS`.
3. Deploy. De crons uit `vercel.json` worden automatisch geregistreerd;
   Vercel genereert en injecteert `CRON_SECRET`.

### 3. Env-vars (Vercel → Settings → Environment Variables)

| Variabele | Omschrijving |
|---|---|
| `ADMIN_USER` | Gebruikersnaam voor de dashboard-login (Basic Auth) |
| `ADMIN_PASS` | Wachtwoord voor de dashboard-login (**geheim**) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role-key (backend + dashboard; **geheim**) |
| `RESEND_API_KEY` | Resend API-key (monitor-alerts) |
| `RESEND_FROM` | Afzender alerts, default `noreply@nederlanders.fr` |
| `ADMIN_EMAIL` | Ontvanger monitor-alerts (`antonnoe@gmail.com`) |
| `CRON_SECRET` | Auto-gegenereerd door Vercel bij cron-setup |
| `NEXT_PUBLIC_SITE_URL` | Productie-URL, bv `https://…vercel.app` (links in alerts) |

Zie `.env.example` voor een kopieerbare template (lokaal: `.env.local`).

### 4. Zapier
Volg **`ZAPIER-SETUP.md`**. Plak daarna per kanaal de webhook-URL in
`/admin/kanalen` en test met de **Test webhook**-knop.

---

## Lokale ontwikkeling

```bash
npm install
cp .env.example .env.local   # vul waarden in
npm run dev                  # http://localhost:3000
npm run typecheck            # tsc --noEmit
```

Crons lokaal handmatig triggeren (met `CRON_SECRET` uit je `.env.local`):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/distribute
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/monitor
```

---

## Login — HTTP Basic Auth

- Eén login, gezet via env-vars `ADMIN_USER` + `ADMIN_PASS`.
- `src/middleware.ts` dwingt Basic Auth af op **`/admin/*`** én
  **`/api/admin/*`**. Bij ontbrekende/foute credentials volgt een
  `401` met `WWW-Authenticate: Basic realm="nlfr-if-distributie"`, waarop de
  browser een login-dialoog toont en de credentials onthoudt.
- De cron-routes (`/api/cron/*`) vallen hierbuiten; die gebruiken `CRON_SECRET`.
- Geen Supabase-Auth, geen magic-link, geen Resend voor inloggen. Resend wordt
  alleen nog gebruikt voor monitor-alerts.
- Wachtwoord wijzigen: pas `ADMIN_PASS` aan in Vercel en redeploy.
- Uitloggen: sluit het browservenster (Basic Auth-credentials zijn
  browser-cache, niet server-side).

---

## Routing & matching

Een **route** koppelt een bron (`nlfr`/`if`) aan een kanaal met een regel:

| match_type | betekenis |
|---|---|
| `alle` | elk item van de bron matcht |
| `categorie_any` | minstens één `match_waarden` zit in de item-categorieën |
| `categorie_all` | álle `match_waarden` zitten in de item-categorieën |

Categorie-vergelijking is hoofdletter- en spatie-tolerant.

## Dedup (idempotentie)

Elke verzending is één rij in `distributie_log` met een **unique
`(post_url, kanaal_id)`**. Voor het posten wordt eerst een `wacht`-rij
geclaimd; die unique-constraint is de atomaire grendel waardoor dubbele of
gelijktijdige cron-runs nooit dubbel posten.

---

## Handmatige operaties

- **Webhook-URL invullen/wijzigen** → `/admin/kanalen` → Bewerk.
- **Kanaal pauzeren/hervatten** → overzicht of kanalen-tabel. Gepauzeerde en
  `defect`-kanalen worden door de distribute-cron overgeslagen.
- **Test-bericht sturen** → Test-knop (stuurt payload met `bron='test'`).
- **Mislukte post opnieuw sturen** → *Replay laatste fout* op het overzicht.
- **Route aanpassen** → `/admin/routes`.
- **Thresholds/alert-email** → `/admin/instellingen`.

---

## Troubleshooting

| Symptoom | Oorzaak / oplossing |
|---|---|
| Cron geeft `401 unauthorized` | `CRON_SECRET` ontbreekt of komt niet overeen. Vercel stuurt hem automatisch; bij handmatig testen zelf de Bearer-header meesturen. |
| `feed_gevonden: false` voor NLFR | Beide NLFR-URL-varianten faalden. Check `nederlanders.fr` handmatig; de werkende URL wordt onthouden in `distributie_instellingen.nlfr_feed_url`. |
| Kanaal blijft op `defect` | Foutburst gedetecteerd. Los de oorzaak op (meestal Zapier/OAuth) en zet het kanaal terug op `actief` in `/admin/kanalen`. |
| Geen alert-mails | Check `RESEND_API_KEY`, `RESEND_FROM` (geverifieerd domein in Resend) en de admin-email in instellingen. |
| Dashboard vraagt steeds om login | Browser onthoudt Basic Auth tot het venster sluit; controleer `ADMIN_USER`/`ADMIN_PASS` in Vercel. |
| Posts komen dubbel | Zou niet mogen door de unique-constraint. Controleer of `post_url` per item stabiel is in de feed. |
| Alert blijft uit bij stilte | By design: er wordt alleen gealerteerd als er nieuwe bron-items zijn maar niets verzonden is. Geen nieuwe content = geen storing. |

---

## Status van deze repo

Deze code is gebouwd in een sessie waarin het aanmaken van een nieuwe GitHub-
repo niet mogelijk was. Hij staat daarom (voorlopig) in de map
`nlfr-if-distributie/` op een feature-branch van `antonnoe/kerstbanner2025`.

**Migreren naar een eigen repo `antonnoe/nlfr-if-distributie`:**

```bash
# 1. Maak op github.com een lege private repo: antonnoe/nlfr-if-distributie
# 2. Lokaal, vanuit deze map:
cd nlfr-if-distributie
git init
git add .
git commit -m "Initial commit: nlfr-if-distributie"
git branch -M main
git remote add origin git@github.com:antonnoe/nlfr-if-distributie.git
git push -u origin main
```

Daarna: Vercel-project koppelen, env-vars zetten, Supabase-migraties draaien,
Zaps aanmaken (`ZAPIER-SETUP.md`), en het project toevoegen aan de
`antons-cockpit-private` portfolio.

## Buiten scope (v1)

Instagram, LinkedIn Company Pages, Threads/Bluesky/Mastodon, AI-rewrites/
vertalingen, beeld-generatie, multi-user admin, per-route scheduling.
