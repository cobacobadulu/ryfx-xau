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


/* REQUEST AI ANALYSIS (Halaman AI Analysis) */

async function requestAIAnalysis(options = {}) {

    if (RYFX_AI_STATE.analyzing) return;

    RYFX_AI_STATE.analyzing = true;
    RYFX_AI_STATE.error = null;

    const requestId = ++RYFX_AI_STATE.requestId;

    const button = document.getElementById("runAIAnalysis") || document.getElementById("analyzeButton");

    setAnalysisLoading(true, button);
    setAnalysisText("analysisStatus", "Analyzing XAUUSD market...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RYFX_AI_CONFIG.timeout);

    try {
        const apiBase = (window.RYFX_API && window.RYFX_API.BASE_URL) || "";
        const safeTimeframe = normalizeTimeframe(options.timeframe);

        const response = await fetch(apiBase + RYFX_AI_CONFIG.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                symbol: RYFX_AI_CONFIG.symbol,
                timeframe: safeTimeframe,
                analysis_type: options.analysisType || "technical"
            }),
            signal: controller.signal
        });

        if (!response.ok) throw new Error(`AI Analysis Error: ${response.status}`);

        const result = await response.json();
        const analysis = result.data || result.analysis || result;

        validateAnalysis(analysis);

        if (requestId !== RYFX_AI_STATE.requestId) return;

        RYFX_AI_STATE.lastAnalysis = analysis;
        RYFX_AI_STATE.error = null;

        renderAIAnalysis(analysis);
        setAnalysisText("analysisStatus", "Analysis completed successfully");

        document.dispatchEvent(new CustomEvent("ryfx:analysis-completed", { detail: analysis }));

    } catch (error) {
        if (requestId !== RYFX_AI_STATE.requestId) return;
        console.error("[ryFX AI Analysis]", error);
        RYFX_AI_STATE.error = error.message;
        const message = error.name === "AbortError" ? "Analysis timed out." : "Unable to analyze market data.";
        showAnalysisError(message);
    } finally {
        clearTimeout(timeout);
        if (requestId === RYFX_AI_STATE.requestId) {
            RYFX_AI_STATE.analyzing = false;
            setAnalysisLoading(false, button);
        }
    }
}


/* VALIDATE AI RESPONSE */
function validateAnalysis(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid AI response");
    const direction = String(data.direction || "").toUpperCase();
    if (!["BUY", "SELL", "WAIT"].includes(direction)) throw new Error("Invalid direction");
    if (typeof data.reasoning !== "string" || !data.reasoning.trim()) throw new Error("Missing reasoning");
    return true;
}


/* GET NUMERIC PRICE */
function getNumericPrice(value) {
    if (value === null || value === undefined || value === "") return null;
    const price = Number(value);
    return Number.isFinite(price) && price > 0 ? price : null;
}

/* GET TAKE PROFIT VALUES */
function getTakeProfitValues(data) {
    const values = [];
    if (Array.isArray(data.take_profits)) values.push(...data.take_profits);
    else if (data.take_profits) values.push(data.take_profits);
    if (data.take_profit !== undefined) values.push(data.take_profit);
    if (data.tp1 !== undefined) values.push(data.tp1);
    if (data.tp2 !== undefined) values.push(data.tp2);
    if (data.tp3 !== undefined) values.push(data.tp3);
    return values.map(v => typeof v === "object" && v !== null ? getNumericPrice(v.price ?? v.value) : getNumericPrice(v)).filter(v => v !== null);
}

/* ANALYSIS LOADING */
function setAnalysisLoading(loading, button) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "Analyzing XAUUSD..." : "Run AI Analysis";
}

/* FORMAT CONFIDENCE */
function formatConfidence(value) {
    if (value === null || value === undefined || value === "") return "--";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    const percentage = number <= 1 && number >= 0 ? number * 100 : number;
    return `${percentage.toFixed(1)}%`;
}

/* FORMAT PRICE */
function formatAnalysisPrice(value) {
    const price = getNumericPrice(value);
    if (price === null) return "--";
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* FORMAT TIMESTAMP */
function formatAnalysisTimestamp(value) {
    if (!value) return new Date().toLocaleString("en-GB");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-GB");
}

/* RENDER AI ANALYSIS */
function renderAIAnalysis(data) {
    const direction = String(data.direction).toUpperCase();
    const directionClass = { BUY: "signal-buy", SELL: "signal-sell", WAIT: "signal-wait" }[direction];
    const entry = direction === "WAIT" ? "--" : formatAnalysisPrice(data.entry);
    const stopLoss = direction === "WAIT" ? "--" : formatAnalysisPrice(data.stop_loss);
    const takeProfits = direction === "WAIT" ? [] : getTakeProfitValues(data);
    const formattedTakeProfits = takeProfits.length ? takeProfits.map(formatAnalysisPrice).join(" / ") : "--";
    const confidence = formatConfidence(data.confidence);
    const timeframe = data.timeframe || "15m";
    const timestamp = formatAnalysisTimestamp(data.timestamp);

    setAnalysisText("analysisDirection", direction);
    setAnalysisText("analysisConfidence", confidence);
    setAnalysisText("analysisSummary", data.summary || data.reasoning || "--");
    setAnalysisText("analysisStructure", data.market_structure || data.structure || "--");
    setAnalysisText("analysisBOS", data.bos || data.break_of_structure || "--");
    setAnalysisText("analysisLiquidity", data.liquidity || "--");
    setAnalysisText("analysisVolatility", data.volatility || "--");
    setAnalysisText("analysisEntry", entry);
    setAnalysisText("analysisStopLoss", stopLoss);
    setAnalysisText("analysisTakeProfit", formattedTakeProfits);
    setAnalysisText("analysisTimestamp", timestamp);
    setAnalysisText("analysisReasoning", data.reasoning || "--");

    const directionElement = document.getElementById("analysisDirection");
    if (directionElement) {
        directionElement.classList.remove("signal-buy", "signal-sell", "signal-wait");
        directionElement.classList.add(directionClass);
    }
}

/* UPDATE TEXT ELEMENT */
function setAnalysisText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = (value === null || value === undefined) ? "--" : String(value);
}

/* ANALYSIS ERROR */
function showAnalysisError(message) {
    setAnalysisText("analysisStatus", message);
}

/* ANALYSIS BUTTON (Halaman AI Analysis) */
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
        
        // Ambil timeframe dari dropdown HTML
        const tfSelect = document.getElementById("scannerTimeframe");
        const rawTf = tfSelect ? tfSelect.value : "M15";
        const safeTf = normalizeTimeframe(rawTf);

        const res = await fetch(`${apiBase}/api/analysis/scanner?timeframe=${safeTf}`);
        const result = await res.json();

        if (!result.success) throw new Error(result.detail || "Gagal scan chart");

        const data = result.data;

        // Update UI berdasarkan ID yang ada di HTML (scannerDirection, dll)
        if (document.getElementById("scannerDirection")) 
            document.getElementById("scannerDirection").textContent = data.direction;
        
        if (document.getElementById("scannerConfidence")) 
            document.getElementById("scannerConfidence").textContent = `Confidence: ${data.confidence}%`;
        
        if (document.getElementById("scannerStructure")) 
            document.getElementById("scannerStructure").textContent = data.structure;
        
        if (document.getElementById("scannerLiquidity")) 
            document.getElementById("scannerLiquidity").textContent = data.liquidity;
        
        if (document.getElementById("scannerBOS")) 
            document.getElementById("scannerBOS").textContent = data.bos;
        
        if (document.getElementById("scannerSupplyZone")) 
            document.getElementById("scannerSupplyZone").textContent = data.supply_zone ? `$${data.supply_zone}` : "--";
        
        if (document.getElementById("scannerDemandZone")) 
            document.getElementById("scannerDemandZone").textContent = data.demand_zone ? `$${data.demand_zone}` : "--";
        
        if (document.getElementById("scannerInsight")) 
            document.getElementById("scannerInsight").textContent = data.insight;

        if (statusText) statusText.textContent = "Analysis completed successfully";

    } catch (err) {
        console.error("[Scanner]", err);
        if (statusText) statusText.textContent = "Error: " + err.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "✦ Analyze Chart with ryAI"; }
    }
}

// Hubungkan tombol dengan ID `analyzeChartButton` (sesuai HTML)
document.addEventListener("click", (e) => {
    const btn = e.target.closest("#analyzeChartButton");
    if (btn) {
        e.preventDefault();
        runChartScanner();
    }
});

// Pastikan tombol scanner aktif saat halaman dimuat (karena HTML aslinya disabled)
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
    renderAIAnalysis,
    validateAnalysis,
    getTakeProfitValues,
    getState() { return { ...RYFX_AI_STATE }; }
};
