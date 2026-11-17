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

    defaultTimeframe: "M15",

    timeframes: {
        M1: "1m",
        M5: "5m",
        M15: "15m",
        M30: "30m",
        H1: "1h",
        H4: "4h",
        D1: "1d"
    }
};

/* CHART STATE */

const RYFX_CHART_STATE = {
    chart: null,
    candleSeries: null,
    currentTimeframe: "M15",
    loading: false,
    libraryLoaded: false
};

/* LOAD CHART LIBRARY */

function loadChartLibrary() {

    return new Promise((resolve, reject) => {

        if (window.LightweightCharts) {
            RYFX_CHART_STATE.libraryLoaded = true;
            resolve();
            return;
        }

        const script = document.createElement("script");

        script.src = RYFX_CHART_CONFIG.libraryUrl;
        script.async = true;

        script.onload = () => {

            if (window.LightweightCharts) {
                RYFX_CHART_STATE.libraryLoaded = true;
                resolve();
            } else {
                reject(new Error("Chart library unavailable"));
            }

        };

        script.onerror = () => {
            reject(new Error("Unable to load chart library"));
        };

        document.head.appendChild(script);

    });

}

/* INITIALIZE CHART */

async function initializeChart() {

    const container = document.getElementById("xauChart");

    if (!container) return;

    try {

        await loadChartLibrary();

        if (RYFX_CHART_STATE.chart) {
            RYFX_CHART_STATE.chart.remove();
        }

        RYFX_CHART_STATE.chart =
            LightweightCharts.createChart(container, {

                width: container.clientWidth,
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
                    mode: LightweightCharts.CrosshairMode.Normal
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
                LightweightCharts.CandlestickSeries,
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

        loadCandles(
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

/* LOAD CANDLE DATA */

async function loadCandles(timeframe) {

    if (!RYFX_CHART_STATE.candleSeries) return;

    if (RYFX_CHART_STATE.loading) return;

    RYFX_CHART_STATE.loading = true;

    try {

        const params = new URLSearchParams({
            symbol: RYFX_CHART_CONFIG.symbol,
            timeframe: timeframe
        });

        const response = await fetch(
            `${RYFX_CHART_CONFIG.candleEndpoint}?${params}`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        const candles = result.data || result.candles;

        if (!Array.isArray(candles)) {
            throw new Error("Invalid candle response");
        }

        const validCandles = candles
            .map(candle => ({

                time: Number(candle.time),

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

        RYFX_CHART_STATE.candleSeries.setData(
            uniqueCandles
        );

        RYFX_CHART_STATE.chart.timeScale().fitContent();

        console.log(
            "[ryFX Chart] Candles loaded:",
            uniqueCandles.length
        );

    } catch (error) {

        console.error("[ryFX Chart Data]", error);

        showChartError(
            "Unable to load XAUUSD candle data."
        );

    } finally {

        RYFX_CHART_STATE.loading = false;

    }

}

/* CHANGE TIMEFRAME */

function changeChartTimeframe(timeframe) {

    if (!RYFX_CHART_CONFIG.timeframes[timeframe]) {
        return;
    }

    RYFX_CHART_STATE.currentTimeframe = timeframe;

    document.querySelectorAll(".timeframe-btn")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.timeframe === timeframe
            );

        });

    loadCandles(timeframe);

}

/* CHART RESIZE */

function observeChartResize(container) {

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(entries => {

        if (!RYFX_CHART_STATE.chart) return;

        const width = entries[0].contentRect.width;
        const height = entries[0].contentRect.height;

        RYFX_CHART_STATE.chart.applyOptions({
            width,
            height
        });

    });

    observer.observe(container);

}

/* FULLSCREEN */

function toggleChartFullscreen() {

    const container = document.querySelector(
        ".market-container"
    );

    if (!container) return;

    if (!document.fullscreenElement) {

        container.requestFullscreen?.();

    } else {

        document.exitFullscreen?.();

    }

}

/* CHART ERROR */

function showChartError(message) {

    const container = document.getElementById("xauChart");

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

    if (event.detail.page === "live-market") {

        initializeChart();

    }

});

/* TIMEFRAME EVENTS */

document.addEventListener("click", event => {

    const button = event.target.closest(
        ".timeframe-btn"
    );

    if (!button) return;

    const timeframe = button.dataset.timeframe;

    if (timeframe) {
        changeChartTimeframe(timeframe);
    }

});

/* EXPORT */

window.RYFX_CHART = {

    initializeChart,
    loadCandles,
    changeChartTimeframe,
    toggleChartFullscreen,

    getState() {
        return { ...RYFX_CHART_STATE };
    }

};
