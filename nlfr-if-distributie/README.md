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

Admin /admin (magic-link auth):
  overzicht · routes · kanalen · log · instellingen
```

## Stack

- **Next.js 15** (App Router, TypeScript) op **Vercel** (hosting + cron)
- **Supabase** (project `communities-tools`) — database + magic-link auth
- **Resend** — monitor-alerts (en als SMTP-provider voor Supabase magic-links)
- **Zapier** — domme publish-engine (Anton beheert de Zaps)
- Dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `fast-xml-parser`

---

## Setup (eenmalig)

### 1. Supabase
1. Open het project **communities-tools** → SQL Editor.
2. Draai `supabase/migrations/0001_schema.sql` (tabellen + RLS).
3. Draai `supabase/migrations/0002_seed.sql` (3 kanalen, 4 routes, admin-user).
4. **Auth → Providers → Email**: zet *magic links* aan.
5. **Auth → SMTP**: vul de Resend-SMTP-gegevens in zodat magic-link-mails
   via `noreply@nederlanders.fr` verstuurd worden (zie *Magic-link* hieronder).
6. **Auth → URL Configuration**: voeg de productie-URL + `…/api/auth/callback`
   toe aan de toegestane redirect-URLs.

### 2. Vercel
1. Koppel deze repo als nieuw Vercel-project (Anton, via de Vercel-UI).
2. Zet de env-vars (zie hieronder).
3. Deploy. De crons uit `vercel.json` worden automatisch geregistreerd;
   Vercel genereert en injecteert `CRON_SECRET`.

### 3. Env-vars (Vercel → Settings → Environment Variables)

| Variabele | Omschrijving |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon-key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role-key (backend; **geheim**) |
| `RESEND_API_KEY` | Resend API-key (monitor-alerts) |
| `ALERT_FROM_EMAIL` | Afzender alerts, default `noreply@nederlanders.fr` |
| `ADMIN_EMAIL` | Fallback admin-email (`antonnoe@gmail.com`) |
| `CRON_SECRET` | Auto-gegenereerd door Vercel bij cron-setup |
| `NEXT_PUBLIC_SITE_URL` | Productie-URL, bv `https://…vercel.app` |

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

## Magic-link auth

- Toegang tot `/admin/*` vereist een geldige Supabase-sessie (afgedwongen door
  `src/middleware.ts`).
- Alleen e-mailadressen in de tabel `admin_gebruikers` worden geaccepteerd
  (gecontroleerd in elke `/api/admin/*`-route via `requireAdmin`).
- De login-pagina stuurt een Supabase magic-link; die mail loopt via de
  Resend-SMTP die je in Supabase instelt. **Afzenderdomein:
  `noreply@nederlanders.fr`** (default — wijzig in Supabase + `ALERT_FROM_EMAIL`
  als je liever `infofrankrijk.com` gebruikt).
- Nieuwe admin toevoegen: voeg een rij toe aan `admin_gebruikers`.

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
| Geen alert-mails | Check `RESEND_API_KEY`, `ALERT_FROM_EMAIL` (geverifieerd domein in Resend) en de admin-email in instellingen. |
| Magic-link komt niet aan | Check de Supabase-SMTP-config (Resend) en de redirect-URL-instellingen. |
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
