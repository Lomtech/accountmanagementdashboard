# x1F Lead Dashboard

Statisches Dashboard (Vanilla HTML/JS/CSS) auf Supabase-Daten — für Account-Manager im FSI-Bereich.

## Was ist drin?

- **Briefing** — Tagesübersicht: Top-Banken, Action-Queue, Segment-Heatmap
- **Leads** — Filterbare Liste aller Banken mit aktiven Signalen
- **Bank-Detail** — Pain-Signale, Decision-Maker, Mini-Netzwerk je Bank
- **Signal-Feed** — alle Signale ≥ 60 Relevance, mit Pitch-Vorschlag
- **Kontakte** — Decision-Maker-Verzeichnis mit Filter (Seniority, Bereich)
- **Netzwerk** — interaktiver Graph aller Personen + Verbindungen (Cytoscape.js)

Keine Build-Tools, keine Frameworks. Drei Files: `index.html`, `styles.css`, `app.js`.

## Datenquelle

Supabase Projekt `wlxolfkhkxembiuofmfa` (eu-west-2). Schreibt direkt aus dem Frontend per **publishable anon key** (RLS auf `SELECT` für `anon` ist aktiv).

Wenn du das Projekt umziehst, ändere oben in `app.js`:
```js
const SUPABASE_URL = "https://<dein-projekt>.supabase.co";
const SUPABASE_KEY = "sb_publishable_...";
```

## Lokal testen

```bash
cd x1f-leads-dashboard
python3 -m http.server 8080
# oder: npx serve .
```
Dann: http://localhost:8080

> Hinweis: einfach `index.html` doppelklicken funktioniert **nicht** (ES-Module brauchen `http://`).

## Deploy auf Netlify

**Variante A — Drag & Drop:**
1. https://app.netlify.com/drop
2. Den ganzen Ordner `x1f-leads-dashboard` reinziehen
3. Fertig — du bekommst eine `*.netlify.app` URL

**Variante B — Git-basiert:**
1. Push den Ordner in ein GitHub-Repo
2. Netlify → "Add new site" → "Import from Git"
3. Build settings: leer lassen (Publish directory = `/`)
4. Deploy

**Custom Domain:** unter Site settings → Domain management.

## Deploy auf GitHub Pages

```bash
cd x1f-leads-dashboard
git init
git add .
git commit -m "x1F lead dashboard"
git branch -M main
git remote add origin git@github.com:<user>/x1f-leads-dashboard.git
git push -u origin main
```
Dann auf GitHub: **Settings → Pages → Source: main → / (root) → Save.**

URL: `https://<user>.github.io/x1f-leads-dashboard/`

## Sicherheit / Datenschutz

- Der Supabase **publishable key** ist explizit für Frontend-Nutzung gedacht und **kein Secret**.
- Lese-Zugriff ist via **RLS-Policy** auf `SELECT` öffentlich freigegeben, weil die Daten aus öffentlichen Quellen kommen.
- **Schreib-Zugriff** geht NICHT direkt aus dem Frontend — dafür gibt es die Edge Function `leads-api` (mit `X-API-Key`-Header) für externe Worker.
- Wenn du das Dashboard nicht öffentlich machen willst:
  - Netlify: **Password protection** (kostenpflichtig im Pro-Plan)
  - GitHub Pages: nur in **Private Repo** mit Pages Pro
  - Oder: einen einfachen Auth-Layer in `app.js` einbauen (z. B. Supabase Magic-Link)

## Datenmodell-Quick-Ref

```
banks (id, name, segment, country, ...)
  └─ signals (bank_id, title, x1f_relevance, signal_type, outreach_status, ...)
  └─ contacts (bank_id, full_name, role_title, seniority, functional_area, influence_score, is_placeholder)

connections (contact_a, contact_b, relationship, strength, evidence)
  Relationship-Typen: reports_to, co_worker_current/past, alumni,
                       co_speaker, board_interlock, co_author, referred_by, known_via
```

**Views (read-only)**:
- `v_top_leads` · `v_outreach_pitches` · `v_action_queue` · `v_segment_heatmap`
- `v_bank_contacts` · `v_network_nodes` · `v_network_edges` · `v_lead_full`
- `heat_score` · `hot_signals`

## Daten pflegen

**Echte Namen statt Platzhalter:**
```sql
UPDATE public.contacts
SET full_name = 'Max Mustermann',
    is_placeholder = false,
    linkedin_url = 'https://linkedin.com/in/...'
WHERE id = 42;
```

**Outreach-Status setzen** (per SQL oder Edge-Function):
```sql
SELECT public.set_outreach_status(123, 'contacted', 'Erstgespräch mit M. Mueller, Folge in 2 Wochen.');
```

**Neue Verbindung anlegen:**
```sql
INSERT INTO public.connections(contact_a, contact_b, relationship, evidence, strength)
VALUES (12, 34, 'alumni', 'Beide Goethe-Uni Frankfurt, BWL-Abschluss 2010', 60);
```

## Was fehlt (Backlog)

- Auth-Layer (z. B. Supabase Magic-Link) damit Dashboard nicht öffentlich
- Edge Function für Bulk-Import von Signalen aus externem Scraper (TED, Bundesanzeiger)
- Kanban-View für Pipeline (queued → contacted → meeting → won/lost)
- Email-Templates pro Pitch-Typ generieren (LLM-basiert)
- Push-Notification via Slack-Webhook bei neuen Hot Signals

## Tech-Stack

- Pure HTML/JS/CSS (keine Bundler, kein React)
- ES-Modules direkt aus dem Browser via [esm.sh](https://esm.sh/)
- [Supabase JS SDK v2](https://supabase.com/docs/reference/javascript/introduction)
- [Cytoscape.js 3.30](https://js.cytoscape.org/) für Graph-Visualisierung
