# ZAPIER-SETUP.md — voor Anton, na deployment

Dit systeem stuurt per kanaal een vaste JSON-payload naar een Zapier
*Catch Hook*. Zapier formatteert die naar het juiste platform. De
content-templates staan **in Zapier**, niet in onze code — zo blijft het
systeem platform-agnostisch.

## 0. Vooraf: oude koppeling opruimen

1. Verwijder in Zapier de oude **"Legacy" Facebook Pages-verbinding**
   (account-instellingen → Connections).
2. Maak een **nieuwe Facebook Pages-verbinding** via Zapier OAuth
   (huidige versie — *niet* 1.1.5).
3. Maak een **nieuwe LinkedIn-verbinding** voor je persoonlijke profiel.

> De oude Zapier-RSS→Facebook-Zap mag uit/weg zodra deze nieuwe live-gang
> bevestigd is.

## 1. Maak per kanaal één Zap

| Zap-naam | Trigger | Action |
|---|---|---|
| Distributie → FB nederlanders.fr | Webhooks by Zapier: **Catch Hook** | Facebook Pages: **Create Page Post** |
| Distributie → FB infofrankrijk | Webhooks by Zapier: **Catch Hook** | Facebook Pages: **Create Page Post** |
| Distributie → LinkedIn Anton | Webhooks by Zapier: **Catch Hook** | LinkedIn: **Create Update** |

## 2. De payload (wat elke Catch Hook ontvangt)

```json
{
  "post_url": "https://www.nederlanders.fr/profiles/blogs/...",
  "titel": "Titel van de post",
  "excerpt": "Eerste ~300 tekens, platte tekst",
  "image_url": "https://... of null",
  "bron": "nlfr",
  "gepubliceerd_op": "2026-06-25T14:30:00Z",
  "categorieen": ["Midden- en Kleinbedrijf", "Ondernemen"]
}
```

> Tip: gebruik de **Test webhook**-knop in `/admin/kanalen` (na stap 4) om
> Zapier een echte voorbeeld-payload te laten "vangen". Dan kun je in de
> action-config de velden netjes mappen.

## 3. Content-templates (in de Zapier action-config)

- **Facebook (Message):**
  ```
  {{titel}}

  {{excerpt}}

  {{post_url}}
  ```
- **LinkedIn (Comment/Text):**
  ```
  {{titel}}

  {{excerpt}}

  Lees meer: {{post_url}}
  ```
- **Afbeelding:** map het veld naar `{{image_url}}`. Laat de Zap een lege
  `image_url` netjes overslaan (geen afbeelding = tekst-post).

## 4. Webhook-URL koppelen

1. Kopieer per Zap de **Custom Webhook-URL** die Zapier toont bij de Catch
   Hook (begint met `https://hooks.zapier.com/hooks/catch/...`).
2. Open **`/admin/kanalen`** in het dashboard → **Bewerk** het juiste kanaal
   → plak de URL bij *Zapier webhook-URL* → **Opslaan**.

## 5. Testen

1. In `/admin/kanalen`: klik **Test** bij het kanaal. Het dashboard stuurt een
   payload met `bron='test'` en toont de HTTP-status + response inline.
2. Controleer in Zapier dat de hook de payload ontving en dat de mapping klopt.

## 6. Zaps aanzetten

Zet alle drie de Zaps **"On"**. Vanaf nu posten ze automatisch zodra de
distribute-cron (elke 15 min) een matchend item naar de hook stuurt.

## 7. Latere uitbreiding (LinkedIn Company)

Als er ooit een LinkedIn Company Page voor IF/NLFR komt: maak een extra kanaal
(`type = linkedin_company`) + Zap, en voeg een route toe. Geen code-wijziging
nodig.
