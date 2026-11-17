/* =========================================
   ryFX XAU — CHART ENGINE
   TradingView Lightweight Charts
========================================= */

"use strict";

/* CHART CONFIGURATION */

const RYFX_CHART_CONFIG = {
    libraryUrl:
        "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js",

    candleEndpoint: "/api/market/candles",

    symbol: "XAUUSD",

    defaultTimeframe: "15",

    timeframes: {
        "1": "1m",
        "5": "5m",
        "15": "15m",
        "30": "30m",
        "60": "1h",
        "240": "4h",
        "D": "1d"
    }
};

/* CHART STATE */

const RYFX_CHART_STATE = {
    chart: null,
    candleSeries: null,
    currentTimeframe: "15",
    loading: false,
    libraryLoaded: false,
    resizeObserver: null,
    requestId: 0,
    activeContainer: null
};

/* LOAD CHART LIBRARY */

function loadChartLibrary() {

    return new Promise((resolve, reject) => {

        if (window.LightweightCharts) {
            RYFX_CHART_STATE.libraryLoaded = true;
            resolve();
            return;
        }

        const existingScript = document.querySelector(
            'script[data-ryfx-chart-library]'
        );

        if (existingScript) {

            existingScript.addEventListener(
                "load",
                () => resolve(),
                { once: true }
            );

            existingScript.addEventListener(
                "error",
                () => reject(
                    new Error("Unable to load chart library")
                ),
                { once: true }
            );

            return;
        }

        const script = document.createElement("script");

        script.src = RYFX_CHART_CONFIG.libraryUrl;
        script.async = true;
        script.dataset.ryfxChartLibrary = "true";

        script.onload = () => {

            if (window.LightweightCharts) {

                RYFX_CHART_STATE.libraryLoaded = true;
                resolve();

            } else {

                reject(
                    new Error("Chart library unavailable")
                );

            }

        };

        script.onerror = () => {

            reject(
                new Error("Unable to load chart library")
            );

        };

        document.head.appendChild(script);

    });

}

/* GET CHART CONTAINER */

function getChartContainer() {

    return (
        document.getElementById("xauusdChart") ||
        document.getElementById("xauChart")
    );

}

/* CLEANUP CHART */

function destroyChart() {

    RYFX_CHART_STATE.requestId++;

    if (RYFX_CHART_STATE.resizeObserver) {

        RYFX_CHART_STATE.resizeObserver.disconnect();

        RYFX_CHART_STATE.resizeObserver = null;

    }

    if (RYFX_CHART_STATE.chart) {

        RYFX_CHART_STATE.chart.remove();

        RYFX_CHART_STATE.chart = null;

    }

    RYFX_CHART_STATE.candleSeries = null;
    RYFX_CHART_STATE.activeContainer = null;
    RYFX_CHART_STATE.loading = false;

}

/* INITIALIZE CHART */

async function initializeChart() {

    const container = getChartContainer();

    if (!container) return;

    destroyChart();

    RYFX_CHART_STATE.activeContainer = container;

    try {

        await loadChartLibrary();

        if (
            !container.isConnected ||
            RYFX_CHART_STATE.activeContainer !== container
        ) {
            return;
        }

        const chartLibrary = window.LightweightCharts;

        RYFX_CHART_STATE.chart =
            chartLibrary.createChart(container, {

                width: container.clientWidth || 600,

                height: container.clientHeight || 380,

                layout: {
                    background: {
                        color: "#0B1422"
                    },

                    textColor: "#8290A5",

                    fontFamily: "Inter, sans-serif"
                },

                grid: {
                    vertLines: {
                        color: "rgba(255,255,255,0.04)"
                    },

                    horzLines: {
                        color: "rgba(255,255,255,0.04)"
                    }
                },

                crosshair: {
                    mode: chartLibrary.CrosshairMode.Normal
                },

                rightPriceScale: {
                    borderColor: "rgba(255,255,255,0.08)"
                },

                timeScale: {
                    borderColor: "rgba(255,255,255,0.08)",
                    timeVisible: true,
                    secondsVisible: false
                },

                handleScroll: true,
                handleScale: true

            });

        RYFX_CHART_STATE.candleSeries =
            RYFX_CHART_STATE.chart.addSeries(
                chartLibrary.CandlestickSeries,
                {

                    upColor: "#22C997",
                    downColor: "#F05B68",

                    borderUpColor: "#22C997",
                    borderDownColor: "#F05B68",

                    wickUpColor: "#22C997",
                    wickDownColor: "#F05B68"

                }
            );

        observeChartResize(container);

        updateTimeframeButtons();

        await loadCandles(
            RYFX_CHART_STATE.currentTimeframe
        );

        console.log("[ryFX Chart] Initialized");

    } catch (error) {

        console.error("[ryFX Chart]", error);

        showChartError(
            "Chart library could not be loaded."
        );

    }

}

/* NORMALIZE CANDLE TIME */

function normalizeCandleTime(value) {

    if (typeof value === "string" && !/^\d+$/.test(value)) {

        const parsed = Math.floor(
            new Date(value).getTime() / 1000
        );

        return Number.isFinite(parsed) ? parsed : NaN;

    }

    let time = Number(value);

    if (!Number.isFinite(time)) return NaN;

    // Convert milliseconds to seconds.

    if (time > 100000000000) {
        time = Math.floor(time / 1000);
    }

    return Math.floor(time);

}

/* LOAD CANDLE DATA */

async function loadCandles(timeframe) {

    if (!RYFX_CHART_STATE.candleSeries) return;

    if (!RYFX_CHART_CONFIG.timeframes[timeframe]) return;

    const requestId = ++RYFX_CHART_STATE.requestId;

    RYFX_CHART_STATE.loading = true;

    try {

        const params = new URLSearchParams({

            symbol: RYFX_CHART_CONFIG.symbol,

            timeframe:
                RYFX_CHART_CONFIG.timeframes[timeframe]

        });

        const response = await fetch(
            `${RYFX_CHART_CONFIG.candleEndpoint}?${params}`
        );

        if (!response.ok) {

            throw new Error(`HTTP ${response.status}`);

        }

        const result = await response.json();

        // Ignore outdated requests.

        if (requestId !== RYFX_CHART_STATE.requestId) {
            return;
        }

        const candles =
            result.data ||
            result.candles ||
            result;

        if (!Array.isArray(candles)) {

            throw new Error("Invalid candle response");

        }

        const validCandles = candles

            .map(candle => ({

                time: normalizeCandleTime(candle.time),

                open: Number(candle.open),

                high: Number(candle.high),

                low: Number(candle.low),

                close: Number(candle.close)

            }))

            .filter(candle =>

                Number.isFinite(candle.time) &&

                Number.isFinite(candle.open) &&

                Number.isFinite(candle.high) &&

                Number.isFinite(candle.low) &&

                Number.isFinite(candle.close) &&

                candle.time > 0 &&

                candle.high >= candle.low &&

                candle.high >= candle.open &&

                candle.high >= candle.close &&

                candle.low <= candle.open &&

                candle.low <= candle.close

            )

            .sort((a, b) => a.time - b.time);

        const uniqueCandles = [

            ...new Map(

                validCandles.map(candle => [
                    candle.time,
                    candle
                ])

            ).values()

        ];

        if (!uniqueCandles.length) {

            throw new Error("No valid candle data");

        }

        if (
            requestId !== RYFX_CHART_STATE.requestId ||
            !RYFX_CHART_STATE.candleSeries
        ) {
            return;
        }

        RYFX_CHART_STATE.candleSeries.setData(
            uniqueCandles
        );

        RYFX_CHART_STATE.chart
            .timeScale()
            .fitContent();

        console.log(
            "[ryFX Chart] Candles loaded:",
            uniqueCandles.length
        );

    } catch (error) {

        if (requestId !== RYFX_CHART_STATE.requestId) {
            return;
        }

        console.error("[ryFX Chart Data]", error);

        showChartError(
            "Unable to load XAUUSD candle data."
        );

    } finally {

        if (requestId === RYFX_CHART_STATE.requestId) {

            RYFX_CHART_STATE.loading = false;

        }

    }

}

/* CHANGE TIMEFRAME */

function changeChartTimeframe(timeframe) {

    if (!RYFX_CHART_CONFIG.timeframes[timeframe]) {
        return;
    }

    if (!RYFX_CHART_STATE.candleSeries) {
        return;
    }

    RYFX_CHART_STATE.currentTimeframe = timeframe;

    updateTimeframeButtons();

    loadCandles(timeframe);

}

/* UPDATE TIMEFRAME BUTTONS */

function updateTimeframeButtons() {

    document.querySelectorAll("[data-timeframe]")
        .forEach(button => {

            button.classList.toggle(

                "active",

                button.dataset.timeframe ===
                    RYFX_CHART_STATE.currentTimeframe

            );

        });

}

/* CHART RESIZE */

function observeChartResize(container) {

    if (typeof ResizeObserver === "undefined") return;

    if (RYFX_CHART_STATE.resizeObserver) {

        RYFX_CHART_STATE.resizeObserver.disconnect();

    }

    RYFX_CHART_STATE.resizeObserver =
        new ResizeObserver(entries => {

            if (!RYFX_CHART_STATE.chart) return;

            const entry = entries[0];

            if (!entry) return;

            const width = entry.contentRect.width;

            const height = entry.contentRect.height;

            if (width <= 0 || height <= 0) return;

            RYFX_CHART_STATE.chart.applyOptions({

                width,
                height

            });

        });

    RYFX_CHART_STATE.resizeObserver.observe(container);

}

/* FULLSCREEN */

function toggleChartFullscreen() {

    const container =
        document.querySelector(".market-container") ||
        getChartContainer();

    if (!container) return;

    if (!document.fullscreenElement) {

        if (container.requestFullscreen) {

            container.requestFullscreen().catch(error => {

                console.error(
                    "[ryFX Chart Fullscreen]",
                    error
                );

            });

        }

    } else {

        document.exitFullscreen?.();

    }

}

/* CHART ERROR */

function showChartError(message) {

    const container = getChartContainer();

    if (!container) return;

    container.innerHTML = `

        <div class="chart-placeholder">

            <div class="chart-placeholder-icon">⚠</div>

            <p>${message}</p>

        </div>

    `;

}

/* INITIALIZATION ON PAGE LOAD */

document.addEventListener("ryfx:page-loaded", event => {

    if (event.detail?.page === "live-market") {

        initializeChart();

    } else {

        destroyChart();

    }

});

/* TIMEFRAME EVENTS */

document.addEventListener("click", event => {

    const button = event.target.closest("[data-timeframe]");

    if (!button) return;

    const timeframe = button.dataset.timeframe;

    if (timeframe) {

        changeChartTimeframe(timeframe);

    }

});

/* FULLSCREEN BUTTON EVENT */

document.addEventListener("click", event => {

    const button = event.target.closest("#chartFullscreen");

    if (!button) return;

    toggleChartFullscreen();

});

/* EXPORT */

window.RYFX_CHART = {

    initializeChart,

    loadCandles,

    changeChartTimeframe,

    toggleChartFullscreen,

    destroyChart,

    getState() {

        return { ...RYFX_CHART_STATE };

    }

};
