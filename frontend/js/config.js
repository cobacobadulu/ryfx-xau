/* =========================================
   ryFX XAU — FRONTEND CONFIGURATION
   API BASE URL + GLOBAL SETTINGS
========================================= */

"use strict";

(function () {

    /*
     * API base URL strategy:
     * - Development: backend lokal (http://127.0.0.1:8000)
     * - Production: backend online (Railway/Render)
     *
     * Cara override tanpa edit file:
     * Tambahkan di <head> sebelum config.js:
     *   <script>window.RYFX_API_BASE_URL = "https://xxx.railway.app";</script>
     */

    const LOCAL_BACKEND = "http://127.0.0.1:8000";
    const PRODUCTION_BACKEND = "https://ryfx-xau-api.up.railway.app"; // ganti nanti

    const isLocal =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.protocol === "file:";

    const baseUrl =
        window.RYFX_API_BASE_URL ||
        (isLocal ? LOCAL_BACKEND : PRODUCTION_BACKEND);

    window.RYFX_API = {
        BASE_URL: baseUrl.replace(/\/+$/, ""),
        TIMEOUT: 30000
    };

    window.RYFX_ENV = isLocal ? "development" : "production";

    console.log(
        "[ryFX] Environment:",
        window.RYFX_ENV,
        "| API:",
        window.RYFX_API.BASE_URL
    );

})();
