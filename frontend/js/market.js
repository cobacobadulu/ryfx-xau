/* =========================================
   ryFX XAU — LIVE MARKET DATA
   MARKETAPI INTEGRATION
========================================= */

"use strict";


/* MARKET CONFIGURATION */

const RYFX_MARKET_CONFIG = {

    symbol: "XAUUSD",

    endpoint: "/api/market/xauusd",

    refreshInterval: 1000,

    decimals: 2

};


/* MARKET STATE */

const RYFX_MARKET_STATE = {

    connected: false,
    loading: false,

    lastPrice: null,
    currentPrice: null,
    previousPrice: null,

    bid: null,
    ask: null,
    spread: null,

    dailyChange: null,
    dailyChangePercent: null,

    high: null,
    low: null,
    open: null,
    volume: null,

    marketStatus: "UNKNOWN",
    isLive: false,

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

    return Number.isFinite(number)
        ? number
        : null;

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

        const apiBase = (window.RYFX_API && window.RYFX_API.BASE_URL) || "";

const response = await fetch(
    apiBase + RYFX_MARKET_CONFIG.endpoint,
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

        if (
            !result ||
            result.success !== true ||
            !result.data
        ) {

            throw new Error(
                "Invalid market API response"
            );

        }

        updateMarketData(result.data);

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

    const price = marketNumber(data.price);

    if (price === null || price <= 0) {

        throw new Error("Invalid XAUUSD price");

    }

    const previous = RYFX_MARKET_STATE.currentPrice;

    RYFX_MARKET_STATE.previousPrice = previous;

    RYFX_MARKET_STATE.currentPrice = price;

    RYFX_MARKET_STATE.lastPrice = price;


    /* BID / ASK / SPREAD */

    RYFX_MARKET_STATE.bid =
        marketNumber(data.bid);

    RYFX_MARKET_STATE.ask =
        marketNumber(data.ask);

    RYFX_MARKET_STATE.spread =
        marketNumber(data.spread);


    /* DAILY STATISTICS */

    const open = marketNumber(data.open);

    const change = marketNumber(data.change);

    const changePercent = marketNumber(
        data.change_percent
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


    Object.entries(statistics).forEach(
        ([key, value]) => {

            RYFX_MARKET_STATE[key] = value;

        }
    );


    /* MARKET STATUS */

    RYFX_MARKET_STATE.marketStatus =
        data.status || "UNKNOWN";

    RYFX_MARKET_STATE.isLive =
        data.is_live === true;


    /* LAST UPDATE */

    RYFX_MARKET_STATE.lastUpdate =
        data.timestamp
            ? new Date(data.timestamp)
            : new Date();


    updatePriceDisplay();

    updateBidAskDisplay();

    updateSpreadDisplay();

    updateMarketStatistics(
        RYFX_MARKET_STATE
    );

    updateMarketChangeDisplay();

    updateMarketDataStatus();

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

    const price =
        RYFX_MARKET_STATE.currentPrice;

    if (price === null) return;

    const selectors = [

        "#currentPrice",
        "#goldPrice",
        "#liveGoldPrice",
        "[data-market-price]"

    ];

    selectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(
            element => {

                element.textContent =
                    marketFormatPrice(price);

            }
        );

    });

    updatePriceChangeDisplay();

}


/* BID / ASK DISPLAY */

function updateBidAskDisplay() {

    const values = {

        bid: RYFX_MARKET_STATE.bid,

        ask: RYFX_MARKET_STATE.ask

    };

    Object.entries(values).forEach(
        ([key, value]) => {

            const selectors = [

                `#market${key.charAt(0).toUpperCase() + key.slice(1)}`,

                `[data-market-${key}]`

            ];

            selectors.forEach(selector => {

                document.querySelectorAll(selector).forEach(
                    element => {

                        element.textContent =
                            marketFormatPrice(value);

                    }
                );

            });

        }
    );

}


/* SPREAD DISPLAY */

function updateSpreadDisplay() {

    const spread =
        RYFX_MARKET_STATE.spread;

    const selectors = [

        "#marketSpread",
        "[data-market-spread]"

    ];

    selectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(
            element => {

                element.textContent =
                    spread === null
                        ? "--"
                        : marketFormatPrice(spread);

            }
        );

    });

}


/* PRICE CHANGE DISPLAY */

function updatePriceChangeDisplay() {

    const change =
        RYFX_MARKET_STATE.dailyChange;

    const percentage =
        RYFX_MARKET_STATE.dailyChangePercent;

    const selectors = [

        "#priceChange",
        "#goldChange",
        "#liveGoldChange",
        "[data-market-change]"

    ];

    const percentSelectors = [

        "#goldChangePercent",
        "#liveGoldChangePercent"

    ];

    if (change === null) {

        [...selectors, ...percentSelectors].forEach(
            selector => {

                document.querySelectorAll(selector).forEach(
                    element => {

                        element.textContent = "--";

                        element.classList.remove(
                            "price-up",
                            "price-down"
                        );

                    }
                );

            }
        );

        return;

    }

    const positive = change >= 0;

    const formattedChange =
        `${positive ? "+" : ""}${marketFormatPrice(change)}`;

    const formattedPercent =
        percentage !== null
            ? ` (${positive ? "+" : ""}${percentage.toFixed(2)}%)`
            : "";


    selectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(
            element => {

                element.textContent =
                    formattedChange + formattedPercent;

                element.classList.toggle(
                    "price-up",
                    positive
                );

                element.classList.toggle(
                    "price-down",
                    !positive
                );

            }
        );

    });


    percentSelectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(
            element => {

                element.textContent =
                    percentage === null
                        ? "--"
                        : `${positive ? "+" : ""}${percentage.toFixed(2)}%`;

                element.classList.toggle(
                    "price-up",
                    positive
                );

                element.classList.toggle(
                    "price-down",
                    !positive
                );

            }
        );

    });

}


/* MARKET CHANGE CARD */

function updateMarketChangeDisplay() {

    const element =
        document.getElementById("marketChange");

    if (!element) return;

    const percentage =
        RYFX_MARKET_STATE.dailyChangePercent;

    if (percentage === null) {

        element.textContent = "--";

        element.classList.remove(
            "price-up",
            "price-down"
        );

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

    Object.entries(selectors).forEach(
        ([key, targets]) => {

            const value = marketNumber(data[key]);

            targets.forEach(selector => {

                document.querySelectorAll(selector).forEach(
                    element => {

                        element.textContent =
                            value === null
                                ? "--"
                                : key === "volume"
                                    ? value.toLocaleString("en-US")
                                    : marketFormatPrice(value);

                    }
                );

            });

        }
    );

}


/* MARKET DATA STATUS */

function updateMarketDataStatus() {

    const status =
        RYFX_MARKET_STATE.marketStatus;

    const isLive =
        RYFX_MARKET_STATE.isLive;

    const label = isLive
        ? "LIVE MARKET"
        : status === "DELAYED"
            ? "DELAYED MARKET"
            : status === "CLOSED"
                ? "MARKET CLOSED"
                : "MARKET CONNECTED";

    const selectors = [

        "#marketDataStatus",
        "[data-market-data-status]"

    ];

    selectors.forEach(selector => {

        document.querySelectorAll(selector).forEach(
            element => {

                element.textContent = label;

            }
        );

    });

}


/* MARKET CONNECTION STATUS */

function updateMarketConnection(connected) {

    const wasConnected =
        RYFX_MARKET_STATE.connected;

    RYFX_MARKET_STATE.connected = connected;


    const statusElements = document.querySelectorAll(
        "#marketStatus, [data-market-status]"
    );

    statusElements.forEach(element => {

        element.textContent = connected
            ? "MARKET ONLINE"
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


    const topbarStatus =
        document.getElementById("topbarMarketStatus");

    if (topbarStatus) {

        topbarStatus.textContent = connected
            ? "Market Online"
            : "Market Offline";

    }


    if (typeof RYFX_STATE !== "undefined") {

        RYFX_STATE.marketConnected = connected;

    }


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

        document.querySelectorAll(selector).forEach(
            element => {

                element.textContent =
                    RYFX_MARKET_STATE.lastUpdate.toLocaleTimeString(
                        "en-GB"
                    );

            }
        );

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

document.addEventListener(
    "ryfx:app-ready",
    () => {

        if (!document.hidden) {

            startMarketUpdates();

        }

    }
);


/* TAB VISIBILITY */

document.addEventListener(
    "visibilitychange",
    () => {

        if (document.hidden) {

            stopMarketUpdates();

        } else {

            startMarketUpdates();

        }

    }
);


/* PAGE RELOAD SUPPORT */

document.addEventListener(
    "ryfx:page-loaded",
    () => {

        if (RYFX_MARKET_STATE.currentPrice !== null) {

            updatePriceDisplay();

            updateBidAskDisplay();

            updateSpreadDisplay();

            updateMarketStatistics(
                RYFX_MARKET_STATE
            );

            updateMarketChangeDisplay();

            updateMarketDataStatus();

            updateLastMarketUpdate();

        }

        updateMarketConnection(
            RYFX_MARKET_STATE.connected
        );

    }
);


/* EXPORT */

window.RYFX_MARKET = {

    fetchMarketData,

    updateMarketData,

    updatePriceDisplay,

    updateBidAskDisplay,

    updateSpreadDisplay,

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
