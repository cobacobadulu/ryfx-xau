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

    liveEndpoint: "/api/market/live",      // <-- TAMBAHAN

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

    libraryPromise: null,

    resizeObserver: null,

    requestId: 0,

    activeContainer: null,

    errorElement: null,

    liveInterval: null                     // <-- TAMBAHAN

};


/* LOAD CHART LIBRARY */

function loadChartLibrary() {

    if (window.LightweightCharts) {

        RYFX_CHART_STATE.libraryLoaded = true;

        return Promise.resolve();

    }


    if (RYFX_CHART_STATE.libraryPromise) {

        return RYFX_CHART_STATE.libraryPromise;

    }


    RYFX_CHART_STATE.libraryPromise =
        new Promise((resolve, reject) => {

            const existingScript = document.querySelector(
                'script[data-ryfx-chart-library]'
            );


            if (existingScript) {

                existingScript.addEventListener(
                    "load",
                    () => {

                        RYFX_CHART_STATE.libraryLoaded =
                            !!window.LightweightCharts;

                        if (RYFX_CHART_STATE.libraryLoaded) {

                            resolve();

                        } else {

                            reject(
                                new Error("Chart library unavailable")
                            );

                        }

                    },
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


    return RYFX_CHART_STATE.libraryPromise;

}


/* GET CHART CONTAINER */

function getChartContainer() {

    return (

        document.getElementById("xauusdChart") ||

        document.getElementById("xauChart")

    );

}


/* CHART ERROR */

function showChartError(message) {

    const container =
        RYFX_CHART_STATE.activeContainer ||
        getChartContainer();

    if (!container) return;


    let errorElement =
        container.querySelector(".chart-placeholder");


    if (!errorElement) {

        errorElement = document.createElement("div");

        errorElement.className = "chart-placeholder";

        container.appendChild(errorElement);

    }


    errorElement.innerHTML = `

        <div class="chart-placeholder-icon">⚠</div>

        <p></p>

    `;


    errorElement.querySelector("p").textContent = message;

    errorElement.style.display = "flex";

    RYFX_CHART_STATE.errorElement = errorElement;

}


/* HIDE CHART ERROR */

function hideChartError() {

    const errorElement =
        RYFX_CHART_STATE.errorElement;

    if (errorElement) {

        errorElement.remove();

        RYFX_CHART_STATE.errorElement = null;

    }

}


/* LIVE FEED — TAMBAHAN */

function stopLiveFeed() {

    if (RYFX_CHART_STATE.liveInterval) {

        clearInterval(RYFX_CHART_STATE.liveInterval);

        RYFX_CHART_STATE.liveInterval = null;

    }

}


function updateLiveCandle(candle) {

    if (!RYFX_CHART_STATE.candleSeries) return;

    const normalized = {

        time: normalizeCandleTime(candle.time),

        open: Number(candle.open),

        high: Number(candle.high),

        low: Number(candle.low),

        close: Number(candle.close)

    };


    if (

        !Number.isFinite(normalized.time) ||

        !Number.isFinite(normalized.open) ||

        !Number.isFinite(normalized.high) ||

        !Number.isFinite(normalized.low) ||

        !Number.isFinite(normalized.close)

    ) return;


    try {

        RYFX_CHART_STATE.candleSeries.update(normalized);

    } catch (err) {

        console.warn("[ryFX Live] update failed:", err.message);

    }

}


function startLiveFeed() {

    stopLiveFeed();


    RYFX_CHART_STATE.liveInterval = setInterval(async () => {

        if (!RYFX_CHART_STATE.candleSeries) return;


        try {

            const apiBase =
                (window.RYFX_API && window.RYFX_API.BASE_URL) || "";

            const params = new URLSearchParams({

                symbol: RYFX_CHART_CONFIG.symbol,

                timeframe:
                    RYFX_CHART_CONFIG.timeframes[
                        RYFX_CHART_STATE.currentTimeframe
                    ]

            });


            const res = await fetch(

                `${apiBase}${RYFX_CHART_CONFIG.liveEndpoint}?${params}`,

                {

                    headers: { "Accept": "application/json" },

                    cache: "no-store"

                }

            );


            if (!res.ok) return;


            const result = await res.json();

            const candle =
                result.data || result.candle || result;


            if (candle && candle.time) {

                updateLiveCandle(candle);

            }

        } catch (err) {

            console.warn("[ryFX Live]", err.message);

        }

    }, 1000);

}


/* CLEANUP CHART */

function destroyChart() {

    stopLiveFeed();                         // <-- TAMBAHAN

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

    RYFX_CHART_STATE.errorElement = null;

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


        if (!chartLibrary.createChart) {

            throw new Error("Invalid chart library");

        }


        const width =
            container.clientWidth || 600;

        const height =
            container.clientHeight || 380;


        RYFX_CHART_STATE.chart =
            chartLibrary.createChart(container, {

                width,

                height,

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

                handleScroll: false,
                handleScale: false

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


        startLiveFeed();                    // <-- TAMBAHAN


        console.log("[ryFX Chart] Initialized");


    } catch (error) {

        console.error("[ryFX Chart]", error);

        showChartError(
            "Chart could not be initialized. Please try again."
        );

    }

}


/* NORMALIZE CANDLE TIME */

function normalizeCandleTime(value) {

    if (

        typeof value === "string" &&

        !/^\d+$/.test(value)

    ) {

        const parsed = Math.floor(
            new Date(value).getTime() / 1000
        );

        return Number.isFinite(parsed)
            ? parsed
            : NaN;

    }


    let time = Number(value);


    if (!Number.isFinite(time)) return NaN;


    if (time > 100000000000) {

        time = Math.floor(time / 1000);

    }


    return Math.floor(time);

}


/* LOAD CANDLE DATA */

async function loadCandles(timeframe) {

    if (!RYFX_CHART_STATE.candleSeries) return;

    if (!RYFX_CHART_CONFIG.timeframes[timeframe]) return;


    const requestId =
        ++RYFX_CHART_STATE.requestId;


    RYFX_CHART_STATE.loading = true;


    hideChartError();


    try {

        const params = new URLSearchParams({

            symbol: RYFX_CHART_CONFIG.symbol,

            timeframe:
                RYFX_CHART_CONFIG.timeframes[timeframe]

        });


        const apiBase = (window.RYFX_API && window.RYFX_API.BASE_URL) || "";


        const response = await fetch(

            `${apiBase}${RYFX_CHART_CONFIG.candleEndpoint}?${params}`,

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
                `HTTP ${response.status}`
            );

        }


        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.detail || "Gagal memuat data");
        }


        if (

            requestId !== RYFX_CHART_STATE.requestId ||

            !RYFX_CHART_STATE.candleSeries

        ) {

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


        // Hapus dulu data lama agar benar-benar bersih
        RYFX_CHART_STATE.candleSeries.setData([]);
        
        // Baru masukkan data baru
        RYFX_CHART_STATE.candleSeries.setData(
            uniqueCandles
        );


        // TAMBAHKAN BARIS INI UNTUK MENGHAPUS TULISAN LOADING
        const loadingText = RYFX_CHART_STATE.activeContainer?.querySelector(".chart-loading");
        if (loadingText) loadingText.remove();


        RYFX_CHART_STATE.chart
            .timeScale()
            .fitContent();


        hideChartError();


        console.log(

            "[ryFX Chart] Candles loaded:",

            uniqueCandles.length

        );


    } catch (error) {

        if (requestId !== RYFX_CHART_STATE.requestId) {

            return;

        }


        console.error(
            "[ryFX Chart Data]",
            error
        );


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

    if (!RYFX_CHART_CONFIG.timeframes[timeframe]) return;

    if (!RYFX_CHART_STATE.candleSeries) return;

    RYFX_CHART_STATE.currentTimeframe = timeframe;

    updateTimeframeButtons();
    
    // KOSONGKAN GRAFIK DULU SEBELUM MEMUAT YANG BARU
    RYFX_CHART_STATE.candleSeries.setData([]);
    
    // TAMPILKAN INDIKATOR LOADING
    const container = RYFX_CHART_STATE.activeContainer;
    if (container) {
        let loadingText = container.querySelector(".chart-loading");
        if (!loadingText) {
            loadingText = document.createElement("div");
            loadingText.className = "chart-loading";
            loadingText.textContent = "Loading XAUUSD chart...";
            container.appendChild(loadingText);
        } else {
            loadingText.style.display = "flex";
        }
    }

    loadCandles(timeframe);

}


/* UPDATE TIMEFRAME BUTTONS */

function updateTimeframeButtons() {

    document.querySelectorAll("[data-timeframe]")
        .forEach(button => {

            const active =

                button.dataset.timeframe ===

                RYFX_CHART_STATE.currentTimeframe;


            button.classList.toggle(
                "active",
                active
            );


            button.setAttribute(
                "aria-pressed",
                String(active)
            );

        });

}


/* CHART RESIZE */

function resizeChart() {

    const chart = RYFX_CHART_STATE.chart;

    const container =
        RYFX_CHART_STATE.activeContainer;


    if (!chart || !container) return;


    const width = container.clientWidth;

    const height = container.clientHeight;


    if (width <= 0 || height <= 0) return;


    chart.applyOptions({

        width,

        height

    });

}


function observeChartResize(container) {

    if (RYFX_CHART_STATE.resizeObserver) {

        RYFX_CHART_STATE.resizeObserver.disconnect();

    }


    if (typeof ResizeObserver !== "undefined") {

        RYFX_CHART_STATE.resizeObserver =
            new ResizeObserver(() => {

                resizeChart();

            });


        RYFX_CHART_STATE.resizeObserver.observe(
            container
        );

    } else {

        window.addEventListener(
            "resize",
            resizeChart
        );

    }

}


/* FULLSCREEN */

async function toggleChartFullscreen() {

    const container =

        document.querySelector(".market-container") ||

        getChartContainer();


    if (!container) return;


    try {

        if (!document.fullscreenElement) {

            await container.requestFullscreen();

            // Saat masuk fullscreen, AKTIFKAN zoom dan scroll chart
            if (RYFX_CHART_STATE.chart) {
                RYFX_CHART_STATE.chart.applyOptions({
                    handleScroll: true,
                    handleScale: true
                });
            }

        } else {

            await document.exitFullscreen();

            // Saat keluar fullscreen, MATIKAN zoom agar halaman bisa di-scroll
            if (RYFX_CHART_STATE.chart) {
                RYFX_CHART_STATE.chart.applyOptions({
                    handleScroll: false,
                    handleScale: false
                });
            }

        }

    } catch (error) {

        console.error(
            "[ryFX Chart Fullscreen]",
            error
        );

    }

}


/* FULLSCREEN RESIZE */

document.addEventListener(
    "fullscreenchange",
    () => {

        setTimeout(() => {

            resizeChart();

        }, 100);

    }
);


/* WINDOW RESIZE FALLBACK */

window.addEventListener(
    "resize",
    resizeChart
);


/* PAGE INITIALIZATION */

document.addEventListener(
    "ryfx:page-loaded",
    event => {

        if (event.detail?.page === "live-market") {

            initializeChart();

        } else {

            destroyChart();

        }

    }
);


/* TIMEFRAME EVENTS */

document.addEventListener("click", event => {

    const button =
        event.target.closest("[data-timeframe]");


    if (!button) return;


    const timeframe =
        button.dataset.timeframe;


    if (timeframe) {

        changeChartTimeframe(timeframe);

    }

});


/* FULLSCREEN BUTTON EVENT */

document.addEventListener("click", event => {

    const button =
        event.target.closest("#chartFullscreen");


    if (!button) return;


    event.preventDefault();

    toggleChartFullscreen();

});


/* EXPORT */

window.RYFX_CHART = {

    initializeChart,

    loadCandles,

    changeChartTimeframe,

    toggleChartFullscreen,

    resizeChart,

    destroyChart,


    getState() {

        return {

            ...RYFX_CHART_STATE,

            chart: undefined,

            candleSeries: undefined,

            resizeObserver: undefined

        };

    }

};
