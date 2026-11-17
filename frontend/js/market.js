/* =========================================
   ryFX XAU — LIVE MARKET DATA
   XAUUSD MARKET CONNECTION
========================================= */

"use strict";


/* MARKET CONFIGURATION */

const RYFX_MARKET_CONFIG = {

    symbol: "XAUUSD",

    // Backend API endpoint
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


        RYFX_MARKET_STATE.connected = true;

        RYFX_MARKET_STATE.error = null;


        updateMarketConnection(true);


    } catch (error) {

        console.error("[ryFX Market]", error);


        RYFX_MARKET_STATE.connected = false;

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


    const price = Number(
        data.price ?? data.close
    );


    if (!Number.isFinite(price) || price <= 0) {

        throw new Error("Invalid XAUUSD price");

    }


    const previous = RYFX_MARKET_STATE.currentPrice;


    RYFX_MARKET_STATE.previousPrice = previous;

    RYFX_MARKET_STATE.currentPrice = price;

    RYFX_MARKET_STATE.lastPrice = price;


    /* DAILY CHANGE */

    const change = Number(
        data.change
    );

    const changePercent = Number(
        data.change_percent ?? data.changePercent
    );


    if (Number.isFinite(change)) {

        RYFX_MARKET_STATE.dailyChange = change;

    } else if (Number.isFinite(Number(data.open))) {

        RYFX_MARKET_STATE.dailyChange =
            price - Number(data.open);

    }


    if (Number.isFinite(changePercent)) {

        RYFX_MARKET_STATE.dailyChangePercent =
            changePercent;

    } else if (
        Number.isFinite(Number(data.open)) &&
        Number(data.open) > 0
    ) {

        RYFX_MARKET_STATE.dailyChangePercent =
            ((price - Number(data.open)) /
                Number(data.open)) * 100;

    }


    /* MARKET STATISTICS */

    ["high", "low", "open", "volume"].forEach(key => {

        const value = Number(data[key]);

        if (Number.isFinite(value)) {

            RYFX_MARKET_STATE[key] = value;

        }

    });


    RYFX_MARKET_STATE.lastUpdate = new Date();


    updatePriceDisplay();

    updateMarketStatistics(data);

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


    const priceSelectors = [

        "#currentPrice",

        "#goldPrice",

        "#liveGoldPrice",

        "[data-market-price]"

    ];


    priceSelectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(element => {

            element.textContent = formatPrice(
                price,
                RYFX_MARKET_CONFIG.decimals
            );

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
        `${positive ? "+" : ""}${formatPrice(change)}`;


    const formattedPercent =
        Number.isFinite(percentage)
            ? ` (${positive ? "+" : ""}${percentage.toFixed(2)}%)`
            : "";


    const text = formattedChange + formattedPercent;


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

            if (Number.isFinite(percentage)) {

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


/* MARKET STATISTICS */

function updateMarketStatistics(data = {}) {

    const fields = {

        open: data.open,

        high: data.high,

        low: data.low,

        volume: data.volume

    };


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


    Object.entries(fields).forEach(([key, value]) => {

        if (
            value === undefined ||
            value === null ||
            !Number.isFinite(Number(value))
        ) return;


        selectors[key].forEach(selector => {

            document.querySelectorAll(selector).forEach(element => {

                element.textContent =
                    key === "volume"
                        ? Number(value).toLocaleString("en-US")
                        : formatPrice(value);

            });

        });

    });

}


/* MARKET CONNECTION STATUS */

function updateMarketConnection(connected) {

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


    RYFX_STATE.marketConnected = connected;

}


/* LAST UPDATE */

function updateLastMarketUpdate() {

    const selectors = [

        "#marketLastUpdate",

        "#liveLastUpdate"

    ];


    if (!RYFX_MARKET_STATE.lastUpdate) return;


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

    startMarketUpdates();

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

        updateMarketStatistics(
            RYFX_MARKET_STATE
        );

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

    startMarketUpdates,

    stopMarketUpdates,


    getState() {

        return {
            ...RYFX_MARKET_STATE
        };

    }

};
