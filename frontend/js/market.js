/* =========================================
   ryFX XAU — LIVE MARKET DATA
   XAUUSD MARKET CONNECTION
========================================= */

"use strict";


/* MARKET CONFIGURATION */

const RYFX_MARKET_CONFIG = {

    symbol: "XAUUSD",

    endpoint: "/api/market/xauusd",

    refreshInterval: 30000,

    decimals: 2

};


/* MARKET STATE */

const RYFX_MARKET_STATE = {

    connected: false,
    loading: false,

    lastPrice: null,
    currentPrice: null,
    previousPrice: null,

    dailyChange: null,
    dailyChangePercent: null,

    high: null,
    low: null,
    open: null,
    volume: null,

    lastUpdate: null,
    error: null

};


let marketRefreshTimer = null;


/* SAFE NUMBER */

function marketNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;

}


/* FORMAT PRICE */

function marketFormatPrice(value) {

    const number = marketNumber(value);

    if (number === null) return "--";

    if (typeof formatPrice === "function") {

        return formatPrice(
            number,
            RYFX_MARKET_CONFIG.decimals
        );

    }

    return number.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}


/* FETCH MARKET DATA */

async function fetchMarketData() {

    if (RYFX_MARKET_STATE.loading) return;

    RYFX_MARKET_STATE.loading = true;

    try {

        const response = await fetch(
            RYFX_MARKET_CONFIG.endpoint,
            {
                method: "GET",

                headers: {
                    "Accept": "application/json"
                },

                cache: "no-store"
            }
        );


        if (!response.ok) {

            throw new Error(
                `Market API Error: ${response.status}`
            );

        }


        const result = await response.json();

        const data = result.data || result;


        updateMarketData(data);


        RYFX_MARKET_STATE.error = null;

        updateMarketConnection(true);


    } catch (error) {

        console.error("[ryFX Market]", error);

        RYFX_MARKET_STATE.error = error.message;

        updateMarketConnection(false);


        document.dispatchEvent(
            new CustomEvent("ryfx:market-error", {
                detail: {
                    message: error.message
                }
            })
        );


    } finally {

        RYFX_MARKET_STATE.loading = false;

    }

}


/* UPDATE MARKET DATA */

function updateMarketData(data) {

    if (!data || typeof data !== "object") {

        throw new Error("Invalid market data");

    }


    const price = marketNumber(
        data.price ??
        data.close ??
        data.last
    );


    if (price === null || price <= 0) {

        throw new Error("Invalid XAUUSD price");

    }


    const previous = RYFX_MARKET_STATE.currentPrice;


    RYFX_MARKET_STATE.previousPrice = previous;

    RYFX_MARKET_STATE.currentPrice = price;

    RYFX_MARKET_STATE.lastPrice = price;


    /* DAILY STATISTICS */

    const open = marketNumber(data.open);

    const change = marketNumber(
        data.change ??
        data.daily_change
    );

    const changePercent = marketNumber(
        data.change_percent ??
        data.changePercent ??
        data.daily_change_percent
    );


    if (change !== null) {

        RYFX_MARKET_STATE.dailyChange = change;

    } else if (open !== null && open > 0) {

        RYFX_MARKET_STATE.dailyChange =
            price - open;

    }


    if (changePercent !== null) {

        RYFX_MARKET_STATE.dailyChangePercent =
            changePercent;

    } else if (open !== null && open > 0) {

        RYFX_MARKET_STATE.dailyChangePercent =
            ((price - open) / open) * 100;

    }


    /* MARKET STATISTICS */

    const statistics = {

        high: marketNumber(data.high),

        low: marketNumber(data.low),

        open,

        volume: marketNumber(data.volume)

    };


    Object.entries(statistics).forEach(([key, value]) => {

        if (value !== null) {

            RYFX_MARKET_STATE[key] = value;

        }

    });


    RYFX_MARKET_STATE.lastUpdate = new Date();


    updatePriceDisplay();

    updateMarketStatistics(RYFX_MARKET_STATE);

    updateMarketChangeDisplay();

    updateLastMarketUpdate();


    document.dispatchEvent(
        new CustomEvent("ryfx:market-updated", {

            detail: {

                symbol: RYFX_MARKET_CONFIG.symbol,

                price,

                previousPrice: previous,

                data

            }

        })
    );

}


/* PRICE DISPLAY */

function updatePriceDisplay() {

    const price = RYFX_MARKET_STATE.currentPrice;

    if (price === null) return;


    const selectors = [

        "#currentPrice",
        "#goldPrice",
        "#liveGoldPrice",
        "[data-market-price]"

    ];


    selectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(element => {

            element.textContent =
                marketFormatPrice(price);

        });

    });


    updatePriceChangeDisplay();

}


/* PRICE CHANGE DISPLAY */

function updatePriceChangeDisplay() {

    const change = RYFX_MARKET_STATE.dailyChange;

    const percentage =
        RYFX_MARKET_STATE.dailyChangePercent;


    if (change === null) return;


    const positive = change >= 0;


    const formattedChange =
        `${positive ? "+" : ""}${marketFormatPrice(change)}`;


    const formattedPercent =
        percentage !== null
            ? ` (${positive ? "+" : ""}${percentage.toFixed(2)}%)`
            : "";


    const text =
        formattedChange + formattedPercent;


    const selectors = [

        "#priceChange",
        "#goldChange",
        "#liveGoldChange",
        "[data-market-change]"

    ];


    selectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(element => {

            element.textContent = text;

            element.classList.toggle(
                "price-up",
                positive
            );

            element.classList.toggle(
                "price-down",
                !positive
            );

        });

    });


    const percentSelectors = [

        "#goldChangePercent",
        "#liveGoldChangePercent"

    ];


    percentSelectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(element => {

            if (percentage !== null) {

                element.textContent =
                    `${positive ? "+" : ""}${percentage.toFixed(2)}%`;

            }

            element.classList.toggle(
                "price-up",
                positive
            );

            element.classList.toggle(
                "price-down",
                !positive
            );

        });

    });

}


/* MARKET CHANGE CARD */

function updateMarketChangeDisplay() {

    const element = document.getElementById("marketChange");

    if (!element) return;


    const percentage =
        RYFX_MARKET_STATE.dailyChangePercent;

    if (percentage === null) {

        element.textContent = "--";

        return;

    }


    const positive = percentage >= 0;


    element.textContent =
        `${positive ? "+" : ""}${percentage.toFixed(2)}%`;


    element.classList.toggle(
        "price-up",
        positive
    );

    element.classList.toggle(
        "price-down",
        !positive
    );

}


/* MARKET STATISTICS */

function updateMarketStatistics(data = {}) {

    const selectors = {

        open: [
            "[data-market-open]",
            "#dailyOpen",
            "#liveDailyOpen"
        ],

        high: [
            "[data-market-high]",
            "#dailyHigh",
            "#liveDailyHigh"
        ],

        low: [
            "[data-market-low]",
            "#dailyLow",
            "#liveDailyLow"
        ],

        volume: [
            "[data-market-volume]"
        ]

    };


    Object.entries(selectors).forEach(([key, targets]) => {

        const value = marketNumber(data[key]);

        if (value === null) return;


        targets.forEach(selector => {

            document.querySelectorAll(selector).forEach(element => {

                element.textContent =
                    key === "volume"
                        ? value.toLocaleString("en-US")
                        : marketFormatPrice(value);

            });

        });

    });

}


/* MARKET CONNECTION STATUS */

function updateMarketConnection(connected) {

    const wasConnected =
        RYFX_MARKET_STATE.connected;

    RYFX_MARKET_STATE.connected = connected;


    /* DASHBOARD STATUS */

    const statusElements = document.querySelectorAll(
        "#marketStatus, [data-market-status]"
    );


    statusElements.forEach(element => {

        element.textContent = connected
            ? "LIVE MARKET"
            : "MARKET DISCONNECTED";


        element.classList.toggle(
            "connected",
            connected
        );

        element.classList.toggle(
            "disconnected",
            !connected
        );

    });


    /* STATUS INDICATORS */

    const indicators = document.querySelectorAll(
        ".market-status .status-indicator, #topbarMarketIndicator"
    );


    indicators.forEach(element => {

        element.classList.toggle(
            "connected",
            connected
        );

        element.classList.toggle(
            "offline",
            !connected
        );

        element.classList.toggle(
            "disconnected",
            !connected
        );

    });


    /* TOPBAR STATUS */

    const topbarStatus =
        document.getElementById("topbarMarketStatus");

    if (topbarStatus) {

        topbarStatus.textContent = connected
            ? "Market Online"
            : "Market Offline";

    }


    /* GLOBAL STATE */

    if (typeof RYFX_STATE !== "undefined") {

        RYFX_STATE.marketConnected = connected;

    }


    /* CONNECTION EVENTS */

    if (connected && !wasConnected) {

        document.dispatchEvent(
            new CustomEvent("ryfx:market-connected")
        );

    } else if (!connected && wasConnected) {

        document.dispatchEvent(
            new CustomEvent("ryfx:market-disconnected")
        );

    }

}


/* LAST UPDATE */

function updateLastMarketUpdate() {

    if (!RYFX_MARKET_STATE.lastUpdate) return;


    const selectors = [

        "#marketLastUpdate",
        "#liveLastUpdate"

    ];


    selectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(element => {

            element.textContent =
                RYFX_MARKET_STATE.lastUpdate.toLocaleTimeString(
                    "en-GB"
                );

        });

    });

}


/* START MARKET UPDATES */

function startMarketUpdates() {

    stopMarketUpdates();

    fetchMarketData();


    marketRefreshTimer = setInterval(
        fetchMarketData,
        RYFX_MARKET_CONFIG.refreshInterval
    );

}


/* STOP MARKET UPDATES */

function stopMarketUpdates() {

    if (marketRefreshTimer !== null) {

        clearInterval(marketRefreshTimer);

        marketRefreshTimer = null;

    }

}


/* APPLICATION INITIALIZATION */

document.addEventListener("ryfx:app-ready", () => {

    if (!document.hidden) {

        startMarketUpdates();

    }

});


/* TAB VISIBILITY */

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {

        stopMarketUpdates();

    } else {

        startMarketUpdates();

    }

});


/* PAGE RELOAD SUPPORT */

document.addEventListener("ryfx:page-loaded", () => {

    if (RYFX_MARKET_STATE.currentPrice !== null) {

        updatePriceDisplay();

        updateMarketStatistics(RYFX_MARKET_STATE);

        updateMarketChangeDisplay();

        updateLastMarketUpdate();

    }


    updateMarketConnection(
        RYFX_MARKET_STATE.connected
    );

});


/* EXPORT */

window.RYFX_MARKET = {

    fetchMarketData,

    updateMarketData,

    updatePriceDisplay,

    updateMarketStatistics,

    updateMarketConnection,

    startMarketUpdates,

    stopMarketUpdates,


    getState() {

        return {
            ...RYFX_MARKET_STATE
        };

    }

};
