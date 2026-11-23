/* =========================================
   ryFX XAU — AI MARKET ANALYSIS
   XAUUSD INTELLIGENCE ENGINE
========================================= */

"use strict";


/* AI CONFIGURATION */

const RYFX_AI_CONFIG = {
    endpoint: "/api/analysis/xauusd",
    symbol: "XAUUSD",
    timeout: 120000
};


/* AI STATE */

const RYFX_AI_STATE = {
    analyzing: false,
    lastAnalysis: null,
    error: null,
    requestId: 0
};


/* =========================================
   NORMALIZE TIMEFRAME
========================================= */
function normalizeTimeframe(tf) {
    if (!tf) return "15m";
    
    const upper = String(tf).toUpperCase();
    const map = {
        "M1": "1m", "M5": "5m", "M15": "15m",
        "M30": "30m", "H1": "1h", "H4": "4h", "D1": "1d"
    };
    
    return map[upper] || upper.toLowerCase();
}


/* =========================================
   REQUEST AI ANALYSIS (MULTI-TIMEFRAME LOGIC)
========================================= */
async function requestAIAnalysis(options = {}) {
    if (RYFX_AI_STATE.analyzing) return;

    RYFX_AI_STATE.analyzing = true;
    RYFX_AI_STATE.error = null;

    const requestId = ++RYFX_AI_STATE.requestId;
    const button = document.getElementById("runAIAnalysis") || document.getElementById("analyzeButton");

    setAnalysisLoading(true, button);
    setAnalysisText("analysisStatus", "Analyzing XAUUSD market...");

    try {
        const apiBase = (window.RYFX_API && window.RYFX_API.BASE_URL) || "";
        const safeTimeframe = normalizeTimeframe(options.timeframe);

        // Tembak ke endpoint baru (tanpa Gemini)
        const response = await fetch(`${apiBase}/api/analysis/full-analysis?timeframe=${safeTimeframe}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const data = result.data;

        if (requestId !== RYFX_AI_STATE.requestId) return;

        // 1. Update Kotak Market Direction
        setAnalysisText("analysisDirection", data.direction);
        setAnalysisText("analysisConfidence", `Confidence: ${data.confidence}%`);
        setAnalysisText("analysisSummary", data.summary);
        setAnalysisText("analysisReasoning", data.reasoning);

        // 2. Update Warna Kotak
        const directionElement = document.getElementById("analysisDirection");
        if (directionElement) {
            directionElement.className = ""; 
            if (data.direction === "BUY") directionElement.classList.add("signal-buy");
            else if (data.direction === "SELL") directionElement.classList.add("signal-sell");
            else directionElement.classList.add("signal-wait");
        }

        // 3. Update Multi-Timeframe Intelligence
        const tfMap = {
            "5m": "tfM5", "15m": "tfM15", "30m": "tfM30",
            "1h": "tfH1", "4h": "tfH4", "1d": "tfD1"
        };

        Object.entries(tfMap).forEach(([apiTf, htmlId]) => {
            const el = document.getElementById(htmlId);
            if (el) {
                const trend = data.timeframe_analysis[apiTf] || "UNKNOWN";
                el.textContent = trend;
                el.style.color = trend === "BULLISH" ? "#22C997" : (trend === "BEARISH" ? "#F05B68" : "#fff");
            }
        });

        // 4. Update status akhir
        setAnalysisText("analysisStatus", "Analysis completed successfully");
        document.dispatchEvent(new CustomEvent("ryfx:analysis-completed", { detail: data }));

    } catch (error) {
        if (requestId !== RYFX_AI_STATE.requestId) return;
        console.error("[ryFX AI Analysis]", error);
        showAnalysisError("Unable to analyze market data. Please try again.");
    } finally {
        if (requestId === RYFX_AI_STATE.requestId) {
            RYFX_AI_STATE.analyzing = false;
            setAnalysisLoading(false, button);
        }
    }
}


/* =========================================
   UTILS
========================================= */
function setAnalysisLoading(loading, button) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "Analyzing..." : "Run AI Analysis";
}

function setAnalysisText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = (value === null || value === undefined) ? "--" : String(value);
}

function showAnalysisError(message) {
    setAnalysisText("analysisStatus", message);
}


/* =========================================
   BUTTON EVENT (Halaman AI Analysis)
========================================= */
document.addEventListener("click", event => {
    const button = event.target.closest("#runAIAnalysis, #analyzeButton");
    if (!button) return;

    const rawTimeframe = document.getElementById("analysisTimeframe")?.value || "M15";
    const timeframe = normalizeTimeframe(rawTimeframe);
    const analysisType = document.getElementById("analysisType")?.value || "technical";

    requestAIAnalysis({ timeframe, analysisType });
});


/* =========================================
   CHART SCANNER LOGIC (Halaman AI Scanner)
========================================= */
async function runChartScanner() {
    const statusText = document.getElementById("scannerStatus");
    const btn = document.getElementById("analyzeChartButton");
    
    if (statusText) statusText.textContent = "Scanning XAUUSD market data...";
    if (btn) { btn.disabled = true; btn.textContent = "Scanning..."; }

    try {
        const apiBase = (window.RYFX_API && window.RYFX_API.BASE_URL) || "";
        const tfSelect = document.getElementById("scannerTimeframe");
        const rawTf = tfSelect ? tfSelect.value : "M15";
        const safeTf = normalizeTimeframe(rawTf);

        const res = await fetch(`${apiBase}/api/analysis/scanner?timeframe=${safeTf}`);
        const result = await res.json();

        if (!result.success) throw new Error(result.detail || "Gagal scan chart");
        const data = result.data;

        if (document.getElementById("scannerDirection")) document.getElementById("scannerDirection").textContent = data.direction;
        if (document.getElementById("scannerConfidence")) document.getElementById("scannerConfidence").textContent = `Confidence: ${data.confidence}%`;
        if (document.getElementById("scannerStructure")) document.getElementById("scannerStructure").textContent = data.structure;
        if (document.getElementById("scannerLiquidity")) document.getElementById("scannerLiquidity").textContent = data.liquidity;
        if (document.getElementById("scannerBOS")) document.getElementById("scannerBOS").textContent = data.bos;
        if (document.getElementById("scannerSupplyZone")) document.getElementById("scannerSupplyZone").textContent = data.supply_zone ? `$${data.supply_zone}` : "--";
        if (document.getElementById("scannerDemandZone")) document.getElementById("scannerDemandZone").textContent = data.demand_zone ? `$${data.demand_zone}` : "--";
        if (document.getElementById("scannerInsight")) document.getElementById("scannerInsight").textContent = data.insight;

        if (statusText) statusText.textContent = "Analysis completed successfully";
    } catch (err) {
        console.error("[Scanner]", err);
        if (statusText) statusText.textContent = "Error: " + err.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "✦ Analyze Chart with ryAI"; }
    }
}

document.addEventListener("click", (e) => {
    const btn = e.target.closest("#analyzeChartButton");
    if (btn) {
        e.preventDefault();
        runChartScanner();
    }
});

document.addEventListener("ryfx:page-loaded", (event) => {
    if (event.detail?.page === "ai-scanner") {
        const btn = document.getElementById("analyzeChartButton");
        if (btn) {
            btn.disabled = false;
            btn.textContent = "✦ Analyze Chart with ryAI";
        }
    }
});


/* EXPORT */
window.RYFX_AI = {
    requestAIAnalysis,
    getState() { return { ...RYFX_AI_STATE }; }
};
