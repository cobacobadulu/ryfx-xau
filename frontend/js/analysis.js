/* =========================================
   ryFX XAU — AI MARKET ANALYSIS
   XAUUSD INTELLIGENCE ENGINE
========================================= */

"use strict";

/* AI CONFIGURATION */

const RYFX_AI_CONFIG = {
    endpoint: "/api/analysis/xauusd",
    symbol: "XAUUSD",
    timeout: 60000
};

/* AI STATE */

const RYFX_AI_STATE = {
    analyzing: false,
    lastAnalysis: null,
    error: null
};

/* REQUEST AI ANALYSIS */

async function requestAIAnalysis(options = {}) {

    if (RYFX_AI_STATE.analyzing) return;

    RYFX_AI_STATE.analyzing = true;
    RYFX_AI_STATE.error = null;

    const button = document.getElementById("analyzeButton");

    setAnalysisLoading(true, button);

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        RYFX_AI_CONFIG.timeout
    );

    try {

        const response = await fetch(
            RYFX_AI_CONFIG.endpoint,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify({
                    symbol: RYFX_AI_CONFIG.symbol,
                    timeframe: options.timeframe || "M15"
                }),

                signal: controller.signal
            }
        );

        if (!response.ok) {
            throw new Error(
                `AI Analysis Error: ${response.status}`
            );
        }

        const result = await response.json();

        const analysis = result.data || result.analysis;

        validateAnalysis(analysis);

        RYFX_AI_STATE.lastAnalysis = analysis;

        renderAIAnalysis(analysis);

        document.dispatchEvent(
            new CustomEvent("ryfx:analysis-completed", {
                detail: analysis
            })
        );

    } catch (error) {

        console.error("[ryFX AI Analysis]", error);

        RYFX_AI_STATE.error = error.message;

        showAnalysisError(
            error.name === "AbortError"
                ? "Analysis timed out. Please try again."
                : "Unable to analyze market data. Please try again."
        );

    } finally {

        clearTimeout(timeout);

        RYFX_AI_STATE.analyzing = false;

        setAnalysisLoading(false, button);

    }

}

/* VALIDATE AI RESPONSE */

function validateAnalysis(data) {

    if (!data || typeof data !== "object") {
        throw new Error("Invalid AI response");
    }

    const validDirections = [
        "BUY",
        "SELL",
        "WAIT"
    ];

    if (!validDirections.includes(data.direction)) {
        throw new Error("Invalid trading direction");
    }

    if (!data.reasoning || typeof data.reasoning !== "string") {
        throw new Error("Missing analysis reasoning");
    }

    if (data.direction !== "WAIT") {

        const required = [
            "entry",
            "stop_loss",
            "take_profit"
        ];

        required.forEach(field => {

            if (
                data[field] === undefined ||
                data[field] === null
            ) {
                throw new Error(`Missing ${field}`);
            }

        });

    }

}

/* ANALYSIS LOADING */

function setAnalysisLoading(loading, button) {

    if (!button) return;

    button.disabled = loading;

    button.textContent = loading
        ? "Analyzing XAUUSD..."
        : "Analyze Market";

}

/* RENDER ANALYSIS */

function renderAIAnalysis(data) {

    const container = document.getElementById(
        "aiAnalysisResult"
    );

    if (!container) return;

    const direction = data.direction;

    const directionClass = {
        BUY: "signal-buy",
        SELL: "signal-sell",
        WAIT: "signal-wait"
    }[direction];

    const entry = data.entry ?? "--";
    const stopLoss = data.stop_loss ?? "--";
    const takeProfit = data.take_profit ?? "--";
    const confidence = data.confidence ?? "--";

    container.innerHTML = `

        <div class="signal-card">

            <div class="panel-header">

                <div>
                    <h2>AI Trading Decision</h2>
                    <p class="panel-subtitle">
                        XAUUSD Market Intelligence
                    </p>
                </div>

                <span class="signal-direction ${directionClass}">
                    ${direction}
                </span>

            </div>

            <div class="signal-details">

                <div class="signal-detail">
                    <span>ENTRY ZONE</span>
                    <strong>${escapeAnalysisText(entry)}</strong>
                </div>

                <div class="signal-detail">
                    <span>STOP LOSS</span>
                    <strong>${escapeAnalysisText(stopLoss)}</strong>
                </div>

                <div class="signal-detail">
                    <span>TAKE PROFIT</span>
                    <strong>${escapeAnalysisText(takeProfit)}</strong>
                </div>

                <div class="signal-detail">
                    <span>CONFIDENCE</span>
                    <strong>${escapeAnalysisText(confidence)}</strong>
                </div>

            </div>

            <div class="divider"></div>

            <h3 class="section-title">
                AI Market Reasoning
            </h3>

            <p class="analysis-reasoning">
                ${escapeAnalysisText(data.reasoning)}
            </p>

            <div class="divider"></div>

            <p class="text-muted">
                Timeframe:
                ${escapeAnalysisText(data.timeframe || "M15")}
            </p>

            <p class="text-muted">
                Analysis time:
                ${escapeAnalysisText(data.timestamp || "Unavailable")}
            </p>

        </div>

    `;

}

/* ESCAPE TEXT */

function escapeAnalysisText(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

/* ANALYSIS ERROR */

function showAnalysisError(message) {

    const container = document.getElementById(
        "aiAnalysisResult"
    );

    if (!container) return;

    const error = document.createElement("div");

    error.className = "notification";

    const content = document.createElement("p");

    content.className = "text-red";
    content.textContent = message;

    error.appendChild(content);

    container.replaceChildren(error);

}

/* ANALYSIS BUTTON */

document.addEventListener("click", event => {

    const button = event.target.closest(
        "#analyzeButton"
    );

    if (!button) return;

    const timeframe =
        document.getElementById("analysisTimeframe")?.value ||
        "M15";

    requestAIAnalysis({
        timeframe
    });

});

/* EXPORT */

window.RYFX_AI = {

    requestAIAnalysis,

    getState() {
        return { ...RYFX_AI_STATE };
    }

};
