# x1F Lead-Gen Auto-Crawler

Headless-Chromium-Worker, der Google Jobs-Widget für eine Liste konfigurierter Banken+SAP-Keywords abruft, parst und an die Supabase Edge Function `/leads-api/ingest` postet.

## Lokal testen

```bash
cd scraper
npm install
npx playwright install chromium
LEADS_API_KEY=dein-secret node scrape.js
```

## In CI (GitHub Actions)

Workflow-Datei: `.github/workflows/scrape.yml` (eine Ebene höher).

GitHub Repository → **Settings → Secrets and variables → Actions → New repository secret**:

```
Name:  LEADS_API_KEY
Value: <derselbe Wert wie im Supabase Edge Function Secret>
```

Der Workflow läuft automatisch jeden Montag 8 Uhr UTC (siehe `.github/workflows/scrape.yml`) und kann manuell via "Run workflow" gestartet werden.

## Konfiguration

`target_banks.json` enthält die Liste der Banken und Suchqueries. Anpassen mit Editor → commit → push, dann läuft beim nächsten Cron-Lauf der neue Set.

## Was passiert

1. Lädt `target_banks.json`
2. Für jede Bank × Query: Google-Search auf `google.com/search?q=...&num=20`
3. Parst Jobs-Widget oder normale Suchergebnisse
4. Filtert auf Treffer, die den Bank-Namen enthalten
5. Berechnet `x1f_relevance` per Keyword-Heuristik (HOT-Keywords +30, WARM +15)
6. Generiert deduplizierenden `raw_hash` aus bank+title+url
7. POST an `/leads-api/ingest` in Batches à 50 Einträge
8. Loggt `inserted / skipped` pro Batch

## Wichtige Limits

- Google rate-limits aggressive Crawling — `SLEEP_MS=3000` per Anfrage
- Default `MAX_TARGETS=30`, kann via env überschrieben werden
- Free Tier GitHub Actions: 2000 Minuten/Monat — bei wöchentlichem Lauf (~5 Min) easy machbar

## Erweitern

### Andere Quellen anbinden
Erstelle weitere Funktionen analog zu `searchOne(page, bank, query)`:
- `searchTedOne(page, bank)` für Ausschreibungen
- `searchBundesanzeiger(page, bank)` für Geschäftsberichte

### SerpAPI statt Playwright
Wenn du bezahlt scrapen willst (zuverlässiger, nicht von Google geblockt):
- SerpAPI subscription (~$50/mo)
- Ersetze `searchOne` durch HTTP-Call zu `https://serpapi.com/search.json?...`
