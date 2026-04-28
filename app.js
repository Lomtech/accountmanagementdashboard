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
const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("de-DE");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "—";
const segmentLabel = {
  grossbank: "Großbank", landesbank: "Landesbank", foerderbank: "Förderbank",
  sparkasse: "Sparkasse", genossenschaft: "Genossensch.", privatbank: "Privatbank",
  spezialbank: "Spezialbank", auslandsbank: "Auslandsbank", asset_manager: "Asset Mgr",
  versicherer: "Versicherer", fintech: "Fintech", other: "Andere"
};
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
const segmentBadge = (s) => `<span class="badge segment">${esc(segmentLabel[s] ?? s)}</span>`;
const countryBadge = (c) => `<span class="badge country">${esc(c)}</span>`;

const RELATIONSHIP_LABELS = {
  reports_to:        "berichtet an", co_worker_current: "Kollege (aktuell)",
  co_worker_past:    "Ex-Kollege",   alumni:            "Alumni / Ex-Arbeitgeber",
  co_speaker:        "Co-Speaker",   board_interlock:   "Aufsichtsrat-Verbindung",
  co_author:         "Co-Author",    referred_by:       "über Empfehlung",
  known_via:         "kennt über",
};

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
  { path: /^\/bank\/(\d+)$/,          render: (m) => renderBankDetail(parseInt(m[1])) },
  { path: /^\/signals$/,              render: renderSignals },
  { path: /^\/contacts$/,             render: renderContacts },
  { path: /^\/network$/,              render: renderNetwork },
];

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
  const [topRes, hotRes, segRes, queueRes] = await Promise.all([
    sb.from("v_top_leads").select("*").limit(50),
    sb.from("hot_signals").select("*"),
    sb.from("v_segment_heatmap").select("*"),
    sb.from("v_action_queue").select("*").limit(15),
  ]);
  if (topRes.error)   throw topRes.error;
  if (hotRes.error)   throw hotRes.error;
  if (segRes.error)   throw segRes.error;
  if (queueRes.error) throw queueRes.error;
  const banks = topRes.data ?? [], hot = hotRes.data ?? [], segs = segRes.data ?? [], queue = queueRes.data ?? [];
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
          <th>Heat</th><th></th>
        </tr></thead>
        <tbody>
          ${banks.slice(0, 10).map(b => `
            <tr class="row-link" data-link="#/bank/${b.bank_id}">
              <td>${b.is_x1f_customer ? '<span class="badge x1f">⭐ Bestand</span> ' : ""}<strong>${esc(b.bank)}</strong>
                  <div class="small muted">${esc(b.hq_city ?? "")}</div></td>
              <td>${segmentBadge(b.segment)}</td>
              <td>${countryBadge(b.country)}</td>
              <td class="numeric">${b.signals_90d}</td>
              <td class="numeric">${b.hot_signals}</td>
              <td>${heatBarFor(b.heat_score)} <span class="muted small">${b.heat_score}</span></td>
              <td class="right"><a href="#/bank/${b.bank_id}">Detail →</a></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
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
    </div>`;
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
      <div><h1>Alle Leads</h1><p>${banks.length} Banken mit aktiven Signalen</p></div>
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
    $("#leads-body").innerHTML = list.map(b => `
      <tr class="row-link" data-link="#/bank/${b.bank_id}">
        <td>${b.is_x1f_customer ? '<span class="badge x1f">⭐</span> ' : ""}<strong>${esc(b.bank)}</strong>
            <div class="small muted">${esc(b.hq_city ?? "")}</div></td>
        <td>${segmentBadge(b.segment)}</td><td>${countryBadge(b.country)}</td>
        <td class="numeric">${b.signals_90d}</td><td class="numeric">${b.hot_signals}</td>
        <td>${heatBarFor(b.heat_score)} <span class="muted small">${b.heat_score}</span></td>
        <td class="small">${esc((b.top_signals ?? "").split("\n")[0] ?? "")}</td>
        <td class="right"><a href="#/bank/${b.bank_id}">Detail →</a></td>
      </tr>`).join("") || `<tr><td colspan="8" class="empty">Keine Treffer.</td></tr>`;
    bindRowLinks();
  };
  ["#f-search","#f-segment","#f-country","#f-sort"].forEach(s => $(s).addEventListener("input", renderRows));
  $("#export-csv").addEventListener("click", () => exportCSV(currentList, "leads"));
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
//   PAGE: Bank Detail (mit Research-Helpers + Edit)
// ===========================================================================
async function renderBankDetail(bankId) {
  app.innerHTML = `<div class="loading">Lade Bank-Detail…</div>`;
  const [bRes, sRes, cRes, conRes, hsRes, actRes] = await Promise.all([
    sb.from("banks").select("*").eq("id", bankId).single(),
    sb.from("signals").select("*").eq("bank_id", bankId).order("x1f_relevance", { ascending: false }),
    sb.from("contacts").select("*").eq("bank_id", bankId).order("influence_score", { ascending: false, nullsFirst: false }),
    sb.from("connections").select("*"),
    sb.from("heat_score").select("heat_score").eq("bank_id", bankId).maybeSingle(),
    sb.from("bank_activity").select("*").eq("bank_id", bankId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (bRes.error) throw bRes.error;
  const b = bRes.data;
  const signals = sRes.data ?? [];
  const contacts = cRes.data ?? [];
  const allConns = conRes.data ?? [];
  const heat = hsRes.data?.heat_score ?? 0;
  const activity = actRes.data ?? [];

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
      <div><a href="#/leads">← Zurück zur Liste</a></div>
    </div>

    <div class="cards">
      <div class="card accent"><div class="label">Heat-Score</div><div class="value">${heat || "—"}</div></div>
      <div class="card"><div class="label">Signale</div><div class="value">${signals.length}</div></div>
      <div class="card"><div class="label">Hot Signale</div><div class="value">${signals.filter(s => s.x1f_relevance >= 70).length}</div></div>
      <div class="card"><div class="label">Kontakte</div><div class="value">${contacts.length}</div></div>
    </div>

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
      </div>
    </div>`;

  if (relevantConns.length > 0) drawDetailGraph([...contacts, ...extContacts], relevantConns);

  // expose helpers for inline buttons
  window._editContact   = (id) => editContactModal(id, contacts.find(c => c.id === id), bankId);
  window._addContact    = (bid) => editContactModal(null, null, bid);
  window._addConnection = (bid) => addConnectionModal(bid, contacts);
  window._editBank      = (bid) => editBankModal(b);
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
  window._generatePitch = async (signal_id, contact_id) => {
    try {
      const tone = prompt("Tonalität? (z.B. professionell-knapp / freundlich / formell)", "professionell-knapp");
      if (!tone) return;
      const j = await apiCall("POST", "generate-pitch", { signal_id, contact_id, tone });
      const html = `
        <div class="modal-backdrop" id="modal">
          <div class="modal" style="max-width:640px">
            <h3>Generierter Pitch (${esc(j.model ?? "Claude")})</h3>
            <div class="pitch-output">${esc(j.pitch)}</div>
            <div class="modal-actions">
              <button onclick="navigator.clipboard.writeText(\`${j.pitch.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`).then(()=>alert('Kopiert'))">In Zwischenablage</button>
              <button class="primary" onclick="closeModal()">Schließen</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML("beforeend", html);
    } catch (e) { alert("Fehler: " + e.message); }
  };
}

function renderSignalItem(s) {
  return `
    <div class="signal-item">
      <div class="head">
        <span class="title">${esc(s.title)}</span>
        ${heatBadge(s.x1f_relevance)}
        <span class="badge dotted">${esc(s.signal_type)}</span>
        ${EDIT_MODE ? `
          <select class="status-edit" data-signal-id="${s.id}" onchange="window._setStatus(${s.id}, this.value)">
            ${["new","queued","contacted","meeting","won","lost","ignored"].map(st =>
              `<option value="${st}"${st === (s.outreach_status ?? "new") ? " selected" : ""}>${st}</option>`).join("")}
          </select>
          <button class="icon-btn" title="Pitch generieren (Claude)" onclick="window._generatePitch(${s.id})">✨</button>` : ""}
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

function renderContactItem(c, editable) {
  const inf = c.influence_score ?? 0;
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
        </div>
      </div>
      <div class="stat">
        <div class="influence-bar"><div class="influence-fill" style="width:${inf}%"></div></div>
        <div class="small muted">${inf || "—"}</div>
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
function editContactModal(id, c, bankId) {
  c = c ?? { bank_id: bankId, full_name: "", role_title: "", seniority: "Unbekannt", functional_area: "", influence_score: 50, is_placeholder: false, linkedin_url: "", email: "", previous_employer: "", source_url: "" };
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:520px">
        <h3>${id ? "Kontakt bearbeiten" : "Neuer Kontakt"}</h3>
        <div class="form-grid">
          <label>Vollständiger Name<input id="m-name" value="${esc(cleanName(c.full_name ?? ''))}" placeholder="Vor Nachname"></label>
          <label>Rolle / Titel<input id="m-role" value="${esc(c.role_title ?? '')}"></label>
          <label>Seniority
            <select id="m-sen">
              ${["Vorstand","C-Level","Bereichsleiter","Abteilungsleiter","Senior","IC","Unbekannt"].map(x =>
                `<option${x === (c.seniority ?? 'Unbekannt') ? " selected" : ""}>${x}</option>`).join("")}
            </select>
          </label>
          <label>Funktionsbereich<input id="m-area" value="${esc(c.functional_area ?? '')}" placeholder="z.B. IT, Finance, Treasury"></label>
          <label>Influence-Score (0–100)<input id="m-inf" type="number" min="0" max="100" value="${c.influence_score ?? 50}"></label>
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
    const payload = {
      bank_id: c.bank_id,
      full_name: $("#m-name").value.trim(),
      role_title: $("#m-role").value.trim(),
      seniority: $("#m-sen").value,
      functional_area: $("#m-area").value.trim() || null,
      influence_score: parseInt($("#m-inf").value),
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

function editBankModal(b) {
  const html = `
    <div class="modal-backdrop" id="modal">
      <div class="modal" style="max-width:520px">
        <h3>Bank bearbeiten: ${esc(b.name)}</h3>
        <div class="form-grid">
          <label>Mitarbeiter<input id="m-emp" type="number" value="${b.employees ?? ''}"></label>
          <label>Bilanzsumme (Mrd €)<input id="m-bal" type="number" step="0.1" value="${b.total_assets_eur_bn ?? ''}"></label>
          <label class="checkbox"><input id="m-cust" type="checkbox" ${b.is_x1f_customer ? "checked" : ""}> x1F-Bestandskunde</label>
          <label>Notizen<textarea id="m-notes" rows="4">${esc(b.notes ?? '')}</textarea></label>
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
      employees: $("#m-emp").value ? parseInt($("#m-emp").value) : null,
      total_assets_eur_bn: $("#m-bal").value ? parseFloat($("#m-bal").value) : null,
      is_x1f_customer: $("#m-cust").checked,
      notes: $("#m-notes").value.trim() || null,
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
    const list = all.filter(s =>
      (s.rel ?? 0) >= rel &&
      (!st || s.outreach_status === st) &&
      (!q || (s.bank ?? "").toLowerCase().includes(q) || (s.title ?? "").toLowerCase().includes(q)));
    $("#signals-list").innerHTML = list.length === 0 ? '<div class="empty">Keine Treffer.</div>' :
      list.map(s => `
        <div class="section">
          <div class="section-header">
            <div class="gap">
              <strong>${esc(s.bank ?? "—")}</strong>
              ${s.is_x1f_customer ? '<span class="badge x1f">⭐ Bestand</span>' : ""}
              ${segmentBadge(s.segment ?? "other")}
              ${countryBadge(s.country ?? "")}
              <a href="#/bank/${s.bank_id}" class="small">Bank-Detail →</a>
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
  ["#f-q","#f-rel","#f-status"].forEach(s => $(s).addEventListener("input", render));
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
      <div><h1>Kontakte / Decision-Maker</h1><p>${all.length} Personen · ${all.filter(c => c.is_decision_maker).length} mit Entscheider-Funktion · ${all.filter(c => !c.is_placeholder).length} mit echtem Namen</p></div>
      <div class="filters">
        <input id="f-q" type="search" placeholder="Suche Name/Bank…">
        <select id="f-sen"><option value="">Alle Seniority</option>${sens.map(s => `<option>${s}</option>`).join("")}</select>
        <select id="f-area"><option value="">Alle Bereiche</option>${areas.map(a => `<option>${esc(a)}</option>`).join("")}</select>
        <label class="small"><input type="checkbox" id="f-real"> nur reale (keine Platzhalter)</label>
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
        <td class="right">${c.linkedin_url ? `<a href="${esc(c.linkedin_url)}" target="_blank">LinkedIn ↗</a>` : ""}</td>
      </tr>`).join("");
  };
  ["#f-q","#f-sen","#f-area","#f-real"].forEach(s => $(s).addEventListener("input", render));
  render();
}

// ===========================================================================
//   PAGE: Network
// ===========================================================================
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

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Netzwerk</h1>
        <p>${nodes.length} Personen · ${edges.length} Verbindungen — Klick auf Knoten/Kante zeigt Details. Drag = bewegen, Scroll = zoom.</p>
      </div>
      <div class="filters">
        <select id="f-relfilter"><option value="">Alle Beziehungen</option>${Object.keys(RELATIONSHIP_LABELS).map(k => `<option>${k}</option>`).join("")}</select>
        <select id="f-bankfilter"><option value="">Alle Banken</option>${Array.from(new Set(nodes.map(n => n.bank))).sort().map(b => `<option>${esc(b)}</option>`).join("")}</select>
        <label class="small"><input type="checkbox" id="f-real"> nur reale Personen</label>
      </div>
    </div>
    <div class="legend">
      <span><span class="swatch" style="background:#c2410c"></span>Vorstand</span>
      <span><span class="swatch" style="background:#f59e0b"></span>Bereichsleiter</span>
      <span><span class="swatch" style="background:#3b82f6"></span>Senior</span>
      <span><span class="swatch" style="background:#9ca3af"></span>Sonstige</span>
    </div>
    <div id="cy"></div>
    <div id="cy-info" class="small muted" style="padding:8px 0">Klicke auf einen Knoten oder eine Kante für Details.</div>`;

  const filterEdges = (rel, bank, realOnly) => {
    let n = nodes;
    if (bank) n = nodes.filter(x => x.bank === bank);
    if (realOnly) n = n.filter(x => !x.is_placeholder);
    const ids = new Set(n.map(x => x.id));
    let e = edges.filter(ed => ids.has(ed.source) && ids.has(ed.target));
    if (rel) e = e.filter(ed => ed.relationship === rel);
    return { n, e };
  };
  const render = () => {
    const rel = $("#f-relfilter").value, bank = $("#f-bankfilter").value, realOnly = $("#f-real").checked;
    const { n, e } = filterEdges(rel, bank, realOnly);
    const cy = cytoscape({
      container: $("#cy"),
      elements: [
        ...n.map(x => ({ data: { ...x, displayLabel: cleanName(x.label) } })),
        ...e.map(ed => ({ data: { id: "e"+ed.id, ...ed } })),
      ],
      style: networkStyle(),
      layout: { name: "cose", padding: 30, animate: false, nodeRepulsion: 4000, idealEdgeLength: 80 },
    });
    cy.on("tap", "node", (evt) => {
      const d = evt.target.data();
      $("#cy-info").innerHTML = `<strong>${esc(d.displayLabel)}</strong> — ${esc(d.role_title ?? "")} @ <a href="#/bank/${d.bank_id}">${esc(d.bank)}</a> · Influence ${d.influence_score ?? "—"}`;
    });
    cy.on("tap", "edge", (evt) => {
      const d = evt.target.data();
      $("#cy-info").innerHTML = `Verbindung: <strong>${esc(RELATIONSHIP_LABELS[d.relationship] ?? d.relationship)}</strong> · Stärke ${d.strength} · ${esc(d.evidence ?? "")}`;
    });
  };
  ["#f-relfilter","#f-bankfilter","#f-real"].forEach(s => $(s).addEventListener("change", render));
  render();
}

function networkStyle() {
  return [
    { selector: "node", style: {
        "label": "data(displayLabel)", "font-size": 10, "color": "#1a1a1a",
        "background-color": (ele) => {
          const sen = ele.data("seniority");
          if (sen === "Vorstand")        return "#c2410c";
          if (sen === "Bereichsleiter")  return "#f59e0b";
          if (sen === "Senior")          return "#3b82f6";
          return "#9ca3af";
        },
        "text-valign": "bottom", "text-margin-y": 4, "text-wrap": "wrap", "text-max-width": "120px",
        "width":  (ele) => 12 + (ele.data("influence_score") ?? 0) / 5,
        "height": (ele) => 12 + (ele.data("influence_score") ?? 0) / 5,
        "border-width": 1, "border-color": "#fff",
      }
    },
    { selector: "edge", style: {
        "width": 1.4,
        "line-color": (ele) => ({
          reports_to: "#1a1a1a", alumni: "#9333ea", co_speaker: "#0891b2",
          co_worker_current: "#16a34a", co_worker_past: "#65a30d",
          board_interlock: "#ea580c", co_author: "#0e7490",
          referred_by: "#db2777", known_via: "#a3a3a3"
        })[ele.data("relationship")] ?? "#9ca3af",
        "curve-style": "bezier",
        "target-arrow-shape": (ele) => ele.data("relationship") === "reports_to" ? "triangle" : "none",
        "target-arrow-color": "#1a1a1a", "opacity": .7,
      }
    },
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
