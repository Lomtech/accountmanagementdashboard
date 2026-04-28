// ===========================================================
//   x1F Lead-Gen Auto-Crawler
//   Liest Google Jobs-Widget für eine Liste Banken+Keywords,
//   parsed Treffer und postet sie an /leads-api/ingest.
//
//   Lokal: SUPABASE_API_KEY=... node scrape.js
//   In CI: secrets.LEADS_API_KEY -> env LEADS_API_KEY
// ===========================================================
import { chromium } from "playwright";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const EDGE_FN_URL  = process.env.EDGE_FN_URL  ?? "https://wlxolfkhkxembiuofmfa.supabase.co/functions/v1/leads-api";
const LEADS_API_KEY = process.env.LEADS_API_KEY ?? "";
const SLEEP_MS      = parseInt(process.env.SLEEP_MS ?? "3000");
const MAX_TARGETS   = parseInt(process.env.MAX_TARGETS ?? "30");

if (!LEADS_API_KEY) {
  console.warn("⚠️  LEADS_API_KEY not set — function will accept any key");
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sha   = (s) => crypto.createHash("md5").update(s).digest("hex");

// Relevance-Scoring Heuristic
const HOT_KEYWORDS = ["SAP FPSL","SAP S/4HANA","S/4 HANA","SAP-CML","SAP TRM","SAP Banking","SAP FS-CD","Bank Analyzer","SAP Treasury"];
const WARM_KEYWORDS = ["SAP Finance","SAP ABAP","SAP Basis","SAP CO","SAP FI","Hedge Accounting","IFRS 9","Group Reporting","Subledger"];

// Signal-Type-Hints fuer auto-Klassifikation
const TYPE_HINTS = {
  tender:               ["ausschreibung","tender","vergabe","bekanntmachung","rahmenvertrag"],
  leadership_change:    ["neuer cio","neuer cfo","neuer ceo","vorstand bestellung","bereichsvorstand","wechsel an die spitze"],
  regulatory_deadline:  ["dora","csrd","basel iv","crr iii","anacredit","ifrs 9","ifrs 17","marisk"],
  ma_activity:          ["übernahme","akquisition","fusion","merger","carve-out","verkauft an"],
  restructuring:        ["stellenabbau","restrukturierung","effizienzprogramm","kostensenkung"],
  cloud_migration:      ["rise with sap","grow with sap","s/4hana cloud","sovereign cloud"],
  customer_reference:   ["customer story","erfolgsgeschichte","case study","referenzkunde"],
  earnings_mention:     ["quartalszahlen","earnings call","geschäftsergebnis"],
  annual_report_mention:["geschäftsbericht","annual report","jahresabschluss"],
  conference_talk:      ["sprecher","speaker","keynote","konferenz","forum","ebicon","sapinsider"],
  competitor_win:       ["kpmg","deloitte","pwc","ey","capgemini","accenture","reply","msg"],
  compliance_finding:   ["bafin beanstandung","marisk findings","aufsicht beanstandet"],
  innovation_signal:    ["innovation lab","fintech investment","beteiligung"],
  vendor_switch:        ["avaloq","temenos","kernbankensystem wechsel"],
  press_release:        ["pressemitteilung","press release"],
};

function classifyType(title, snippet) {
  const text = (title + " " + (snippet ?? "")).toLowerCase();
  for (const [type, hints] of Object.entries(TYPE_HINTS)) {
    if (hints.some(h => text.includes(h))) return type;
  }
  return "job_posting";  // Default für SAP+Bank-Treffer
}

function scoreRelevance(title, snippet, type) {
  const text = (title + " " + (snippet ?? "")).toLowerCase();
  let score = 0;
  for (const k of HOT_KEYWORDS)  if (text.includes(k.toLowerCase())) score += 30;
  for (const k of WARM_KEYWORDS) if (text.includes(k.toLowerCase())) score += 15;
  // Type-Boni
  if (type === "tender")              score += 25;
  if (type === "leadership_change")   score += 20;
  if (type === "regulatory_deadline") score += 20;
  if (type === "customer_reference")  score += 25;
  if (type === "ma_activity")         score += 20;
  if (type === "restructuring")       score += 15;
  return Math.min(100, score || 30);
}

function extractKeywords(text) {
  const all = [...HOT_KEYWORDS, ...WARM_KEYWORDS];
  const found = [];
  const lower = text.toLowerCase();
  for (const k of all) if (lower.includes(k.toLowerCase())) found.push(k);
  return found;
}

async function searchOne(page, bank, query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=de`;
  console.log(`[${bank}] → ${query}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(800);

  // Try Jobs widget first (Google for Jobs aggregator)
  let jobs = await page.$$eval('.PwjeAc, .iFjolb, [role="listitem"]', els => els.map(el => ({
    title: el.querySelector("h2,h3,a")?.innerText?.trim() ?? "",
    snippet: el.innerText?.trim()?.slice(0, 280) ?? "",
  })).filter(j => j.title.length > 5));

  // Fallback: regular search results
  if (!jobs.length) {
    jobs = await page.$$eval('div.g, div.tF2Cxc', els => els.map(el => ({
      title: el.querySelector("h3")?.innerText?.trim() ?? "",
      snippet: el.querySelector('.VwiC3b, .Hdw6tb')?.innerText?.trim()?.slice(0, 280) ?? "",
      url: el.querySelector("a")?.href ?? "",
    })).filter(j => j.title.length > 5));
  }

  return jobs.slice(0, 10).map(j => {
    const type = classifyType(j.title, j.snippet);
    return {
      bank_name_raw: bank,
      signal_type: type,
      title: j.title,
      body: j.snippet,
      source: "google_search",
      source_url: j.url ?? url,
      signal_date: new Date().toISOString().slice(0, 10),
      keywords_matched: extractKeywords(j.title + " " + j.snippet),
      x1f_relevance: scoreRelevance(j.title, j.snippet, type),
      raw_hash: sha(`${bank}::${j.title}::${j.url ?? url}`),
    };
  });
}

async function postIngest(signals) {
  if (!signals.length) return { inserted: 0, skipped: 0 };
  const r = await fetch(`${EDGE_FN_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": LEADS_API_KEY },
    body: JSON.stringify(signals),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Ingest failed (${r.status}): ${JSON.stringify(j)}`);
  return j.result ?? j;
}

async function main() {
  const targets = JSON.parse(await fs.readFile(new URL("./target_banks.json", import.meta.url)));
  console.log(`📋 ${targets.length} target banks loaded`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "de-DE",
  });

  const allSignals = [];
  for (const t of targets.slice(0, MAX_TARGETS)) {
    for (const kw of t.queries) {
      try {
        const sigs = await searchOne(page, t.bank, kw);
        // filter: keep only those that look bank-relevant
        const filtered = sigs.filter(s =>
          s.title.toLowerCase().includes(t.bank.toLowerCase()) ||
          (s.body ?? "").toLowerCase().includes(t.bank.toLowerCase())
        );
        allSignals.push(...filtered);
        await sleep(SLEEP_MS);
      } catch (e) {
        console.error(`✗ [${t.bank}] ${kw}: ${e.message}`);
      }
    }
  }

  await browser.close();
  console.log(`\n📦 ${allSignals.length} candidate signals collected`);
  if (!allSignals.length) return;

  // Batch in chunks of 50 to avoid huge payloads
  let totalInserted = 0, totalSkipped = 0;
  for (let i = 0; i < allSignals.length; i += 50) {
    const chunk = allSignals.slice(i, i + 50);
    const res = await postIngest(chunk);
    const ins = res.inserted ?? res[0]?.inserted ?? 0;
    const skp = res.skipped  ?? res[0]?.skipped  ?? 0;
    totalInserted += ins;
    totalSkipped  += skp;
    console.log(`  chunk ${i / 50 + 1}: +${ins} ingested / ${skp} duplicates`);
  }
  console.log(`\n✅ Total: ${totalInserted} new, ${totalSkipped} dedup'd`);
}

main().catch(e => { console.error("✗ Fatal:", e); process.exit(1); });
