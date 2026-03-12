/* ═══════════════════════════════════════════════════════════════
   HealthWise CHD Expert System — Frontend JS
   ═══════════════════════════════════════════════════════════════ */

const COLORS = { healthy: '#00ff9d', middle: '#ffb703', sick: '#ff4d6d' };
const P_COLORS = ['#00c8ff', '#ffb703', '#ff4d6d'];
const API = '/api';

// ─── Chart registry (to destroy before re-render) ─────────────
const chartReg = {};
function getOrCreate(id, config) {
  if (chartReg[id]) { chartReg[id].destroy(); }
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  chartReg[id] = new Chart(ctx, config);
  return chartReg[id];
}

// ─── Slider percent helper ────────────────────────────────────
function updateSliderStyle(el) {
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.setProperty('--pct', pct + '%');
}
document.querySelectorAll('input[type=range]').forEach(s => {
  updateSliderStyle(s);
  s.addEventListener('input', () => updateSliderStyle(s));
});

// ─── Tab switching ─────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const id = 'tab-' + btn.dataset.tab;
    document.getElementById(id).classList.add('active');
    if (btn.dataset.tab === 'membership') loadMembershipCharts('none');
    if (btn.dataset.tab === 'manual')     loadManual(0);
    if (btn.dataset.tab === 'surface3d')  loadSurface3D(75);
    if (btn.dataset.tab === 'comparison') loadComparison('none');
  });
});

// ═══════════════════════════════════════════════════════════════
// TAB: DIAGNOSIS
// ═══════════════════════════════════════════════════════════════

const bpSlider   = document.getElementById('bp-slider');
const cholSlider = document.getElementById('chol-slider');
const hrSlider   = document.getElementById('hr-slider');

function linkSlider(slider, valId) {
  const display = document.getElementById(valId);
  const update  = () => {
    const unit = valId === 'bp-val' ? 'mmHg' : valId === 'chol-val' ? 'mg/dL' : 'bpm';
    display.innerHTML = `${slider.value} <small>${unit}</small>`;
    updateSliderStyle(slider);
  };
  slider.addEventListener('input', update);
  update();
}
linkSlider(bpSlider,   'bp-val');
linkSlider(cholSlider, 'chol-val');
linkSlider(hrSlider,   'hr-val');

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    bpSlider.value   = btn.dataset.bp;
    cholSlider.value = btn.dataset.chol;
    hrSlider.value   = btn.dataset.hr;
    [bpSlider, cholSlider, hrSlider].forEach(s => updateSliderStyle(s));
    linkSlider(bpSlider,   'bp-val');
    linkSlider(cholSlider, 'chol-val');
    linkSlider(hrSlider,   'hr-val');
    runDiagnosis();
  });
});

document.getElementById('run-btn').addEventListener('click', runDiagnosis);

async function runDiagnosis() {
  const btn = document.getElementById('run-btn');
  btn.disabled = true; btn.textContent = '⏳ Computing...';
  const hedge = document.querySelector('input[name="hedge"]:checked')?.value || 'none';

  try {
    const res = await fetch(`${API}/diagnose`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ bp: +bpSlider.value, chol: +cholSlider.value, hr: +hrSlider.value, hedge }),
    });
    const data = await res.json();
    renderDiagnosis(data);
  } catch(e) { console.error(e); }
  btn.disabled = false; btn.textContent = '🔬 Run Diagnosis';
}

function badgeClass(label) {
  if (label.toLowerCase().includes('healthy')) return 'badge-healthy';
  if (label.toLowerCase().includes('middle'))  return 'badge-middle';
  return 'badge-sick';
}

function renderDiagnosis(d) {
  const area = document.getElementById('results-area');
  const cogC  = d.cog.classification;
  const sugC  = d.sugeno.classification;

  // Membership bars helper
  const membBars = (sets, colorMap) => Object.entries(sets).map(([k, v]) => {
    const col = colorMap[k] || '#6a9bc3';
    return `<div class="memb-row">
      <span class="memb-key" style="color:${col}">${k}</span>
      <div class="memb-bar-wrap"><div class="memb-bar" style="width:${v*100}%;background:${col}"></div></div>
      <span class="memb-num">${v.toFixed(3)}</span>
    </div>`;
  }).join('');

  // Rule rows
  const ruleRows = d.rule_strengths.map(r => {
    const col = COLORS[r.output] || '#6a9bc3';
    return `<tr>
      <td>R${r.rule}</td>
      <td>${r.bp}(${r.bp_deg.toFixed(3)})</td>
      <td>${r.chol}(${r.chol_deg.toFixed(3)})</td>
      <td>${r.hr}(${r.hr_deg.toFixed(3)})</td>
      <td style="color:${r.strength > 0 ? '#00c8ff' : '#2a3a4a'};font-weight:700">${r.strength.toFixed(4)}</td>
      <td><span class="badge ${badgeClass(r.output)}">${r.output}</span></td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <!-- Gauges -->
    <div class="result-gauges">
      <div class="gauge-card" style="border-color:${cogC.color}33;box-shadow:0 0 20px ${cogC.color}11">
        <div class="gauge-method">COG — Centroid of Gravity</div>
        <div class="gauge-value" style="color:${cogC.color};text-shadow:0 0 20px ${cogC.color}66">${d.cog.value.toFixed(4)}</div>
        <div class="gauge-label" style="color:${cogC.color}">${cogC.emoji} ${cogC.label}</div>
        ${d.hedge !== 'none' ? `<div class="gauge-hedge">Hedge: ${d.hedge}</div>` : ''}
      </div>
      <div class="gauge-card" style="border-color:${sugC.color}33;box-shadow:0 0 20px ${sugC.color}11">
        <div class="gauge-method">Sugeno — Weighted Average</div>
        <div class="gauge-value" style="color:${sugC.color};text-shadow:0 0 20px ${sugC.color}66">${d.sugeno.value.toFixed(4)}</div>
        <div class="gauge-label" style="color:${sugC.color}">${sugC.emoji} ${sugC.label}</div>
        ${d.hedge !== 'none' ? `<div class="gauge-hedge">Hedge: ${d.hedge}</div>` : ''}
      </div>
    </div>

    <!-- Memberships -->
    <div class="memberships-card">
      <div class="card-label">Fuzzification — Membership Degrees</div>
      <div class="memberships-grid">
        <div>
          <div class="memb-col-title">Blood Pressure</div>
          ${membBars(d.memberships.bp, {low:'#00c8ff',medium:'#ffb703',high:'#ff4d6d'})}
        </div>
        <div>
          <div class="memb-col-title">Cholesterol</div>
          ${membBars(d.memberships.chol, {low:'#00c8ff',high:'#ff4d6d'})}
        </div>
        <div>
          <div class="memb-col-title">Heart Rate</div>
          ${membBars(d.memberships.hr, {slow:'#00c8ff',moderate:'#ffb703',fast:'#ff4d6d'})}
        </div>
      </div>
    </div>

    <!-- Rules -->
    <div class="rules-card">
      <div class="card-label">Rule Firing Strengths</div>
      <div class="rules-chart-wrap"><canvas id="rule-bar-chart" height="160"></canvas></div>
      <div style="overflow-x:auto;margin-top:12px">
        <table class="data-table">
          <thead><tr><th>Rule</th><th>BP</th><th>Chol</th><th>HR</th><th>Strength</th><th>Output</th></tr></thead>
          <tbody>${ruleRows}</tbody>
        </table>
      </div>
    </div>
  `;

  // Rule bar chart
  const ruleData = d.rule_strengths;
  getOrCreate('rule-bar-chart', {
    type: 'bar',
    data: {
      labels: ruleData.map(r => `R${r.rule}`),
      datasets: [{
        data: ruleData.map(r => r.strength),
        backgroundColor: ruleData.map(r => COLORS[r.output] + 'cc'),
        borderColor:     ruleData.map(r => COLORS[r.output]),
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.raw.toFixed(4)} → ${ruleData[ctx.dataIndex].output}`,
      }}},
      scales: {
        x: { ticks: { color: '#6a9bc3', font: { family: 'Space Mono', size: 11 } }, grid: { color: '#0e3a6e22' } },
        y: { min: 0, max: 1, ticks: { color: '#6a9bc3', font: { family: 'Space Mono', size: 10 } }, grid: { color: '#0e3a6e44' } },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// TAB: MEMBERSHIP FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const MF_CONFIG = {
  bp:     { id: 'mf-bp',     keys: ['low','medium','high'], colors: ['#00c8ff','#ffb703','#ff4d6d'] },
  chol:   { id: 'mf-chol',   keys: ['low','high'],          colors: ['#00c8ff','#ff4d6d'] },
  hr:     { id: 'mf-hr',     keys: ['slow','moderate','fast'], colors: ['#00c8ff','#ffb703','#ff4d6d'] },
  output: { id: 'mf-output', keys: ['healthy','middle','sick'], colors: ['#00ff9d','#ffb703','#ff4d6d'] },
};

async function loadMembershipCharts(hedge) {
  for (const [type, cfg] of Object.entries(MF_CONFIG)) {
    const res  = await fetch(`${API}/membership/${type}?hedge=${hedge}&points=100`);
    const data = await res.json();
    const labels = data.map(p => p.x.toFixed(1));
    const datasets = cfg.keys.map((k, i) => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      data: data.map(p => p[k]),
      borderColor: cfg.colors[i],
      backgroundColor: cfg.colors[i] + '18',
      borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3,
    }));
    getOrCreate(cfg.id, {
      type: 'line',
      data: { labels, datasets },
      options: {
        animation: false,
        plugins: { legend: { labels: { color: '#6a9bc3', font: { family: 'Space Mono', size: 10 }, boxWidth: 14 } } },
        scales: {
          x: { ticks: { maxTicksLimit: 7, color: '#6a9bc3', font: { family: 'Space Mono', size: 9 } }, grid: { color: '#0e3a6e33' } },
          y: { min: 0, max: 1, ticks: { color: '#6a9bc3', font: { family: 'Space Mono', size: 9 } }, grid: { color: '#0e3a6e44' } },
        },
      },
    });
  }
}

document.querySelectorAll('#mf-hedge-btns .hedge-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#mf-hedge-btns .hedge-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadMembershipCharts(btn.dataset.hedge);
  });
});

// ═══════════════════════════════════════════════════════════════
// TAB: MANUAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════

const PATIENTS = [
  { bp: 105, chol: 160, hr: 55, name: 'Patient 1' },
  { bp: 120, chol: 195, hr: 65, name: 'Patient 2' },
  { bp: 165, chol: 186, hr: 95, name: 'Patient 3' },
];

document.querySelectorAll('#manual-patient-tabs .ptab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadManual(+btn.dataset.pid);
  });
});

async function loadManual(pid) {
  const p = PATIENTS[pid];
  const res = await fetch(`${API}/diagnose`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ bp: p.bp, chol: p.chol, hr: p.hr, hedge: 'none' }),
  });
  const d = await res.json();

  // Also get hedge=very result for comparison
  const resH = await fetch(`${API}/diagnose`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ bp: p.bp, chol: p.chol, hr: p.hr, hedge: 'very' }),
  });
  const dH = await resH.json();

  const bpM   = d.memberships.bp;
  const cholM = d.memberships.chol;
  const hrM   = d.memberships.hr;

  const mRow = (label, sets, cols) => Object.entries(sets).map(([k, v]) =>
    `<span style="color:${cols[k]||'#6a9bc3'}">μ<sub>${k}</sub> = <b>${v}</b></span>&emsp;`
  ).join('');

  const ruleRows2 = d.rule_strengths.map(r => {
    const col = COLORS[r.output] || '#6a9bc3';
    return `<tr>
      <td>R${r.rule}</td>
      <td>${r.bp}(${r.bp_deg.toFixed(3)})</td>
      <td>${r.chol}(${r.chol_deg.toFixed(3)})</td>
      <td>${r.hr}(${r.hr_deg.toFixed(3)})</td>
      <td style="color:${r.strength>0?'#00c8ff':'#2a3a4a'};font-weight:700">${r.strength.toFixed(4)}</td>
      <td><span class="badge ${badgeClass(r.output)}">${r.output}</span></td>
    </tr>`;
  }).join('');

  const hedgeRuleRows = dH.rule_strengths.map((r, i) => {
    const orig = d.rule_strengths[i].strength;
    const hedged = r.strength;
    return `<div class="mono">R${r.rule}: ${orig.toFixed(4)} → <span class="hl">${hedged.toFixed(4)}</span> (${r.output})</div>`;
  }).join('');

  const makeStep = (num, title, body) => `
    <div class="step-block">
      <div class="step-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <div class="step-num">${num}</div>
        <div class="step-title">${title}</div>
        <span class="step-arrow">▲</span>
      </div>
      <div class="step-body">${body}</div>
    </div>`;

  const content = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        ${makeStep(1, 'Fuzzification — Membership Degrees', `
          <div class="mono">
            <b>Blood Pressure (${p.bp} mmHg)</b><br>
            ${mRow('bp', bpM, {low:'#00c8ff',medium:'#ffb703',high:'#ff4d6d'})}<br>
            <br><b>Cholesterol (${p.chol} mg/dL)</b><br>
            ${mRow('chol', cholM, {low:'#00c8ff',high:'#ff4d6d'})}<br>
            <br><b>Heart Rate (${p.hr} bpm)</b><br>
            ${mRow('hr', hrM, {slow:'#00c8ff',moderate:'#ffb703',fast:'#ff4d6d'})}
          </div>
        `)}
        ${makeStep(2, 'Inference Engine — Rule Firing (AND = min)', `
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead><tr><th>Rule</th><th>BP</th><th>Chol</th><th>HR</th><th>Strength</th><th>Output</th></tr></thead>
              <tbody>${ruleRows2}</tbody>
            </table>
          </div>
          <div class="mono" style="margin-top:10px">
            Active rules: <span class="hl">${d.rule_strengths.filter(r=>r.strength>0).length}</span> / 6
          </div>
        `)}
        ${makeStep(3, 'Aggregation — MAX of Clipped Consequents', `
          <div class="mono">
            Method: <span class="hl">MAX aggregation</span><br><br>
            ${d.rule_strengths.filter(r=>r.strength>0).map(r =>
              `→ Rule ${r.rule}: <span class="${r.output==='healthy'?'ok':r.output==='middle'?'warn':''}" style="${r.output==='sick'?'color:#ff4d6d':''}">${r.output}</span> clipped at <span class="hl">${r.strength.toFixed(4)}</span>`
            ).join('<br>')}
            ${d.rule_strengths.every(r=>r.strength===0) ? '<br><span style="color:#3a5a7a">No rules fired — default middle output</span>' : ''}
          </div>
        `)}
      </div>
      <div>
        ${makeStep(4, 'Defuzzification — COG (Centroid of Gravity)', `
          <div class="mono">
            <span class="warn">COG = ∫ x·μ(x)dx / ∫ μ(x)dx</span><br><br>
            Discrete: 400 steps over [0, 4], dx = 0.01<br>
            For each x → μ_agg(x) = max of all clipped consequents<br>
            Numerator: Σ x·μ_agg(x)·dx<br>
            Denominator: Σ μ_agg(x)·dx<br>
          </div>
          <div class="result-box" style="border-left:3px solid ${COLORS[d.cog.classification.label.toLowerCase().includes('healthy')?'healthy':d.cog.classification.label.toLowerCase().includes('middle')?'middle':'sick']}">
            <span style="color:${d.cog.classification.color};font-weight:700;font-size:15px">
              COG = ${d.cog.value.toFixed(4)}
            </span>
            <span style="color:#6a9bc3;margin-left:12px">→ ${d.cog.classification.label}</span>
          </div>
        `)}
        ${makeStep(5, 'Defuzzification — Sugeno Method', `
          <div class="mono">
            <span class="warn">Sugeno = Σ(wᵢ·zᵢ) / Σwᵢ</span><br><br>
            Crisp centres: Healthy=0.75, Middle=2.0, Sick=3.25<br><br>
            ${d.rule_strengths.filter(r=>r.strength>0).map(r => {
              const z = r.output==='healthy'?0.75:r.output==='middle'?2.0:3.25;
              return `w=${r.strength.toFixed(4)} × z=${z} = <span class="hl">${(r.strength*z).toFixed(4)}</span> (${r.output})`;
            }).join('<br>')}
          </div>
          <div class="result-box" style="border-left:3px solid ${d.sugeno.classification.color}">
            <span style="color:${d.sugeno.classification.color};font-weight:700;font-size:15px">
              Sugeno = ${d.sugeno.value.toFixed(4)}
            </span>
            <span style="color:#6a9bc3;margin-left:12px">→ ${d.sugeno.classification.label}</span>
          </div>
        `)}
        ${makeStep(6, 'Linguistic Hedge — "very" Effect (μ²)', `
          <div class="mono">
            Applying hedge "very": μ_new = μ_original²<br><br>
            ${hedgeRuleRows}
          </div>
          <div class="result-box" style="border-left:3px solid #00c8ff;margin-top:10px">
            <div class="mono">
              <span class="warn">COG (no hedge):</span> <span class="hl">${d.cog.value.toFixed(4)}</span>
              &nbsp;→&nbsp;
              <span class="warn">COG (very):</span> <span class="hl">${dH.cog.value.toFixed(4)}</span>
              (Δ ${(dH.cog.value - d.cog.value).toFixed(4)})
              <br>
              <span class="warn">Sugeno (no hedge):</span> <span class="hl">${d.sugeno.value.toFixed(4)}</span>
              &nbsp;→&nbsp;
              <span class="warn">Sugeno (very):</span> <span class="hl">${dH.sugeno.value.toFixed(4)}</span>
              (Δ ${(dH.sugeno.value - d.sugeno.value).toFixed(4)})
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
  document.getElementById('manual-content').innerHTML = content;
}

// ═══════════════════════════════════════════════════════════════
// TAB: 3D SURFACE
// ═══════════════════════════════════════════════════════════════

async function loadSurface3D(hr) {
  const el = document.getElementById('surface3d-plot');
  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6a9bc3;font-family:Space Mono;font-size:13px">⏳ Generating surface...</div>';

  const res  = await fetch(`${API}/surface3d?hr=${hr}`);
  const data = await res.json();

  const plotData = [{
    type: 'surface', x: data.chol, y: data.bp, z: data.z,
    colorscale: [
      [0.0, '#00ff9d'],[0.37,'#00ffcc'],[0.5,'#ffb703'],
      [0.7,'#ff8c42'],[1.0,'#ff4d6d'],
    ],
    contours: { z: { show: true, usecolormap: true, highlightcolor: '#00c8ff', project: { z: true } } },
    lighting: { ambient: 0.8, diffuse: 0.8, specular: 0.1 },
    opacity: 0.92,
    colorbar: {
      title: { text: 'CHD', font: { color: '#a0c8e8', family: 'Space Mono', size: 11 } },
      tickfont: { color: '#a0c8e8', family: 'Space Mono', size: 10 },
      bgcolor: '#071a2e', bordercolor: '#0e3a6e', borderwidth: 1,
      tickvals: [0.75, 2.0, 3.25], ticktext: ['Healthy', 'Middle', 'Sick'],
    },
  }];

  const layout = {
    paper_bgcolor: '#071a2e', plot_bgcolor: '#071a2e',
    scene: {
      xaxis: { title: { text: 'Cholesterol (mg/dL)', font: { color: '#a0c8e8', family: 'Space Mono', size: 11 } }, tickfont: { color: '#6a9bc3', family: 'Space Mono', size: 9 }, gridcolor: '#0e3a6e', backgroundcolor: '#020b14' },
      yaxis: { title: { text: 'Blood Pressure (mmHg)', font: { color: '#a0c8e8', family: 'Space Mono', size: 11 } }, tickfont: { color: '#6a9bc3', family: 'Space Mono', size: 9 }, gridcolor: '#0e3a6e', backgroundcolor: '#020b14' },
      zaxis: { title: { text: 'CHD Level', font: { color: '#a0c8e8', family: 'Space Mono', size: 11 } }, range: [0, 4], tickfont: { color: '#6a9bc3', family: 'Space Mono', size: 9 }, gridcolor: '#0e3a6e', backgroundcolor: '#020b14' },
      bgcolor: '#020b14', camera: { eye: { x: 1.6, y: -1.6, z: 1.2 } },
    },
    margin: { t: 40, b: 0, l: 0, r: 0 },
    title: { text: `CHD Surface — Chol × BP (HR = ${hr} bpm)`, font: { family: 'Syne', size: 14, color: '#e0f0ff' }, x: 0.5, xanchor: 'center' },
    font: { family: 'Space Mono', color: '#a0c8e8' },
  };

  Plotly.react(el, plotData, layout, { responsive: true, displaylogo: false });
}

const surfaceHR = document.getElementById('surface-hr');
const surfaceHRVal = document.getElementById('surface-hr-val');
let surfaceDebounce;
surfaceHR.addEventListener('input', () => {
  surfaceHRVal.textContent = surfaceHR.value + ' bpm';
  updateSliderStyle(surfaceHR);
  clearTimeout(surfaceDebounce);
  surfaceDebounce = setTimeout(() => loadSurface3D(+surfaceHR.value), 500);
});
document.querySelectorAll('.hr-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hr-quick').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    surfaceHR.value = btn.dataset.v;
    surfaceHRVal.textContent = btn.dataset.v + ' bpm';
    updateSliderStyle(surfaceHR);
    loadSurface3D(+btn.dataset.v);
  });
});

// ═══════════════════════════════════════════════════════════════
// TAB: COMPARISON
// ═══════════════════════════════════════════════════════════════

async function loadComparison(hedge) {
  const res = await fetch(`${API}/presets?hedge=${hedge}`);
  const data = await res.json();

  // Comparison cards
  const cardsHTML = data.map((item, i) => {
    const p = item.patient;
    const r = item.result;
    const col = P_COLORS[i];
    return `
      <div class="cmp-card" style="border-color:${col}44;border-top-color:${col}">
        <div class="cmp-name" style="color:${col}">${p.name} ${r.cog.classification.emoji}</div>
        <div class="cmp-inputs">BP:${p.bp} · Chol:${p.chol} · HR:${p.hr}</div>
        <div class="cmp-vals">
          <div class="cmp-val-box">
            <div class="cmp-val-method">COG</div>
            <div class="cmp-val-num" style="color:${r.cog.classification.color}">${r.cog.value.toFixed(3)}</div>
            <div class="cmp-val-lbl" style="color:${r.cog.classification.color}">${r.cog.classification.label}</div>
          </div>
          <div class="cmp-val-box">
            <div class="cmp-val-method">Sugeno</div>
            <div class="cmp-val-num" style="color:${r.sugeno.classification.color}">${r.sugeno.value.toFixed(3)}</div>
            <div class="cmp-val-lbl" style="color:${r.sugeno.classification.color}">${r.sugeno.classification.label}</div>
          </div>
        </div>
        <div style="font-family:'Space Mono';font-size:10px;color:#6a9bc3;line-height:1.7">
          ${i===0?'Predominantly Healthy: Low BP+Chol, Slow HR. Rule 1 dominant.':
            i===1?'Borderline/Middle: Normal BP but elevated Chol triggers Rule 4.':
                  'Moderate-High risk: Elevated BP+Chol+HR fires Rules 3, 5, 6.'}
        </div>
      </div>`;
  }).join('');
  document.getElementById('comparison-cards').innerHTML = cardsHTML;

  // Bar chart
  const labels = ['COG', 'Sugeno'];
  getOrCreate('cmp-bar', {
    type: 'bar',
    data: {
      labels,
      datasets: data.map((item, i) => ({
        label: item.patient.name,
        data: [item.result.cog.value, item.result.sugeno.value],
        backgroundColor: P_COLORS[i] + 'aa',
        borderColor: P_COLORS[i],
        borderWidth: 1, borderRadius: 4,
      })),
    },
    options: {
      plugins: { legend: { labels: { color: '#a0c8e8', font: { family: 'Space Mono', size: 10 } } } },
      scales: {
        x: { ticks: { color: '#6a9bc3', font: { family: 'Space Mono', size: 11 } }, grid: { color: '#0e3a6e33' } },
        y: { min: 0, max: 4, ticks: { color: '#6a9bc3', font: { family: 'Space Mono', size: 10 } }, grid: { color: '#0e3a6e44' } },
      },
    },
  });

  // Radar
  const RULE_LABELS = ['R1','R2','R3','R4','R5','R6'];
  getOrCreate('cmp-radar', {
    type: 'radar',
    data: {
      labels: RULE_LABELS,
      datasets: data.map((item, i) => ({
        label: item.patient.name,
        data: item.result.rule_strengths.map(r => r.strength),
        borderColor: P_COLORS[i],
        backgroundColor: P_COLORS[i] + '25',
        borderWidth: 2, pointRadius: 3, pointBackgroundColor: P_COLORS[i],
      })),
    },
    options: {
      plugins: { legend: { labels: { color: '#a0c8e8', font: { family: 'Space Mono', size: 10 } } } },
      scales: { r: {
        min: 0, max: 1,
        ticks: { color: '#6a9bc3', backdropColor: 'transparent', font: { family: 'Space Mono', size: 9 } },
        grid: { color: '#0e3a6e66' }, angleLines: { color: '#0e3a6e66' },
        pointLabels: { color: '#a0c8e8', font: { family: 'Space Mono', size: 10 } },
      }},
    },
  });

  // Hedge sensitivity table
  const hedgeRes = await fetch(`${API}/hedge-comparison`);
  const hedgeData = await hedgeRes.json();
  const hedges = Object.keys(hedgeData[0].hedges);
  const tableHTML = `
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Hedge</th>
            ${hedgeData.map((item,i) => `<th colspan="2" style="color:${P_COLORS[i]}">${item.patient.name}</th>`).join('')}
          </tr>
          <tr>
            <th></th>
            ${hedgeData.map(() => '<th>COG</th><th>Sugeno</th>').join('')}
          </tr>
        </thead>
        <tbody>
          ${hedges.map(h => `
            <tr>
              <td style="font-weight:${h===hedge?'700':'400'};color:${h===hedge?'#00c8ff':'#a0c8e8'}">${h}</td>
              ${hedgeData.map((item, pi) => {
                const v = item.hedges[h];
                const base = item.hedges['none'];
                const diff = +(v.cog - base.cog).toFixed(3);
                return `
                  <td style="color:${P_COLORS[pi]};font-weight:700">
                    ${v.cog.toFixed(3)}
                    ${h!=='none'?`<span style="font-size:9px;color:${diff>0?'#ff4d6d':'#00ff9d'}">${diff>0?'▲':'▼'}${Math.abs(diff)}</span>`:''}
                  </td>
                  <td style="color:#6a9bc3">${v.sugeno.toFixed(3)}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  document.getElementById('hedge-table-container').innerHTML = tableHTML;
}

document.querySelectorAll('#cmp-hedge-btns .hedge-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#cmp-hedge-btns .hedge-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadComparison(btn.dataset.hedge);
  });
});
