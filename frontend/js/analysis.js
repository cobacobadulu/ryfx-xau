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
    error: null,
    requestId: 0
};

/* REQUEST AI ANALYSIS */

async function requestAIAnalysis(options = {}) {

    if (RYFX_AI_STATE.analyzing) return;

    RYFX_AI_STATE.analyzing = true;
    RYFX_AI_STATE.error = null;

    const requestId = ++RYFX_AI_STATE.requestId;

    const button =
        document.getElementById("runAIAnalysis") ||
        document.getElementById("analyzeButton");

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

                    timeframe: options.timeframe || "M15",

                    analysis_type: options.analysisType || "technical"

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

        const analysis =
            result.data ||
            result.analysis ||
            result;

        validateAnalysis(analysis);

        if (requestId !== RYFX_AI_STATE.requestId) return;

        RYFX_AI_STATE.lastAnalysis = analysis;

        renderAIAnalysis(analysis);

        document.dispatchEvent(
            new CustomEvent("ryfx:analysis-completed", {
                detail: analysis
            })
        );

    } catch (error) {

        if (requestId !== RYFX_AI_STATE.requestId) return;

        console.error("[ryFX AI Analysis]", error);

        RYFX_AI_STATE.error = error.message;

        showAnalysisError(

            error.name === "AbortError"

                ? "Analysis timed out. Please try again."

                : "Unable to analyze market data. Please try again."

        );

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

    if (!data || typeof data !== "object") {

        throw new Error("Invalid AI response");

    }

    const direction = String(
        data.direction || ""
    ).toUpperCase();

    const validDirections = [
        "BUY",
        "SELL",
        "WAIT"
    ];

    if (!validDirections.includes(direction)) {

        throw new Error("Invalid trading direction");

    }

    if (
        typeof data.reasoning !== "string" ||
        !data.reasoning.trim()
    ) {

        throw new Error("Missing analysis reasoning");

    }

    if (direction === "WAIT") return;

    const entry = getNumericPrice(data.entry);

    const stopLoss = getNumericPrice(data.stop_loss);

    const takeProfits = getTakeProfitValues(data);

    if (
        entry === null ||
        stopLoss === null ||
        takeProfits.length === 0
    ) {

        throw new Error("Invalid trading levels");

    }

    if (direction === "BUY") {

        if (stopLoss >= entry) {

            throw new Error("Invalid BUY stop loss");

        }

        if (!takeProfits.some(price => price > entry)) {

            throw new Error("Invalid BUY take profit");

        }

    }

    if (direction === "SELL") {

        if (stopLoss <= entry) {

            throw new Error("Invalid SELL stop loss");

        }

        if (!takeProfits.some(price => price < entry)) {

            throw new Error("Invalid SELL take profit");

        }

    }

}

/* GET NUMERIC PRICE */

function getNumericPrice(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const price = Number(value);

    return Number.isFinite(price) && price > 0
        ? price
        : null;

}

/* GET TAKE PROFIT VALUES */

function getTakeProfitValues(data) {

    const values = [];

    if (Array.isArray(data.take_profits)) {

        values.push(...data.take_profits);

    } else if (data.take_profits) {

        values.push(data.take_profits);

    }

    if (data.take_profit !== undefined) {

        values.push(data.take_profit);

    }

    if (data.tp1 !== undefined) values.push(data.tp1);

    if (data.tp2 !== undefined) values.push(data.tp2);

    if (data.tp3 !== undefined) values.push(data.tp3);

    return values
        .map(value => {

            if (typeof value === "object" && value !== null) {

                return getNumericPrice(
                    value.price ?? value.value
                );

            }

            return getNumericPrice(value);

        })
        .filter(value => value !== null);

}

/* ANALYSIS LOADING */

function setAnalysisLoading(loading, button) {

    if (!button) return;

    button.disabled = loading;

    button.textContent = loading
        ? "Analyzing XAUUSD..."
        : "Run AI Analysis";

}

/* RENDER AI ANALYSIS */

function renderAIAnalysis(data) {

    const direction = String(
        data.direction
    ).toUpperCase();

    const directionClass = {

        BUY: "signal-buy",

        SELL: "signal-sell",

        WAIT: "signal-wait"

    }[direction];

    const entry = data.entry ?? "--";

    const stopLoss = data.stop_loss ?? "--";

    const takeProfits = getTakeProfitValues(data);

    const confidence = data.confidence ?? "--";

    const timeframe = data.timeframe || "M15";

    const timestamp =
        data.timestamp ||
        new Date().toISOString();

    /* DIRECTION */

    setAnalysisText(
        "analysisDirection",
        direction
    );

    /* CONFIDENCE */

    setAnalysisText(
        "analysisConfidence",
        formatConfidence(confidence)
    );

    /* SUMMARY */

    setAnalysisText(
        "analysisSummary",
        data.summary || data.reasoning || "--"
    );

    /* MARKET STRUCTURE */

    setAnalysisText(
        "analysisStructure",
        data.market_structure || data.structure || "--"
    );

    setAnalysisText(
        "analysisBOS",
        data.bos || data.break_of_structure || "--"
    );

    setAnalysisText(
        "analysisLiquidity",
        data.liquidity || "--"
    );

    setAnalysisText(
        "analysisVolatility",
        data.volatility || "--"
    );

    /* TRADE LEVELS */

    setAnalysisText(
        "analysisEntry",
        entry
    );

    setAnalysisText(
        "analysisStopLoss",
        stopLoss
    );

    setAnalysisText(
        "analysisTakeProfit",
        takeProfits.length
            ? takeProfits.join(" / ")
            : "--"
    );

    /* TIMESTAMP */

    setAnalysisText(
        "analysisTimestamp",
        timestamp
    );

    setAnalysisText(
        "analysisTimeframe",
        timeframe
    );

    /* DIRECTION BADGE */

    const directionElement = document.getElementById(
        "analysisDirection"
    );

    if (directionElement) {

        directionElement.classList.remove(
            "signal-buy",
            "signal-sell",
            "signal-wait"
        );

        directionElement.classList.add(
            directionClass
        );

    }

    /* REASONING */

    const reasoningElement = document.getElementById(
        "analysisReasoning"
    );

    if (reasoningElement) {

        reasoningElement.textContent =
            data.reasoning || "--";

    }

    /* RESULT CONTAINER */

    const container = document.getElementById(
        "aiAnalysisResult"
    );

    if (container) {

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
                        ${escapeAnalysisText(direction)}
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
                        <strong>${escapeAnalysisText(
                            takeProfits.length
                                ? takeProfits.join(" / ")
                                : "--"
                        )}</strong>
                    </div>

                    <div class="signal-detail">
                        <span>CONFIDENCE</span>
                        <strong>${escapeAnalysisText(
                            formatConfidence(confidence)
                        )}</strong>
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
                    Timeframe: ${escapeAnalysisText(timeframe)}
                </p>

                <p class="text-muted">
                    Analysis time: ${escapeAnalysisText(timestamp)}
                </p>

            </div>

        `;

    }

}

/* UPDATE TEXT ELEMENT */

function setAnalysisText(id, value) {

    const element = document.getElementById(id);

    if (!element) return;

    element.textContent =
        value === null || value === undefined
            ? "--"
            : String(value);

}

/* FORMAT CONFIDENCE */

function formatConfidence(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "--";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {

        return String(value);

    }

    return `${number}%`;

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

    if (container) {

        const error = document.createElement("div");

        error.className = "notification";

        const content = document.createElement("p");

        content.className = "text-red";

        content.textContent = message;

        error.appendChild(content);

        container.replaceChildren(error);

    }

    setAnalysisText(
        "analysisStatus",
        message
    );

}

/* ANALYSIS BUTTON */

document.addEventListener("click", event => {

    const button = event.target.closest(
        "#runAIAnalysis, #analyzeButton"
    );

    if (!button) return;

    const timeframe =
        document.getElementById("analysisTimeframe")?.value ||
        "M15";

    const analysisType =
        document.getElementById("analysisType")?.value ||
        "technical";

    requestAIAnalysis({

        timeframe,

        analysisType

    });

});

/* EXPORT */

window.RYFX_AI = {

    requestAIAnalysis,

    renderAIAnalysis,

    getState() {

        return { ...RYFX_AI_STATE };

    }

};
