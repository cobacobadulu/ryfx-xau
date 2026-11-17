/* =========================================
   ryFX XAU — LIVE MARKET DATA
   XAUUSD MARKET CONNECTION
========================================= */

"use strict";

/* MARKET CONFIGURATION */

const RYFX_MARKET_CONFIG = {
    symbol: "XAUUSD",

    // Akan dihubungkan ke backend ryFX XAU.
    // Jangan memasukkan API KEY di frontend.
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
            throw new Error(`Market API Error: ${response.status}`);
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
    RYFX_MARKET_STATE.lastUpdate = new Date();

    updatePriceDisplay(price, previous);

    updateMarketStatistics(data);

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

function updatePriceDisplay(price, previous) {

    const priceElements = [
        "#currentPrice",
        "[data-market-price]"
    ];

    priceElements.forEach(selector => {

        document.querySelectorAll(selector).forEach(element => {

            element.textContent = formatPrice(
                price,
                RYFX_MARKET_CONFIG.decimals
            );

        });

    });

    const changeElement = document.querySelector(
        "#priceChange"
    );

    if (!changeElement || previous === null) return;

    const difference = price - previous;

    const percentage = (difference / previous) * 100;

    const positive = difference >= 0;

    changeElement.textContent =
        `${positive ? "+" : ""}${formatPrice(difference)} (${percentage.toFixed(2)}%)`;

    changeElement.classList.toggle("price-up", positive);
    changeElement.classList.toggle("price-down", !positive);

}

/* MARKET STATISTICS */

function updateMarketStatistics(data) {

    const fields = {
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume
    };

    Object.entries(fields).forEach(([key, value]) => {

        if (value === undefined || value === null) return;

        const element = document.querySelector(
            `[data-market-${key}]`
        );

        if (element) {

            element.textContent =
                key === "volume"
                    ? Number(value).toLocaleString("en-US")
                    : formatPrice(value);

        }

    });

}

/* CONNECTION STATUS */

function updateMarketConnection(connected) {

    const statusElements = document.querySelectorAll(
        "#marketStatus, [data-market-status]"
    );

    statusElements.forEach(element => {

        element.textContent = connected
            ? "LIVE MARKET"
            : "MARKET DISCONNECTED";

        element.classList.toggle("connected", connected);
        element.classList.toggle("disconnected", !connected);

    });

    RYFX_STATE.marketConnected = connected;

}

/* LAST UPDATE */

function updateLastMarketUpdate() {

    const element = document.querySelector(
        "#marketLastUpdate"
    );

    if (!element || !RYFX_MARKET_STATE.lastUpdate) return;

    element.textContent =
        RYFX_MARKET_STATE.lastUpdate.toLocaleTimeString("en-GB");

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

/* INITIALIZATION */

document.addEventListener("ryfx:app-ready", () => {

    startMarketUpdates();

});

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {

        stopMarketUpdates();

    } else {

        startMarketUpdates();

    }

});

/* PAGE RELOAD SUPPORT */

document.addEventListener("ryfx:page-loaded", () => {

    const price = RYFX_MARKET_STATE.currentPrice;

    if (price !== null) {

        updatePriceDisplay(
            price,
            RYFX_MARKET_STATE.previousPrice
        );

    }

    updateMarketConnection(
        RYFX_MARKET_STATE.connected
    );

    updateLastMarketUpdate();

});

/* EXPORT */

window.RYFX_MARKET = {

    fetchMarketData,
    updateMarketData,
    startMarketUpdates,
    stopMarketUpdates,

    getState() {
        return { ...RYFX_MARKET_STATE };
    }

};
