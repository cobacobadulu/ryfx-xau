/* =========================================
   ryFX XAU — TRADINGVIEW WIDGET LOADER
========================================= */

"use strict";

document.addEventListener("ryfx:page-loaded", event => {
    // Hanya jalankan jika halaman yang dimuat adalah live-market
    if (event.detail?.page !== "live-market") return;

    // Pastikan script TradingView hanya dimuat sekali
    if (!window.TradingView) {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            renderTradingViewChart();
        };
        document.head.appendChild(script);
    } else {
        renderTradingViewChart();
    }
});

function renderTradingViewChart() {
    const container = document.getElementById("tradingview_xauusd_chart");
    if (!container) return;

    // Bersihkan container jika sebelumnya sudah ada chart
    container.innerHTML = "";

    // Render Widget TradingView
    new window.TradingView.widget({
        "autosize": true,
        "symbol": "OANDA:XAUUSD",
        "interval": "15",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": true,
        "allow_symbol_change": false,
        "container_id": "tradingview_xauusd_chart"
    });
}
