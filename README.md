# x1F Lead Dashboard v2

Statisches Vanilla-Dashboard für x1F Sales Account-Manager im FSI-Bereich. Hosted auf Netlify, Daten aus Supabase.

## Features

| Seite | Was |
|---|---|
| **Briefing** (`#/`)        | Tagesübersicht: KPIs, Top-Leads, Action-Queue, Heatmap |
| **Leads** (`#/leads`)      | Filterbare Bank-Liste + CSV-Export |
| **Pipeline** (`#/pipeline`)| Kanban-View mit Drag&Drop (im Edit-Mode) |
| **Signals** (`#/signals`)  | Signal-Feed mit Pitch-Vorschlag, Status-Update |
| **Kontakte** (`#/contacts`)| Decision-Maker-Verzeichnis, ID-basiert für Connection-Anlage |
| **Netzwerk** (`#/network`) | Cytoscape-Graph aller Personen + Verbindungen |
| **Bank-Detail** (`#/bank/123`) | Pain-Signale + Decision-Maker + Mini-Graph + **Recherche-Helfer** |

## 🔍 Recherche-Helfer (Bank-Detail)

Pro Bank ein Klick → öffnet vorbereitete Suchen für:
- Vorstand, CIO, CFO Recherche
- SAP-Stellen
- LinkedIn People-Suche
- Geschäftsbericht
- Pressemitteilungen
- TED Ausschreibungen
- Bundesanzeiger
- Karriereseite der Bank

## ✏️ Edit-Mode

Klick auf das ✏️-Icon in der Topbar → Login mit API-Key.

**Was im Edit-Mode geht:**
- Decision-Maker bearbeiten/anlegen/löschen (echte Namen, LinkedIn, E-Mail, Influence)
- Connections zwischen Personen anlegen/löschen (auch cross-bank)
- Bank-Stammdaten bearbeiten (Notizen, Mitarbeiter, x1F-Bestandskunden-Flag)
- Outreach-Status pro Signal setzen (Dropdown direkt am Signal)
- **Pipeline drag&drop**: Karten zwischen Statusspalten verschieben

**API-Key setzen** (einmalig):
1. Supabase Dashboard → Project Settings → Edge Functions → Manage Secrets
2. Add new secret: `LEADS_API_KEY` = ein langes Random-Token (z.B. `openssl rand -hex 32`)
3. Diesen Token im Dashboard im Edit-Login eingeben

> Solange `LEADS_API_KEY` nicht gesetzt ist, akzeptiert die API jeden Wert (Dev-Modus).

## Deploy

Schon erledigt — Netlify build von `main` Branch. Nach `git push` deployt Netlify automatisch.

```bash
git add . && git commit -m "Update" && git push
```

## Datenmodell

```
banks (id, name, segment, country, hq_city, domain, parent_group, employees, total_assets_eur_bn, is_x1f_customer, notes)
  ├─ signals (bank_id, title, x1f_relevance, signal_type, outreach_status, body, keywords_matched, source_url)
  └─ contacts (bank_id, full_name, role_title, seniority, functional_area, influence_score,
               is_decision_maker, is_placeholder, linkedin_url, email,
               previous_employer, alma_mater, notes, source, source_url)

connections (contact_a, contact_b, relationship, evidence, source_url, strength)

Relationship-Typen:
  reports_to, co_worker_current, co_worker_past, alumni,
  co_speaker, board_interlock, co_author, referred_by, known_via
```

## Daten pflegen — drei Wege

### A) Über das Dashboard (nach Edit-Mode-Login)
- Bank-Detail → "+ Neu" auf Decision-Maker-Sektion
- Bank-Detail → "+ Connection" auf Verbindungen
- Bank-Detail → "Bearbeiten" für Stammdaten

### B) Über die Edge Function API
```bash
# Outreach-Status setzen
curl -X POST https://wlxolfkhkxembiuofmfa.supabase.co/functions/v1/leads-api/outreach \
  -H "X-API-Key: $LEADS_API_KEY" -H "Content-Type: application/json" \
  -d '{"signal_id": 12, "status": "contacted", "note": "Erstgespräch"}'

# Kontakt anlegen
curl -X POST https://wlxolfkhkxembiuofmfa.supabase.co/functions/v1/leads-api/contact \
  -H "X-API-Key: $LEADS_API_KEY" -H "Content-Type: application/json" \
  -d '{"bank_id": 1, "full_name": "Max Mustermann", "role_title": "CIO",
       "seniority": "Vorstand", "influence_score": 90, "linkedin_url": "https://linkedin.com/in/..."}'

# Bulk-Import von Signalen (für externe Scraper)
curl -X POST https://wlxolfkhkxembiuofmfa.supabase.co/functions/v1/leads-api/ingest \
  -H "X-API-Key: $LEADS_API_KEY" -H "Content-Type: application/json" \
  -d '[{"bank_name_raw": "Deutsche Bank", "title": "Senior SAP Architect", "x1f_relevance": 80, ...}]'
```

### C) Direkt in Supabase Studio (SQL Editor)
```sql
-- Echten Namen statt Platzhalter setzen
UPDATE public.contacts
SET full_name = 'Max Mustermann', is_placeholder = false,
    linkedin_url = 'https://linkedin.com/in/...', source_url = '...'
WHERE id = 42;

-- Cross-Bank-Connection
INSERT INTO public.connections (contact_a, contact_b, relationship, evidence, strength)
VALUES (12, 34, 'alumni', 'Beide vorher bei Deutsche Bank Frankfurt', 70);
```

## Scraping & Aktualisierung

Aktuell läuft Scraping **manuell** durch Claude (mich). Für Automatisierung siehe [`AUTOMATION.md`](AUTOMATION.md) — Optionen:
1. **GitHub Actions Cron + Playwright** (free, 4h Setup)
2. **n8n self-hosted** (free, 1 Tag Setup)
3. **Make.com + SerpAPI** (50 €/Monat, 1h Setup)
4. **Apollo.io / Cognism API** (99-700 €/Monat, sales-grade, GDPR-clean)

Alle Pfade rufen am Ende `POST /leads-api/ingest` auf. Format siehe Edge Function Code.

## Dev / Lokal

```bash
cd x1f-leads-dashboard
python3 -m http.server 8080
# http://localhost:8080
```

## Sicherheit

- **anon-Key** (im Frontend hardcoded) ist kein Secret und nur für SELECT freigegeben
- **API_KEY** ist Secret, nur in Supabase Edge Function Secrets
- RLS-Policy erlaubt anon nur SELECT — kein direkter Write aus dem Frontend möglich
- Wenn du das Dashboard nicht öffentlich willst: Netlify Password Protection (Pro-Plan) oder Supabase Auth Layer einbauen

## Boss-Demo-Features (v6)

### 📋 Battle-Card (auf Bank-Detail)
Klick auf **"📋 Battle-Card"** auf jeder Bank-Detail-Seite → Claude generiert in 5-10 Sek ein 1-Seiten-Briefing mit:
- Top-3 Pain-Signale
- Decision-Maker-Reihenfolge (wer zuerst, warum)
- 3 konkrete Pitch-Hooks
- Why-Now-Argument
- Risiken / Vorsicht
- 3 Mail-Subject-Vorschläge

Alles als Markdown — kopierbar in Notion/OneNote, druckbar, klipboard-ready.

### 💰 Revenue-Page (`#/revenue`)
Pipeline-Attribution mit:
- **Pipeline-Wert** (Summe deal_value für offene Deals)
- **Won-Wert** (Summe abgeschlossener Deals)
- **Win-Rate** (won / (won+lost))
- **Funnel-Visualisierung** new → queued → contacted → meeting → won/lost
- **Performance pro Signal-Typ** — welcher Trigger bringt das meiste Geld?

Pro Deal eintragen: Edit-Mode → 💰-Icon am Signal → Wert + Status setzen.

### 🔔 Slack-Webhook (Hot-Signal-Alerts)
- Bei jedem neuen Signal mit `x1f_relevance >= 80`: automatisch in Slack posten
- Bei Deal-Status `won`: 🎉-Notification
- Manuell pro Signal: 🔔-Icon im Edit-Mode

**Setup:**
1. Slack: **Apps → Incoming Webhooks → Add to Workspace**
2. Channel auswählen (z.B. `#sales-x1f-leads`)
3. Webhook-URL kopieren (`https://hooks.slack.com/services/T.../B.../xxx`)
4. Supabase: **Project Settings → Edge Functions → Secrets → New**
   - Name: `SLACK_WEBHOOK_URL`
   - Value: die URL aus Schritt 3
5. Save → ab nächstem `/ingest` oder `/slack-notify`-Call landen Alerts im Channel

**Test:**
```bash
KEY=$(cat .leads-secrets.local)
curl -X POST "https://wlxolfkhkxembiuofmfa.supabase.co/functions/v1/leads-api/slack-notify" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"signal_id": 2}'
```
Erwartet: `{"posted": true}` + Nachricht im Slack-Channel.

## Signal-Taxonomie (v4)

23 Trigger-Typen die ein FSI-Account-Manager trackt — jeder mit eigener Pitch-Logik:

| Typ | Was | x1F-Hebel |
|---|---|---|
| 👤 `job_posting` | SAP-Stellen | Beratungs-Pitch |
| 📋 `tender` | Öffentliche Ausschreibung | Bidder-Position |
| 🪑 `leadership_change` | CEO/CIO/CFO-Wechsel | 100-Tage-Trigger |
| ⚖️ `regulatory_deadline` | DORA/CSRD/Basel IV/IFRS | Pflicht-Budget |
| 🤝 `ma_activity` | M&A / Carve-out | System-Konsolidierung |
| ✂️ `restructuring` | Stellenabbau / Effizienz | Automatisierung |
| ☁️ `cloud_migration` | RISE/GROW with SAP | Migration Services |
| ⭐ `customer_reference` | SAP-Customer-Story | Cross-Sell |
| 💰 `earnings_mention` | CFO commits IT-Budget | Strategie-Gespräch |
| 📊 `annual_report_mention` | Geschäftsbericht-Hint | Roadmap-Alignment |
| 🎤 `conference_talk` | Banking-/SAP-Sprecher | Direkt-Kontakt |
| 🏁 `competitor_win` | KPMG/Deloitte gewinnt | Sub-Bidder |
| 🚨 `compliance_finding` | BaFin/MaRisk | Schnell-Fix |
| 💡 `innovation_signal` | Innovation Lab | Plattform-Partner |
| 🏢 `office_expansion` | New-Market | Multi-Site |
| 🔄 `vendor_switch` | Avaloq/Temenos | SAP-Pfad |
| ⚠️ `sanction_event` | Sanktion/Strafe | Remediation |
| 👥 `aufsichtsrat_change` | AR-Wechsel | Top-Down |
| 🤝 `partnership` | Tech-Partnerschaft | Ecosystem |
| 📢 `project_announcement` | IT-Projekt-Announcement | Sofort-Kontakt |
| 🛠️ `tech_stack_signal` | GitHub/Patente | Architektur-Workshop |
| 📈 `directors_dealings` | Insider-Trades | Strategy-Watch |
| 📰 `press_release` | Allgemeine PR | Kontext-Aufbau |

Volle Pitch-Templates pro Typ in `public.v_outreach_pitches` (SQL-View).
Auto-Klassifikation: `scraper/scrape.js → classifyType()` mappt Title+Snippet auf Typ.

## Neue Features (v3)

- **🌓 Dark/Light Theme-Toggle** in der Topbar (gespeichert in localStorage)
- **🖨 Print-Briefing**: Klick auf 🖨 → druckfreundlicher Briefing-Ausdruck
- **📱 Mobile Responsive**: Layout passt sich Smartphone an
- **📝 Activity Log pro Bank**: Notizen, Calls, Meetings mit Timestamp + Typ
- **✨ LLM-Pitch-Generator**: Klick auf ✨ am Signal → Claude generiert Outreach-Mail in deinem Tonfall
- **🤖 GitHub Actions Auto-Crawler**: `scraper/` Ordner enthält Playwright-Worker, läuft automatisch jeden Mo 8 Uhr UTC

### LLM-Pitch-Generator aktivieren

In Supabase → Project Settings → Edge Functions → Secrets hinzufügen:
```
ANTHROPIC_API_KEY = sk-ant-...
```

Dann erscheint im Edit-Mode ein ✨-Icon neben Signalen — klicken → Tonalität wählen → fertige E-Mail bekommen.

### Auto-Crawler aktivieren

1. GitHub Repo → Settings → Secrets and variables → Actions
2. New repository secret: `LEADS_API_KEY = <dein-supabase-secret>`
3. Workflow läuft automatisch jeden Montag 8 Uhr UTC, oder manuell via "Actions → x1F Lead Scraper → Run workflow"

Konfigurierte Banken in `scraper/target_banks.json` editieren → commit → push → wird beim nächsten Lauf verwendet.

## Tech-Stack

- HTML/CSS/JS, keine Bundler, keine Frameworks
- Supabase JS SDK v2 + Edge Functions (Deno) — leads-api v3
- Cytoscape.js 3.30 für Graph
- Anthropic Claude 3.5 Sonnet für Pitch-Generation
- Playwright + GitHub Actions für Auto-Crawling
- Netlify static hosting + GitHub auto-deploy

Architektur-Details: siehe [ARCHITECTURE.md](ARCHITECTURE.md)
