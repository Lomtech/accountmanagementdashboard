# x1F Lead-Gen — Architecture

End-to-end Architektur des x1F Lead-Generation-Systems. Erklärt, wie Daten von externen Quellen über Scraping in die Datenbank kommen, wie die API darüber liegt und wie das Dashboard sie nutzt.

---

## 1. High-Level Übersicht

```mermaid
flowchart TB
    subgraph Quellen["🌐 Externe Datenquellen (öffentlich)"]
        G[Google Search<br/>Jobs Widget]
        SS[StepStone / Indeed<br/>eFinancialCareers]
        VS[Bank Vorstands-Pages<br/>db.com, dzbank.de, …]
        TED[TED EU<br/>evergabe-online · DTVP]
        BA[Bundesanzeiger<br/>Geschäftsberichte]
        PR[Pressemitteilungen<br/>Finanzwelt-Magazine]
    end

    subgraph Scrape["⚙️ Scraping-Layer"]
        CC["Claude in Chrome<br/>(heute - manuell)"]
        GA["GitHub Actions Cron<br/>+ Playwright (geplant)"]
        SP["SerpAPI / Apollo<br/>(optional, paid)"]
    end

    subgraph SB["🗄️ Supabase (eu-west-2)"]
        DB[(Postgres<br/>banks, signals,<br/>contacts, connections,<br/>bank_activity)]
        RLS[RLS Policies<br/>anon: SELECT only]
        EF["Edge Function<br/>leads-api (Deno)"]
        SECRETS[Secrets:<br/>LEADS_API_KEY<br/>ANTHROPIC_API_KEY]
    end

    subgraph FE["💻 Netlify (Static Hosting)"]
        DASH[Dashboard SPA<br/>HTML/JS/CSS]
        CY[Cytoscape.js<br/>Network-Graph]
    end

    subgraph User["👤 User"]
        AM[Sales Account-Manager<br/>x1F]
    end

    G & SS & VS --> CC
    TED & BA & PR --> CC
    CC -->|Insert/Update| DB
    CC -.->|/ingest mit X-API-Key| EF

    GA -->|Headless Browser| G
    GA -->|/ingest| EF
    SP -.->|optional| EF

    EF --> DB
    DB --> RLS
    RLS -->|anon-Key, SELECT| DASH

    EF -->|/briefing, /hot, …| DASH
    EF -->|/contact, /connection, /outreach| DASH

    DASH --> CY
    DASH <--> AM
    AM -->|Edit-Mode + API-Key| EF

    style CC fill:#fff0e6,stroke:#c2410c
    style GA fill:#e6f7ff,stroke:#0891b2,stroke-dasharray:4 4
    style SP fill:#f3f4f6,stroke:#6b7280,stroke-dasharray:4 4
    style EF fill:#ecfdf5,stroke:#16a34a
    style DB fill:#f5f3ff,stroke:#6d28d9
    style DASH fill:#fff7e6,stroke:#b45309
```

---

## 2. Komponenten im Detail

### 2.1 Datenquellen

Alles **öffentlich zugänglich**, keine ToS-Probleme:

| Quelle | Was | Wie geholt |
|---|---|---|
| **Google Search Jobs-Widget** | Aggregierte Stellen aus Indeed, StepStone, eFC, LinkedIn, Workday | `q=Bankname+SAP+stelle` → Widget oben |
| **Bank Vorstands-Pages** | Aktuelle Vorstände, Aufsichtsräte | direkt: `db.com/who-we-are`, `dzbank.de/vorstand`, etc. |
| **TED EU + evergabe-online + DTVP** | Öffentliche IT-Ausschreibungen (Bundesbank, Förderbanken, Sparkassen) | Volltext-Suche per Schlagwort |
| **Bundesanzeiger** | Geschäftsberichte aller deutschen Banken/Versicherer (Pflichtveröffentlichung) | Volltext-Suche, technisch sperrig |
| **Pressemitteilungen** | Personalia, IT-Projekt-Ankündigungen, Partnerschaften | finanz-szene, finance-magazin, börsen-zeitung |

### 2.2 Scraping-Layer

**Heute (Stufe 1): manuell über mich (Claude)**
- Du fragst → ich öffne Chrome via Browser-Extension → suche → parse → INSERT in Supabase
- Vorteil: flexibel, kontextsensitiv, kein Setup
- Nachteil: skaliert nicht, abhängig von meiner Verfügbarkeit

**Halbautomatisch (Stufe 2): n8n / Make.com / Zapier**
- Cron-Trigger → externe Workflow-Engine → HTTP an `/leads-api/ingest`
- 1 Tag Setup, 0–50 €/Monat
- Kann Google Jobs-Search abrufen, parsen, weiterreichen

**Vollautomatisch (Stufe 3): GitHub Actions + Playwright** (Skeleton in `/scraper/`)
- Cron im Repo → Headless Chromium → Suche → Parse → POST `/leads-api/ingest`
- Free Tier 2000min/Monat (ca. 200× wöchentlicher Lauf)
- ✅ vollständig automatisch, versioniert, audit-bar

**Premium (Stufe 4): Apollo / Cognism API**
- B2B-Daten-Anbieter mit Decision-Maker-Datenbank
- Direkter Pull über REST API, GDPR-clean (Cognism)
- 99–700 €/Monat, sales-grade Daten

### 2.3 Supabase (Backend)

**Postgres-Tabellen**:
```
banks         (id, name, segment, country, hq_city, domain, …)
signals       (bank_id, title, x1f_relevance, signal_type, outreach_status, …)
contacts      (bank_id, full_name, role_title, seniority, influence_score, is_placeholder, …)
connections   (contact_a, contact_b, relationship, evidence, strength, …)
bank_activity (bank_id, actor, content, type, created_at)
```

**Views** (read-optimiert für Frontend):
```
heat_score, hot_signals, v_top_leads, v_outreach_pitches,
v_action_queue, v_segment_heatmap, v_bank_contacts,
v_network_nodes, v_network_edges, v_lead_full
```

**RLS Policies**:
- `anon` Rolle hat **nur SELECT** (read-only public access)
- Schreibende Operationen laufen ausschließlich über die Edge Function mit Service-Role-Key
- Keine direkten INSERT/UPDATE/DELETE aus dem Frontend möglich

**Edge Function `leads-api`** (Deno-Runtime):
- Read-Endpoints (anonym): `/briefing`, `/hot`, `/action-queue`, `/segments`, `/lead-full`
- Write-Endpoints (X-API-Key required): `/ingest`, `/outreach`, `/contact`, `/connection`, `/bank`, `/activity`, `/generate-pitch`
- API-Key wird via Supabase Secret `LEADS_API_KEY` validiert

### 2.4 Frontend (Netlify Static Hosting)

**Komplett vanilla**: HTML / JS-ES-Modules / CSS — kein Build-Step, kein React.
Auto-Deploy bei jedem `git push` zum verbundenen GitHub-Repo.

**SPA-Routing** über URL-Hash (`#/`, `#/leads`, `#/bank/123`, `#/network`, ...) — funktioniert auch auf statischem Hosting ohne Server-Rewrite-Regeln.

**Datenzugriff**:
- Read: Supabase JS SDK direkt zur Postgres-API mit Anon-Key
- Write: `fetch()` zur Edge Function mit `X-API-Key` Header (im Edit-Mode)

---

## 3. Operative Flows

### 3.1 Flow A: Neues Pain-Signal erfassen (heute, manuell via Claude)

```mermaid
sequenceDiagram
    participant U as User
    participant C as Claude (Chrome-Ext)
    participant G as Google Search
    participant SB as Supabase Postgres
    participant DASH as Dashboard

    U->>C: "Such SAP-Banking Signale für Top-10 Banken"
    loop pro Bank
        C->>G: Google Search mit Bank+SAP-Keyword
        G-->>C: Results (Jobs Widget)
        C->>C: Parse Snippets, extract Title/Source/URL
        C->>C: Score Relevance (0-100) per Keyword-Match
    end
    C->>SB: INSERT INTO signals (...)
    SB-->>C: signal_id
    Note over DASH: User sieht neue Signale<br/>im Briefing (live, RLS-Refresh)
    DASH->>SB: SELECT v_top_leads
    SB-->>DASH: aktualisierte Liste
```

### 3.2 Flow B: Outreach-Status setzen (User im Dashboard)

```mermaid
sequenceDiagram
    participant U as User
    participant DASH as Dashboard (Browser)
    participant EF as Edge Function leads-api
    participant SB as Supabase Postgres

    U->>DASH: Pipeline-Karte drag & drop in "Contacted"
    DASH->>DASH: Check EDIT_MODE active + API_KEY in localStorage
    DASH->>EF: POST /outreach<br/>{signal_id, status:"contacted"}<br/>X-API-Key: ***
    EF->>EF: Validate API_KEY against LEADS_API_KEY secret
    EF->>SB: SELECT public.set_outreach_status(...)
    SB-->>EF: updated row
    EF-->>DASH: 200 OK {updated: {...}}
    DASH->>DASH: navigate() reload
    DASH->>SB: SELECT v_outreach_pitches
    SB-->>DASH: Karte erscheint in neuer Spalte
```

### 3.3 Flow C: Decision-Maker-Namen ergänzen

```mermaid
sequenceDiagram
    participant U as User
    participant DASH
    participant EF as Edge Function
    participant SB

    U->>DASH: Bank-Detail → Edit-Mode aktiv → ✏️ am Platzhalter
    DASH->>U: Modal mit Name-Feld, LinkedIn-URL, etc.
    U->>DASH: Eingabe + "Speichern"
    DASH->>EF: PATCH /contact?id=42<br/>{full_name, linkedin_url, is_placeholder:false, …}
    EF->>SB: UPDATE contacts SET ... WHERE id=42
    SB-->>EF: updated contact
    EF-->>DASH: 200 OK
    DASH->>DASH: reload, neue Daten sichtbar
```

### 3.4 Flow D: Vollautomatisches Scraping (Stufe 3, geplant)

```mermaid
sequenceDiagram
    participant CRON as GitHub Actions Cron
    participant SCRAPER as scraper/scrape.js<br/>(Playwright)
    participant G as Google
    participant EF as Edge Function
    participant SB as Supabase

    CRON->>SCRAPER: schedule.cron "0 8 * * 1" (Mo 8 Uhr)
    SCRAPER->>SCRAPER: Lade target_banks.json
    loop pro Bank+Keyword
        SCRAPER->>G: navigate google.com/search?q=...
        G-->>SCRAPER: HTML-Response
        SCRAPER->>SCRAPER: Parse Jobs-Widget mit DOM-Selektoren
        SCRAPER->>SCRAPER: Compute relevance score, dedupe via raw_hash
    end
    SCRAPER->>EF: POST /ingest<br/>X-API-Key: $SECRETS.LEADS_API_KEY<br/>[{bank_name_raw, title, …}]
    EF->>SB: SELECT public.ingest_signals($1)
    SB-->>EF: {inserted: 12, skipped: 4}
    EF-->>SCRAPER: 200 OK
    SCRAPER->>CRON: Exit 0
    Note over CRON: Workflow-Run als grüner Check sichtbar<br/>im GitHub Actions Tab
```

---

## 4. Datenmodell (ERD)

```mermaid
erDiagram
    banks ||--o{ signals       : "hat Signale"
    banks ||--o{ contacts      : "hat Kontakte"
    banks ||--o{ bank_activity : "hat Aktivitäten"
    contacts ||--o{ connections : "Kontakt A"
    contacts ||--o{ connections : "Kontakt B"

    banks {
        bigint id PK
        text name
        bank_segment segment
        country country
        text hq_city
        text domain
        text parent_group
        bool is_x1f_customer
        text notes
    }
    signals {
        bigint id PK
        bigint bank_id FK
        signal_type signal_type
        text title
        text body
        smallint x1f_relevance
        text[] keywords_matched
        text outreach_status
        text source_url
        date signal_date
    }
    contacts {
        bigint id PK
        bigint bank_id FK
        text full_name
        text role_title
        text seniority
        text functional_area
        smallint influence_score
        bool is_decision_maker
        bool is_placeholder
        text linkedin_url
        text email
        text previous_employer
        text alma_mater
    }
    connections {
        bigint id PK
        bigint contact_a FK
        bigint contact_b FK
        text relationship
        text evidence
        smallint strength
    }
    bank_activity {
        bigint id PK
        bigint bank_id FK
        text actor
        text content
        text activity_type
        timestamptz created_at
    }
```

---

## 5. Authentication / Sicherheit

### Aktuell
| Layer | Rolle | Zugriff |
|---|---|---|
| **Frontend / anon** | Anon-Key (im JS hardcoded) | nur SELECT auf Tabellen + Views |
| **Edge Function Read** | Service-Role-Key (im Edge-Secret) | volle DB-Rechte, aber Function-intern |
| **Edge Function Write** | API-Key (`LEADS_API_KEY`) | erforderlich für alle PATCH/POST/DELETE |
| **Dashboard Edit-Mode** | API-Key in localStorage | wird im X-API-Key Header gesendet |

### Schutz vor Missbrauch
- RLS-Policy lässt anon **nur SELECT**, kein direktes Insert/Update aus dem Frontend
- API-Key validiert vor jedem Write-Vorgang in der Edge Function
- LEADS_API_KEY ist Server-Secret, nicht im Frontend-Code
- Bei Setup ohne API-Key (Dev-Modus): Function erlaubt jeden Wert → für Testumgebungen OK, für Production setzen!

### Mögliche Erweiterungen
- **Supabase Auth** (Magic-Link): mehrere User mit individuellen Rechten, Activity-Log mit user-ID
- **Netlify Password-Protection** (Pro-Plan): Dashboard nicht öffentlich
- **GitHub Branch-Protection**: nur Admin merged → kein versehentlicher Deploy

---

## 6. Tech-Stack

| Layer | Tech | Warum |
|---|---|---|
| Storage | Supabase Postgres 17 | RLS, Views, RPC, Edge-Functions in einem |
| API | Supabase Edge Function (Deno) | Same-region als DB, low-latency, deno-typesafe |
| Frontend | Vanilla HTML/JS/CSS | kein Build, einfach hosten, schnell |
| Visualization | Cytoscape.js 3.30 | beste Graph-Lib für Browser, vom CDN |
| Scraping (manual) | Claude in Chrome (Anthropic Browser-Extension) | nutzt echten Browser, ToS-konform |
| Scraping (auto) | Playwright + GitHub Actions Cron | gratis, versioniert, einfach |
| Hosting | Netlify static | Auto-Deploy ab `git push`, CDN, free tier |
| Auth | API-Key | minimale Komplexität, ausreichend für Solo |

---

## 7. Skalierungs-Pfade

### Wenn die Datenmenge wächst (>10k Signale)
- Postgres Indizes auf `signals.captured_at`, `signals.bank_id`, `signals.x1f_relevance` (sind drin)
- Materialized View statt regulärer View für `heat_score` (regelmäßig refresh via pg_cron)
- Pagination im Dashboard (statt LIMIT 500)

### Wenn das Sales-Team wächst (>3 User)
- Supabase Auth mit Magic-Link
- Activity-Log per User-ID
- "Mein Lead-Pool" Filter im Dashboard
- Kanban: Karten "Owner" zuweisen

### Wenn mehrere Branchen abgedeckt werden (FSI + Public + Industrie)
- `industry` Spalte in banks (heute: `segment`)
- Pro Industrie eigene Pitch-Templates
- Dashboard Multi-Industry-Filter

### Wenn von Manual-Scraping wegmigriert
- GitHub Actions täglich/wöchentlich
- Diff-Logik: nur **neue** Signale insertieren (raw_hash dedupliziert bereits)
- Alert via Slack-Webhook bei `x1f_relevance >= 80` neu eingetroffen

### Wenn Apollo/Cognism dazukommt
- Edge Function `/enrich-contact` ruft Apollo-API mit name+company → ergänzt LinkedIn, E-Mail, Phone
- Cron-Job einmal pro Woche für alle `is_placeholder=false AND linkedin_url IS NULL`

---

## 8. Quick-Reference: wer macht was

| Aktion | Wer triggert | Wie | Ergebnis |
|---|---|---|---|
| Neue Signale scrapen | User → mich (Claude) | Chat | INSERT in DB |
| Neue Signale ingesten | externer Worker | POST /ingest | INSERT, dedupliziert via raw_hash |
| Echten Namen ergänzen | User im Dashboard | ✏️-Modal | PATCH /contact |
| Outreach-Status setzen | User per Drag&Drop | Pipeline Kanban | POST /outreach |
| Connection anlegen | User im Dashboard | "+ Connection" Modal | POST /connection |
| Bank-Notiz hinzufügen | User im Dashboard | Notiz-Feld in Stammdaten | PATCH /bank oder POST /activity |
| Briefing generieren | User | Lädt `#/` | SELECT v_top_leads, hot_signals |

---

## 9. Files & Ordner

```
/Users/lom/Developer/x1f-leads-dashboard/
├── index.html              # SPA shell + nav
├── styles.css              # light theme (+ dark, print)
├── app.js                  # SPA logic, router, edit mode
├── netlify.toml            # static hosting config
├── README.md               # benutzer-doku
├── ARCHITECTURE.md         # dieses dokument
└── scraper/                # geplant: GitHub-Actions-Worker
    ├── scrape.js           # Playwright + Google + POST /ingest
    ├── package.json
    └── target_banks.json
└── .github/workflows/
    └── scrape.yml          # cron + run scraper

Supabase Projekt: wlxolfkhkxembiuofmfa
├── DB schema "public":     banks, signals, contacts, connections, bank_activity
├── Edge Function:          leads-api (v2)
└── Secrets:                LEADS_API_KEY, ANTHROPIC_API_KEY (für Pitch-Gen)
```
