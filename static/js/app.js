/* app.js — HealthWise CHD Expert System Frontend
   All tab logic, API calls, Chart.js + Plotly visualisations
   Dr. Mohammed A. Altahrawi · UCAS 2026                        */

"use strict";

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const P_COLORS  = ["#00d4ff", "#f5a623", "#ff4d6d"];
const SET_COLORS = {
  low: "#38bdf8", medium: "#f5a623", high: "#ff4d6d",
  slow: "#38bdf8", moderate: "#f5a623", fast: "#ff4d6d",
  young: "#38bdf8", middle: "#f5a623", old: "#ff4d6d",
  none: "#10d48a",  light: "#f5a623",  heavy: "#ff4d6d",
  no: "#10d48a",    pre: "#f5a623",    yes: "#ff4d6d",
  healthy: "#10d48a", sick: "#ff4d6d",
};
const CHD_COLORS = ["#10d48a", "#f5a623", "#ff4d6d"];

const clsColor = v => v < 1.5 ? "#10d48a" : v < 2.7 ? "#f5a623" : "#ff4d6d";
const clsCls   = v => v < 1.5 ? "healthy"  : v < 2.7 ? "middle"   : "sick";
const clsLabel = v => v < 1.5 ? "Healthy"  : v < 2.7 ? "Middle Risk" : "Sick";
const clsEmoji = v => v < 1.5 ? "💚"       : v < 2.7 ? "🟡"       : "❤️";
const pct = (v, mx) => Math.round((v / mx) * 100);

// ═══════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════

const tabLoaded = {};

function showTab(name, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + name)?.classList.add("active");
  if (btn) btn.classList.add("active");

  if (!tabLoaded[name]) {
    tabLoaded[name] = true;
    if (name === "membership")   initMembership();
    if (name === "surface3d")    initSurface3D();
    if (name === "sensitivity")  initSensitivity();
    if (name === "comparison")   initComparison();
    if (name === "neuro")        initNeuro();
  }
}

// ═══════════════════════════════════════════════════════
// SLIDER HELPERS
// ═══════════════════════════════════════════════════════

function updSlider(id, val, min, max, unit) {
  const el  = document.getElementById(id);
  const disp = document.getElementById(id + "-val");
  if (!el || !disp) return;
  const pct = ((val - min) / (max - min)) * 100;
  el.style.setProperty("--pct", pct + "%");
  disp.textContent = val + (unit ? " " + unit : "");
}

function bindSlider(id, min, max, unit, cb) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => {
    updSlider(id, el.value, min, max, unit);
    if (cb) cb(parseFloat(el.value));
  });
  updSlider(id, el.value, min, max, unit);
}

// ═══════════════════════════════════════════════════════
// ── TAB 1: DIAGNOSIS ────────────────────────────────
// ═══════════════════════════════════════════════════════

const diagSliders = [
  {id:"bp",       min:80,   max:220,  unit:"mmHg"},
  {id:"chol",     min:80,   max:300,  unit:"mg/dL"},
  {id:"hr",       min:30,   max:220,  unit:"bpm"},
  {id:"age",      min:0,    max:100,  unit:"yrs"},
  {id:"smoking",  min:0,    max:4,    unit:"pkts/day"},
  {id:"diabetes", min:55,   max:360,  unit:"mg/dL"},
];

diagSliders.forEach(s =>
  document.getElementById(s.id) &&
  bindSlider(s.id, s.min, s.max, s.unit)
);

function loadPreset(pid) {
  const PRESETS = {
    1: {bp:105, chol:160, hr:55,  age:28, smoking:0.0, diabetes:85},
    2: {bp:120, chol:195, hr:65,  age:45, smoking:0.5, diabetes:95},
    3: {bp:165, chol:186, hr:95,  age:62, smoking:0.9, diabetes:135},
  };
  const p = PRESETS[pid];
  if (!p) return;
  Object.entries(p).forEach(([k,v]) => {
    const el = document.getElementById(k);
    if (el) { el.value = v; const s = diagSliders.find(x=>x.id===k); if(s) updSlider(k,v,s.min,s.max,s.unit); }
  });
  runDiagnosis();
}

async function runDiagnosis() {
  const btn = document.getElementById("run-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analysing…'; }

  const body = {
    bp:       parseFloat(document.getElementById("bp")?.value       || 130),
    chol:     parseFloat(document.getElementById("chol")?.value     || 190),
    hr:       parseFloat(document.getElementById("hr")?.value       ||  75),
    age:      parseFloat(document.getElementById("age")?.value      ||  45),
    smoking:  parseFloat(document.getElementById("smoking")?.value  || 0.5),
    diabetes: parseFloat(document.getElementById("diabetes")?.value || 110),
    hedge:    document.querySelector('input[name="hedge"]:checked')?.value || "none",
  };

  try {
    const res = await fetch("/api/diagnose", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    });
    const data = await res.json();
    renderDiagnosis(data, body);
  } catch(e) {
    console.error("Diagnosis failed:", e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🔬 Run Diagnosis"; }
  }
}

function renderDiagnosis(d, inputs) {
  const area = document.getElementById("result-area");
  if (!area) return;

  const cog  = d.cog.value;
  const sug  = d.sugeno.value;
  const cc   = clsCls(cog);
  const sc   = clsCls(sug);

  // Membership bars
  const mfHtml = (sets, colorKey) => Object.entries(sets).map(([k,v]) => {
    const clr = SET_COLORS[k] || SET_COLORS[colorKey] || "#00d4ff";
    return `<div class="mf-row">
      <span class="mf-key" style="color:${clr}">${k}</span>
      <div class="mf-bg"><div class="mf-bar" style="width:${Math.round(v*100)}%;background:${clr}"></div></div>
      <span class="mf-val">${(v*100).toFixed(1)}%</span>
    </div>`;
  }).join("");

  // Active rules
  const activeRules = d.fired.filter(r => r.strength > 0);
  const rulesHtml = activeRules.map(r => `
    <tr class="row-fired">
      <td class="mono" style="font-weight:700">${r.id}</td>
      <td style="font-size:12px;color:var(--text2)">${r.condition}</td>
      <td style="font-size:11px;color:var(--text3)">
        ${r.bp_deg !== undefined ? `${r.bp_deg} · ${r.chol_deg} · ${r.hr_deg}` : `${r.age_deg} · ${r.sm_deg} · ${r.db_deg}`}
      </td>
      <td>
        <div class="str-wrap">
          <div class="str-bg"><div class="str-fill" style="width:${r.strength*100}%;background:${clsColor(r.output==='healthy'?0:r.output==='middle'?2:3.5)}"></div></div>
          <span class="mono" style="font-size:12px;font-weight:700">${r.strength}</span>
        </div>
      </td>
      <td><span class="badge badge-${r.output}">${r.output==='healthy'?'💚':r.output==='middle'?'🟡':'❤️'} ${r.output}</span></td>
    </tr>
  `).join("");

  const anfisHtml = d.anfis ? `
    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="icon">🧠</span> ANFIS Prediction</div>
      <div style="display:flex;align-items:center;gap:16px">
        <div style="font-family:var(--mono);font-size:28px;font-weight:800;color:${clsColor(d.anfis.value)}">${d.anfis.value}</div>
        <div>
          <div style="font-weight:700;color:${clsColor(d.anfis.value)}">${clsEmoji(d.anfis.value)} ${d.anfis.cls.label}</div>
          <div style="font-size:12px;color:var(--text3)">Δ from COG: ${Math.abs(cog - d.anfis.value).toFixed(4)}</div>
        </div>
      </div>
    </div>` : "";

  area.innerHTML = `
    <!-- Main result cards -->
    <div class="grid-2" style="margin-bottom:16px">
      <div class="result-card ${cc} glow-${cc}">
        <span class="result-emoji">${clsEmoji(cog)}</span>
        <span class="result-score c-${cc}">${cog}</span>
        <span class="result-label c-${cc}">${clsLabel(cog)}</span>
        <span class="result-method">COG — Centroid Method</span>
      </div>
      <div class="result-card ${sc}">
        <span class="result-emoji">${clsEmoji(sug)}</span>
        <span class="result-score c-${sc}">${sug}</span>
        <span class="result-label c-${sc}">${clsLabel(sug)}</span>
        <span class="result-method">Sugeno — Weighted Average</span>
      </div>
    </div>

    <!-- Risk meter -->
    <div class="card">
      <div class="sec-lbl">Risk Scale (0 = Healthy → 4 = Sick)</div>
      <div class="meter-outer" style="margin-bottom:6px">
        <div class="meter-fill" style="width:${(cog/4*100).toFixed(1)}%;background:${clsColor(cog)}"></div>
      </div>
      <div class="meter-labels">
        <span>0 Healthy</span>
        <span style="font-weight:700;color:${clsColor(cog)}">COG: ${cog}</span>
        <span>4 Sick</span>
      </div>
      ${inputs.hedge !== "none" ? `<div class="alert blue" style="margin-top:10px;margin-bottom:0;padding:8px 12px">
        <div class="alert-icon" style="font-size:14px">🗣️</div>
        <div style="font-size:12px">Hedge <strong>"${inputs.hedge}"</strong> applied — membership functions modified.</div>
      </div>` : ""}
    </div>

    <!-- Memberships -->
    <div class="card">
      <div class="card-header"><span class="icon">🎯</span> Membership Degrees</div>
      <div class="grid-3">
        <div>
          <div class="sec-lbl">🩸 BP (${inputs.bp})</div>
          ${mfHtml(d.memberships.bp)}
        </div>
        <div>
          <div class="sec-lbl">🧪 Cholesterol (${inputs.chol})</div>
          ${mfHtml(d.memberships.chol)}
        </div>
        <div>
          <div class="sec-lbl">💓 Heart Rate (${inputs.hr})</div>
          ${mfHtml(d.memberships.hr)}
        </div>
        ${d.memberships.age ? `<div><div class="sec-lbl">👤 Age (${inputs.age})</div>${mfHtml(d.memberships.age)}</div>` : ""}
        ${d.memberships.smoking ? `<div><div class="sec-lbl">🚬 Smoking (${inputs.smoking})</div>${mfHtml(d.memberships.smoking)}</div>` : ""}
        ${d.memberships.diabetes ? `<div><div class="sec-lbl">🩸 Glucose (${inputs.diabetes})</div>${mfHtml(d.memberships.diabetes)}</div>` : ""}
      </div>
    </div>

    <!-- Rule firing -->
    <div class="card">
      <div class="card-header">
        <span class="icon">⚙️</span> Rule Firing
        <span class="card-sub">${d.n_fired}/${d.fired.length} rules active</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Conditions</th><th>Degrees</th><th>Strength</th><th>Output</th></tr></thead>
        <tbody>${rulesHtml}</tbody>
      </table></div>
    </div>
    ${anfisHtml}
  `;

  // Rule strength bar chart via Plotly
  const chartDiv = document.createElement("div");
  chartDiv.style.cssText = "height:220px;margin-top:10px";
  area.querySelector(".card:last-child")?.appendChild(chartDiv);
  if (window.Plotly && chartDiv) {
    const labels  = d.fired.map(r => `R${r.id}`);
    const vals    = d.fired.map(r => r.strength);
    const colors  = d.fired.map(r => r.output==="healthy"?"#10d48a":r.output==="middle"?"#f5a623":"#ff4d6d");
    Plotly.newPlot(chartDiv, [{
      type: "bar", x: labels, y: vals,
      marker: {color: colors},
      text: vals.map(v => v > 0 ? v.toFixed(3) : ""),
      textposition: "outside",
    }], {
      paper_bgcolor: "transparent", plot_bgcolor: "transparent",
      margin: {t:10,b:30,l:30,r:10},
      xaxis: {tickfont:{color:"#526a84",size:10}},
      yaxis: {range:[0,1.05], tickfont:{color:"#526a84",size:10}, gridcolor:"#1e3050"},
      font:  {family:"Inter,sans-serif"},
    }, {responsive:true, displaylogo:false});
  }
}


// ═══════════════════════════════════════════════════════
// ── TAB 2: MEMBERSHIP FUNCTIONS ─────────────────────
// ═══════════════════════════════════════════════════════

const mfCharts = {};

async function initMembership() {
  const vars = [
    {id:"bp",       label:"Blood Pressure (mmHg)"},
    {id:"chol",     label:"Cholesterol (mg/dL)"},
    {id:"hr",       label:"Heart Rate (bpm)"},
    {id:"output",   label:"CHD Output (0–4)"},
    {id:"age",      label:"Age (years)"},
    {id:"smoking",  label:"Smoking (packs/day)"},
    {id:"diabetes", label:"Fasting Glucose (mg/dL)"},
  ];
  for (const v of vars) {
    await loadMFChart(v.id, "none", v.label);
  }
}

async function loadMFChart(varId, hedge, label) {
  const hedge2 = hedge || document.querySelector(".hedge-btn.active")?.dataset.hedge || "none";
  const res  = await fetch(`/api/membership/${varId}?hedge=${hedge2}`);
  const data = await res.json();
  const div  = document.getElementById(`mf-${varId}`);
  if (!div || !window.Plotly) return;

  const traces = Object.keys(data).filter(k => k !== "x").map((k, i) => ({
    type: "scatter", mode: "lines",
    name: k.charAt(0).toUpperCase() + k.slice(1),
    x: data.x, y: data[k],
    line: {color: SET_COLORS[k] || P_COLORS[i % 3], width: 2.5},
    fill: "tozeroy",
    fillcolor: (SET_COLORS[k] || P_COLORS[i % 3]) + "18",
  }));

  const layout = {
    title: {text: label + (hedge2 !== "none" ? ` [${hedge2}]` : ""), font:{color:"#e2eaf4",size:13}},
    paper_bgcolor: "transparent", plot_bgcolor: "transparent",
    xaxis: {tickfont:{color:"#526a84",size:10}, gridcolor:"#1e3050"},
    yaxis: {range:[0,1.05], tickfont:{color:"#526a84",size:10}, gridcolor:"#1e3050"},
    legend: {font:{color:"#8ba4c0",size:11}, bgcolor:"transparent"},
    margin: {t:36,b:36,l:38,r:10},
  };

  Plotly.newPlot(div, traces, layout, {responsive:true, displaylogo:false});
}

async function applyMFHedge(hedge) {
  document.querySelectorAll(".hedge-btn").forEach(b => b.classList.toggle("active", b.dataset.hedge === hedge));
  const labels = {
    bp:"Blood Pressure (mmHg)", chol:"Cholesterol (mg/dL)", hr:"Heart Rate (bpm)",
    output:"CHD Output (0–4)", age:"Age (years)", smoking:"Smoking (packs/day)", diabetes:"Fasting Glucose (mg/dL)",
  };
  for (const [k,v] of Object.entries(labels)) {
    await loadMFChart(k, hedge, v);
  }
}


// ═══════════════════════════════════════════════════════
// ── TAB 3: MANUAL CALCULATIONS ──────────────────────
// ═══════════════════════════════════════════════════════

async function loadManual(pid, btn) {
  document.querySelectorAll(".manual-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const res  = await fetch("/api/presets");
  const list = await res.json();
  const item = list.find(x => x.patient.id === pid);
  if (!item) return;

  const {patient: p, diagnosis: d} = item;
  const area = document.getElementById("manual-area");
  if (!area) return;

  const mfRow = (k, v, clr) => `
    <div class="mf-row">
      <span class="mf-key" style="color:${clr}">${k}</span>
      <div class="mf-bg"><div class="mf-bar" style="width:${Math.round(v*100)}%;background:${clr}"></div></div>
      <span class="mf-val">${(v*100).toFixed(2)}%</span>
    </div>`;

  const stepHtml = (n, title, body) => `
    <div class="step-block">
      <div class="step-head" onclick="toggleStep(this)">
        <div class="step-num">${n}</div>
        <div class="step-title">${title}</div>
        <span class="step-arrow">▼</span>
      </div>
      <div class="step-body open">${body}</div>
    </div>`;

  const ruleRows = d.fired.map(r => `
    <tr class="${r.strength>0?'row-fired':''}">
      <td class="mono" style="font-weight:700">${r.id}</td>
      <td style="font-size:12px">${r.condition}</td>
      <td style="font-size:11px;color:var(--text3)">${r.bp_deg!==undefined?`${r.bp_deg} · ${r.chol_deg} · ${r.hr_deg}`:`${r.age_deg} · ${r.sm_deg} · ${r.db_deg}`}</td>
      <td>
        <div class="str-wrap">
          <div class="str-bg"><div class="str-fill" style="width:${r.strength*100}%;background:${clsColor(r.output==='healthy'?0:r.output==='middle'?2:3.5)}"></div></div>
          <span class="mono" style="font-size:12px;font-weight:700">${r.strength}</span>
        </div>
      </td>
      <td><span class="badge badge-${r.output}">${r.output}</span></td>
    </tr>`).join("");

  area.innerHTML = `
    <div class="alert blue"><div class="alert-icon">📋</div>
    <div><strong>Patient ${p.id}</strong>: BP=${p.bp}, Chol=${p.chol}, HR=${p.hr}<br>
    Final → COG = <strong>${d.cog.value}</strong> (${d.cog.cls.label}) | Sugeno = <strong>${d.sugeno.value}</strong> (${d.sugeno.cls.label})</div></div>

    ${stepHtml(1, "Fuzzification — Membership Degrees", `
      <div class="grid-3">
        <div><div class="sec-lbl">🩸 BP (${p.bp} mmHg)</div>
          ${mfRow("low",    d.memberships.bp.low,    "#38bdf8")}
          ${mfRow("medium", d.memberships.bp.medium, "#f5a623")}
          ${mfRow("high",   d.memberships.bp.high,   "#ff4d6d")}
        </div>
        <div><div class="sec-lbl">🧪 Chol (${p.chol} mg/dL)</div>
          ${mfRow("low",  d.memberships.chol.low,  "#38bdf8")}
          ${mfRow("high", d.memberships.chol.high, "#ff4d6d")}
        </div>
        <div><div class="sec-lbl">💓 HR (${p.hr} bpm)</div>
          ${mfRow("slow",     d.memberships.hr.slow,     "#38bdf8")}
          ${mfRow("moderate", d.memberships.hr.moderate, "#f5a623")}
          ${mfRow("fast",     d.memberships.hr.fast,     "#ff4d6d")}
        </div>
      </div>
    `)}

    ${stepHtml(2, "Inference — Rule Firing Strengths (AND = min)", `
      <div class="alert amber" style="margin-bottom:12px;padding:9px 12px">
        <div class="alert-icon" style="font-size:14px">⚙️</div>
        <div style="font-size:12px">strength = min(μ_BP, μ_Chol, μ_HR) for each rule. Green = fired.</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Conditions</th><th>Degrees</th><th>Strength</th><th>Output</th></tr></thead>
        <tbody>${ruleRows}</tbody>
      </table></div>
    `)}

    ${stepHtml(3, "Aggregation (max per output zone)", `
      <div class="grid-3">
        ${["healthy","middle","sick"].map(z => {
          const mx = Math.max(...d.fired.filter(r=>r.output===z).map(r=>r.strength), 0);
          return `<div class="stat" style="border-top:3px solid ${clsColor(z==='healthy'?0:z==='middle'?2:3.5)}">
            <div style="font-size:24px;margin-bottom:4px">${z==='healthy'?'💚':z==='middle'?'🟡':'❤️'}</div>
            <div class="stat-val" style="color:${clsColor(z==='healthy'?0:z==='middle'?2:3.5)}">${(mx*100).toFixed(1)}%</div>
            <div class="stat-lbl">${z.charAt(0).toUpperCase()+z.slice(1)}</div>
          </div>`;
        }).join("")}
      </div>
    `)}

    ${stepHtml(4, "Defuzzification — COG and Sugeno", `
      <div class="grid-2">
        <div style="background:var(--green-dim);border:1px solid rgba(16,212,138,.3);border-radius:var(--r);padding:16px">
          <div style="font-weight:800;color:var(--green);margin-bottom:8px">📐 COG (Centroid)</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">∫x·μ_agg(x)dx / ∫μ_agg(x)dx  over [0,4] (500 steps)</div>
          <div style="font-family:var(--mono);font-size:32px;font-weight:800;color:var(--${d.cog.cls.cls==='healthy'?'green':d.cog.cls.cls==='middle'?'amber':'red'});text-align:center">${d.cog.value}</div>
          <div style="text-align:center;font-weight:700;color:var(--${d.cog.cls.cls==='healthy'?'green':d.cog.cls.cls==='middle'?'amber':'red'})">${d.cog.cls.emoji} ${d.cog.cls.label}</div>
        </div>
        <div style="background:var(--amber-dim);border:1px solid rgba(245,166,35,.3);border-radius:var(--r);padding:16px">
          <div style="font-weight:800;color:var(--amber);margin-bottom:8px">📊 Sugeno (Weighted Average)</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">z = Σ(wᵢ·zᵢ)/Σwᵢ  with z_healthy=0.75, z_middle=2.00, z_sick=3.25</div>
          <div style="font-family:var(--mono);font-size:32px;font-weight:800;color:var(--${d.sugeno.cls.cls==='healthy'?'green':d.sugeno.cls.cls==='middle'?'amber':'red'});text-align:center">${d.sugeno.value}</div>
          <div style="text-align:center;font-weight:700;color:var(--${d.sugeno.cls.cls==='healthy'?'green':d.sugeno.cls.cls==='middle'?'amber':'red'})">${d.sugeno.cls.emoji} ${d.sugeno.cls.label}</div>
        </div>
      </div>
    `)}
  `;
}

function toggleStep(hdr) {
  const body  = hdr.nextElementSibling;
  const arrow = hdr.querySelector(".step-arrow");
  const open  = body.classList.toggle("open");
  if (arrow) arrow.textContent = open ? "▼" : "▶";
}


// ═══════════════════════════════════════════════════════
// ── TAB 4: 3D SURFACE ───────────────────────────────
// ═══════════════════════════════════════════════════════

async function initSurface3D() {
  const sl = document.getElementById("surf-hr");
  if (sl) bindSlider("surf-hr", 40, 180, "bpm", () => {});
  await renderSurface3D(75, "none");
}

async function renderSurface3D(hr, hedge) {
  hr    = hr    || parseFloat(document.getElementById("surf-hr")?.value  || 75);
  hedge = hedge || document.querySelector(".surf-hedge-btn.active")?.dataset.hedge || "none";
  const el = document.getElementById("surface-plot");
  if (!el) return;
  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);gap:10px"><span class="spinner"></span> Computing surface…</div>';
  const res  = await fetch(`/api/surface3d?hr=${hr}&hedge=${hedge}`);
  const data = await res.json();
  const traces = [{
    type: "surface",
    x: data.chol, y: data.bp, z: data.z,
    colorscale: [[0,"#10d48a"],[0.38,"#4db87a"],[0.5,"#b88a20"],[0.7,"#d97030"],[1,"#ff4d6d"]],
    colorbar: {
      title: {text:"CHD Level", font:{color:"#8ba4c0",size:11}},
      tickvals:[0.75,2.0,3.25], ticktext:["💚 Healthy","🟡 Middle","❤️ Sick"],
      tickfont:{color:"#8ba4c0",size:10},
    },
    contours:{z:{show:true,usecolormap:true,project:{z:true}}},
    opacity: 0.92,
  }];
  Plotly.newPlot(el, traces, {
    paper_bgcolor:"transparent", plot_bgcolor:"transparent",
    scene:{
      xaxis:{title:{text:"Cholesterol (mg/dL)",font:{color:"#8ba4c0",size:11}}, tickfont:{color:"#526a84",size:9}, gridcolor:"#1e3050", backgroundcolor:"#060d1a"},
      yaxis:{title:{text:"Blood Pressure (mmHg)",font:{color:"#8ba4c0",size:11}}, tickfont:{color:"#526a84",size:9}, gridcolor:"#1e3050", backgroundcolor:"#060d1a"},
      zaxis:{title:{text:"CHD Level",font:{color:"#8ba4c0",size:11}}, range:[0,4], tickfont:{color:"#526a84",size:9}, gridcolor:"#1e3050", backgroundcolor:"#060d1a"},
      bgcolor:"#060d1a",
      camera:{eye:{x:1.6,y:-1.7,z:1.2}},
    },
    title:{text:`CHD Surface — HR=${hr} bpm, Hedge=${hedge}`, font:{color:"#e2eaf4",size:14}, x:0.5},
    margin:{t:50,b:0,l:0,r:0},
  }, {responsive:true,displaylogo:false});
}

function setSurfHedge(hedge, btn) {
  document.querySelectorAll(".surf-hedge-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderSurface3D(null, hedge);
}


// ═══════════════════════════════════════════════════════
// ── TAB 5: SENSITIVITY ──────────────────────────────
// ═══════════════════════════════════════════════════════

async function initSensitivity() {
  await renderSensitivity("none");
}

async function renderSensitivity(hedge) {
  const res  = await fetch("/api/sensitivity", {
    method: "POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({hedge}),
  });
  const data = await res.json();
  const div  = document.getElementById("sensitivity-chart");
  const bar  = document.getElementById("sensitivity-bar");
  const info = document.getElementById("sensitivity-info");
  if (!div || !window.Plotly) return;

  // Line chart
  const traces = Object.entries(data.factors).map(([k,v], i) => ({
    type:"scatter", mode:"lines",
    name: v.label.split(" (")[0],
    x: v.x, y: v.y_cog,
    line:{color: P_COLORS[i % P_COLORS.length] || "#8ba4c0", width: 2.5},
  }));
  Plotly.newPlot(div, traces, {
    paper_bgcolor:"transparent", plot_bgcolor:"transparent",
    xaxis:{visible:false},
    yaxis:{title:{text:"CHD Level",font:{color:"#8ba4c0",size:11}}, range:[0,4], tickfont:{color:"#526a84",size:10}, gridcolor:"#1e3050"},
    legend:{font:{color:"#8ba4c0",size:11}, bgcolor:"transparent"},
    margin:{t:30,b:30,l:50,r:10},
    title:{text:"Factor Sensitivity (COG)", font:{color:"#e2eaf4",size:13}, x:0.5},
  }, {responsive:true,displaylogo:false});

  // Bar chart
  if (bar) {
    const ranked = data.ranking;
    Plotly.newPlot(bar, [{
      type:"bar", orientation:"h",
      x: ranked.map(r=>r[1]),
      y: ranked.map(r=>data.factors[r[0]].label.split(" (")[0]),
      marker:{color: ranked.map((_,i) => i===0 ? "#00d4ff" : "#2d4468")},
      text: ranked.map(r=>r[1].toFixed(3)),
      textposition:"outside",
    }], {
      paper_bgcolor:"transparent", plot_bgcolor:"transparent",
      xaxis:{tickfont:{color:"#526a84",size:10}, gridcolor:"#1e3050"},
      yaxis:{tickfont:{color:"#8ba4c0",size:11}},
      margin:{t:20,b:30,l:120,r:50},
    }, {responsive:true,displaylogo:false});
  }

  // Info banner
  if (info) {
    const f = data.factors[data.most_influential];
    info.innerHTML = `<div class="alert green" style="margin-bottom:0">
      <div class="alert-icon">🏆</div>
      <div>Most influential factor: <strong>${f.label}</strong> — CHD output range = <strong>${f.range_cog.toFixed(3)}</strong></div>
    </div>`;
  }
}

function setSensHedge(hedge, btn) {
  document.querySelectorAll(".sens-hedge-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderSensitivity(hedge);
}


// ═══════════════════════════════════════════════════════
// ── TAB 6: COMPARISON ───────────────────────────────
// ═══════════════════════════════════════════════════════

async function initComparison() {
  const res  = await fetch("/api/hedge-comparison");
  const data = await res.json();
  renderComparison(data, "none");
}

function renderComparison(data, activeHedge) {
  const area = document.getElementById("comparison-area");
  if (!area) return;

  // Patient cards
  const cards = data.table.map((row, i) => {
    const r = row.results["none"];
    return `<div class="card" style="border-top:3px solid ${P_COLORS[i]}">
      <div style="font-weight:800;font-size:16px;color:${P_COLORS[i]};margin-bottom:6px">👤 ${row.patient.name}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">BP:${row.patient.bp} · Chol:${row.patient.chol} · HR:${row.patient.hr}</div>
      <div style="text-align:center;background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:10px">
        <span style="font-size:28px">${clsEmoji(r.cog)}</span>
        <div style="font-family:var(--mono);font-size:22px;font-weight:800;color:${clsColor(r.cog)}">${r.cog}</div>
        <div style="font-weight:700;color:${clsColor(r.cog)}">${clsLabel(r.cog)}</div>
        <div style="font-size:11px;color:var(--text3)">COG Method</div>
      </div>
      <div class="cmp-row"><span class="cmp-key">COG</span><div class="cmp-bg"><div class="cmp-fill" style="width:${(r.cog/4*100).toFixed(1)}%;background:${P_COLORS[i]}"></div></div><span class="cmp-val" style="color:${P_COLORS[i]}">${r.cog}</span></div>
      <div class="cmp-row"><span class="cmp-key">Sugeno</span><div class="cmp-bg"><div class="cmp-fill" style="width:${(r.sugeno/4*100).toFixed(1)}%;background:${P_COLORS[i]};opacity:.5"></div></div><span class="cmp-val" style="color:${P_COLORS[i]};opacity:.7">${r.sugeno}</span></div>
    </div>`;
  }).join("");

  // Hedge table
  const hedgeCols = data.hedges.map(h => `<th colspan="2" style="text-align:center">${h.label}</th>`).join("");
  const subCols   = data.hedges.map(() => `<th style="text-align:center;color:var(--text3)">COG</th><th style="text-align:center;color:var(--text3)">Sug</th>`).join("");
  const tableRows = data.table.map((row, i) => {
    const cells = data.hedges.map(h => {
      const r = row.results[h.value];
      return `<td class="mono" style="text-align:center;font-weight:700;color:${clsColor(r.cog)}">${r.cog}</td>
              <td class="mono" style="text-align:center;color:var(--text2)">${r.sugeno}</td>`;
    }).join("");
    return `<tr><td style="font-weight:700;color:${P_COLORS[i]}">${row.patient.name}</td>${cells}</tr>`;
  }).join("");

  area.innerHTML = `
    <div class="grid-3" style="margin-bottom:20px">${cards}</div>
    <div class="card">
      <div class="card-header"><span class="icon">🗣️</span> Hedge Sensitivity Table — All Patients</div>
      <div class="table-wrap"><table>
        <thead>
          <tr><th>Patient</th>${hedgeCols}</tr>
          <tr><th></th>${subCols}</tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table></div>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════
// ── TAB 7: NEURO-FUZZY ──────────────────────────────
// ═══════════════════════════════════════════════════════

async function initNeuro() {
  // show placeholder
}

async function trainNeuro() {
  const btn = document.getElementById("train-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Training ANFIS…'; }

  const n   = parseInt(document.getElementById("train-n")?.value || 400);
  const res = await fetch(`/api/neuro-train?n=${n}`, {method:"POST"});
  const d   = await res.json();

  if (btn) { btn.disabled = false; btn.textContent = "⚡ Retrain"; }
  renderNeuroResults(d);
}

function renderNeuroResults(d) {
  const area = document.getElementById("neuro-area");
  if (!area) return;

  // Loss curve
  const lossCurveHtml = `<div id="neuro-loss" style="height:220px"></div>`;

  // Comparison table
  const cmpRows = (d.comparison || []).map(c =>
    `<tr>
      <td style="font-weight:700">${c.name}</td>
      <td class="mono" style="color:${clsColor(c.fuzzy_cog)};font-weight:700">${c.fuzzy_cog}</td>
      <td class="mono" style="color:${clsColor(c.anfis)};font-weight:700">${c.anfis}</td>
      <td class="mono" style="color:${c.diff<0.2?'var(--green)':'var(--amber)'}">${c.diff}</td>
      <td><span class="badge badge-${c.fuzzy_cls.toLowerCase().replace(' risk','')}">${c.fuzzy_cls}</span></td>
      <td><span class="badge badge-${c.anfis_cls.toLowerCase().replace(' risk','')}">${c.anfis_cls}</span></td>
    </tr>`).join("");

  area.innerHTML = `
    <div class="grid-4" style="margin-bottom:18px">
      <div class="stat"><div class="stat-val">${d.r2?.toFixed(4) || "—"}</div><div class="stat-lbl">R² Score</div></div>
      <div class="stat"><div class="stat-val">${d.mse?.toFixed(5) || "—"}</div><div class="stat-lbl">MSE</div></div>
      <div class="stat"><div class="stat-val">${d.mae?.toFixed(4) || "—"}</div><div class="stat-lbl">MAE</div></div>
      <div class="stat"><div class="stat-val">${d.epochs || "—"}</div><div class="stat-lbl">Epochs</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-header"><span class="icon">📉</span> Training Loss Curve</div>${lossCurveHtml}</div>
      <div class="card">
        <div class="card-header"><span class="icon">🔬</span> Preset Patient Comparison</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Patient</th><th>Fuzzy COG</th><th>ANFIS</th><th>Δ Diff</th><th>Fuzzy Class</th><th>ANFIS Class</th></tr></thead>
          <tbody>${cmpRows}</tbody>
        </table></div>
      </div>
    </div>
  `;

  // Render loss chart
  if (d.train_loss && window.Plotly) {
    Plotly.newPlot("neuro-loss", [{
      type:"scatter", mode:"lines",
      y: d.train_loss,
      x: d.train_loss.map((_,i) => i+1),
      line: {color:"#00d4ff", width:2},
      fill:"tozeroy", fillcolor:"rgba(0,212,255,.1)",
    }], {
      paper_bgcolor:"transparent", plot_bgcolor:"transparent",
      xaxis:{title:{text:"Epoch",font:{color:"#8ba4c0",size:11}}, tickfont:{color:"#526a84",size:10}, gridcolor:"#1e3050"},
      yaxis:{title:{text:"Loss (MSE)",font:{color:"#8ba4c0",size:11}}, tickfont:{color:"#526a84",size:10}, gridcolor:"#1e3050"},
      margin:{t:20,b:40,l:55,r:10},
    }, {responsive:true,displaylogo:false});
  }
}


// ═══════════════════════════════════════════════════════
// INITIALISE ON LOAD
// ═══════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  // Init all sliders
  diagSliders.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) updSlider(s.id, el.value, s.min, s.max, s.unit);
  });

  // Auto-load Patient 1 on start
  loadManual(1, document.getElementById("manual-p1"));
});
