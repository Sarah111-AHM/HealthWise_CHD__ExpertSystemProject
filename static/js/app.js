/* ---------------------------------------------------------
   HealthWise Clinical Suite - Frontend Logic Engine
   Core UI Orchestration & Dynamic Visualization
   --------------------------------------------------------- */

"use strict";

// --- Clinical Color Palettes (Aligned with Medical CSS) ---
const THEME = {
  primary:   "#2563eb", // Royal Medical Blue
  success:   "#10b981", // Clinical Green
  warning:   "#f59e0b", // Observation Amber
  danger:    "#ef4444", // Critical Red
  muted:     "#94a3b8", // Neutral Slate
};

const RISK_LEVELS = {
  optimal:      { color: THEME.success, label: "Optimal / Healthy",  id: "low" },
  intermediate: { color: THEME.warning, label: "Intermediate Risk",  id: "moderate" },
  critical:     { color: THEME.danger,  label: "Critical / High Risk", id: "high" }
};

/**
 * Maps a numerical score to a clinical risk profile.
 */
const getRiskProfile = (score) => {
  if (score < 1.5)  return RISK_LEVELS.optimal;
  if (score < 2.55) return RISK_LEVELS.intermediate;
  return RISK_LEVELS.critical;
};

// --- Tab & Navigation Management ---
const state = {
  loadedModules: new Set(),
  activeHedge: 'none'
};

/**
 * Handles professional dashboard tab switching.
 */
function showTab(moduleId, triggerElement) {
  // UI Reset
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  // Activate Target Module
  const targetPanel = document.getElementById("tab-" + moduleId);
  if (targetPanel) {
    targetPanel.classList.add("active");
    if (triggerElement) triggerElement.classList.add("active");
    
    // Lazy Initialization of Analytical Modules
    if (!state.loadedModules.has(moduleId)) {
      initializeModule(moduleId);
      state.loadedModules.add(moduleId);
    }
  }
}

function initializeModule(id) {
  const initializers = {
    'membership':  initMembershipDistributions,
    'surface3d':   initRiskSurfaceMapping,
    'sensitivity': initImpactAnalysis,
    'comparison':  initComparativeStudy,
    'neuro':       initLogicOptimization
  };
  if (initializers[id]) initializers[id]();
}

// --- Dynamic Input Handlers (Sliders & Badges) ---
/**
 * Synchronizes UI badges with slider input values.
 */
function syncInputDisplay(id, value, unit = "") {
  const badge = document.getElementById(`${id}-val`);
  if (badge) {
    badge.textContent = `${value}${unit ? ' ' + unit : ''}`;
  }
}

/**
 * Configures clinical parameter sliders with real-time feedback.
 */
function setupParameterControl(id, unit = "", callback = null) {
  const slider = document.getElementById(id);
  if (!slider) return;

  slider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    syncInputDisplay(id, val, unit);
    if (callback) callback(val);
  });
  
  // Initial sync
  syncInputDisplay(id, slider.value, unit);
}

// Initialize core UI listeners on load
document.addEventListener("DOMContentLoaded", () => {
  setupParameterControl("bp", "mmHg");
  setupParameterControl("chol", "mg/dL");
  setupParameterControl("hr", "bpm");
  setupParameterControl("age", "yrs");
  setupParameterControl("smoking", "pkts");
  setupParameterControl("diabetes", "mg/dL");
});
// --- TAB 1: CLINICAL DIAGNOSTICS LOGIC ---

/**
 * Loads a pre-defined clinical case study into the input fields.
 */
function loadPreset(caseId) {
    const CLINICAL_CASES = {
        1: { bp: 105, chol: 160, hr: 55,  age: 28, smoking: 0.0, diabetes: 85 },
        2: { bp: 120, chol: 195, hr: 65,  age: 45, smoking: 0.5, diabetes: 95 },
        3: { bp: 165, chol: 186, hr: 95,  age: 62, smoking: 0.9, diabetes: 135 },
    };

    const data = CLINICAL_CASES[caseId];
    if (!data) return;

    // Update all sliders and badges
    Object.entries(data).forEach(([key, val]) => {
        const slider = document.getElementById(key);
        if (slider) {
            slider.value = val;
            syncInputDisplay(key, val, key === "smoking" ? "pkts" : "");
        }
    });

    // Auto-execute analysis for seamless UX
    executeClinicalAnalysis();
}

/**
 * Orchestrates the full diagnostic pipeline via the Backend API.
 */
async function executeClinicalAnalysis() {
    const actionBtn = document.getElementById("run-btn");
    const resultArea = document.getElementById("result-area");

    // UI Feedback: Loading State
    if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.innerHTML = `<i data-lucide="refresh-cw" class="spin"></i> Processing...`;
        lucide.createIcons(); // Refresh icons inside button
    }

    const payload = {
        bp:       parseFloat(document.getElementById("bp")?.value       || 130),
        chol:     parseFloat(document.getElementById("chol")?.value     || 190),
        hr:       parseFloat(document.getElementById("hr")?.value       || 75),
        age:      parseFloat(document.getElementById("age")?.value      || 45),
        smoking:  parseFloat(document.getElementById("smoking")?.value  || 0.5),
        glucose:  parseFloat(document.getElementById("diabetes")?.value || 110),
        hedge:    document.querySelector('input[name="hedge"]:checked')?.value || "none",
    };

    try {
        const response = await fetch("/api/diagnose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const report = await response.json();
        renderDiagnosticReport(report, payload);
    } catch (error) {
        console.error("Clinical Analysis Error:", error);
    } finally {
        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.innerHTML = `<i data-lucide="play-circle"></i> Execute Analysis`;
            lucide.createIcons();
        }
    }
}

/**
 * Renders the clinical report in a high-fidelity dashboard format.
 */
function renderDiagnosticReport(data, inputs) {
    const area = document.getElementById("result-area");
    if (!area) return;

    const primary = data.primary_assessment;
    const secondary = data.secondary_assessment;
    const profile = primary.classification;

    // Helper: Component for membership bars
    const renderBars = (memberships) => Object.entries(memberships).map(([label, value]) => `
        <div class="analysis-row">
            <span class="analysis-label">${label}</span>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${value * 100}%; background: ${THEME.primary}"></div>
            </div>
            <span class="analysis-value">${(value * 100).toFixed(1)}%</span>
        </div>
    `).join("");

    // Build the Report HTML
    area.innerHTML = `
        <div class="report-fade-in">
            <!-- Summary Score Cards -->
            <div class="dashboard-grid-2 mb-lg">
                <div class="diagnostic-result-card shadow-md border-top-${profile.status}">
                    <div class="pulse-icon-container mx-auto mb-sm">
                        <i data-lucide="activity"></i>
                    </div>
                    <h4 class="metric-label">Inference Score (Centroid)</h4>
                    <h2 class="metric-value" style="color: ${getRiskProfile(primary.score).color}">${primary.score}</h2>
                    <div class="status-badge ${profile.status}">${profile.label}</div>
                </div>

                <div class="diagnostic-result-card shadow-sm bg-light">
                    <h4 class="metric-label">Weighted Average</h4>
                    <h2 class="metric-value secondary">${secondary.score}</h2>
                    <p class="text-muted small">Variance: ${data.variance}</p>
                    <div class="status-badge ${secondary.classification.status}">${secondary.classification.label}</div>
                </div>
            </div>

            <!-- Risk Scale Visualization -->
            <div class="card shadow-sm mb-lg">
                <div class="card-header"><i data-lucide="gauge"></i> <h3>Visual Risk Scale</h3></div>
                <div class="progress-track lg mb-sm">
                    <div class="progress-fill" style="width: ${(primary.score / 4 * 100)}%; background: ${getRiskProfile(primary.score).color}"></div>
                </div>
                <div class="range-labels">
                    <span>Optimal (0.0)</span>
                    <span class="font-bold" style="color: ${getRiskProfile(primary.score).color}">SCORE: ${primary.score}</span>
                    <span>Critical (4.0)</span>
                </div>
            </div>

            <!-- Physiological Distribution -->
            <div class="card shadow-sm mb-lg">
                <div class="card-header"><i data-lucide="microscope"></i> <h3>Clinical Distributions</h3></div>
                <div class="analytics-grid">
                    <div><h5 class="sec-lbl">Blood Pressure</h5>${renderBars(data.membership_degrees.bp)}</div>
                    <div><h5 class="sec-lbl">Cholesterol</h5>${renderBars(data.membership_degrees.chol)}</div>
                    <div><h5 class="sec-lbl">Heart Rate</h5>${renderBars(data.membership_degrees.hr)}</div>
                </div>
            </div>

            <!-- Optimization Audit (If available) -->
            ${data.optimization_audit ? `
                <div class="card shadow-sm border-accent mb-lg">
                    <div class="card-header"><i data-lucide="cpu"></i> <h3>Optimization Audit</h3></div>
                    <div class="flex-row items-center gap-lg p-sm">
                        <div class="metric-value lg">${data.optimization_audit.score}</div>
                        <div>
                            <div class="status-badge info">${data.optimization_audit.classification.label}</div>
                            <p class="text-light small mt-xs">Logic Deviation: ${Math.abs(primary.score - data.optimization_audit.score).toFixed(4)}</p>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Re-initialize Lucide Icons for the new content
    lucide.createIcons();
}
// --- TAB 2: ANALYTICAL DISTRIBUTION MAPPING ---

/**
 * Initializes all clinical distribution charts on first load.
 */
async function initMembershipDistributions() {
    const clinicalParameters = [
        { id: "bp",       title: "Blood Pressure Profile" },
        { id: "chol",     title: "Cholesterol Distribution" },
        { id: "hr",       title: "Heart Rate Dynamics" },
        { id: "output",   title: "CHD Diagnostic Scale" },
        { id: "age",      title: "Age Demographics" },
        { id: "smoking",  title: "Smoking Intensity" },
        { id: "glucose",  title: "Fasting Glucose" }, // Note: renamed from diabetes to glucose to match backend
    ];

    // Batch load all charts for efficiency
    await Promise.all(clinicalParameters.map(param => 
        loadDistributionChart(param.id, state.activeHedge, param.title)
    ));
}

/**
 * Fetches coordinate data and renders high-fidelity Plotly charts.
 */
async function loadDistributionChart(parameterId, modifier = "none", title) {
    const targetDiv = document.getElementById(`mf-${parameterId}`);
    if (!targetDiv || !window.Plotly) return;

    try {
        const response = await fetch(`/api/membership/${parameterId}?hedge=${modifier}`);
        const data = await response.json();

        const xValues = data.x_axis || data.x;
        const traces = Object.keys(data)
            .filter(key => key !== "x" && key !== "x_axis")
            .map((key, index) => ({
                x: xValues,
                y: data[key],
                name: key.toUpperCase(),
                type: "scatter",
                mode: "lines",
                fill: "tozeroy",
                line: { 
                    width: 2.5, 
                    shape: 'spline', // Smoother curves for a "Fresh" look
                    color: Object.values(THEME)[index % 5] 
                },
                fillcolor: Object.values(THEME)[index % 5] + "15", // Subtle transparency
            }));

        const layout = {
            title: { 
                text: `${title} ${modifier !== 'none' ? `(${modifier})` : ''}`, 
                font: { family: 'Inter', size: 14, color: '#1e293b', weight: 'bold' } 
            },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            xaxis: { 
                gridcolor: "#f1f5f9", 
                tickfont: { color: "#94a3b8", size: 10 },
                zeroline: false 
            },
            yaxis: { 
                range: [0, 1.05], 
                gridcolor: "#f1f5f9", 
                tickfont: { color: "#94a3b8", size: 10 },
                zeroline: false 
            },
            margin: { t: 50, b: 40, l: 40, r: 20 },
            legend: { orientation: 'h', y: -0.2, font: { size: 11, color: '#64748b' } },
            hovermode: 'closest'
        };

        const config = { responsive: true, displayModeBar: false };
        Plotly.newPlot(targetDiv, traces, layout, config);

    } catch (error) {
        console.error(`Distribution load failure [${parameterId}]:`, error);
    }
}

/**
 * Global Intensity Modifier toggle with real-time UI synchronization.
 */
async function applyMFHedge(modifierLabel) {
    state.activeHedge = modifierLabel;

    // Update UI button states
    document.querySelectorAll(".pill-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.hedge === modifierLabel);
    });

    // Refresh all active analytics with new modifier logic
    const mappings = {
        bp: "Blood Pressure Profile",
        chol: "Cholesterol Distribution",
        hr: "Heart Rate Dynamics",
        output: "CHD Diagnostic Scale",
        age: "Age Demographics",
        smoking: "Smoking Intensity",
        glucose: "Fasting Glucose"
    };

    // Re-render each distribution chart with the new intensity scale
    for (const [id, title] of Object.entries(mappings)) {
        loadDistributionChart(id, modifierLabel, title);
    }
}
// --- TAB 3: ENGINE LOGIC & TRACEABILITY ---

/**
 * Loads a detailed mathematical breakdown for a specific clinical case.
 */
async function loadManual(caseId, triggerBtn) {
    // UI: Update Active State
    document.querySelectorAll(".case-selector-btn").forEach(b => b.classList.remove("active"));
    if (triggerBtn) triggerBtn.classList.add("active");

    const area = document.getElementById("manual-area");
    if (!area) return;

    // Fetch and identify the target profile
    try {
        const response = await fetch("/api/presets");
        const dataset = await response.json();
        const entry = dataset.find(x => x.case_profile.case_id.includes(caseId));
        if (!entry) return;

        const { case_profile: p, diagnostic_report: d } = entry;

        // Internal Components Builders
        const renderTraceBar = (label, val, color) => `
            <div class="analysis-row">
                <span class="analysis-label" style="color:${color}">${label}</span>
                <div class="progress-track"><div class="progress-fill" style="width:${Math.round(val * 100)}%;background:${color}"></div></div>
                <span class="analysis-value">${(val * 100).toFixed(2)}%</span>
            </div>`;

        const renderTraceStep = (num, title, content) => `
            <div class="trace-block shadow-sm">
                <div class="trace-header" onclick="this.nextElementSibling.classList.toggle('is-open')">
                    <div class="trace-step-id">${num}</div>
                    <h3 class="trace-title">${title}</h3>
                    <i data-lucide="chevron-down" class="ms-auto"></i>
                </div>
                <div class="trace-body is-open">${content}</div>
            </div>`;

        // Process Rule Activation Table
        const ruleRows = d.raw_rules.map(r => `
            <tr class="${r.strength > 0 ? 'row-fired' : ''}">
                <td class="code-font font-bold">${r.id}</td>
                <td class="small text-muted">${r.details}</td>
                <td>
                    <div class="analysis-row mb-0">
                        <div class="progress-track" style="max-width:80px">
                            <div class="progress-fill" style="width:${r.strength * 100}%; background:${getRiskProfile(r.outcome === 'healthy' ? 0 : 3).color}"></div>
                        </div>
                        <span class="code-font small">${r.strength.toFixed(3)}</span>
                    </div>
                </td>
                <td><div class="status-badge ${getRiskProfile(r.outcome === 'healthy' ? 0 : 3).id}">${r.outcome}</div></td>
            </tr>`).join("");

        // Build Final HTML Output
        area.innerHTML = `
            <div class="clinical-alert info mb-lg">
                <i data-lucide="file-text"></i>
                <div class="alert-content">
                    <strong>Audit Case ${p.case_id}</strong>: ${p.description}<br>
                    <small class="text-muted">BP:${p.bp} | Chol:${p.chol} | HR:${p.hr}</small>
                </div>
            </div>

            ${renderTraceStep(1, "Phase I: Fuzzification (Input Mapping)", `
                <div class="analytics-grid">
                    <div><h5 class="sec-lbl">Blood Pressure</h5>
                        ${renderTraceBar("Low", d.membership_degrees.bp.low, THEME.primary)}
                        ${renderTraceBar("Medium", d.membership_degrees.bp.medium, THEME.warning)}
                        ${renderTraceBar("High", d.membership_degrees.bp.high, THEME.danger)}
                    </div>
                    <div><h5 class="sec-lbl">Cholesterol</h5>
                        ${renderTraceBar("Low", d.membership_degrees.chol.low, THEME.primary)}
                        ${renderTraceBar("High", d.membership_degrees.chol.high, THEME.danger)}
                    </div>
                    <div><h5 class="sec-lbl">Heart Rate</h5>
                        ${renderTraceBar("Slow", d.membership_degrees.hr.slow, THEME.primary)}
                        ${renderTraceBar("Moderate", d.membership_degrees.hr.moderate, THEME.warning)}
                        ${renderTraceBar("Fast", d.membership_degrees.hr.fast, THEME.danger)}
                    </div>
                </div>
            `)}

            ${renderTraceStep(2, "Phase II: Inference (Rule Activation)", `
                <div class="table-container">
                    <table class="clinical-table">
                        <thead><tr><th>ID</th><th>Logic Conditions</th><th>Firing Strength</th><th>Outcome</th></tr></thead>
                        <tbody>${ruleRows}</tbody>
                    </table>
                </div>
            `)}

            ${renderTraceStep(3, "Phase III: Defuzzification (Risk Quantification)", `
                <div class="analytics-grid-2">
                    <div class="metric-card shadow-sm border-left-primary">
                        <h4 class="metric-label">COG (Centroid)</h4>
                        <div class="metric-value">${d.primary_assessment.score}</div>
                        <div class="status-badge ${d.primary_assessment.classification.status} mt-sm">${d.primary_assessment.classification.label}</div>
                    </div>
                    <div class="metric-card shadow-sm border-left-warning">
                        <h4 class="metric-label">Weighted Average</h4>
                        <div class="metric-value">${d.secondary_assessment.score}</div>
                        <div class="status-badge ${d.secondary_assessment.classification.status} mt-sm">${d.secondary_assessment.classification.label}</div>
                    </div>
                </div>
            `)}
        `;
        
        // Re-initialize Icons
        lucide.createIcons();

    } catch (err) {
        console.error("Logic trace load failed:", err);
    }
}
// --- TAB 4: MULTI-DIMENSIONAL RISK TOPOLOGY (3D) ---

/**
 * Initializes the 3D surface mapping module.
 */
async function initRiskSurfaceMapping() {
    const hrSlider = document.getElementById("surf-hr");
    if (hrSlider) {
        setupParameterControl("surf-hr", "bpm", (val) => {
            // Optional: Auto-refresh on slider change with debounce could be added here
        });
    }
    // Initial high-resolution render
    await renderRiskSurface();
}

/**
 * Generates and renders the 3D Risk Surface using Plotly.
 */
async function renderRiskSurface(hrValue = null, modifierLabel = null) {
    const targetDiv = document.getElementById("surface-plot");
    if (!targetDiv) return;

    // Loading State UI
    targetDiv.innerHTML = `
        <div class="loading-state">
            <i data-lucide="refresh-cw" class="spin"></i>
            <p>Mapping Risk Topology...</p>
        </div>`;
    lucide.createIcons();

    // Normalizing parameters
    const hr = hrValue || parseFloat(document.getElementById("surf-hr")?.value || 75);
    const hedge = modifierLabel || document.querySelector(".tab-pill-btn.active")?.dataset.hedge || "none";

    try {
        const response = await fetch(`/api/surface3d?hr=${hr}&hedge=${hedge}`);
        const data = await response.json();

        const trace = {
            type: "surface",
            x: data.chol_axis || data.chol,
            y: data.bp_axis || data.bp,
            z: data.z_matrix || data.z,
            
            // Professional Medical Gradient (Green -> Amber -> Red)
            colorscale: [
                [0, THEME.success],    [0.35, '#6ee7b7'], 
                [0.5, THEME.warning],  [0.75, '#fb923c'], 
                [1, THEME.danger]
            ],
            
            colorbar: {
                title: { text: "RISK SCORE", font: { family: 'Inter', size: 11, color: '#64748b' } },
                tickvals: [0.75, 2.0, 3.25],
                ticktext: ["Optimal", "Intermediate", "Critical"],
                tickfont: { color: "#94a3b8", size: 10 },
                thickness: 15,
                len: 0.8
            },
            
            contours: {
                z: { show: true, usecolormap: true, project: { z: true }, color: '#ffffff', width: 2 }
            },
            opacity: 0.95,
            lighting: { ambient: 0.7, diffuse: 0.9, specular: 0.2, roughness: 0.4 }
        };

        const layout = {
            title: { 
                text: `CHD Risk Topology (HR: ${hr} bpm | Modifier: ${hedge})`,
                font: { family: 'Inter', size: 15, color: '#1e293b', weight: 'bold' }
            },
            paper_bgcolor: "rgba(0,0,0,0)",
            scene: {
                xaxis: { 
                    title: { text: "Cholesterol", font: { size: 11, color: '#64748b' } },
                    gridcolor: "#e2e8f0", backgroundcolor: "#f8fafc", showbackground: true 
                },
                yaxis: { 
                    title: { text: "Blood Pressure", font: { size: 11, color: '#64748b' } },
                    gridcolor: "#e2e8f0", backgroundcolor: "#f8fafc", showbackground: true 
                },
                zaxis: { 
                    title: { text: "Risk Score", font: { size: 11, color: '#64748b' } },
                    range: [0, 4], gridcolor: "#e2e8f0" 
                },
                camera: { eye: { x: 1.5, y: -1.5, z: 1.1 } }
            },
            margin: { t: 60, b: 20, l: 20, r: 20 },
            hovermode: 'closest'
        };

        Plotly.newPlot(targetDiv, [trace], layout, { responsive: true, displayModeBar: false });

    } catch (error) {
        console.error("Surface Mapping Failed:", error);
        targetDiv.innerHTML = `<div class="error-msg">Calibration failed. Please try again.</div>`;
    }
}

/**
 * Handles modifier switching for the 3D surface.
 */
function setSurfHedge(hedge, triggerBtn) {
    document.querySelectorAll(".tab-pill-btn").forEach(btn => btn.classList.remove("active"));
    if (triggerBtn) triggerBtn.classList.add("active");
    renderRiskSurface(null, hedge);
}
// --- TAB 5: CLINICAL IMPACT & SENSITIVITY ---

/**
 * Executes a parametric sweep to identify key clinical risk drivers.
 */
async function initImpactAnalysis() {
    await renderImpactAssessment("none");
}

async function renderImpactAssessment(modifier = "none") {
    const response = await fetch("/api/sensitivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hedge: modifier }),
    });
    
    const data = await response.json();
    const lineChartDiv = document.getElementById("sensitivity-chart");
    const barChartDiv = document.getElementById("sensitivity-bar");
    const summaryDiv = document.getElementById("sensitivity-info");

    if (!lineChartDiv || !window.Plotly) return;

    // 1. Sensitivity Curves (Trace Analysis)
    const lineTraces = Object.entries(data.factors).map(([key, factor], index) => ({
        type: "scatter", 
        mode: "lines",
        name: factor.label.split(" (")[0],
        x: factor.coordinates || factor.x, 
        y: factor.centroid_path || factor.y_cog,
        line: { color: Object.values(THEME)[index % 5], width: 3, shape: 'spline' },
        hoverinfo: "name+y"
    }));

    const lineLayout = {
        title: { text: "Marginal Impact Curves", font: { family: 'Inter', size: 14, color: '#1e293b' } },
        paper_bgcolor: "transparent", plot_bgcolor: "transparent",
        xaxis: { showgrid: false, zeroline: false, showticklabels: false },
        yaxis: { title: "Risk Score", range: [0, 4.1], gridcolor: "#f1f5f9" },
        margin: { t: 40, b: 20, l: 40, r: 10 },
        legend: { font: { size: 10, color: '#64748b' }, orientation: 'h', y: -0.2 }
    };

    Plotly.newPlot(lineChartDiv, lineTraces, lineLayout, { responsive: true, displayModeBar: false });

    // 2. Influence Hierarchy (Impact Ranking)
    if (barChartDiv) {
        const ranking = data.impact_ranking || data.ranking;
        const barTrace = {
            type: "bar", 
            orientation: "h",
            x: ranking.map(r => r[1]),
            y: ranking.map(r => (data.factors[r[0]].display_label || data.factors[r[0]].label).split(" (")[0]),
            marker: {
                color: ranking.map((_, i) => i === 0 ? THEME.primary : '#e2e8f0'),
                line: { width: 0 }
            },
            text: ranking.map(r => r[1].toFixed(3)),
            textposition: "outside",
            cliponaxis: false
        };

        const barLayout = {
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            xaxis: { title: "Sensitivity Index (Δ)", gridcolor: "#f1f5f9" },
            yaxis: { automargin: true, tickfont: { size: 11, color: '#475569' } },
            margin: { t: 10, b: 40, l: 120, r: 40 }
        };

        Plotly.newPlot(barChartDiv, [barTrace], barLayout, { responsive: true, displayModeBar: false });
    }

    // 3. Clinical Insight Banner
    if (summaryDiv) {
        const topFactor = data.factors[data.primary_driver || data.most_influential];
        const sensitivityVal = data.impact_ranking ? data.impact_ranking[0][1] : data.ranges_cog[data.most_influential];
        
        summaryDiv.innerHTML = `
            <div class="clinical-alert info shadow-sm border-left-primary">
                <i data-lucide="award"></i>
                <div class="alert-content">
                    <strong>Primary Clinical Driver:</strong> The system identifies <u>${topFactor.display_label || topFactor.label}</u> as the most significant variable, 
                    with a clinical sensitivity index of <strong>${sensitivityVal.toFixed(3)}</strong>.
                </div>
            </div>`;
        lucide.createIcons();
    }
}

function setSensHedge(modifier, btn) {
    document.querySelectorAll(".pill-btn, .sens-hedge-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderImpactAssessment(modifier);
}


// --- TAB 6: COMPARATIVE STUDY ---

/**
 * Aggregates results from multiple patients and methods for benchmarking.
 */
async function initComparativeStudy() {
    const response = await fetch("/api/hedge-comparison");
    const data = await response.json();
    renderComparativeDashboard(data);
}

function renderComparativeDashboard(data) {
    const area = document.getElementById("comparison-area");
    if (!area) return;

    // Patient Benchmark Cards
    const cards = data.table.map((row, index) => {
        const baseline = row.results["none"];
        const profile = getRiskProfile(baseline.cog);
        
        return `
            <div class="metric-card shadow-sm border-top-${profile.id}">
                <div class="flex-row justify-between items-center mb-sm">
                    <h3 class="text-primary font-bold">${row.patient.name}</h3>
                    <i data-lucide="user" class="text-muted" style="width:16px"></i>
                </div>
                <p class="small text-light mb-md">Baseline: BP ${row.patient.bp} · Chol ${row.patient.chol}</p>
                
                <div class="diagnostic-summary mb-lg">
                    <h2 class="metric-value" style="color: ${profile.color}">${baseline.cog}</h2>
                    <div class="status-badge ${profile.id}">${profile.label}</div>
                </div>

                <div class="analysis-row mb-xs">
                    <span class="analysis-label small">COG</span>
                    <div class="progress-track sm"><div class="progress-fill" style="width:${(baseline.cog/4*100)}%; background:${profile.color}"></div></div>
                </div>
                <div class="analysis-row">
                    <span class="analysis-label small">Sugeno</span>
                    <div class="progress-track sm"><div class="progress-fill" style="width:${(baseline.sugeno/4*100)}%; background:${profile.color}; opacity:0.4"></div></div>
                </div>
            </div>`;
    }).join("");

    // Professional Cross-Methodology Table
    const headerCols = data.hedges.map(h => `<th colspan="2" class="text-center border-left">${h.label}</th>`).join("");
    const subHeaderCols = data.hedges.map(() => `<th class="text-center small border-left">COG</th><th class="text-center small">Sug</th>`).join("");
    
    const tableRows = data.table.map(row => {
        const cells = data.hedges.map(h => {
            const res = row.results[h.value];
            const p = getRiskProfile(res.cog);
            return `<td class="code-font text-center font-bold border-left" style="color:${p.color}">${res.cog}</td>
                    <td class="code-font text-center text-muted small">${res.sugeno}</td>`;
        }).join("");
        return `<tr><td class="font-bold">${row.patient.name}</td>${cells}</tr>`;
    }).join("");

    area.innerHTML = `
        <div class="dashboard-grid-3 mb-lg">${cards}</div>
        <div class="card shadow-sm">
            <div class="card-header"><i data-lucide="table"></i> <h3>Global Sensitivity Matrix</h3></div>
            <div class="table-container">
                <table class="clinical-table">
                    <thead>
                        <tr><th>Case Study</th>${headerCols}</tr>
                        <tr><th></th>${subHeaderCols}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>`;
    
    lucide.createIcons();
}
// --- TAB 7: ENGINE OPTIMIZATION (PARAMETRIC CALIBRATION) ---

/**
 * Initializes the optimization module view.
 */
async function initLogicOptimization() {
    // Current module uses a placeholder until calibration is triggered.
}

/**
 * Executes the parametric calibration sequence to synchronize the 
 * approximator with the core inference engine.
 */
async function trainNeuro() {
    const calibrateBtn = document.getElementById("train-btn");
    const sampleSize = parseInt(document.getElementById("train-n")?.value || 400);

    // UI Feedback: Calibration Mode
    if (calibrateBtn) {
        calibrateBtn.disabled = true;
        calibrateBtn.innerHTML = `<i data-lucide="refresh-ccw" class="spin"></i> Calibrating Logic...`;
        lucide.createIcons();
    }

    try {
        const response = await fetch(`/api/logic-calibrate?n=${sampleSize}`, { method: "POST" });
        const metrics = await response.json();
        
        renderOptimizationResults(metrics);
        
    } catch (error) {
        console.error("Calibration sequence failed:", error);
    } finally {
        if (calibrateBtn) {
            calibrateBtn.disabled = false;
            calibrateBtn.innerHTML = `<i data-lucide="zap"></i> Recalibrate System`;
            lucide.createIcons();
        }
    }
}

/**
 * Renders the optimization metrics and convergence data.
 */
function renderOptimizationResults(data) {
    const area = document.getElementById("neuro-area");
    if (!area) return;

    // Statistical Comparison Table
    const auditRows = (data.audit_results || []).map(row => {
        const profile = getRiskProfile(row.engine_val);
        return `
            <tr>
                <td class="font-bold">${row.case_id}</td>
                <td class="code-font font-bold" style="color:${profile.color}">${row.engine_val}</td>
                <td class="code-font text-muted">${row.approx_val}</td>
                <td class="code-font ${row.variance < 0.2 ? 'text-success' : 'text-warning'}">${row.variance}</td>
                <td><div class="status-badge ${profile.id}">${row.engine_status}</div></td>
            </tr>`;
    }).join("");

    area.innerHTML = `
        <!-- High-Level Performance Metrics -->
        <div class="dashboard-grid-4 mb-lg">
            <div class="metric-card shadow-sm">
                <div class="metric-value">${data.r2_coefficient?.toFixed(4) || "—"}</div>
                <div class="metric-label">R² Consistency</div>
            </div>
            <div class="metric-card shadow-sm">
                <div class="metric-value">${data.mean_squared_error?.toFixed(5) || "—"}</div>
                <div class="metric-label">Mean Sq. Error</div>
            </div>
            <div class="metric-card shadow-sm">
                <div class="metric-value">${data.mean_abs_error?.toFixed(4) || "—"}</div>
                <div class="metric-label">Mean Abs. Error</div>
            </div>
            <div class="metric-card shadow-sm">
                <div class="metric-value">${data.convergence_steps || "—"}</div>
                <div class="metric-label">Iterations</div>
            </div>
        </div>

        <div class="analytics-grid">
            <!-- Convergence / Loss Curve -->
            <div class="card shadow-sm">
                <div class="card-header"><i data-lucide="trending-down"></i> <h3>Error Convergence Curve</h3></div>
                <div id="neuro-loss" class="chart-container-sm"></div>
            </div>

            <!-- Validation Audit Table -->
            <div class="card shadow-sm">
                <div class="card-header"><i data-lucide="shield-check"></i> <h3>Engine Validation Audit</h3></div>
                <div class="table-container">
                    <table class="clinical-table">
                        <thead>
                            <tr><th>Case ID</th><th>Engine Val</th><th>Approx Val</th><th>Variance</th><th>Status</th></tr>
                        </thead>
                        <tbody>${auditRows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Visualizing the Convergence (Loss) Curve
    if (data.train_loss && window.Plotly) {
        const trace = {
            type: "scatter", mode: "lines",
            y: data.train_loss,
            x: data.train_loss.map((_, i) => i + 1),
            line: { color: THEME.primary, width: 3, shape: 'spline' },
            fill: "tozeroy", 
            fillcolor: THEME.primary + "10",
        };

        const layout = {
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            xaxis: { title: "Optimization Step", gridcolor: "#f1f5f9", tickfont: { size: 10, color: '#94a3b8' } },
            yaxis: { title: "Loss (MSE)", gridcolor: "#f1f5f9", tickfont: { size: 10, color: '#94a3b8' } },
            margin: { t: 10, b: 40, l: 50, r: 10 },
            hovermode: 'x'
        };

        Plotly.newPlot("neuro-loss", [trace], layout, { responsive: true, displayModeBar: false });
    }
    
    lucide.createIcons();
}

// --- SYSTEM INITIALIZATION ---

document.addEventListener("DOMContentLoaded", () => {
    console.log("HealthWise Clinical Suite: System Initialized.");
    
    // Auto-initialize the default Traceability Case
    const defaultCaseBtn = document.getElementById("manual-p1");
    if (defaultCaseBtn) {
        loadManual(1, defaultCaseBtn);
    }
    
    // Initialize Lucide Icons globally
    if (window.lucide) {
        lucide.createIcons();
    }
});
