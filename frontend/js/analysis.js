/* =========================================
   ryFX XAU — AI MARKET ANALYSIS
   XAUUSD INTELLIGENCE ENGINE
========================================= */

"use strict";


/* AI CONFIGURATION */

const RYFX_AI_CONFIG = {

    endpoint: "/api/analysis/xauusd",

    symbol: "XAUUSD",

    timeout: 120000 // Dinaikkan jadi 2 menit agar tidak timeout

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
   Mengubah "M15" / "H1" menjadi "15m" / "1h"
========================================= */
function normalizeTimeframe(tf) {
    if (!tf) return "15m";
    
    const upper = String(tf).toUpperCase();
    const map = {
        "M1": "1m",
        "M5": "5m",
        "M15": "15m",
        "M30": "30m",
        "H1": "1h",
        "H4": "4h",
        "D1": "1d"
    };
    
    return map[upper] || upper.toLowerCase();
}


/* REQUEST AI ANALYSIS */

async function requestAIAnalysis(options = {}) {

    if (RYFX_AI_STATE.analyzing) return;


    RYFX_AI_STATE.analyzing = true;

    RYFX_AI_STATE.error = null;


    const requestId =
        ++RYFX_AI_STATE.requestId;


    const button =

        document.getElementById("runAIAnalysis") ||
        document.getElementById("analyzeButton");


    setAnalysisLoading(true, button);

    setAnalysisText(
        "analysisStatus",
        "Analyzing XAUUSD market..."
    );


    const controller = new AbortController();


    const timeout = setTimeout(

        () => controller.abort(),

        RYFX_AI_CONFIG.timeout

    );


    try {

        const apiBase = (window.RYFX_API && window.RYFX_API.BASE_URL) || "";
        
        // Pastikan timeframe yang dikirim sesuai format backend
        const safeTimeframe = normalizeTimeframe(options.timeframe);

        const response = await fetch(

            apiBase + RYFX_AI_CONFIG.endpoint,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",

                    "Accept": "application/json"

                },

                body: JSON.stringify({

                    symbol: RYFX_AI_CONFIG.symbol,

                    timeframe: safeTimeframe,

                    analysis_type:
                        options.analysisType || "technical"

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


        if (requestId !== RYFX_AI_STATE.requestId) {
            return;
        }


        RYFX_AI_STATE.lastAnalysis = analysis;

        RYFX_AI_STATE.error = null;


        renderAIAnalysis(analysis);


        setAnalysisText(
            "analysisStatus",
            "Analysis completed successfully"
        );


        setAnalysisText(
            "analysisTimestamp",
            formatAnalysisTimestamp(
                analysis.timestamp
            )
        );


        document.dispatchEvent(

            new CustomEvent(
                "ryfx:analysis-completed",

                {
                    detail: analysis
                }
            )

        );


    } catch (error) {

        if (requestId !== RYFX_AI_STATE.requestId) {
            return;
        }


        console.error(
            "[ryFX AI Analysis]",
            error
        );


        RYFX_AI_STATE.error = error.message;


        const message =

            error.name === "AbortError"

                ? "Analysis timed out. Please try again."

                : "Unable to analyze market data. Please try again.";


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

        throw new Error(
            "Invalid trading direction"
        );

    }


    if (

        typeof data.reasoning !== "string" ||

        !data.reasoning.trim()

    ) {

        throw new Error(
            "Missing analysis reasoning"
        );

    }


    if (direction === "WAIT") {

        return true;

    }


    const entry = getNumericPrice(data.entry);

    const stopLoss = getNumericPrice(data.stop_loss);

    const takeProfits = getTakeProfitValues(data);


    if (

        entry === null ||

        stopLoss === null ||

        takeProfits.length === 0

    ) {

        throw new Error(
            "Invalid trading levels"
        );

    }


    if (direction === "BUY") {

        if (stopLoss >= entry) {

            throw new Error(
                "Invalid BUY stop loss"
            );

        }


        if (!takeProfits.some(price => price > entry)) {

            throw new Error(
                "Invalid BUY take profit"
            );

        }

    }


    if (direction === "SELL") {

        if (stopLoss <= entry) {

            throw new Error(
                "Invalid SELL stop loss"
            );

        }


        if (!takeProfits.some(price => price < entry)) {

            throw new Error(
                "Invalid SELL take profit"
            );

        }

    }


    return true;

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


    if (data.tp1 !== undefined) {

        values.push(data.tp1);

    }


    if (data.tp2 !== undefined) {

        values.push(data.tp2);

    }


    if (data.tp3 !== undefined) {

        values.push(data.tp3);

    }


    return values

        .map(value => {

            if (
                typeof value === "object" &&
                value !== null
            ) {

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


    const percentage =

        number <= 1 && number >= 0

            ? number * 100

            : number;


    return `${percentage.toFixed(1)}%`;

}


/* FORMAT PRICE */

function formatAnalysisPrice(value) {

    const price = getNumericPrice(value);

    if (price === null) return "--";


    return price.toLocaleString("en-US", {

        minimumFractionDigits: 2,

        maximumFractionDigits: 2

    });

}


/* FORMAT TIMESTAMP */

function formatAnalysisTimestamp(value) {

    if (!value) {

        return new Date().toLocaleString("en-GB");

    }


    const date = new Date(value);


    if (Number.isNaN(date.getTime())) {

        return String(value);

    }


    return date.toLocaleString("en-GB");

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


    const entry =

        direction === "WAIT"

            ? "--"

            : formatAnalysisPrice(data.entry);


    const stopLoss =

        direction === "WAIT"

            ? "--"

            : formatAnalysisPrice(data.stop_loss);


    const takeProfits =

        direction === "WAIT"

            ? []

            : getTakeProfitValues(data);


    const formattedTakeProfits =

        takeProfits.length

            ? takeProfits
                .map(formatAnalysisPrice)
                .join(" / ")

            : "--";


    const confidence = formatConfidence(
        data.confidence
    );


    const timeframe = data.timeframe || "15m";


    const timestamp = formatAnalysisTimestamp(
        data.timestamp
    );


    /* DIRECTION */

    setAnalysisText(
        "analysisDirection",
        direction
    );


    /* CONFIDENCE */

    setAnalysisText(
        "analysisConfidence",
        confidence
    );


    /* SUMMARY */

    setAnalysisText(

        "analysisSummary",

        data.summary || data.reasoning || "--"

    );


    /* MARKET STRUCTURE */

    setAnalysisText(

        "analysisStructure",

        data.market_structure ||
        data.structure ||
        "--"

    );


    setAnalysisText(

        "analysisBOS",

        data.bos ||
        data.break_of_structure ||
        "--"

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
        formattedTakeProfits
    );


    /* TP1/TP2/TP3 untuk halaman ai-analysis.html */

    const tpArray = takeProfits.slice(0, 3);

    const tpIds = ["analysisTP1", "analysisTP2", "analysisTP3"];

    tpIds.forEach((id, index) => {

        setAnalysisText(
            id,
            direction === "WAIT"
                ? "--"
                : formatAnalysisPrice(tpArray[index])
        );

    });


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

    setAnalysisText(

        "analysisReasoning",

        data.reasoning || "--"

    );


    /* RESULT CONTAINER */

    const container = document.getElementById(
        "aiAnalysisResult"
    );


    if (container) {

        container.replaceChildren();


        const card = document.createElement("div");

        card.className = "signal-card";


        const header = document.createElement("div");

        header.className = "panel-header";


        const title = document.createElement("div");


        const heading = document.createElement("h2");

        heading.textContent = "AI Trading Decision";


        const subtitle = document.createElement("p");

        subtitle.className = "panel-subtitle";

        subtitle.textContent =
            "XAUUSD Market Intelligence";


        title.append(heading, subtitle);


        const badge = document.createElement("span");

        badge.className =
            `signal-direction ${directionClass}`;

        badge.textContent = direction;


        header.append(title, badge);


        const details = document.createElement("div");

        details.className = "signal-details";


        const detailItems = [

            ["ENTRY ZONE", entry],

            ["STOP LOSS", stopLoss],

            ["TAKE PROFIT", formattedTakeProfits],

            ["CONFIDENCE", confidence]

        ];


        detailItems.forEach(([label, value]) => {

            const item = document.createElement("div");

            item.className = "signal-detail";


            const span = document.createElement("span");

            span.textContent = label;


            const strong = document.createElement("strong");

            strong.textContent = value;


            item.append(span, strong);

            details.appendChild(item);

        });


        const divider = document.createElement("div");

        divider.className = "divider";


        const reasoningTitle = document.createElement("h3");

        reasoningTitle.className = "section-title";

        reasoningTitle.textContent =
            "AI Market Reasoning";


        const reasoning = document.createElement("p");

        reasoning.className = "analysis-reasoning";

        reasoning.textContent =
            data.reasoning || "--";


        const timestampText = document.createElement("p");

        timestampText.className = "text-muted";

        timestampText.textContent =
            `Timeframe: ${timeframe} | Analysis time: ${timestamp}`;


        card.append(

            header,

            details,

            divider,

            reasoningTitle,

            reasoning,

            timestampText

        );


        container.appendChild(card);

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


    const rawTimeframe =

        document.getElementById("analysisTimeframe")?.value ||
        "M15";

    const timeframe = normalizeTimeframe(rawTimeframe);


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

    validateAnalysis,

    getTakeProfitValues,


    getState() {

        return {

            ...RYFX_AI_STATE

        };

    }

};
