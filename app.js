// ===========================================================
//   x1F Lead Dashboard — Vanilla SPA
//   Hash-Routing, Supabase REST, Cytoscape Network
// ===========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?bundle";

// ---- KONFIG (Public, OK in Frontend) ---------------------------------------
const SUPABASE_URL = "https://wlxolfkhkxembiuofmfa.supabase.co";
const SUPABASE_KEY = "sb_publishable_thWgZmusJh9usU4hUKUZEg_s4_o52Mn";
// ---------------------------------------------------------------------------

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const app = $("#app");

// ---- Status-Indikator -------------------------------------------------------
async function pingDb() {
  try {
    const { error } = await sb.from("banks").select("id", { head: true, count: "exact" }).limit(1);
    $("#connection-status").classList.toggle("connected", !error);
    $("#connection-status").classList.toggle("disconnected", !!error);
    $("#connection-status").title = error ? "Fehler: " + error.message : "Verbunden";
  } catch (e) {
    $("#connection-status").classList.add("disconnected");
  }
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
  if (rel >= 80) return `<span class="badge hot">Hot ${rel}</span>`;
  if (rel >= 60) return `<span class="badge warm">Warm ${rel}</span>`;
  return `<span class="badge cold">${rel ?? "—"}</span>`;
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
const segmentBadge = (s) => `<span class="badge segment">${esc(segmentLabel[s] ?? s)}</span>`;
const countryBadge = (c) => `<span class="badge country">${esc(c)}</span>`;

// ===========================================================================
//   ROUTER
// ===========================================================================
const routes = [
  { path: /^\/?$/,                         render: renderBriefing },
  { path: /^\/leads$/,                     render: renderLeads },
  { path: /^\/bank\/(\d+)$/,               render: (m) => renderBankDetail(parseInt(m[1])) },
  { path: /^\/signals$/,                   render: renderSignals },
  { path: /^\/contacts$/,                  render: renderContacts },
  { path: /^\/network$/,                   render: renderNetwork },
];

function navigate() {
  const hash = location.hash.slice(1) || "/";
  // active nav
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

// ===========================================================================
//   PAGE: Briefing  (Home)
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

  const banks = topRes.data ?? [];
  const hot   = hotRes.data ?? [];
  const segs  = segRes.data ?? [];
  const queue = queueRes.data ?? [];

  const totalSignals = banks.reduce((a,b) => a + (b.signals_90d ?? 0), 0);
  const totalBanksWithSignals = banks.length;
  const totalHot = hot.length;
  const customers = banks.filter(b => b.is_x1f_customer).length;

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Briefing</h1>
        <p>Tagesübersicht — die heißesten Konten, neueste Signale, Action-Queue.</p>
      </div>
    </div>

    <div class="cards">
      <div class="card accent">
        <div class="label">Heiße Signale</div>
        <div class="value">${totalHot}</div>
        <div class="sub">Relevance ≥ 70</div>
      </div>
      <div class="card">
        <div class="label">Aktive Banken</div>
        <div class="value">${totalBanksWithSignals}</div>
        <div class="sub">mit Signalen letzte 90 Tage</div>
      </div>
      <div class="card">
        <div class="label">Total Signale</div>
        <div class="value">${totalSignals}</div>
      </div>
      <div class="card">
        <div class="label">Bestandskunden</div>
        <div class="value">${customers}</div>
        <div class="sub">in aktivem Briefing</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Top-Leads (Heat-Score)</h2>
        <a href="#/leads">Alle ansehen →</a>
      </div>
      <table>
        <thead><tr>
          <th>Bank</th><th>Segment</th><th>Land</th>
          <th class="numeric">Signale</th><th class="numeric">Hot</th>
          <th>Heat</th><th></th>
        </tr></thead>
        <tbody>
          ${banks.slice(0, 10).map(b => `
            <tr class="row-link" data-link="#/bank/${b.bank_id}">
              <td>
                ${b.is_x1f_customer ? '<span class="badge x1f">⭐ Bestand</span> ' : ""}
                <strong>${esc(b.bank)}</strong>
                <div class="small muted">${esc(b.hq_city ?? "")}</div>
              </td>
              <td>${segmentBadge(b.segment)}</td>
              <td>${countryBadge(b.country)}</td>
              <td class="numeric">${b.signals_90d}</td>
              <td class="numeric">${b.hot_signals}</td>
              <td>${heatBarFor(b.heat_score)} <span class="muted small">${b.heat_score}</span></td>
              <td class="right"><a href="#/bank/${b.bank_id}">Detail →</a></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="detail-grid">
      <div class="section">
        <div class="section-header"><h2>Action Queue</h2></div>
        ${queue.length === 0 ? '<div class="empty">Keine offenen Aktionen.</div>' : `
          <table>
            <thead><tr><th>Bank</th><th>Signal</th><th>Aktion</th><th></th></tr></thead>
            <tbody>
              ${queue.map(q => `
                <tr>
                  <td>${esc(q.bank)} ${q.is_x1f_customer ? '<span class="badge x1f">⭐</span>' : ''}</td>
                  <td>${esc(q.title)}</td>
                  <td><span class="badge ${q.action?.startsWith('PRIO 1') ? 'hot' : 'warm'}">${esc(q.action ?? '')}</span></td>
                  <td>${heatBadge(q.rel)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>
      <div class="section">
        <div class="section-header"><h2>Heatmap nach Segment</h2></div>
        <table>
          <thead><tr><th>Land</th><th>Segment</th><th class="numeric">Banken</th><th class="numeric">Aktive</th><th class="numeric">Heat</th></tr></thead>
          <tbody>
            ${segs.filter(s => s.banks_with_signals > 0).slice(0, 12).map(s => `
              <tr>
                <td>${countryBadge(s.country)}</td>
                <td>${segmentBadge(s.segment)}</td>
                <td class="numeric">${s.banks_total}</td>
                <td class="numeric">${s.banks_with_signals}</td>
                <td class="numeric">${s.total_heat}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  bindRowLinks();
}

// ===========================================================================
//   PAGE: Leads (alle Banken mit Signalen + Filter)
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
      </div>
    </div>
    <div class="section">
      <table>
        <thead><tr>
          <th>Bank</th><th>Segment</th><th>Land</th>
          <th class="numeric">Signale</th><th class="numeric">Hot</th>
          <th>Heat</th>
          <th>Top-Signale</th><th></th>
        </tr></thead>
        <tbody id="leads-body"></tbody>
      </table>
    </div>
  `;

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
    $("#leads-body").innerHTML = list.map(b => `
      <tr class="row-link" data-link="#/bank/${b.bank_id}">
        <td>${b.is_x1f_customer ? '<span class="badge x1f">⭐</span> ' : ""}<strong>${esc(b.bank)}</strong>
            <div class="small muted">${esc(b.hq_city ?? "")}</div></td>
        <td>${segmentBadge(b.segment)}</td>
        <td>${countryBadge(b.country)}</td>
        <td class="numeric">${b.signals_90d}</td>
        <td class="numeric">${b.hot_signals}</td>
        <td>${heatBarFor(b.heat_score)} <span class="muted small">${b.heat_score}</span></td>
        <td class="small">${esc((b.top_signals ?? "").split("\n")[0] ?? "")}</td>
        <td class="right"><a href="#/bank/${b.bank_id}">Detail →</a></td>
      </tr>
    `).join("") || `<tr><td colspan="8" class="empty">Keine Treffer.</td></tr>`;
    bindRowLinks();
  };
  ["#f-search", "#f-segment", "#f-country", "#f-sort"].forEach(s => $(s).addEventListener("input", renderRows));
  renderRows();
}

// ===========================================================================
//   PAGE: Bank Detail
// ===========================================================================
async function renderBankDetail(bankId) {
  app.innerHTML = `<div class="loading">Lade Bank-Detail…</div>`;
  const [bRes, sRes, cRes, conRes] = await Promise.all([
    sb.from("banks").select("*").eq("id", bankId).single(),
    sb.from("signals").select("*").eq("bank_id", bankId).order("x1f_relevance", { ascending: false }),
    sb.from("contacts").select("*").eq("bank_id", bankId).order("influence_score", { ascending: false, nullsFirst: false }),
    sb.from("connections").select("*"),
  ]);
  if (bRes.error) throw bRes.error;
  const b = bRes.data;
  const signals = sRes.data ?? [];
  const contacts = cRes.data ?? [];
  const allConns = conRes.data ?? [];

  // intra-bank connections + cross-bank that touch this bank's contacts
  const myContactIds = new Set(contacts.map(c => String(c.id)));
  const relevantConns = allConns.filter(cn =>
    myContactIds.has(String(cn.contact_a)) || myContactIds.has(String(cn.contact_b))
  );

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${b.is_x1f_customer ? "⭐ " : ""}${esc(b.name)}</h1>
        <p>
          ${segmentBadge(b.segment)} ${countryBadge(b.country)}
          ${b.hq_city ? `· ${esc(b.hq_city)}` : ""}
          ${b.parent_group ? `· Gruppe: ${esc(b.parent_group)}` : ""}
        </p>
      </div>
      <div><a href="#/leads">← Zurück zur Liste</a></div>
    </div>

    <div class="cards">
      <div class="card accent"><div class="label">Heat-Score</div><div class="value">${b._heat ?? "—"}</div></div>
      <div class="card"><div class="label">Signale</div><div class="value">${signals.length}</div></div>
      <div class="card"><div class="label">Hot Signale</div><div class="value">${signals.filter(s => s.x1f_relevance >= 70).length}</div></div>
      <div class="card"><div class="label">Kontakte</div><div class="value">${contacts.length}</div></div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="section">
          <div class="section-header"><h2>Pain-Signale</h2></div>
          ${signals.length === 0 ? '<div class="empty">Keine Signale erfasst.</div>' :
            signals.map(s => renderSignalItem(s)).join("")
          }
        </div>
      </div>
      <div>
        <div class="section">
          <div class="section-header"><h2>Decision-Maker</h2></div>
          ${contacts.length === 0 ? '<div class="empty">Keine Kontakte.</div>' :
            contacts.map(c => renderContactItem(c)).join("")
          }
        </div>
        ${relevantConns.length > 0 ? `
          <div class="section">
            <div class="section-header"><h2>Verbindungen (${relevantConns.length})</h2></div>
            <div style="padding:12px 16px"><div id="cy-detail" style="height:300px;border:1px solid var(--border);border-radius:8px"></div></div>
          </div>
        ` : ""}
        <div class="section">
          <div class="section-header"><h2>Stammdaten</h2></div>
          <div style="padding:12px 16px">
            <dl class="kv-list">
              <dt>Domain</dt><dd>${b.domain ? `<a href="https://${esc(b.domain)}" target="_blank">${esc(b.domain)}</a>` : "—"}</dd>
              <dt>Stadt</dt><dd>${esc(b.hq_city ?? "—")}</dd>
              <dt>Gruppe</dt><dd>${esc(b.parent_group ?? "—")}</dd>
              <dt>Bestandskunde</dt><dd>${b.is_x1f_customer ? "Ja" : "Nein"}</dd>
              <dt>Mitarbeiter</dt><dd>${fmt(b.employees)}</dd>
              <dt>Bilanzsumme (Mrd €)</dt><dd>${fmt(b.total_assets_eur_bn)}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  `;

  if (relevantConns.length > 0) drawDetailGraph(contacts, relevantConns);
}

function renderSignalItem(s) {
  return `
    <div class="signal-item">
      <div class="head">
        <span class="title">${esc(s.title)}</span>
        ${heatBadge(s.x1f_relevance)}
        <span class="badge dotted">${esc(s.signal_type)}</span>
      </div>
      <div class="meta-line">
        ${esc(s.source ?? "")}
        ${s.signal_date ? `· ${fmtDate(s.signal_date)}` : ""}
        ${s.outreach_status && s.outreach_status !== "new" ? ` · <span class="badge cold">${esc(s.outreach_status)}</span>` : ""}
        ${s.source_url ? ` · <a href="${esc(s.source_url)}" target="_blank">Quelle →</a>` : ""}
      </div>
      ${s.body ? `<div class="body">${esc(s.body)}</div>` : ""}
      ${(s.keywords_matched ?? []).length ? `<div class="keywords">${s.keywords_matched.map(k => `<span class="keyword">${esc(k)}</span>`).join("")}</div>` : ""}
    </div>
  `;
}

function renderContactItem(c) {
  const inf = c.influence_score ?? 0;
  return `
    <div class="contact-item">
      <div class="avatar">${initials(c.full_name)}</div>
      <div class="info">
        <div class="name">${esc((c.full_name ?? "").replace(/^\[Platzhalter\]\s*/, ""))}
          ${c.is_placeholder ? '<span class="placeholder-mark"> (Rolle/Platzhalter)</span>' : ""}</div>
        <div class="role">${esc(c.role_title ?? "")} ${c.functional_area ? `· ${esc(c.functional_area)}` : ""}</div>
        ${c.linkedin_url ? `<div class="small"><a href="${esc(c.linkedin_url)}" target="_blank">LinkedIn →</a></div>` : ""}
      </div>
      <div class="stat">
        <div class="influence-bar"><div class="influence-fill" style="width:${inf}%"></div></div>
        <div class="small muted">${inf || "—"}</div>
        ${c.seniority ? `<span class="badge ${c.seniority === 'Vorstand' ? 'hot' : 'cold'}">${esc(c.seniority)}</span>` : ""}
      </div>
    </div>
  `;
}

function drawDetailGraph(contacts, conns) {
  const elements = [
    ...contacts.map(c => ({
      data: { id: String(c.id), label: (c.full_name || "").replace(/^\[Platzhalter\]\s*/, ""),
              seniority: c.seniority, area: c.functional_area }
    })),
    ...conns.map(cn => ({
      data: { id: "e"+cn.id, source: String(cn.contact_a), target: String(cn.contact_b),
              label: cn.relationship }
    })),
  ];
  cytoscape({
    container: $("#cy-detail"),
    elements,
    style: networkStyle(),
    layout: { name: "cose", padding: 20, animate: false },
  });
}

// ===========================================================================
//   PAGE: Signals
// ===========================================================================
async function renderSignals() {
  app.innerHTML = `<div class="loading">Lade Signale…</div>`;
  const { data, error } = await sb.from("v_outreach_pitches").select("*");
  if (error) throw error;
  const all = data ?? [];

  const types = Array.from(new Set(all.map(s => s.signal_type ?? "—").filter(Boolean))).sort();

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
          <option value="new">new</option>
          <option value="queued">queued</option>
          <option value="contacted">contacted</option>
          <option value="meeting">meeting</option>
          <option value="won">won</option>
          <option value="lost">lost</option>
        </select>
      </div>
    </div>
    <div id="signals-list"></div>
  `;

  const render = () => {
    const q = $("#f-q").value.toLowerCase();
    const rel = parseInt($("#f-rel").value);
    const st = $("#f-status").value;
    const list = all.filter(s =>
      (s.rel ?? 0) >= rel &&
      (!st || s.outreach_status === st) &&
      (!q || (s.bank ?? "").toLowerCase().includes(q) || (s.title ?? "").toLowerCase().includes(q))
    );
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
            ${s.source_url ? `<div class="small muted" style="margin-top:8px"><a href="${esc(s.source_url)}" target="_blank">${esc(s.source ?? "Quelle")} →</a></div>` : ""}
          </div>
        </div>
      `).join("");
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
      <div><h1>Kontakte / Decision-Maker</h1><p>${all.length} Personen · ${all.filter(c => c.is_decision_maker).length} mit Entscheider-Funktion</p></div>
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
          <th>Name</th><th>Rolle</th><th>Seniority</th><th>Bereich</th>
          <th>Bank</th><th class="numeric">Influence</th><th></th>
        </tr></thead>
        <tbody id="c-body"></tbody>
      </table>
    </div>
  `;
  const render = () => {
    const q = $("#f-q").value.toLowerCase();
    const sen = $("#f-sen").value;
    const ar = $("#f-area").value;
    const real = $("#f-real").checked;
    const list = all.filter(c =>
      (!sen || c.seniority === sen) &&
      (!ar || c.functional_area === ar) &&
      (!real || !c.is_placeholder) &&
      (!q || (c.full_name ?? "").toLowerCase().includes(q) || (c.bank ?? "").toLowerCase().includes(q) || (c.role_title ?? "").toLowerCase().includes(q))
    );
    list.sort((a, b) => (b.influence_score ?? 0) - (a.influence_score ?? 0));
    $("#c-body").innerHTML = list.length === 0 ? `<tr><td colspan="7" class="empty">Keine Treffer.</td></tr>` : list.map(c => `
      <tr>
        <td>
          <strong>${esc((c.full_name ?? "").replace(/^\[Platzhalter\]\s*/, ""))}</strong>
          ${c.is_placeholder ? '<span class="placeholder-mark"> (Rolle)</span>' : ""}
        </td>
        <td>${esc(c.role_title ?? "")}</td>
        <td>${c.seniority ? `<span class="badge ${c.seniority === 'Vorstand' ? 'hot' : 'cold'}">${esc(c.seniority)}</span>` : ""}</td>
        <td>${esc(c.functional_area ?? "—")}</td>
        <td><a href="#/bank/${c.bank_id}">${esc(c.bank)}</a></td>
        <td class="numeric">${c.influence_score ?? "—"}</td>
        <td class="right">${c.linkedin_url ? `<a href="${esc(c.linkedin_url)}" target="_blank">LinkedIn →</a>` : ""}</td>
      </tr>
    `).join("");
  };
  ["#f-q","#f-sen","#f-area","#f-real"].forEach(s => $(s).addEventListener("input", render));
  render();
}

// ===========================================================================
//   PAGE: Network (Cytoscape)
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
        <p>${nodes.length} Personen · ${edges.length} Verbindungen — Klick auf einen Knoten zeigt Details. Drag = bewegen, Scroll = zoom.</p>
      </div>
      <div class="filters">
        <select id="f-relfilter">
          <option value="">Alle Beziehungen</option>
          <option>reports_to</option>
          <option>co_worker_current</option>
          <option>co_worker_past</option>
          <option>alumni</option>
          <option>co_speaker</option>
          <option>board_interlock</option>
        </select>
        <select id="f-bankfilter"><option value="">Alle Banken</option>${
          Array.from(new Set(nodes.map(n => n.bank))).sort().map(b => `<option>${esc(b)}</option>`).join("")
        }</select>
      </div>
    </div>
    <div class="legend">
      <span><span class="swatch" style="background:#c2410c"></span>Vorstand</span>
      <span><span class="swatch" style="background:#f59e0b"></span>Bereichsleiter</span>
      <span><span class="swatch" style="background:#3b82f6"></span>Senior</span>
      <span><span class="swatch" style="background:#9ca3af"></span>Sonstige</span>
    </div>
    <div id="cy"></div>
    <div id="cy-info" class="small muted" style="padding:8px 0"></div>
  `;

  const filterEdges = (rel, bank) => {
    let n = nodes;
    if (bank) n = nodes.filter(x => x.bank === bank);
    const ids = new Set(n.map(x => x.id));
    let e = edges.filter(ed => ids.has(ed.source) && ids.has(ed.target));
    if (rel) e = e.filter(ed => ed.relationship === rel);
    return { n, e };
  };

  const render = () => {
    const rel = $("#f-relfilter").value;
    const bank = $("#f-bankfilter").value;
    const { n, e } = filterEdges(rel, bank);
    const cy = cytoscape({
      container: $("#cy"),
      elements: [
        ...n.map(x => ({ data: { ...x, displayLabel: (x.label || "").replace(/^\[Platzhalter\]\s*/, "") } })),
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
      $("#cy-info").innerHTML = `Verbindung: <strong>${esc(d.relationship)}</strong> · Stärke ${d.strength} · ${esc(d.evidence ?? "")}`;
    });
  };
  ["#f-relfilter","#f-bankfilter"].forEach(s => $(s).addEventListener("change", render));
  render();
}

function networkStyle() {
  return [
    { selector: "node", style: {
        "label": "data(displayLabel)",
        "font-size": 10,
        "color": "#1a1a1a",
        "background-color": (ele) => {
          const sen = ele.data("seniority");
          if (sen === "Vorstand")        return "#c2410c";
          if (sen === "Bereichsleiter")  return "#f59e0b";
          if (sen === "Senior")          return "#3b82f6";
          return "#9ca3af";
        },
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-wrap": "wrap",
        "text-max-width": "120px",
        "width": (ele) => 12 + (ele.data("influence_score") ?? 0) / 5,
        "height": (ele) => 12 + (ele.data("influence_score") ?? 0) / 5,
        "border-width": 1,
        "border-color": "#fff",
      }
    },
    { selector: "edge", style: {
        "width": 1.2,
        "line-color": (ele) => {
          switch (ele.data("relationship")) {
            case "reports_to":        return "#1a1a1a";
            case "alumni":            return "#9333ea";
            case "co_speaker":        return "#0891b2";
            case "co_worker_current": return "#16a34a";
            case "co_worker_past":    return "#65a30d";
            default: return "#9ca3af";
          }
        },
        "curve-style": "bezier",
        "target-arrow-shape": (ele) => ele.data("relationship") === "reports_to" ? "triangle" : "none",
        "target-arrow-color": "#1a1a1a",
        "opacity": .65,
      }
    },
  ];
}

// ---- helpers ----------------------------------------------------------------
function bindRowLinks() {
  $$("tr.row-link").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.tagName === "A") return;
      location.hash = tr.dataset.link;
    });
  });
}

// ---- boot -------------------------------------------------------------------
pingDb();
navigate();
