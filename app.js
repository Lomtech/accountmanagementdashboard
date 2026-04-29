// ===========================================================
//   x1F Lead Dashboard v2 — Vanilla SPA mit Edit-Mode + Pipeline
// ===========================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?bundle";

// ---- KONFIG (Public, OK in Frontend) ---------------------------------------
const SUPABASE_URL = "https://wlxolfkhkxembiuofmfa.supabase.co";
const SUPABASE_KEY = "sb_publishable_thWgZmusJh9usU4hUKUZEg_s4_o52Mn";
const EDGE_FN_URL  = `${SUPABASE_URL}/functions/v1/leads-api`;
// ---------------------------------------------------------------------------

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const app = $("#app");

// ---- Edit-Mode State -------------------------------------------------------
const EDIT_KEY_LS = "x1f_api_key";
let EDIT_MODE = false;
let API_KEY   = localStorage.getItem(EDIT_KEY_LS) ?? "";

function setEditMode(on, key = "") {
  EDIT_MODE = !!on;
  if (on) { API_KEY = key; localStorage.setItem(EDIT_KEY_LS, key); }
  else    { API_KEY = "";  localStorage.removeItem(EDIT_KEY_LS); }
  $("#edit-btn").textContent = on ? "🔓" : "✏️";
  $("#edit-btn").title = on ? "Edit-Mode aktiv (klicken zum Beenden)" : "Edit-Mode aktivieren";
  document.body.classList.toggle("edit-mode", on);
  navigate(); // re-render
}

async function apiCall(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json", "X-API-Key": API_KEY } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${EDGE_FN_URL}/${path}`, opts);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

// ---- Helpers ----------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => (
  { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]
));

function showToast(msg, type = "success", duration = 2800) {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-show"));
  setTimeout(() => { el.classList.remove("toast-show"); setTimeout(() => el.remove(), 400); }, duration);
}
const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("de-DE");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "—";
const segmentLabel = {
  grossbank: "Großbank", landesbank: "Landesbank", foerderbank: "Förderbank",
  sparkasse: "Sparkasse", genossenschaft: "Genossensch.", privatbank: "Privatbank",
  spezialbank: "Spezialbank", auslandsbank: "Auslandsbank", asset_manager: "Asset Mgr",
  versicherer: "Versicherer", fintech: "Fintech", other: "Andere"
};
// Signal-Verfallszeiten in Tagen pro Typ
const SIGNAL_TTL_DAYS = {
  leadership_change: 90,  compliance_finding: 30,  conference_talk: 30,
  tender: 60,             job_posting: 45,          project_announcement: 60,
  restructuring: 90,      ma_activity: 180,         regulatory_deadline: 365,
  sanction_event: 60,     vendor_switch: 180,       cloud_migration: 180,
  earnings_mention: 90,   annual_report_mention: 180,
};
function isStale(date, type) {
  if (!date) return false;
  const ttl = SIGNAL_TTL_DAYS[type] ?? 120;
  return (Date.now() - new Date(date).getTime()) / 86400000 > ttl;
}

const heatBadge = (rel) => {
  if (rel == null) return `<span class="badge cold">—</span>`;
  if (rel >= 80) return `<span class="badge hot">Hot ${rel}</span>`;
  if (rel >= 60) return `<span class="badge warm">Warm ${rel}</span>`;
  return `<span class="badge cold">${rel}</span>`;
};
const heatBarFor = (score) => {
  const max = 400;
  const w = Math.min(120, Math.max(8, (score / max) * 120));
  return `<span class="heat-bar" style="width:${w}px"></span>`;
};
const initials = (name) => {
  if (!name) return "?";
  const clean = name.replace(/^\[Platzhalter\]\s*/, "");
  return clean.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
};
const cleanName = (n) => (n || "").replace(/^\[Platzhalter\]\s*/, "");
// Short display label for graph nodes — prevents long labels from overlapping
const shortLabel = (n) => {
  const clean = cleanName(n);
  const parts = clean.trim().split(/\s+/);
  if (parts.length <= 2) return clean;
  // "Dr. Max Mustermann" → "Max Mustermann"
  const skipTitles = /^(dr\.?|prof\.?|ing\.?|mag\.?)$/i;
  const meaningful = parts.filter(p => !skipTitles.test(p));
  return meaningful.length >= 2 ? meaningful[0] + " " + meaningful[meaningful.length - 1] : clean;
};
const segmentBadge = (s) => `<span class="badge segment">${esc(segmentLabel[s] ?? s)}</span>`;
const countryBadge = (c) => `<span class="badge country">${esc(c)}</span>`;

const RELATIONSHIP_LABELS = {
  reports_to:        "berichtet an", co_worker_current: "Kollege (aktuell)",
  co_worker_past:    "Ex-Kollege",   alumni:            "Alumni / Ex-Arbeitgeber",
  co_speaker:        "Co-Speaker",   board_interlock:   "Aufsichtsrat-Verbindung",
  co_author:         "Co-Author",    referred_by:       "über Empfehlung",
  known_via:         "kennt über",
};

const SIGNAL_TYPE_META = {
  job_posting:          { icon: "👤", label: "Job-Posting",      color: "#0891b2" },
  tender:               { icon: "📋", label: "Ausschreibung",    color: "#c2410c" },
  leadership_change:    { icon: "🪑", label: "Leadership-Wechsel", color: "#9333ea" },
  regulatory_deadline:  { icon: "⚖️", label: "Reg-Deadline",     color: "#dc2626" },
  ma_activity:          { icon: "🤝", label: "M&A",              color: "#0e7490" },
  restructuring:        { icon: "✂️", label: "Restrukturierung", color: "#b45309" },
  cloud_migration:      { icon: "☁️", label: "Cloud-Migration",  color: "#2563eb" },
  customer_reference:   { icon: "⭐", label: "Customer-Ref",     color: "#16a34a" },
  earnings_mention:     { icon: "💰", label: "Earnings",         color: "#65a30d" },
  annual_report_mention:{ icon: "📊", label: "Geschäftsbericht", color: "#854d0e" },
  conference_talk:      { icon: "🎤", label: "Conference",       color: "#0891b2" },
  competitor_win:       { icon: "🏁", label: "Competitor-Win",   color: "#ea580c" },
  compliance_finding:   { icon: "🚨", label: "Compliance",       color: "#dc2626" },
  directors_dealings:   { icon: "📈", label: "Insider-Trade",    color: "#6b7280" },
  innovation_signal:    { icon: "💡", label: "Innovation",       color: "#a855f7" },
  office_expansion:     { icon: "🏢", label: "Expansion",        color: "#059669" },
  vendor_switch:        { icon: "🔄", label: "Vendor-Switch",    color: "#7c3aed" },
  sanction_event:       { icon: "⚠️", label: "Sanktion",         color: "#991b1b" },
  aufsichtsrat_change:  { icon: "👥", label: "AR-Wechsel",       color: "#7c2d12" },
  partnership:          { icon: "🤝", label: "Partnerschaft",    color: "#0d9488" },
  project_announcement: { icon: "📢", label: "Projekt-Ankündigung", color: "#1e40af" },
  tech_stack_signal:    { icon: "🛠️", label: "Tech-Stack",       color: "#475569" },
  press_release:        { icon: "📰", label: "Pressemitteilung", color: "#525252" },
  regulatory_action:    { icon: "⚖️", label: "Reg-Action",       color: "#dc2626" },
};

function signalBadge(type) {
  const m = SIGNAL_TYPE_META[type] ?? { icon: "•", label: type, color: "#6b7280" };
  return `<span class="badge" style="background:${m.color}15;color:${m.color};border-color:${m.color}40" title="${esc(type)}">${m.icon} ${esc(m.label)}</span>`;
}

// ===========================================================================
//   FEATURE 1 + 3: Data-Completeness-Score & Timing-Score
// ===========================================================================

/**
 * Berechne Data-Completeness-Score 0-100 für eine Bank.
 * @param {object} bank  - Bank-Objekt aus `banks` Tabelle
 * @param {Array}  contacts - Kontakte der Bank
 * @param {Array}  signals  - Signale der Bank
 */
function calcCompletenessScore(bank, contacts, signals) {
  let score = 0;
  const now = Date.now();

  // Hat mind. 1 echter Kontakt (kein Platzhalter): +20
  if (contacts.some(c => !c.is_placeholder)) score += 20;

  // Hat CIO/CDO/IT-Vorstand mit LinkedIn: +20
  const itTitles = /cio|cdo|cto|it.vorstand|chief.information|chief.digital|chief.technology|bereichsvorstand.it/i;
  if (contacts.some(c => !c.is_placeholder && itTitles.test(c.role_title ?? "") && c.linkedin_url)) score += 20;

  // Hat sap_modules gefüllt: +15
  if ((bank.sap_modules ?? []).length > 0) score += 15;

  // Hat cloud_provider gefüllt: +10
  if (bank.cloud_provider) score += 10;

  // Hat main_partner gefüllt: +10
  if (bank.main_partner) score += 10;

  // Hat mind. 1 Signal in letzten 90 Tagen: +15
  const d90 = 90 * 86400000;
  if (signals.some(s => s.captured_at && (now - new Date(s.captured_at).getTime()) < d90)) score += 15;

  // Hat contract_end_estimate: +10
  if (bank.contract_end_estimate) score += 10;

  return Math.min(100, score);
}

/**
 * Rendere Daten-Qualitäts-Fortschrittsbalken HTML.
 */
function renderCompletenessBar(score) {
  const color = score >= 70 ? "var(--good)" : score >= 40 ? "var(--warn)" : "var(--danger)";
  const label = score >= 70 ? "Gut" : score >= 40 ? "Mittel" : "Lückenhaft";
  return `
    <div class="completeness-bar-wrap">
      <div class="completeness-bar-label">
        <span>Daten-Qualität: <strong>${score}%</strong></span>
        <span class="completeness-label" style="color:${color}">${label}</span>
      </div>
      <div class="completeness-bar-track">
        <div class="completeness-bar-fill" style="width:${score}%;background:${color}"></div>
      </div>
    </div>`;
}

/**
 * Berechne Kauf-Timing-Score 0-100.
 * @param {object} bank
 * @param {Array}  signals
 * @param {Array}  contacts
 */
function calcTimingScore(bank, signals, contacts) {
  let score = 0;
  const now = Date.now();
  const d60 = 60 * 86400000;
  const d90 = 90 * 86400000;

  // Frische heiße Signale (relevance ≥ 70, < 60 Tage alt): +30
  if (signals.some(s => (s.x1f_relevance ?? 0) >= 70 &&
      s.signal_date && (now - new Date(s.signal_date).getTime()) < d60)) score += 30;

  // Leadership-Change-Signal < 90 Tage: +25
  if (signals.some(s => s.signal_type === "leadership_change" &&
      s.signal_date && (now - new Date(s.signal_date).getTime()) < d90)) score += 25;

  // Regulatory-Deadline-Signal vorhanden: +20
  if (signals.some(s => s.signal_type === "regulatory_deadline")) score += 20;

  // Tender/Ausschreibung-Signal < 60 Tage: +15
  if (signals.some(s => s.signal_type === "tender" &&
      s.signal_date && (now - new Date(s.signal_date).getTime()) < d60)) score += 15;

  // Kein Kontakt im Status "contacted"/"meeting": +10
  const hasActiveOutreach = signals.some(s =>
    ["contacted","meeting"].includes(s.outreach_status));
  if (!hasActiveOutreach) score += 10;

  return Math.min(100, score);
}

/**
 * Rendere Timing-Score-Badge HTML.
 */
function timingBadge(score) {
  if (score >= 70) return `<span class="badge hot timing-badge" title="Timing-Score: ${score}">⏱ Jetzt! ${score}</span>`;
  if (score >= 40) return `<span class="badge warm timing-badge" title="Timing-Score: ${score}">⏱ Bald ${score}</span>`;
  return `<span class="badge cold timing-badge" title="Timing-Score: ${score}">⏱ Abwarten ${score}</span>`;
}

// ---- Status-Indikator -------------------------------------------------------
async function pingDb() {
  try {
    const { error } = await sb.from("banks").select("id", { head: true, count: "exact" }).limit(1);
    $("#connection-status").classList.toggle("connected", !error);
    $("#connection-status").classList.toggle("disconnected", !!error);
    $("#connection-status").title = error ? "Fehler: " + error.message : "Verbunden";
  } catch (e) { $("#connection-status").classList.add("disconnected"); }
}

// ===========================================================================
//   ROUTER
// ===========================================================================
const routes = [
  { path: /^\/?$/,                    render: renderBriefing },
  { path: /^\/leads$/,                render: renderLeads },
  { path: /^\/pipeline$/,             render: renderPipeline },
  { path: /^\/revenue$/,              render: renderRevenue },
  { path: /^\/bank\/(\d+)$/,          render: (m) => renderBankDetail(parseInt(m[1])) },
  { path: /^\/signals$/,              render: renderSignals },
  { path: /^\/contacts$/,             render: renderContacts },
  { path: /^\/network$/,              render: renderNetwork },
];

const fmtEur = (v) => v == null ? "—" : "€ " + Number(v).toLocaleString("de-DE", { maximumFractionDigits: 0 });

function navigate() {
  const hash = location.hash.slice(1) || "/";
  $$("#nav a").forEach(a => {
    a.classList.toggle("active", hash === a.dataset.route ||
      (a.dataset.route !== "/" && hash.startsWith(a.dataset.route)));
  });
  for (const r of routes) {
    const m = hash.match(r.path);
    if (m) { r.render(m).catch(showError); return; }
  }
  app.innerHTML = `<div class="empty">Seite nicht gefunden: ${esc(hash)}</div>`;
}
function showError(e) {
  console.error(e);
  app.innerHTML = `<div class="error">Fehler: ${esc(e?.message ?? e)}</div>`;
}

window.addEventListener("hashchange", navigate);
$("#reload-btn").addEventListener("click", () => { pingDb(); navigate(); });
$("#edit-btn").addEventListener("click", toggleEditMode);

// Theme toggle
const THEME_LS = "x1f_theme";
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
  localStorage.setItem(THEME_LS, t);
}
applyTheme(localStorage.getItem(THEME_LS) ?? "light");
$("#theme-btn").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(cur);
});

// Print
$("#print-btn").addEventListener("click", () => {
  if (location.hash !== "#/") location.hash = "#/";
  setTimeout(() => window.print(), 300);
});

function toggleEditMode() {
  if (EDIT_MODE) {
    setEditMode(false);
  } else {
    showLoginModal();
  }
}

function showLoginModal() {
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal">
        <h3>Edit-Mode aktivieren</h3>
        <p class="muted small">Gib den API-Key ein (LEADS_API_KEY aus Supabase Edge Function Secrets).</p>
        <input id="api-key-input" type="password" placeholder="API Key" style="width:100%">
        <div class="muted small" style="margin-top:6px">Hinweis: ist <code>LEADS_API_KEY</code> nicht gesetzt, akzeptiert die API jeden Wert.</div>
        <div class="modal-actions">
          <button onclick="closeModal()">Abbrechen</button>
          <button class="primary" id="api-login-btn">Anmelden</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  $("#api-key-input").focus();
  $("#api-login-btn").onclick = async () => {
    const key = $("#api-key-input").value.trim();
    try {
      const r = await fetch(`${EDGE_FN_URL}/auth-check`, { headers: { "X-API-Key": key } });
      if (!r.ok) throw new Error("Key abgelehnt");
      closeModal();
      setEditMode(true, key);
    } catch (e) {
      alert("Login fehlgeschlagen: " + e.message);
    }
  };
}
window.closeModal = () => { const m = $("#modal"); if (m) m.remove(); };

// ===========================================================================
//   PAGE: Briefing
// ===========================================================================
async function renderBriefing() {
  app.innerHTML = `<div class="loading">Lade Briefing…</div>`;
  const [topRes, hotRes, segRes, queueRes, tasksRes, velRes] = await Promise.all([
    sb.from("v_top_leads").select("*").limit(50),
    sb.from("hot_signals").select("*"),
    sb.from("v_segment_heatmap").select("*"),
    sb.from("v_action_queue").select("*").limit(15),
    sb.from("v_overdue_tasks").select("*").limit(20),
    sb.from("v_signal_velocity").select("*").limit(10),
  ]);
  if (topRes.error)   throw topRes.error;
  if (hotRes.error)   throw hotRes.error;
  if (segRes.error)   throw segRes.error;
  if (queueRes.error) throw queueRes.error;
  const banks = topRes.data ?? [], hot = hotRes.data ?? [], segs = segRes.data ?? [], queue = queueRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const velocity = velRes.data ?? [];
  const totalSignals = banks.reduce((a,b) => a + (b.signals_90d ?? 0), 0);
  const totalBanksWithSignals = banks.length;
  const totalHot = hot.length;
  const customers = banks.filter(b => b.is_x1f_customer).length;

  app.innerHTML = `
    <div class="page-header">
      <div><h1>Briefing</h1><p>Tagesübersicht — die heißesten Konten, neueste Signale, Action-Queue.</p></div>
    </div>
    <div class="cards">
      <div class="card accent"><div class="label">Heiße Signale</div><div class="value">${totalHot}</div><div class="sub">Relevance ≥ 70</div></div>
      <div class="card"><div class="label">Aktive Banken</div><div class="value">${totalBanksWithSignals}</div><div class="sub">mit Signalen letzte 90 Tage</div></div>
      <div class="card"><div class="label">Total Signale</div><div class="value">${totalSignals}</div></div>
      <div class="card"><div class="label">Bestandskunden</div><div class="value">${customers}</div><div class="sub">in aktivem Briefing</div></div>
    </div>
    <div class="section">
      <div class="section-header"><h2>Top-Leads (Heat-Score)</h2><a href="#/leads">Alle ansehen →</a></div>
      <table>
        <thead><tr>
          <th>Bank</th><th>Segment</th><th>Land</th>
          <th class="numeric">Signale</th><th class="numeric">Hot</th>
          <th>Heat</th><th>⏱ Timing</th><th></th>
        </tr></thead>
        <tbody>
          ${banks.slice(0, 10).map(b => {
            const ts = calcTimingScore(b, [], []);
            return `
            <tr class="row-link" data-link="#/bank/${b.bank_id}">
              <td>${b.is_x1f_customer ? '<span class="badge x1f">⭐ Bestand</span> ' : ""}<strong>${esc(b.bank)}</strong>
                  <div class="small muted">${esc(b.hq_city ?? "")}</div></td>
              <td>${segmentBadge(b.segment)}</td>
              <td>${countryBadge(b.country)}</td>
              <td class="numeric">${b.signals_90d}</td>
              <td class="numeric">${b.hot_signals}</td>
              <td>${heatBarFor(b.heat_score)} <span class="muted small">${b.heat_score}</span></td>
              <td>${timingBadge(ts)}</td>
              <td class="right"><a href="#/bank/${b.bank_id}">Detail →</a></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    ${velocity.length > 0 ? `
    <div class="section velocity-widget">
      <div class="section-header"><h2>📈 Signal-Velocity</h2><span class="muted small">Top-5 Banken mit stärkster Signal-Beschleunigung (30d vs. Vormonat)</span></div>
      <table>
        <thead><tr><th>Bank</th><th>Segment</th><th class="numeric">Signale 30d</th><th class="numeric">Vormonat</th><th class="numeric">Delta</th></tr></thead>
        <tbody>
          ${velocity.slice(0, 5).map(v => {
            const deltaPos = (v.velocity_delta ?? 0) > 0;
            const deltaNeg = (v.velocity_delta ?? 0) < 0;
            const deltaColor = deltaPos ? "var(--good)" : deltaNeg ? "var(--danger)" : "var(--text-muted)";
            const deltaSign = deltaPos ? "+" : "";
            return `<tr>
              <td><strong>${esc(v.bank)}</strong></td>
              <td>${segmentBadge(v.segment)}</td>
              <td class="numeric">${v.signals_30d}</td>
              <td class="numeric muted">${v.signals_prev_30d}</td>
              <td class="numeric" style="color:${deltaColor};font-weight:700">${deltaSign}${v.velocity_delta}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : ""}
    <div class="detail-grid">
      <div class="section">
        <div class="section-header"><h2>Action Queue</h2></div>
        ${queue.length === 0 ? '<div class="empty">Keine offenen Aktionen.</div>' : `
          <table>
            <thead><tr><th>Bank</th><th>Signal</th><th>Aktion</th><th></th></tr></thead>
            <tbody>${queue.map(q => `
                <tr>
                  <td>${esc(q.bank)} ${q.is_x1f_customer ? '<span class="badge x1f">⭐</span>' : ''}</td>
                  <td>${esc(q.title)}</td>
                  <td><span class="badge ${q.action?.startsWith('PRIO 1') ? 'hot' : 'warm'}">${esc(q.action ?? '')}</span></td>
                  <td>${heatBadge(q.rel)}</td>
                </tr>`).join("")}
            </tbody>
          </table>`}
      </div>
      <div class="section">
        <div class="section-header"><h2>Heatmap nach Segment</h2></div>
        <table>
          <thead><tr><th>Land</th><th>Segment</th><th class="numeric">Banken</th><th class="numeric">Aktive</th><th class="numeric">Heat</th></tr></thead>
          <tbody>${segs.filter(s => s.banks_with_signals > 0).slice(0, 12).map(s => `
              <tr><td>${countryBadge(s.country)}</td><td>${segmentBadge(s.segment)}</td>
                  <td class="numeric">${s.banks_total}</td><td class="numeric">${s.banks_with_signals}</td>
                  <td class="numeric">${s.total_heat}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
    ${tasks.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <h2>📌 Offene Tasks</h2>
        <span class="muted small">${tasks.length} offen${tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0,10)).length > 0 ? ` · <span style="color:var(--danger,#dc2626);font-weight:600">${tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0,10)).length} überfällig</span>` : ""}</span>
      </div>
      <table>
        <thead><tr><th>Bank</th><th>Aufgabe</th><th>Kontakt</th><th>Fällig</th><th></th></tr></thead>
        <tbody>
          ${tasks.map(t => {
            const overdue = t.due_date && t.due_date < new Date().toISOString().slice(0,10);
            return `<tr${overdue ? ' style="background:var(--danger-bg,#fef2f2)"' : ''}>
              <td><a href="#/bank/${t.bank_id}">${esc(t.bank_name)}</a></td>
              <td>${esc(t.title)}</td>
              <td class="muted small">${esc(t.contact_name ?? "—")}</td>
              <td class="small${overdue ? ' style="color:var(--danger,#dc2626);font-weight:600"' : ''}">${t.due_date ? fmtDate(t.due_date) : "—"}</td>
              <td class="right">${EDIT_MODE ? `<button class="icon-btn" onclick="window._doneTask(${t.id})" title="Erledigt">✓</button>` : ""}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : ""}`;
  bindRowLinks();
}

// ===========================================================================
//   PAGE: Leads
// ===========================================================================
async function renderLeads() {
  app.innerHTML = `<div class="loading">Lade Leads…</div>`;
  const { data, error } = await sb.from("v_top_leads").select("*").limit(500);
  if (error) throw error;
  const banks = data ?? [];
  const segments = Array.from(new Set(banks.map(b => b.segment))).sort();
  const countries = Array.from(new Set(banks.map(b => b.country))).sort();

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Alle Leads</h1>
        <p>${banks.length} Banken mit aktiven Signalen</p>
      </div>
      <div class="filters">
        <input id="f-search" type="search" placeholder="Suche Bank…">
        <select id="f-segment"><option value="">Alle Segmente</option>${segments.map(s => `<option value="${s}">${segmentLabel[s] ?? s}</option>`).join("")}</select>
        <select id="f-country"><option value="">Alle Länder</option>${countries.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
        <select id="f-sort">
          <option value="heat">Sort: Heat-Score</option>
          <option value="hot">Sort: Hot Signals</option>
          <option value="signals">Sort: Total Signals</option>
          <option value="name">Sort: Name</option>
        </select>
        <button id="export-csv" title="CSV exportieren">⬇ CSV</button>
        ${EDIT_MODE ? `<button class="primary" onclick="window._createBank()">+ Lead anlegen</button>` : ""}
      </div>
    </div>
    <div class="section">
      <table>
        <thead><tr><th>Bank</th><th>Segment</th><th>Land</th>
          <th class="numeric">Signale</th><th class="numeric">Hot</th>
          <th>Heat</th><th>Top-Signale</th><th></th></tr></thead>
        <tbody id="leads-body"></tbody>
      </table>
    </div>`;

  let currentList = banks;
  const renderRows = () => {
    const q = $("#f-search").value.toLowerCase();
    const seg = $("#f-segment").value;
    const cty = $("#f-country").value;
    const sort = $("#f-sort").value;
    let list = banks.filter(b =>
      (!q   || b.bank.toLowerCase().includes(q)) &&
      (!seg || b.segment === seg) &&
      (!cty || b.country === cty));
    list.sort((a, b) => {
      switch (sort) {
        case "hot":     return (b.hot_signals ?? 0) - (a.hot_signals ?? 0);
        case "signals": return (b.signals_90d ?? 0) - (a.signals_90d ?? 0);
        case "name":    return a.bank.localeCompare(b.bank);
        default:        return (b.heat_score ?? 0) - (a.heat_score ?? 0);
      }
    });
    currentList = list;
    // Lightweight completeness estimate from v_top_leads columns
    const quickScore = (b) => {
      let s = 0;
      if ((b.signals_90d ?? 0) > 0) s += 15;  // mind. 1 Signal 90d
      if ((b.hot_signals ?? 0) > 0) s += 30;  // hot = frisch + relevant (proxy für mehrere Kriterien)
      // v_top_leads hat keine tech-details → max möglicher Score hier ~45
      // Wir skalieren auf 0-100 für die Badge-Logik (<40 = Lücken)
      return Math.round((s / 45) * 100);
    };
    $("#leads-body").innerHTML = list.map(b => {
      const qs = quickScore(b);
      const gapBadge = qs < 40 ? `<span class="badge badge-gap" title="Daten-Qualität niedrig — Bank-Detail öffnen">⚠ Lücken</span>` : "";
      return `
      <tr class="row-link" data-link="#/bank/${b.bank_id}">
        <td>${b.is_x1f_customer ? '<span class="badge x1f">⭐</span> ' : ""}${gapBadge}<strong>${esc(b.bank)}</strong>
            <div class="small muted">${esc(b.hq_city ?? "")}</div></td>
        <td>${segmentBadge(b.segment)}</td><td>${countryBadge(b.country)}</td>
        <td class="numeric">${b.signals_90d}</td><td class="numeric">${b.hot_signals}</td>
        <td>${heatBarFor(b.heat_score)} <span class="muted small">${b.heat_score}</span></td>
        <td class="small">${esc((b.top_signals ?? "").split("\n")[0] ?? "")}</td>
        <td class="right"><a href="#/bank/${b.bank_id}">Detail →</a></td>
      </tr>`;
    }).join("") || `<tr><td colspan="8" class="empty">Keine Treffer.</td></tr>`;
    bindRowLinks();
  };
  ["#f-search","#f-segment","#f-country","#f-sort"].forEach(s => $(s).addEventListener("input", renderRows));
  $("#export-csv").addEventListener("click", () => exportCSV(currentList, "leads"));
  window._createBank = () => createBankModal();
  renderRows();
}

function exportCSV(rows, name) {
  if (!rows?.length) return alert("Keine Daten");
  const cols = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== "object" || rows[0][k] === null);
  const csv = [cols.join(",")].concat(rows.map(r =>
    cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `x1f-${name}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ===========================================================================
//   PAGE: Pipeline (Kanban)
// ===========================================================================
async function renderPipeline() {
  app.innerHTML = `<div class="loading">Lade Pipeline…</div>`;
  const { data, error } = await sb.from("v_outreach_pitches").select("*");
  if (error) throw error;
  const all = data ?? [];

  const COLS = [
    { key: "new",       label: "Neu" },
    { key: "queued",    label: "In Queue" },
    { key: "contacted", label: "Kontaktiert" },
    { key: "meeting",   label: "Meeting" },
    { key: "won",       label: "Won" },
    { key: "lost",      label: "Lost" },
  ];

  app.innerHTML = `
    <div class="page-header">
      <div><h1>Pipeline</h1><p>${all.length} Signale (Relevance ≥ 60)${EDIT_MODE ? " — drag & drop zum Statuswechsel" : " — Edit-Mode aktivieren um Status zu ändern"}</p></div>
    </div>
    <div class="kanban">
      ${COLS.map(c => `
        <div class="kanban-col" data-status="${c.key}">
          <div class="kanban-header">${c.label} <span class="muted">(${all.filter(s => (s.outreach_status ?? "new") === c.key).length})</span></div>
          <div class="kanban-body">
            ${all.filter(s => (s.outreach_status ?? "new") === c.key).map(s => `
              <div class="kanban-card" draggable="${EDIT_MODE}" data-id="${s.signal_id}">
                <div class="gap small">
                  <strong>${esc(s.bank ?? "—")}</strong>
                  ${s.is_x1f_customer ? '<span class="badge x1f">⭐</span>' : ''}
                  <span class="spacer"></span>
                  ${heatBadge(s.rel)}
                </div>
                <div style="margin-top:4px">${esc(s.title ?? "")}</div>
                <div class="muted small" style="margin-top:4px">${esc((s.suggested_pitch ?? "").slice(0, 100))}…</div>
                <div class="kanban-card-actions">
                  <a href="#/bank/${s.bank_id}" class="small">Detail →</a>
                </div>
              </div>`).join("")}
          </div>
        </div>`).join("")}
    </div>
  `;

  if (EDIT_MODE) bindKanbanDnD();
}

function bindKanbanDnD() {
  let dragId = null;
  $$(".kanban-card").forEach(card => {
    card.addEventListener("dragstart", e => {
      dragId = card.dataset.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  $$(".kanban-col").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drop-target"); });
    col.addEventListener("dragleave", () => col.classList.remove("drop-target"));
    col.addEventListener("drop", async e => {
      e.preventDefault();
      col.classList.remove("drop-target");
      if (!dragId) return;
      const status = col.dataset.status;
      try {
        await apiCall("POST", "outreach", { signal_id: parseInt(dragId), status });
        navigate(); // reload
      } catch (e) {
        alert("Update fehlgeschlagen: " + e.message);
      }
      dragId = null;
    });
  });
}

// ===========================================================================
//   PAGE: Revenue (Pipeline-Attribution)
// ===========================================================================
async function renderRevenue() {
  app.innerHTML = `<div class="loading">Lade Revenue-Übersicht…</div>`;
  const r = await fetch(`${EDGE_FN_URL}/attribution`);
  if (!r.ok) throw new Error("Attribution-Endpoint nicht erreichbar");
  const j = await r.json();
  const k = j.kpis ?? {};
  const funnel = j.funnel ?? [];
  const byType = j.by_type ?? [];
  const stages = ["new","queued","contacted","meeting","won","lost"];
  const stageColors = { new:"#6b7280", queued:"#6366f1", contacted:"#0891b2", meeting:"#f59e0b", won:"#16a34a", lost:"#dc2626" };
  const fMap = Object.fromEntries(funnel.map(f => [f.outreach_status, f]));
  const maxCount = Math.max(...stages.map(s => fMap[s]?.count ?? 0), 1);

  app.innerHTML = `
    <div class="page-header">
      <div><h1>💰 Revenue & Attribution</h1>
      <p>Was hat der Tool-gestützte Pipeline-Aufbau eingebracht?</p></div>
    </div>

    <div class="cards">
      <div class="card accent">
        <div class="label">Pipeline-Wert</div>
        <div class="value">${fmtEur(k.pipeline_value)}</div>
        <div class="sub">${k.active_signals ?? 0} aktive Signale</div>
      </div>
      <div class="card" style="border-left:3px solid var(--good)">
        <div class="label">Won (closed)</div>
        <div class="value" style="color:var(--good)">${fmtEur(k.won_value)}</div>
        <div class="sub">${k.won_count ?? 0} Deals</div>
      </div>
      <div class="card">
        <div class="label">Win-Rate</div>
        <div class="value">${k.win_rate_pct ?? 0}%</div>
        <div class="sub">won / (won+lost)</div>
      </div>
      <div class="card">
        <div class="label">Contact → Meeting</div>
        <div class="value">${k.contact_to_meeting_pct ?? 0}%</div>
        <div class="sub">Conversion zu Termin</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><h2>Pipeline-Funnel</h2></div>
      <div style="padding:16px">
        ${stages.map(s => {
          const f = fMap[s] ?? { count: 0, total_value: 0 };
          const w = (f.count / maxCount) * 100;
          return `
            <div style="display:grid;grid-template-columns:140px 1fr 140px 100px;gap:12px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
              <div style="font-weight:600">${s}</div>
              <div style="background:${stageColors[s]}20;border-radius:4px;height:28px;width:${w}%;min-width:30px;display:flex;align-items:center;padding:0 8px;color:${stageColors[s]};font-weight:600">${f.count}</div>
              <div class="muted">${fmtEur(f.total_value)}</div>
              <div class="muted small right">Ø Rel: ${f.avg_relevance ?? "—"}</div>
            </div>`;
        }).join("")}
      </div>
    </div>

    <div class="section">
      <div class="section-header"><h2>Performance pro Signal-Typ</h2></div>
      <table>
        <thead><tr><th>Typ</th><th class="numeric">Total</th><th class="numeric">Won</th>
                <th class="numeric">Lost</th><th class="numeric">Win-Rate</th>
                <th class="numeric">Won-Wert</th><th class="numeric">Ø Deal</th></tr></thead>
        <tbody>
          ${byType.map(t => `
            <tr>
              <td>${signalBadge(t.signal_type)}</td>
              <td class="numeric">${t.total}</td>
              <td class="numeric">${t.won}</td>
              <td class="numeric">${t.lost}</td>
              <td class="numeric">${t.win_rate_pct}%</td>
              <td class="numeric">${fmtEur(t.won_value)}</td>
              <td class="numeric">${fmtEur(t.avg_won_deal)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-header"><h2>So fütterst du das Tool</h2></div>
      <div style="padding:14px 16px;font-size:13px">
        <p>Sobald du im Dashboard einen Deal abschließt:</p>
        <ol>
          <li>Bank-Detail aufrufen → Edit-Mode aktiv</li>
          <li>Beim Signal: Deal-Wert eintragen + Status auf <code>won</code> setzen</li>
          <li>Pipeline-Wert hier auf der Revenue-Page wächst sofort</li>
          <li>Bei Won: Slack postet automatisch 🎉 (wenn SLACK_WEBHOOK_URL gesetzt)</li>
        </ol>
        <p class="muted">Pro Deal-Eintrag siehst du danach: welcher Signal-Typ wirklich Geld bringt → Tool wird mit der Zeit klüger.</p>
      </div>
    </div>
  `;
}

// ===========================================================================
//   PAGE: Bank Detail (mit Research-Helpers + Edit)
// ===========================================================================
async function renderBankDetail(bankId) {
  app.innerHTML = `<div class="loading">Lade Bank-Detail…</div>`;
  const [bRes, sRes, cRes, conRes, hsRes, actRes, tasksRes] = await Promise.all([
    sb.from("banks").select("*").eq("id", bankId).single(),
    sb.from("signals").select("*").eq("bank_id", bankId).order("x1f_relevance", { ascending: false }),
    sb.from("contacts").select("*").eq("bank_id", bankId).order("influence_score", { ascending: false, nullsFirst: false }),
    sb.from("connections").select("*"),
    sb.from("heat_score").select("heat_score").eq("bank_id", bankId).maybeSingle(),
    sb.from("bank_activity").select("*").eq("bank_id", bankId).order("created_at", { ascending: false }).limit(50),
    sb.from("tasks").select("*").eq("bank_id", bankId).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
  ]);
  if (bRes.error) throw bRes.error;
  const b = bRes.data;
  const signals = sRes.data ?? [];
  const contacts = cRes.data ?? [];
  const allConns = conRes.data ?? [];
  const heat = hsRes.data?.heat_score ?? 0;
  const activity = actRes.data ?? [];
  const tasks = tasksRes.data ?? [];

  const myContactIds = new Set(contacts.map(c => String(c.id)));
  const relevantConns = allConns.filter(cn =>
    myContactIds.has(String(cn.contact_a)) || myContactIds.has(String(cn.contact_b))
  );

  // External contact ids needed for cross-bank connections shown
  const extIds = new Set();
  relevantConns.forEach(cn => {
    if (!myContactIds.has(String(cn.contact_a))) extIds.add(cn.contact_a);
    if (!myContactIds.has(String(cn.contact_b))) extIds.add(cn.contact_b);
  });
  let extContacts = [];
  if (extIds.size) {
    const { data } = await sb.from("v_network_nodes").select("*").in("id", Array.from(extIds).map(String));
    extContacts = data ?? [];
  }

  const bankNameUrl = encodeURIComponent(b.name);
  const researchLinks = [
    { label: "Vorstand",           url: `https://www.google.com/search?q=Vorstand+%22${bankNameUrl}%22+2026` },
    { label: "CIO / IT-Chef",      url: `https://www.google.com/search?q=%22${bankNameUrl}%22+CIO+%22Bereichsvorstand+IT%22+OR+%22Chief+Information+Officer%22+2026` },
    { label: "CFO",                url: `https://www.google.com/search?q=%22${bankNameUrl}%22+CFO+Finanzvorstand+2026` },
    { label: "SAP-Stellen",        url: `https://www.google.com/search?q=%22${bankNameUrl}%22+%22SAP%22+stellenangebot+2026` },
    { label: "LinkedIn",           url: `https://www.linkedin.com/search/results/people/?keywords=${bankNameUrl}` },
    { label: "Geschäftsbericht",   url: `https://www.google.com/search?q=%22${bankNameUrl}%22+Gesch%C3%A4ftsbericht+2025+SAP+Modernisierung` },
    { label: "Pressemitteilungen", url: `https://www.google.com/search?q=%22${bankNameUrl}%22+Pressemitteilung+SAP+S%2F4HANA+OR+IT-Transformation+2026` },
    { label: "TED Ausschreibung",  url: `https://ted.europa.eu/de/search/result?text=${bankNameUrl}` },
    { label: "Bundesanzeiger",     url: `https://www.bundesanzeiger.de/pub/de/start?0&query=${bankNameUrl}` },
  ];
  if (b.domain) researchLinks.unshift({ label: "🌐 Website",           url: `https://${b.domain}` });
  if (b.domain) researchLinks.push   ({ label: "Karriere @ Bank",      url: `https://www.google.com/search?q=site%3A${b.domain}+karriere+OR+jobs+SAP` });

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${b.is_x1f_customer ? "⭐ " : ""}${esc(b.name)}</h1>
        <p>${segmentBadge(b.segment)} ${countryBadge(b.country)}
          ${b.hq_city ? `· ${esc(b.hq_city)}` : ""}
          ${b.parent_group ? `· Gruppe: ${esc(b.parent_group)}` : ""}</p>
      </div>
      <div class="gap">
        <button class="primary" onclick="window._battleCard(${bankId})" title="Claude generiert ein Briefing für deinen Call">📋 Battle-Card</button>
        <button onclick="window._introPfad(${bankId})" title="Kürzester Weg zu dieser Bank über dein Netzwerk">🔗 Intro-Pfad</button>
        <a href="#/leads">← Zurück</a>
      </div>
    </div>

    ${(() => {
      const compScore = calcCompletenessScore(b, contacts, signals);
      const timingScore = calcTimingScore(b, signals, contacts);
      return `
    <div class="cards">
      <div class="card accent"><div class="label">Heat-Score</div><div class="value">${heat || "—"}</div></div>
      <div class="card"><div class="label">Signale</div><div class="value">${signals.length}</div></div>
      <div class="card"><div class="label">Hot Signale</div><div class="value">${signals.filter(s => (s.x1f_relevance ?? 0) >= 70).length}</div></div>
      <div class="card"><div class="label">Kontakte</div><div class="value">${contacts.length}</div></div>
      <div class="card"><div class="label">⏱ Kauf-Timing</div>
        <div class="value" style="font-size:18px">${timingBadge(timingScore)}</div>
        <div class="sub">${timingScore >= 70 ? "Jetzt aktiv werden!" : timingScore >= 40 ? "Bald opportun" : "Noch abwarten"}</div>
      </div>
    </div>
    ${renderCompletenessBar(compScore)}`;
    })()}

    <div class="section research-section">
      <div class="section-header">
        <h2>🔍 Recherche-Helfer</h2>
        <span class="muted small">Externe Suchen für diese Bank — öffnen in neuem Tab</span>
      </div>
      <div class="research-buttons">
        ${researchLinks.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="research-btn">${esc(r.label)}</a>`).join("")}
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="section">
          <div class="section-header"><h2>Pain-Signale</h2></div>
          ${signals.length === 0 ? '<div class="empty">Keine Signale erfasst.</div>' :
            signals.map(s => renderSignalItem(s)).join("")}
        </div>
      </div>
      <div>
        <div class="section">
          <div class="section-header">
            <h2>Decision-Maker</h2>
            ${EDIT_MODE ? `<button class="primary small" onclick="window._addContact(${bankId})">+ Neu</button>` : ""}
          </div>
          ${contacts.length === 0 ? '<div class="empty">Keine Kontakte.</div>' :
            contacts.map(c => renderContactItem(c, EDIT_MODE)).join("")}
        </div>
        ${relevantConns.length > 0 ? `
          <div class="section">
            <div class="section-header">
              <h2>Verbindungen (${relevantConns.length})</h2>
              ${EDIT_MODE ? `<button class="primary small" onclick="window._addConnection(${bankId})">+ Connection</button>` : ""}
            </div>
            <div style="padding:12px 16px"><div id="cy-detail" style="height:320px;border:1px solid var(--border);border-radius:8px"></div></div>
            ${renderConnectionsList(relevantConns, contacts, extContacts)}
          </div>` : ""}
        <div class="section">
          <div class="section-header">
            <h2>Aktivitäten / Notizen (${activity.length})</h2>
          </div>
          ${EDIT_MODE ? `
            <div class="activity-form">
              <textarea id="act-input" placeholder="Neue Notiz / Call-Zusammenfassung / Meeting…"></textarea>
              <div class="activity-actions">
                <select id="act-type">
                  <option value="note">Notiz</option>
                  <option value="call">Call</option>
                  <option value="email">E-Mail</option>
                  <option value="meeting">Meeting</option>
                  <option value="custom">Sonstiges</option>
                </select>
                <button class="primary small" onclick="window._addActivity(${bankId})">+ Hinzufügen</button>
              </div>
            </div>` : ""}
          <div class="activity-list">
            ${activity.length === 0 ? '<div class="empty small">Noch keine Aktivitäten erfasst.</div>' :
              activity.map(a => `
                <div class="activity-item">
                  <div class="activity-meta">${esc(a.activity_type)} · ${fmtDate(a.created_at)} · ${esc(a.actor)}</div>
                  <div class="activity-content">${esc(a.content)}</div>
                </div>`).join("")}
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2>Stammdaten</h2>
            ${EDIT_MODE ? `<button class="primary small" onclick="window._editBank(${bankId})">Bearbeiten</button>` : ""}
          </div>
          <div style="padding:12px 16px">
            <dl class="kv-list">
              <dt>Domain</dt><dd>${b.domain ? `<a href="https://${esc(b.domain)}" target="_blank">${esc(b.domain)}</a>` : "—"}</dd>
              <dt>Stadt</dt><dd>${esc(b.hq_city ?? "—")}</dd>
              <dt>Gruppe</dt><dd>${esc(b.parent_group ?? "—")}</dd>
              <dt>Bestandskunde</dt><dd>${b.is_x1f_customer ? "Ja" : "Nein"}</dd>
              <dt>Mitarbeiter</dt><dd>${fmt(b.employees)}</dd>
              <dt>Bilanzsumme (Mrd €)</dt><dd>${fmt(b.total_assets_eur_bn)}</dd>
              <dt>Notizen</dt><dd>${esc(b.notes ?? "—")}</dd>
            </dl>
          </div>
        </div>

        <div class="section">
          <div class="section-header"><h2>🛠 Tech-Profil</h2>
            ${EDIT_MODE ? `<button class="primary small" onclick="window._editBank(${bankId})">Bearbeiten</button>` : ""}
          </div>
          <div style="padding:12px 16px">
            <dl class="kv-list">
              <dt>SAP-Module</dt><dd>${(b.sap_modules ?? []).length ? b.sap_modules.map(m => `<span class="keyword">${esc(m)}</span>`).join(" ") : "—"}</dd>
              <dt>Cloud</dt><dd>${esc(b.cloud_provider ?? "—")}</dd>
              <dt>Hauptpartner</dt><dd>${esc(b.main_partner ?? "—")}</dd>
              <dt>Vertragsende</dt><dd>${esc(b.contract_end_estimate ?? "—")}</dd>
              <dt>IT-Budget (Mio €)</dt><dd>${b.it_budget_estimate_mn != null ? fmt(b.it_budget_estimate_mn) : "—"}</dd>
            </dl>
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2>📌 Tasks (${tasks.length})</h2>
            ${EDIT_MODE ? `<button class="primary small" onclick="window._addTask(${bankId})">+ Task</button>` : ""}
          </div>
          ${tasks.length === 0
            ? `<div class="empty small" style="padding:12px 16px">Keine offenen Tasks.${EDIT_MODE ? " Klick auf + Task um eine Aufgabe zu erfassen." : ""}</div>`
            : `<div style="padding:0 16px 12px">
              ${tasks.map(t => {
                const overdue = t.due_date && t.due_date < new Date().toISOString().slice(0,10);
                return `<div class="activity-item" style="${overdue ? "border-left:3px solid var(--danger,#dc2626)" : "border-left:3px solid var(--border)"}">
                  <div class="activity-meta">
                    ${t.due_date ? `<span${overdue ? ' style="color:var(--danger,#dc2626);font-weight:600"' : ""}>${overdue ? "⚠ Überfällig: " : "Fällig: "}${fmtDate(t.due_date)}</span> · ` : ""}
                    ${t.created_at ? fmtDate(t.created_at) : ""}
                    ${EDIT_MODE ? `
                      <button class="icon-btn" onclick="window._doneTask(${t.id})" title="Als erledigt markieren">✓</button>
                      <button class="icon-btn" onclick="window._deleteTask(${t.id})" title="Löschen">🗑</button>` : ""}
                  </div>
                  <div class="activity-content">${esc(t.title)}${t.description ? `<div class="muted small">${esc(t.description)}</div>` : ""}</div>
                </div>`;
              }).join("")}
            </div>`}
        </div>
      </div>
    </div>`;

  if (relevantConns.length > 0) drawDetailGraph([...contacts, ...extContacts], relevantConns);

  // expose helpers for inline buttons
  window._editContact   = (id) => editContactModal(id, contacts.find(c => c.id === id), bankId);
  window._addContact    = (bid) => editContactModal(null, null, bid);
  window._addConnection = (bid) => addConnectionModal(bid, contacts);
  window._editBank      = (bid) => editBankModal(b);
  window._addTask       = (bid) => addTaskModal(bid, contacts);
  window._doneTask      = async (id) => {
    try { await apiCall("PATCH", `task?id=${id}`, { status: "done" }); navigate(); }
    catch (e) { alert("Fehler: " + e.message); }
  };
  window._deleteTask    = async (id) => {
    if (!confirm("Task wirklich löschen?")) return;
    try { await apiCall("DELETE", `task?id=${id}`); navigate(); }
    catch (e) { alert("Fehler: " + e.message); }
  };
  window._delContact    = async (id) => {
    if (!confirm("Kontakt wirklich löschen?")) return;
    try { await apiCall("DELETE", "contact?id=" + id); navigate(); }
    catch (e) { alert("Fehler: " + e.message); }
  };
  window._addActivity = async (bid) => {
    const content = $("#act-input").value.trim();
    if (!content) return;
    const type = $("#act-type").value;
    try {
      await apiCall("POST", "activity", { bank_id: bid, content, type });
      navigate();
    } catch (e) { alert("Fehler: " + e.message); }
  };
  window._battleCard = async (bid) => {
    const tone = "praezise-strategisch";
    const loadingHtml = `
      <div class="modal-backdrop" id="modal">
        <div class="modal" style="max-width:680px">
          <h3>📋 Battle-Card wird generiert…</h3>
          <p class="muted small">Claude verdichtet alle Bank-Daten zu einem 1-Seiten-Brief. Dauert 5-10s.</p>
          <div class="loading">⏳</div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", loadingHtml);
    try {
      const j = await apiCall("POST", "battle-card", { bank_id: bid, tone });
      const cardText = j.battle_card ?? "";
      const cardHtml = simpleMarkdownToHtml(cardText);
      window._lastBattleCard = cardText;  // stash für Copy-Button
      $("#modal").remove();
      const html = `
        <div class="modal-backdrop" id="modal">
          <div class="modal" style="max-width:760px;max-height:90vh">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <h3 style="margin:0">📋 Battle-Card</h3>
              <span class="muted small">Generated by ${esc(j.model)}</span>
            </div>
            <div class="battle-card-body">${cardHtml}</div>
            <div class="modal-actions">
              <button onclick="window._copyBattleCard()">📋 Kopieren</button>
              <button onclick="window.print()">🖨 Drucken</button>
              <button class="primary" onclick="closeModal()">Schließen</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML("beforeend", html);
    } catch (e) {
      $("#modal")?.remove();
      alert("Fehler: " + e.message);
    }
  };

  // ---- Feature 4: Intro-Pfad-Finder (BFS über Connections-Graph) -----------
  window._introPfad = async (bid) => {
    // Lade alle Nodes & Edges aus den Network-Views
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-backdrop" id="modal">
        <div class="modal" style="max-width:640px">
          <h3>🔗 Intro-Pfad wird berechnet…</h3>
          <div class="loading">⏳</div>
        </div>
      </div>`);
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        sb.from("v_network_nodes").select("*"),
        sb.from("v_network_edges").select("*"),
      ]);
      const allNodes = nodesRes.data ?? [];
      const allEdges = edgesRes.data ?? [];

      // Ziel: Kontakte der aktuellen Bank
      const targetNodeIds = new Set(
        allNodes.filter(n => String(n.bank_id) === String(bid)).map(n => String(n.id))
      );

      if (targetNodeIds.size === 0) {
        $("#modal").remove();
        document.body.insertAdjacentHTML("beforeend", `
          <div class="modal-backdrop" id="modal">
            <div class="modal" style="max-width:540px">
              <h3>🔗 Intro-Pfad zu ${esc(b.name)}</h3>
              <p class="muted">Keine Kontakte bei dieser Bank erfasst — zuerst Kontakte anlegen.</p>
              <div class="modal-actions"><button class="primary" onclick="closeModal()">Schließen</button></div>
            </div>
          </div>`);
        return;
      }

      // Erstelle Adjacency-Map
      const adj = new Map(); // nodeId → [{neighborId, edgeData}]
      for (const e of allEdges) {
        const src = String(e.source), tgt = String(e.target);
        if (!adj.has(src)) adj.set(src, []);
        if (!adj.has(tgt)) adj.set(tgt, []);
        adj.get(src).push({ neighbor: tgt, edge: e });
        adj.get(tgt).push({ neighbor: src, edge: e });
      }

      // Wir nutzen "unsere" Kontakte als Startpunkte (Relationship-Score > 0 oder placeholder=false)
      // Hier: alle non-target Nodes als potentielle eigene Kontakte / Vermittler
      // BFS von jedem Target-Node — finde kürzesten Weg zu non-target Nodes die gut connected sind
      // Einfachere Interpretation: BFS von allen Target-Nodes, max depth 3

      const nodeMap = new Map(allNodes.map(n => [String(n.id), n]));

      // Finde alle Pfade (BFS), max depth 3
      const found = [];
      for (const startId of targetNodeIds) {
        const visited = new Set([startId]);
        const queue = [[startId]]; // Pfade als Arrays von nodeIds
        while (queue.length > 0 && found.length < 5) {
          const path = queue.shift();
          const last = path[path.length - 1];
          if (!targetNodeIds.has(last) && path.length > 1) {
            found.push([...path].reverse()); // Pfad umdrehen: Du → ... → Ziel
          }
          if (path.length >= 4) continue; // max depth 3 hops
          for (const { neighbor } of (adj.get(last) ?? [])) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push([...path, neighbor]);
            }
          }
        }
        if (found.length >= 5) break;
      }

      $("#modal").remove();

      let pathHtml = "";
      if (found.length === 0) {
        pathHtml = `<div class="intro-pfad-none">
          <p>Kein direkter Netzwerk-Pfad gefunden.</p>
          <p class="muted small">Nutze die Battle-Card für Cold Outreach oder pflege weitere Verbindungen im Netzwerk-Graph.</p>
          <button class="primary" onclick="closeModal();window._battleCard(${bid})">📋 Battle-Card für Cold Outreach</button>
        </div>`;
      } else {
        pathHtml = `<div class="intro-pfad-list">
          ${found.slice(0, 5).map((path, i) => {
            const chain = path.map(nid => {
              const n = nodeMap.get(nid);
              if (!n) return `<span class="intro-node">?</span>`;
              const isTarget = targetNodeIds.has(nid);
              const isYou = i === 0 && nid === path[0] && !targetNodeIds.has(nid);
              const cls = isTarget ? "intro-node intro-node--target" : "intro-node";
              return `<span class="${cls}" title="${esc(n.role_title ?? "")} @ ${esc(n.bank ?? "")}">${esc((n.label ?? "").replace(/^\[Platzhalter\]\s*/,""))}<div class="intro-node-sub">${esc(n.bank ?? "")}</div></span>`;
            });
            // Insert Du → at start if path starts from non-target
            const firstNode = nodeMap.get(path[0]);
            const prefix = firstNode && !targetNodeIds.has(path[0]) ? "" : `<span class="intro-node intro-node--you">Du</span><span class="intro-arrow">→</span>`;
            return `<div class="intro-pfad-item">
              <div class="intro-pfad-label">Pfad ${i + 1}</div>
              <div class="intro-chain">
                ${prefix}${chain.join('<span class="intro-arrow">→</span>')}
              </div>
            </div>`;
          }).join("")}
        </div>`;
      }

      document.body.insertAdjacentHTML("beforeend", `
        <div class="modal-backdrop" id="modal">
          <div class="modal" style="max-width:640px">
            <h3>🔗 Intro-Pfad zu ${esc(b.name)}</h3>
            <p class="muted small">Kürzester Netzwerk-Weg zu den Kontakten bei dieser Bank (max. 3 Hops).</p>
            ${pathHtml}
            <div class="modal-actions"><button class="primary" onclick="closeModal()">Schließen</button></div>
          </div>
        </div>`);
    } catch (e) {
      $("#modal")?.remove();
      alert("Fehler beim Laden des Netzwerks: " + e.message);
    }
  };

  window._copyBattleCard = async () => {
    try {
      await navigator.clipboard.writeText(window._lastBattleCard ?? "");
      showToast("📋 Battle-Card in Zwischenablage kopiert!");
    } catch (e) { showToast("Kopieren fehlgeschlagen: " + e.message, "error"); }
  };

  window._copyPitch = async () => {
    try {
      await navigator.clipboard.writeText(window._lastPitch ?? "");
      showToast("✉️ Pitch-Mail in Zwischenablage kopiert!");
    } catch (e) { showToast("Kopieren fehlgeschlagen: " + e.message, "error"); }
  };
  window._generatePitch = async (signal_id, contact_id) => {
    try {
      const tone = prompt("Tonalität? (z.B. professionell-knapp / freundlich / formell)", "professionell-knapp");
      if (!tone) return;
      const j = await apiCall("POST", "generate-pitch", { signal_id, contact_id, tone });
      window._lastPitch = j.pitch ?? "";  // stash für Copy
      const html = `
        <div class="modal-backdrop" id="modal">
          <div class="modal" style="max-width:640px">
            <h3>Generierter Pitch (${esc(j.model ?? "Claude")})</h3>
            <div class="pitch-output">${esc(j.pitch)}</div>
            <div class="modal-actions">
              <button onclick="window._copyPitch()">📋 In Zwischenablage</button>
              <button class="primary" onclick="closeModal()">Schließen</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML("beforeend", html);
    } catch (e) { alert("Fehler: " + e.message); }
  };
}

function renderSignalItem(s) {
  const dealBadge = s.deal_value ? `<span class="badge x1f">€ ${Number(s.deal_value).toLocaleString("de-DE", {maximumFractionDigits: 0})} ${s.deal_status ?? ""}</span>` : "";
  const staleBadge = isStale(s.signal_date, s.signal_type) ? `<span class="badge stale" title="Dieses Signal ist älter als das empfohlene Aktionsfenster">⌛ Veraltet</span>` : "";
  return `
    <div class="signal-item${isStale(s.signal_date, s.signal_type) ? " signal-stale" : ""}">
      <div class="head">
        <span class="title">${esc(s.title)}</span>
        ${heatBadge(s.x1f_relevance)}
        ${signalBadge(s.signal_type)}
        ${dealBadge}
        ${staleBadge}
        ${EDIT_MODE ? `
          <select class="status-edit" data-signal-id="${s.id}" onchange="window._setStatus(${s.id}, this.value)">
            ${["new","queued","contacted","meeting","won","lost","ignored"].map(st =>
              `<option value="${st}"${st === (s.outreach_status ?? "new") ? " selected" : ""}>${st}</option>`).join("")}
          </select>
          <button class="icon-btn" title="Pitch generieren (Claude)" onclick="window._generatePitch(${s.id})">✨</button>
          <button class="icon-btn" title="Deal-Wert / Status setzen" onclick="window._editDeal(${s.id}, ${s.deal_value ?? 'null'}, '${s.deal_status ?? "pipeline"}')">💰</button>
          <button class="icon-btn" title="Slack-Alert posten" onclick="window._slackNotify(${s.id})">🔔</button>` : ""}
      </div>
      <div class="meta-line">
        ${esc(s.source ?? "")} ${s.signal_date ? `· ${fmtDate(s.signal_date)}` : ""}
        ${s.outreach_status && s.outreach_status !== "new" ? ` · <span class="badge cold">${esc(s.outreach_status)}</span>` : ""}
        ${s.source_url ? ` · <a href="${esc(s.source_url)}" target="_blank">Quelle →</a>` : ""}
      </div>
      ${s.body ? `<div class="body">${esc(s.body)}</div>` : ""}
      ${(s.keywords_matched ?? []).length ? `<div class="keywords">${s.keywords_matched.map(k => `<span class="keyword">${esc(k)}</span>`).join("")}</div>` : ""}
    </div>`;
}

window._setStatus = async (signal_id, status) => {
  try { await apiCall("POST", "outreach", { signal_id, status }); navigate(); }
  catch (e) { alert("Fehler: " + e.message); }
};

window._editDeal = (signal_id, currentValue, currentStatus) => {
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:420px">
        <h3>💰 Deal aktualisieren</h3>
        <div class="form-grid">
          <label>Deal-Wert (EUR)<input id="d-val" type="number" step="1000" value="${currentValue !== null && currentValue !== undefined ? currentValue : ''}" placeholder="z.B. 250000"></label>
          <label>Status
            <select id="d-stat">
              ${["pipeline","won","lost","disqualified"].map(s =>
                `<option${s === currentStatus ? " selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>
          <label>Notizen<textarea id="d-notes" rows="3" placeholder="Kontext zum Deal…"></textarea></label>
        </div>
        <div class="modal-actions">
          <button onclick="closeModal()">Abbrechen</button>
          <button class="primary" id="d-save">Speichern</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  $("#d-save").onclick = async () => {
    const payload = {
      signal_id,
      deal_value: $("#d-val").value ? parseFloat($("#d-val").value) : null,
      deal_status: $("#d-stat").value,
      deal_notes: $("#d-notes").value.trim() || null,
    };
    try { await apiCall("POST", "deal", payload); closeModal(); navigate(); }
    catch (e) { alert("Fehler: " + e.message); }
  };
};

window._slackNotify = async (signal_id) => {
  try {
    const j = await apiCall("POST", "slack-notify", { signal_id });
    if (j.posted) alert("✓ In Slack gepostet");
    else alert("Slack-Webhook nicht konfiguriert. SLACK_WEBHOOK_URL in Supabase Secrets setzen.");
  } catch (e) { alert("Fehler: " + e.message); }
};

// Simple markdown → HTML (für Battle-Card)
function simpleMarkdownToHtml(md) {
  if (!md) return "";
  let html = esc(md);
  // headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // ordered + unordered list items
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, "<li>$2</li>");
  html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
  // wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)+)/gs, "<ul>$1</ul>");
  // line breaks
  html = html.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}

function renderContactItem(c, editable) {
  const inf = c.influence_score ?? 0;
  const rel = c.relationship_score ?? 0;
  const relColor = rel >= 70 ? "var(--good)" : rel >= 40 ? "var(--warn, #f59e0b)" : "var(--muted-text)";
  const realBadge = c.is_placeholder
    ? '<span class="badge dotted small">Platzhalter</span>'
    : '<span class="badge x1f small">verifiziert</span>';
  return `
    <div class="contact-item">
      <div class="avatar">${initials(c.full_name)}</div>
      <div class="info">
        <div class="name">${esc(cleanName(c.full_name))}
          ${realBadge}</div>
        <div class="role">${esc(c.role_title ?? "")} ${c.functional_area ? `· ${esc(c.functional_area)}` : ""}</div>
        ${c.previous_employer ? `<div class="small muted">vorher: ${esc(c.previous_employer)}</div>` : ""}
        <div class="small">
          ${c.linkedin_url ? `<a href="${esc(c.linkedin_url)}" target="_blank">LinkedIn ↗</a>` : ""}
          ${c.email ? ` · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}
          ${c.source_url && !c.is_placeholder ? ` · <a href="${esc(c.source_url)}" target="_blank">Quelle ↗</a>` : ""}
          ${c.last_contacted_at ? ` · <span class="muted">Zuletzt: ${fmtDate(c.last_contacted_at)}</span>` : ""}
        </div>
      </div>
      <div class="stat">
        <div class="influence-bar"><div class="influence-fill" style="width:${inf}%"></div></div>
        <div class="small muted" title="Influence-Score">Inf: ${inf || "—"}</div>
        <div class="influence-bar" style="margin-top:3px"><div class="influence-fill" style="width:${rel}%;background:${relColor}"></div></div>
        <div class="small muted" title="Relationship-Score (wie gut kennen wir diese Person)">Rel: ${rel || "—"}</div>
        ${c.seniority ? `<span class="badge ${c.seniority === 'Vorstand' ? 'hot' : 'cold'}">${esc(c.seniority)}</span>` : ""}
      </div>
      ${editable ? `
        <div class="contact-actions">
          <button class="icon-btn" onclick="window._editContact(${c.id})" title="Bearbeiten">✏️</button>
          <button class="icon-btn" onclick="window._delContact(${c.id})" title="Löschen">🗑</button>
        </div>` : ""}
    </div>`;
}

function renderConnectionsList(conns, contacts, extContacts) {
  const cmap = new Map();
  contacts.forEach(c => cmap.set(String(c.id), c));
  extContacts.forEach(c => cmap.set(String(c.id), { ...c, full_name: c.label, role_title: c.role_title, bank: c.bank }));
  return `<div style="padding:0 16px 12px">
    <details><summary class="small muted">Liste der Verbindungen anzeigen</summary>
      <ul style="margin:8px 0;padding-left:20px;font-size:12px">
        ${conns.map(cn => {
          const a = cmap.get(String(cn.contact_a)), b = cmap.get(String(cn.contact_b));
          return `<li>
            <strong>${esc(cleanName(a?.full_name ?? "?"))}</strong>
            <span class="muted">${esc(RELATIONSHIP_LABELS[cn.relationship] ?? cn.relationship)}</span>
            <strong>${esc(cleanName(b?.full_name ?? "?"))}</strong>
            ${b?.bank && b.bank !== a?.bank ? `<span class="badge segment small">@ ${esc(b.bank)}</span>` : ""}
            ${cn.evidence ? `<div class="muted small" style="margin-left:0">${esc(cn.evidence)}</div>` : ""}
            ${EDIT_MODE ? `<button class="icon-btn small" onclick="window._delConnection(${cn.id})">🗑</button>` : ""}
          </li>`;
        }).join("")}
      </ul>
    </details>
  </div>`;
}

window._delConnection = async (id) => {
  if (!confirm("Verbindung löschen?")) return;
  try { await apiCall("DELETE", "connection?id=" + id); navigate(); }
  catch (e) { alert("Fehler: " + e.message); }
};

function drawDetailGraph(allContacts, conns) {
  const elements = [
    ...allContacts.map(c => ({
      data: { id: String(c.id), label: cleanName(c.full_name ?? c.label),
              seniority: c.seniority, area: c.functional_area }
    })),
    ...conns.map(cn => ({
      data: { id: "e"+cn.id, source: String(cn.contact_a), target: String(cn.contact_b),
              relationship: cn.relationship, label: cn.relationship }
    })),
  ];
  cytoscape({ container: $("#cy-detail"), elements, style: networkStyle(),
    layout: { name: "cose", padding: 20, animate: false } });
}

// ===========================================================================
//   EDIT MODALS
// ===========================================================================
function editContactModal(id, c, bankId, banksList = null) {
  c = c ?? { bank_id: bankId, full_name: "", role_title: "", seniority: "Unbekannt", functional_area: "", influence_score: 50, relationship_score: 0, is_placeholder: false, linkedin_url: "", email: "", previous_employer: "", source_url: "" };
  const bankSelect = (!id && banksList)
    ? `<label>Bank / Unternehmen <span class="muted small">(optional)</span><select id="m-bank"><option value="">— kein Unternehmen —</option>${banksList.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></label>`
    : "";
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:520px">
        <h3>${id ? "Kontakt bearbeiten" : "Neuer Kontakt"}</h3>
        <div class="form-grid">
          ${bankSelect}
          <label>Vollständiger Name<input id="m-name" value="${esc(cleanName(c.full_name ?? ''))}" placeholder="Vor Nachname"></label>
          <label>Rolle / Titel<input id="m-role" value="${esc(c.role_title ?? '')}"></label>
          <label>Seniority
            <select id="m-sen">
              ${["Vorstand","C-Level","Bereichsleiter","Abteilungsleiter","Senior","IC","Unbekannt"].map(x =>
                `<option${x === (c.seniority ?? 'Unbekannt') ? " selected" : ""}>${x}</option>`).join("")}
            </select>
          </label>
          <label>Funktionsbereich<input id="m-area" value="${esc(c.functional_area ?? '')}" placeholder="z.B. IT, Finance, Treasury"></label>
          <label>
            Influence-Score (0–100) — Macht/Entscheidungsgewicht
            <input id="m-inf" type="number" min="0" max="100" value="${c.influence_score ?? 50}">
          </label>
          <label>
            Relationship-Score (0–100) — wie gut kennen wir diese Person?
            <div style="display:flex;gap:10px;align-items:center">
              <input id="m-rel" type="range" min="0" max="100" value="${c.relationship_score ?? 0}" style="flex:1" oninput="document.getElementById('m-rel-val').textContent=this.value">
              <span id="m-rel-val" style="width:28px;text-align:right;font-weight:600">${c.relationship_score ?? 0}</span>
            </div>
          </label>
          <label>Letzter Kontakt<input id="m-lc" type="date" value="${c.last_contacted_at ?? ''}"></label>
          <label>LinkedIn-URL<input id="m-li" value="${esc(c.linkedin_url ?? '')}"></label>
          <label>E-Mail<input id="m-email" type="email" value="${esc(c.email ?? '')}"></label>
          <label>Vorheriger Arbeitgeber<input id="m-prev" value="${esc(c.previous_employer ?? '')}"></label>
          <label>Quellen-URL<input id="m-src" value="${esc(c.source_url ?? '')}"></label>
          <label class="checkbox"><input id="m-pl" type="checkbox" ${c.is_placeholder ? "checked" : ""}> Platzhalter (keine echte Person)</label>
        </div>
        <div class="modal-actions">
          <button onclick="closeModal()">Abbrechen</button>
          <button class="primary" id="m-save">Speichern</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  $("#m-save").onclick = async () => {
    const resolvedBankId = banksList ? (parseInt($("#m-bank")?.value ?? "0") || null) : (bankId ?? c.bank_id ?? null);
    const payload = {
      bank_id: resolvedBankId,
      full_name: $("#m-name").value.trim(),
      role_title: $("#m-role").value.trim(),
      seniority: $("#m-sen").value,
      functional_area: $("#m-area").value.trim() || null,
      influence_score: parseInt($("#m-inf").value),
      relationship_score: parseInt($("#m-rel").value),
      last_contacted_at: $("#m-lc").value || null,
      linkedin_url: $("#m-li").value.trim() || null,
      email: $("#m-email").value.trim() || null,
      previous_employer: $("#m-prev").value.trim() || null,
      source_url: $("#m-src").value.trim() || null,
      is_placeholder: $("#m-pl").checked,
      is_decision_maker: ["Vorstand","C-Level","Bereichsleiter"].includes($("#m-sen").value),
    };
    try {
      if (id) await apiCall("PATCH", `contact?id=${id}`, payload);
      else    await apiCall("POST",  "contact", payload);
      closeModal();
      navigate();
    } catch (e) { alert("Fehler: " + e.message); }
  };
}

function addTaskModal(bankId, bankContacts) {
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:460px">
        <h3>+ Neue Aufgabe</h3>
        <div class="form-grid">
          <label>Aufgabe (Titel)<input id="t-title" placeholder="z.B. Follow-up Call CIO" autofocus></label>
          <label>Beschreibung<textarea id="t-desc" rows="2" placeholder="Kontext, Ziel, nächste Schritte…"></textarea></label>
          <label>Fällig am<input id="t-due" type="date"></label>
          ${bankContacts.length > 0 ? `<label>Kontakt (optional)
            <select id="t-contact">
              <option value="">— kein Kontakt —</option>
              ${bankContacts.map(c => `<option value="${c.id}">${esc(cleanName(c.full_name))} (${esc(c.role_title ?? "")})</option>`).join("")}
            </select>
          </label>` : ""}
        </div>
        <div class="modal-actions">
          <button onclick="closeModal()">Abbrechen</button>
          <button class="primary" id="t-save">Speichern</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  $("#t-save").onclick = async () => {
    const title = $("#t-title").value.trim();
    if (!title) return alert("Titel fehlt.");
    const payload = {
      bank_id: bankId,
      title,
      description: $("#t-desc").value.trim() || null,
      due_date: $("#t-due").value || null,
      contact_id: $("#t-contact")?.value ? parseInt($("#t-contact").value) : null,
    };
    try { await apiCall("POST", "task", payload); closeModal(); navigate(); }
    catch (e) { alert("Fehler: " + e.message); }
  };
}

function addConnectionModal(bankId, bankContacts) {
  if (bankContacts.length === 0) return alert("Erst Kontakte anlegen.");
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:520px">
        <h3>Neue Verbindung</h3>
        <p class="muted small">Kontakt A bei dieser Bank → Kontakt B (kann andere Bank sein, dann ID via Suche eingeben)</p>
        <div class="form-grid">
          <label>Kontakt A
            <select id="m-a">${bankContacts.map(c => `<option value="${c.id}">${esc(cleanName(c.full_name))}</option>`).join("")}</select>
          </label>
          <label>Kontakt B (ID)<input id="m-b" type="number" placeholder="Contact-ID aus #/contacts"></label>
          <label>Beziehung
            <select id="m-rel">
              ${Object.entries(RELATIONSHIP_LABELS).map(([k,v]) => `<option value="${k}">${esc(v)} (${esc(k)})</option>`).join("")}
            </select>
          </label>
          <label>Belege / Evidence<textarea id="m-ev" rows="3" placeholder="Worauf basiert die Verbindung?"></textarea></label>
          <label>Stärke (0-100)<input id="m-str" type="number" min="0" max="100" value="60"></label>
        </div>
        <div class="modal-actions">
          <button onclick="closeModal()">Abbrechen</button>
          <button class="primary" id="m-save">Speichern</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  $("#m-save").onclick = async () => {
    const payload = {
      contact_a: parseInt($("#m-a").value),
      contact_b: parseInt($("#m-b").value),
      relationship: $("#m-rel").value,
      evidence: $("#m-ev").value.trim(),
      strength: parseInt($("#m-str").value),
    };
    if (!payload.contact_b) return alert("Kontakt B ID fehlt");
    try { await apiCall("POST", "connection", payload); closeModal(); navigate(); }
    catch (e) { alert("Fehler: " + e.message); }
  };
}

function createBankModal() {
  const segs = ['grossbank','landesbank','foerderbank','sparkasse','genossenschaft','privatbank','versicherung','investmentbank'];
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:520px">
        <h3>+ Neuen Lead anlegen</h3>
        <div class="form-grid">
          <label>Name der Bank *<input id="nb-name" placeholder="z.B. Musterbank AG" autofocus></label>
          <label>Segment
            <select id="nb-seg">
              ${segs.map(s => `<option value="${s}">${segmentLabel[s] ?? s}</option>`).join("")}
            </select>
          </label>
          <label>Land (ISO-Code)<input id="nb-country" value="DE" placeholder="DE, AT, CH…" maxlength="3"></label>
          <label>Hauptsitz Stadt<input id="nb-city" placeholder="Frankfurt"></label>
          <label>Domain<input id="nb-domain" placeholder="musterbank.de"></label>
          <label>Mitarbeiter<input id="nb-emp" type="number" placeholder="5000"></label>
          <label>Bilanzsumme (Mrd €)<input id="nb-assets" type="number" step="0.1" placeholder="45.5"></label>
          <label>Notizen<textarea id="nb-notes" rows="2" placeholder="Erste Infos, Quelle…"></textarea></label>
          <label class="checkbox"><input id="nb-cust" type="checkbox"> x1F-Bestandskunde</label>
        </div>
        <div class="modal-actions">
          <button onclick="closeModal()">Abbrechen</button>
          <button class="primary" id="nb-save">Anlegen</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  $("#nb-save").onclick = async () => {
    const name = $("#nb-name").value.trim();
    if (!name) { showToast("Name ist Pflichtfeld", "error"); return; }
    const payload = {
      name,
      segment:              $("#nb-seg").value,
      country:              $("#nb-country").value.trim().toUpperCase() || "DE",
      hq_city:              $("#nb-city").value.trim() || null,
      domain:               $("#nb-domain").value.trim() || null,
      employees:            $("#nb-emp").value ? parseInt($("#nb-emp").value) : null,
      total_assets_eur_bn:  $("#nb-assets").value ? parseFloat($("#nb-assets").value) : null,
      is_x1f_customer:      $("#nb-cust").checked,
      notes:                $("#nb-notes").value.trim() || null,
    };
    try {
      const j = await apiCall("POST", "bank", payload);
      closeModal();
      showToast(`✅ ${name} angelegt — ID ${j.bank?.id}`);
      setTimeout(() => navigate(), 1200);
    } catch (e) { showToast("Fehler: " + e.message, "error"); }
  };
}

function editBankModal(b) {
  const sapModulesStr = (b.sap_modules ?? []).join(", ");
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:560px">
        <h3>Bank bearbeiten: ${esc(b.name)}</h3>
        <div class="form-grid">
          <label>Mitarbeiter<input id="m-emp" type="number" value="${b.employees ?? ''}"></label>
          <label>Bilanzsumme (Mrd €)<input id="m-bal" type="number" step="0.1" value="${b.total_assets_eur_bn ?? ''}"></label>
          <label class="checkbox"><input id="m-cust" type="checkbox" ${b.is_x1f_customer ? "checked" : ""}> x1F-Bestandskunde</label>
          <label>Notizen<textarea id="m-notes" rows="3">${esc(b.notes ?? '')}</textarea></label>
          <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;font-weight:600;font-size:12px;color:var(--muted-text);grid-column:1/-1">Tech-Profil</div>
          <label>SAP-Module (kommagetrennt)<input id="m-sap" value="${esc(sapModulesStr)}" placeholder="z.B. S/4HANA Finance, BW/4HANA, FSCM"></label>
          <label>Cloud-Anbieter<input id="m-cloud" value="${esc(b.cloud_provider ?? '')}" placeholder="z.B. Azure, AWS, GCP, On-Premise"></label>
          <label>Hauptpartner / Hauptintegrator<input id="m-partner" value="${esc(b.main_partner ?? '')}" placeholder="z.B. Accenture, KPMG, IBM, Capgemini"></label>
          <label>Vertragsende (Schätzung)<input id="m-contract" value="${esc(b.contract_end_estimate ?? '')}" placeholder="z.B. Q3 2027 oder 2026"></label>
          <label>IT-Budget-Schätzung (Mio €)<input id="m-itb" type="number" step="0.1" value="${b.it_budget_estimate_mn ?? ''}" placeholder="z.B. 45"></label>
        </div>
        <div class="modal-actions">
          <button onclick="closeModal()">Abbrechen</button>
          <button class="primary" id="m-save">Speichern</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  $("#m-save").onclick = async () => {
    const sapRaw = $("#m-sap").value.trim();
    const payload = {
      employees: $("#m-emp").value ? parseInt($("#m-emp").value) : null,
      total_assets_eur_bn: $("#m-bal").value ? parseFloat($("#m-bal").value) : null,
      is_x1f_customer: $("#m-cust").checked,
      notes: $("#m-notes").value.trim() || null,
      sap_modules: sapRaw ? sapRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
      cloud_provider: $("#m-cloud").value.trim() || null,
      main_partner: $("#m-partner").value.trim() || null,
      contract_end_estimate: $("#m-contract").value.trim() || null,
      it_budget_estimate_mn: $("#m-itb").value ? parseFloat($("#m-itb").value) : null,
    };
    try { await apiCall("PATCH", `bank?id=${b.id}`, payload); closeModal(); navigate(); }
    catch (e) { alert("Fehler: " + e.message); }
  };
}

// ===========================================================================
//   PAGE: Signals
// ===========================================================================
async function renderSignals() {
  app.innerHTML = `<div class="loading">Lade Signale…</div>`;
  const { data, error } = await sb.from("v_outreach_pitches").select("*");
  if (error) throw error;
  const all = data ?? [];

  const types = Array.from(new Set(all.map(s => s.signal_type).filter(Boolean))).sort();

  app.innerHTML = `
    <div class="page-header">
      <div><h1>Signal-Feed</h1><p>${all.length} Signale mit Relevance ≥ 60 — mit Pitch-Vorschlag</p></div>
      <div class="filters">
        <input id="f-q" type="search" placeholder="Suche…">
        <select id="f-rel">
          <option value="60">≥ 60 (alle)</option>
          <option value="70">≥ 70 (warm)</option>
          <option value="80">≥ 80 (hot)</option>
        </select>
        <select id="f-type">
          <option value="">Alle Typen</option>
          ${types.map(t => `<option value="${esc(t)}">${SIGNAL_TYPE_META[t]?.icon ?? "•"} ${esc(SIGNAL_TYPE_META[t]?.label ?? t)}</option>`).join("")}
        </select>
        <select id="f-status">
          <option value="">Alle Status</option>
          <option>new</option><option>queued</option><option>contacted</option>
          <option>meeting</option><option>won</option><option>lost</option>
        </select>
      </div>
    </div>
    <div id="signals-list"></div>`;

  const render = () => {
    const q = $("#f-q").value.toLowerCase();
    const rel = parseInt($("#f-rel").value);
    const st = $("#f-status").value;
    const tp = $("#f-type").value;
    const list = all.filter(s =>
      (s.rel ?? 0) >= rel &&
      (!st || s.outreach_status === st) &&
      (!tp || s.signal_type === tp) &&
      (!q || (s.bank ?? "").toLowerCase().includes(q) || (s.title ?? "").toLowerCase().includes(q)));
    $("#signals-list").innerHTML = list.length === 0 ? '<div class="empty">Keine Treffer.</div>' :
      list.map(s => `
        <div class="section">
          <div class="section-header">
            <div class="gap">
              <strong>${esc(s.bank ?? "Marktsignal")}</strong>
              ${s.is_x1f_customer ? '<span class="badge x1f">⭐ Bestand</span>' : ""}
              ${s.segment ? segmentBadge(s.segment) : ""}
              ${s.country ? countryBadge(s.country) : ""}
              ${signalBadge(s.signal_type)}
              ${s.bank_id ? `<a href="#/bank/${s.bank_id}" class="small">Bank-Detail →</a>` : ""}
            </div>
            ${heatBadge(s.rel)}
          </div>
          <div style="padding:12px 16px">
            <div style="font-weight:600;margin-bottom:6px">${esc(s.title)}</div>
            <div class="pitch"><strong>Pitch:</strong> ${esc(s.suggested_pitch)}</div>
            ${(s.keywords_matched ?? []).length ? `<div class="keywords" style="margin-top:8px">${s.keywords_matched.map(k => `<span class="keyword">${esc(k)}</span>`).join("")}</div>` : ""}
            <div class="small muted" style="margin-top:8px">
              ${s.source_url ? `<a href="${esc(s.source_url)}" target="_blank">${esc(s.source ?? "Quelle")} →</a>` : esc(s.source ?? "")}
              ${EDIT_MODE ? ` · <select onchange="window._setStatus(${s.signal_id}, this.value)">
                ${["new","queued","contacted","meeting","won","lost","ignored"].map(st =>
                  `<option value="${st}"${st === (s.outreach_status ?? "new") ? " selected" : ""}>${st}</option>`).join("")}
              </select>` : ""}
            </div>
          </div>
        </div>`).join("");
  };
  ["#f-q","#f-rel","#f-type","#f-status"].forEach(s => $(s).addEventListener("input", render));
  render();
}

// ===========================================================================
//   PAGE: Contacts
// ===========================================================================
async function renderContacts() {
  app.innerHTML = `<div class="loading">Lade Kontakte…</div>`;
  const { data, error } = await sb.from("v_bank_contacts").select("*");
  if (error) throw error;
  const all = (data ?? []).filter(c => c.contact_id);
  const sens = Array.from(new Set(all.map(c => c.seniority).filter(Boolean)));
  const areas = Array.from(new Set(all.map(c => c.functional_area).filter(Boolean))).sort();

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Kontakte / Decision-Maker</h1>
        <p>${all.length} Personen · ${all.filter(c => c.is_decision_maker).length} Entscheider · ${all.filter(c => !c.is_placeholder).length} verifiziert</p>
      </div>
      <div class="filters">
        <input id="f-q" type="search" placeholder="Suche Name/Bank…">
        <select id="f-sen"><option value="">Alle Seniority</option>${sens.map(s => `<option>${s}</option>`).join("")}</select>
        <select id="f-area"><option value="">Alle Bereiche</option>${areas.map(a => `<option>${esc(a)}</option>`).join("")}</select>
        <label class="small"><input type="checkbox" id="f-real"> nur reale (keine Platzhalter)</label>
        ${EDIT_MODE ? `<button class="primary" onclick="window._newContactGlobal()">+ Kontakt anlegen</button>` : ""}
      </div>
    </div>
    <div class="section">
      <table>
        <thead><tr>
          <th>ID</th><th>Name</th><th>Rolle</th><th>Seniority</th><th>Bereich</th>
          <th>Bank</th><th class="numeric">Influence</th><th>Vorher</th><th></th>
        </tr></thead>
        <tbody id="c-body"></tbody>
      </table>
    </div>`;
  const render = () => {
    const q = $("#f-q").value.toLowerCase();
    const sen = $("#f-sen").value;
    const ar = $("#f-area").value;
    const real = $("#f-real").checked;
    const list = all.filter(c =>
      (!sen || c.seniority === sen) &&
      (!ar || c.functional_area === ar) &&
      (!real || !c.is_placeholder) &&
      (!q || (c.full_name ?? "").toLowerCase().includes(q) || (c.bank ?? "").toLowerCase().includes(q) || (c.role_title ?? "").toLowerCase().includes(q)));
    list.sort((a, b) => (b.influence_score ?? 0) - (a.influence_score ?? 0));
    $("#c-body").innerHTML = list.length === 0 ? `<tr><td colspan="9" class="empty">Keine Treffer.</td></tr>` : list.map(c => `
      <tr>
        <td class="muted small">${c.contact_id}</td>
        <td><strong>${esc(cleanName(c.full_name))}</strong>
            ${c.is_placeholder ? '<span class="badge dotted small">Platzhalter</span>' : '<span class="badge x1f small">verifiziert</span>'}</td>
        <td>${esc(c.role_title ?? "")}</td>
        <td>${c.seniority ? `<span class="badge ${c.seniority === 'Vorstand' ? 'hot' : 'cold'}">${esc(c.seniority)}</span>` : ""}</td>
        <td>${esc(c.functional_area ?? "—")}</td>
        <td><a href="#/bank/${c.bank_id}">${esc(c.bank)}</a></td>
        <td class="numeric">${c.influence_score ?? "—"}</td>
        <td class="small">${esc(c.previous_employer ?? "—")}</td>
        <td class="right" style="white-space:nowrap">
          ${c.linkedin_url ? `<a href="${esc(c.linkedin_url)}" target="_blank">LinkedIn ↗</a> ` : ""}
          ${EDIT_MODE ? `<button class="icon-btn" onclick="window._editContactGlobal(${c.contact_id})" title="Bearbeiten">✎</button>
          <button class="icon-btn danger" onclick="window._delContactGlobal(${c.contact_id})" title="Löschen">🗑</button>` : ""}
        </td>
      </tr>`).join("");
  };
  ["#f-q","#f-sen","#f-area","#f-real"].forEach(s => $(s).addEventListener("input", render));
  render();
  // edit-mode actions
  window._newContactGlobal = async () => {
    const { data: bankList } = await sb.from("banks").select("id, name").order("name");
    editContactModal(null, null, null, bankList ?? []);
  };
  window._editContactGlobal = (id) => {
    const c = all.find(x => x.contact_id === id);
    if (c) editContactModal(id, c, c.bank_id);
  };
  window._delContactGlobal = async (id) => {
    if (!confirm("Kontakt wirklich löschen?")) return;
    try { await apiCall("DELETE", "contact?id=" + id); navigate(); }
    catch (e) { showToast("Fehler: " + e.message, "error"); }
  };
}

// ===========================================================================
//   PAGE: Network
// ===========================================================================
// --- Network: functional-area → color mapping ----------------------------
const FUNC_COLORS = {
  management: { base: "#f97316", light: "#fff7ed", dark: "#7c2d12" },
  treasury:   { base: "#eab308", light: "#fefce8", dark: "#713f12" },
  it:         { base: "#3b82f6", light: "#eff6ff", dark: "#1e3a8a" },
  risk:       { base: "#ef4444", light: "#fef2f2", dark: "#7f1d1d" },
  operations: { base: "#8b5cf6", light: "#f5f3ff", dark: "#4c1d95" },
  sales:      { base: "#10b981", light: "#ecfdf5", dark: "#064e3b" },
  hr:         { base: "#ec4899", light: "#fdf2f8", dark: "#831843" },
  other:      { base: "#64748b", light: "#f8fafc", dark: "#1e293b" },
};
function funcAreaKey(area) {
  const a = (area ?? "").toLowerCase();
  if (/treasury|finanzen|finance|cfo|investment|wertpapier|kapitalmarkt/.test(a)) return "treasury";
  if (/\bit\b|technolog|digital|cio|cto|informatik|data|cyber|infrastruktur/.test(a)) return "it";
  if (/risk|compliance|cro|recht|revision|regulat/.test(a)) return "risk";
  if (/operations|coo|prozess|betrieb/.test(a)) return "operations";
  if (/geschäftsführung|ceo|vorstand|management/.test(a)) return "management";
  if (/sales|vertrieb|kundenbetreuung/.test(a)) return "sales";
  if (/hr|personal|people/.test(a)) return "hr";
  return "other";
}
function funcAreaColor(area) { return FUNC_COLORS[funcAreaKey(area)]?.base ?? "#64748b"; }

let _cyInst = null; // global cy instance for zoom controls

async function renderNetwork() {
  app.innerHTML = `<div class="loading">Lade Netzwerk…</div>`;
  const [nodesRes, edgesRes] = await Promise.all([
    sb.from("v_network_nodes").select("*"),
    sb.from("v_network_edges").select("*"),
  ]);
  if (nodesRes.error) throw nodesRes.error;
  if (edgesRes.error) throw edgesRes.error;
  const nodes = nodesRes.data ?? [];
  const edges = edgesRes.data ?? [];

  const bankList = Array.from(new Set(nodes.map(n => n.bank).filter(Boolean))).sort();

  const FUNC_CHIPS = [
    { key: "",           label: "Alle",      icon: "" },
    { key: "management", label: "Management",icon: "🏢" },
    { key: "treasury",   label: "Finance",   icon: "💰" },
    { key: "it",         label: "IT",        icon: "💻" },
    { key: "risk",       label: "Risk",      icon: "⚠" },
    { key: "operations", label: "Operations",icon: "⚙" },
    { key: "sales",      label: "Sales",     icon: "🤝" },
  ];

  app.innerHTML = `
    <div class="net-layout">
      <div class="net-main">
        <div class="net-header-card">
          <div class="net-header-top">
            <div>
              <h1 class="net-title">Netzwerk & Verflechtungen</h1>
              <p class="net-subtitle">${nodes.length} Personen · ${edges.length} Verbindungen · Knoten anklicken für Details</p>
            </div>
            <div class="cy-zoom-controls">
              <button id="cy-zoom-in" title="Zoom rein">+</button>
              <button id="cy-zoom-out" title="Zoom raus">−</button>
              <button id="cy-fit" title="Alle einpassen">Fit</button>
            </div>
          </div>

          <div class="net-search-row">
            <div class="net-search-wrap">
              <svg class="net-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m14 14 3 3"/></svg>
              <input type="text" id="f-search" placeholder="Person, Rolle oder Bank suchen…" class="net-search">
            </div>
            <select id="f-bankfilter" class="net-select">
              <option value="">Alle Banken / Unternehmen</option>
              ${bankList.map(b => `<option>${esc(b)}</option>`).join("")}
            </select>
            <select id="f-relfilter" class="net-select">
              <option value="">Alle Beziehungstypen</option>
              ${Object.keys(RELATIONSHIP_LABELS).map(k => `<option value="${k}">${RELATIONSHIP_LABELS[k]}</option>`).join("")}
            </select>
            <label class="net-toggle"><input type="checkbox" id="f-real"><span class="net-toggle-track"></span><span class="net-toggle-label">Nur verifiziert</span></label>
          </div>

          <div class="net-chips-row">
            ${FUNC_CHIPS.map(c => `<button class="net-chip${c.key === "" ? " active" : ""}" data-area="${c.key}" style="${c.key ? `--chip-color:${FUNC_COLORS[c.key]?.base}` : ""}">${c.icon ? c.icon + " " : ""}${c.label}</button>`).join("")}
            <div class="net-chips-legend">
              <span>Größe = Einfluss</span>
              <span>★ = Entscheider</span>
              <span>Goldrand = Vorstand</span>
            </div>
          </div>
        </div>
        <div id="cy"></div>
      </div>
      <div class="net-sidebar" id="cy-sidebar">
        <div class="net-sidebar-empty">
          <div class="net-sidebar-icon">⬡</div>
          <p>Knoten anklicken</p>
          <p class="small muted">Profil, Einfluss-Score und Verbindungen werden hier angezeigt</p>
          <p class="small muted" style="margin-top:16px">Scroll = Zoomen<br>Drag = Bewegen</p>
        </div>
      </div>
    </div>`;

  const FUNC_AREA_PATTERNS = {
    treasury: /treasury|finanzen|finance|cfo|investment|wertpapier|kapitalmarkt/,
    it: /\bit\b|technolog|digital|cio|cto|informatik|data|cyber|infrastruktur/,
    risk: /risk|compliance|cro|recht|revision|regulat/,
    management: /geschäftsführung|ceo|vorstand|management/,
    operations: /operations|coo|prozess|betrieb/,
    sales: /sales|vertrieb|kundenbetreuung/,
    hr: /hr|personal|people/,
  };

  const matchesFuncArea = (node, area) => {
    if (!area) return true;
    const haystack = ((node.functional_area ?? "") + " " + (node.role_title ?? "")).toLowerCase();
    const pat = FUNC_AREA_PATTERNS[area];
    return pat ? pat.test(haystack) : funcAreaKey((node.functional_area ?? "") + " " + (node.role_title ?? "")) === area;
  };

  let _activeArea = "";
  $$(".net-chip").forEach(btn => btn.addEventListener("click", () => {
    $$(".net-chip").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    _activeArea = btn.dataset.area ?? "";
    render();
  }));

  const filterNodes = () => {
    const bank     = $("#f-bankfilter").value;
    const rel      = $("#f-relfilter").value;
    const realOnly = $("#f-real").checked;
    const area     = _activeArea;
    let n = nodes;
    if (bank) n = n.filter(x => x.bank === bank);
    if (realOnly) n = n.filter(x => !x.is_placeholder);
    if (area) n = n.filter(x => matchesFuncArea(x, area));
    const ids = new Set(n.map(x => x.id));
    let e = edges.filter(ed => ids.has(ed.source) && ids.has(ed.target));
    if (rel) e = e.filter(ed => ed.relationship === rel);
    return { n, e };
  };

  const searchNodes = (cy, q) => {
    if (!q) { cy.elements().removeClass("cy-faded cy-highlighted"); return; }
    const lq = q.toLowerCase();
    const matches = cy.nodes().filter(n =>
      (n.data("displayLabel") ?? "").toLowerCase().includes(lq) ||
      (n.data("role_title") ?? "").toLowerCase().includes(lq) ||
      (n.data("functional_area") ?? "").toLowerCase().includes(lq) ||
      (n.data("bank") ?? "").toLowerCase().includes(lq)
    );
    cy.elements().addClass("cy-faded");
    cy.elements().removeClass("cy-highlighted");
    matches.removeClass("cy-faded").addClass("cy-highlighted");
    matches.connectedEdges().removeClass("cy-faded");
    if (matches.length > 0) cy.animate({ fit: { eles: matches, padding: 80 } }, { duration: 400 });
  };

  const showNodeProfile = (d) => {
    const fkey = funcAreaKey((d.functional_area ?? "") + " " + (d.role_title ?? ""));
    const fc = FUNC_COLORS[fkey] ?? FUNC_COLORS.other;
    const funcColor = fc.base;
    const decisionBadge = d.is_decision_maker ? `<span class="net-badge net-badge-star">⭐ Entscheider</span>` : "";
    const linkedIn = d.linkedin_url ? `<a href="${esc(d.linkedin_url)}" target="_blank" class="btn btn-sm" style="margin-top:8px">LinkedIn →</a>` : "";
    $("#cy-sidebar").innerHTML = `
      <div class="net-profile">
        <div class="net-profile-color-bar" style="background:${funcColor}"></div>
        <div class="net-profile-body">
          <div style="font-size:18px;font-weight:700;line-height:1.2">${esc(d.displayLabel)}</div>
          <div class="small muted" style="margin:4px 0 8px">${esc(d.role_title ?? "—")}</div>
          <div class="net-profile-chips">
            ${decisionBadge}
            <span class="net-badge">${esc(d.seniority ?? "Unbekannt")}</span>
            <span class="net-badge" style="background:${funcColor}18;color:${funcColor};border-color:${funcColor}30">${esc(d.functional_area ?? "—")}</span>
          </div>
          <div class="net-profile-row"><span class="muted">Unternehmen</span>${d.bank_id ? `<a href="#/bank/${d.bank_id}">${esc(d.bank ?? "—")}</a>` : `<span>${esc(d.bank ?? "—")}</span>`}</div>
          <div class="net-profile-row"><span class="muted">Einfluss</span><div style="display:flex;align-items:center;gap:8px"><div class="mini-bar"><div class="mini-bar-fill" style="width:${d.influence_score ?? 0}%;background:${funcColor}"></div></div><span>${d.influence_score ?? "—"}</span></div></div>
          ${d.email ? `<div class="net-profile-row"><span class="muted">E-Mail</span><a href="mailto:${esc(d.email)}">${esc(d.email)}</a></div>` : ""}
          ${d.alma_mater ? `<div class="net-profile-row"><span class="muted">Alma Mater</span>${esc(d.alma_mater)}</div>` : ""}
          ${d.previous_employer ? `<div class="net-profile-row"><span class="muted">Vorher bei</span>${esc(d.previous_employer)}</div>` : ""}
          ${linkedIn}
          <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
            <div class="small muted" style="margin-bottom:6px">Verbindungen (${edges.filter(e => e.source === d.id || e.target === d.id).length})</div>
            ${edges.filter(e => e.source === d.id || e.target === d.id).slice(0,5).map(e => {
              const otherId = e.source === d.id ? e.target : e.source;
              const other = nodes.find(n => n.id === otherId);
              return `<div class="small" style="padding:3px 0">${RELATIONSHIP_LABELS[e.relationship] ?? e.relationship} ↔ ${esc(other?.label ?? "—")}</div>`;
            }).join("")}
          </div>
        </div>
      </div>`;
  };

  const render = () => {
    const { n, e } = filterNodes();
    if (_cyInst) { _cyInst.destroy(); _cyInst = null; }
    _cyInst = cytoscape({
      container: $("#cy"),
      elements: [
        ...n.map(x => ({ data: { ...x, displayLabel: shortLabel(x.label) } })),
        ...e.map(ed => ({ data: { id: "e"+ed.id, ...ed } })),
      ],
      style: networkStyle(),
      layout: {
        name: "cose", padding: 60, animate: true, animationDuration: 600,
        nodeRepulsion: 8000, idealEdgeLength: 120,
        gravity: 0.3, numIter: 1500,
        nodeDimensionsIncludeLabels: true,
      },
    });
    _cyInst.on("tap", "node", (evt) => showNodeProfile(evt.target.data()));
    _cyInst.on("tap", "edge", (evt) => {
      const d = evt.target.data();
      const srcNode = nodes.find(n => n.id === d.source);
      const tgtNode = nodes.find(n => n.id === d.target);
      $("#cy-sidebar").innerHTML = `
        <div class="net-profile">
          <div class="net-profile-color-bar" style="background:linear-gradient(90deg,${funcAreaColor((srcNode?.functional_area ?? "")+" "+(srcNode?.role_title ?? ""))},${funcAreaColor((tgtNode?.functional_area ?? "")+" "+(tgtNode?.role_title ?? ""))})"></div>
          <div class="net-profile-body">
            <div class="net-conn-header">
              <span>${esc(shortLabel(srcNode?.label ?? "?"))}</span>
              <span class="net-conn-arrow">↔</span>
              <span>${esc(shortLabel(tgtNode?.label ?? "?"))}</span>
            </div>
            <div class="net-profile-row"><span class="muted">Beziehung</span><strong>${esc(RELATIONSHIP_LABELS[d.relationship] ?? d.relationship)}</strong></div>
            <div class="net-profile-row"><span class="muted">Stärke</span>
              <div style="display:flex;align-items:center;gap:8px;flex:1"><div class="mini-bar"><div class="mini-bar-fill" style="width:${d.strength ?? 50}%;background:#64748b"></div></div><span>${d.strength ?? "—"}</span></div>
            </div>
            ${d.evidence ? `<div class="net-profile-row"><span class="muted">Evidenz</span><span class="small">${esc(d.evidence)}</span></div>` : ""}
          </div>
        </div>`;
    });
    // re-apply search highlight after re-render
    const q = $("#f-search")?.value ?? "";
    if (q) searchNodes(_cyInst, q);
  };

  ["#f-relfilter","#f-bankfilter","#f-real"].forEach(s =>
    $(s)?.addEventListener("change", render)
  );
  let _searchTimer;
  $("#f-search")?.addEventListener("input", (ev) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => searchNodes(_cyInst, ev.target.value), 250);
  });
  $("#cy-zoom-in")?.addEventListener("click",  () => _cyInst?.zoom({ level: (_cyInst.zoom() * 1.3), renderedPosition: { x: $("#cy").clientWidth/2, y: $("#cy").clientHeight/2 } }));
  $("#cy-zoom-out")?.addEventListener("click", () => _cyInst?.zoom({ level: (_cyInst.zoom() / 1.3), renderedPosition: { x: $("#cy").clientWidth/2, y: $("#cy").clientHeight/2 } }));
  $("#cy-fit")?.addEventListener("click",    () => _cyInst?.animate({ fit: { eles: _cyInst.elements(), padding: 40 } }, { duration: 350 }));

  render();
}

function networkStyle() {
  const dark = document.documentElement.dataset.theme === "dark";
  const labelColor = dark ? "#f0f0f0" : "#1a1a1a";
  return [
    { selector: "node", style: {
        "label": "data(displayLabel)",
        "font-size": 10,
        "color": labelColor,
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-wrap": "wrap",
        "text-max-width": "110px",
        "text-outline-width": 2,
        "text-outline-color": dark ? "#242424" : "#ffffff",
        "background-color": (ele) => funcAreaColor((ele.data("functional_area") ?? "") + " " + (ele.data("role_title") ?? "")),
        "width":  (ele) => Math.max(16, 12 + (ele.data("influence_score") ?? 0) / 5),
        "height": (ele) => Math.max(16, 12 + (ele.data("influence_score") ?? 0) / 5),
        "border-width": (ele) => ele.data("seniority") === "Vorstand" ? 3 : (ele.data("is_decision_maker") ? 2 : 1),
        "border-color": (ele) => ele.data("seniority") === "Vorstand" ? "#fbbf24" : "#ffffff",
        "shape": (ele) => ele.data("is_decision_maker") ? "star" : "ellipse",
      }
    },
    { selector: "node.cy-faded", style: { "opacity": 0.12 } },
    { selector: "node.cy-highlighted", style: {
        "border-width": 4, "border-color": "#fbbf24",
        "z-index": 999,
      }
    },
    { selector: "edge", style: {
        "width": (ele) => 1 + (ele.data("strength") ?? 50) / 40,
        "line-color": (ele) => ({
          reports_to: "#374151", alumni: "#9333ea", co_speaker: "#0891b2",
          co_worker_current: "#16a34a", co_worker_past: "#65a30d",
          board_interlock: "#ea580c", co_author: "#0e7490",
          referred_by: "#db2777", known_via: "#9ca3af"
        })[ele.data("relationship")] ?? "#9ca3af",
        "curve-style": "bezier",
        "target-arrow-shape": (ele) => ele.data("relationship") === "reports_to" ? "triangle" : "none",
        "target-arrow-color": "#374151",
        "opacity": 0.75,
      }
    },
    { selector: "edge.cy-faded", style: { "opacity": 0.05 } },
  ];
}

// ---- helpers ----------------------------------------------------------------
function bindRowLinks() {
  $$("tr.row-link").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.tagName === "A" || e.target.tagName === "BUTTON" || e.target.tagName === "SELECT") return;
      location.hash = tr.dataset.link;
    });
  });
}

// ---- boot -------------------------------------------------------------------
if (API_KEY) setEditMode(true, API_KEY);
else { pingDb(); navigate(); }
