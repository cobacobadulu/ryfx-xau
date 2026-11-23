/* =========================================
   ryFX XAU — MAIN APPLICATION
   AI POWERED GOLD TRADING INTELLIGENCE
========================================= */

"use strict";

/* =========================================
   BACKEND URL (RAILWAY)
========================================= */
window.RYFX_API = {
    BASE_URL: "https://ryfx-xau-production.up.railway.app"
};


/* APPLICATION CONFIGURATION */

const RYFX_CONFIG = {
    name: "ryFX XAU",
    version: "1.0.0",
    asset: "XAUUSD",
    defaultTimeframe: "M15",
    theme: "dark"
};


/* APPLICATION STATE */

const RYFX_STATE = {
    initialized: false,
    currentPage: "dashboard",
    currentTimeframe: RYFX_CONFIG.defaultTimeframe,
    marketConnected: false,
    notifications: [],
    pageLoaded: false
};


/* DOM HELPERS */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


/* APPLICATION SHELL */

function renderApplicationShell() {

    const app = document.getElementById("app");

    if (!app) return;

    app.innerHTML = `

        <div class="app-layout">

            <!-- MOBILE OVERLAY -->

            <div class="sidebar-overlay"></div>

            <!-- SIDEBAR -->

            <aside class="sidebar">

                <div class="sidebar-brand">

                    <div class="brand-logo">
                        ryFX
                        <span>XAU</span>
                    </div>

                    <div class="brand-description">
                        GOLD INTELLIGENCE
                    </div>

                </div>

                <div class="sidebar-section">

                    <span class="sidebar-label">
                        WORKSPACE
                    </span>

                    <nav class="sidebar-nav">

                        <button
                            class="nav-item active"
                            data-page="dashboard"
                        >
                            <span class="nav-icon">▦</span>
                            <span>Dashboard</span>
                        </button>

                        <button
                            class="nav-item"
                            data-page="live-market"
                        >
                            <span class="nav-icon">◷</span>
                            <span>Live Market</span>
                        </button>

                        <button
                            class="nav-item"
                            data-page="ai-analysis"
                        >
                            <span class="nav-icon">⌁</span>
                            <span>AI Analysis</span>
                        </button>

                        <button
                            class="nav-item"
                            data-page="ai-scanner"
                        >
                            <span class="nav-icon">⌕</span>
                            <span>AI Chart Scanner</span>
                        </button>

                        <button
                            class="nav-item"
                            data-page="signals"
                        >
                            <span class="nav-icon">↗</span>
                            <span>Trading Signals</span>
                        </button>

                        <button
                            class="nav-item"
                            data-page="track-record"
                        >
                            <span class="nav-icon">▤</span>
                            <span>Track Record</span>
                        </button>

                        <button
                            class="nav-item"
                            data-page="journal"
                        >
                            <span class="nav-icon">▧</span>
                            <span>Trading Journal</span>
                        </button>

                        <button
                            class="nav-item"
                            data-page="calculator"
                        >
                            <span class="nav-icon">⌗</span>
                            <span>Risk Calculator</span>
                        </button>

                    </nav>

                </div>

                <div class="sidebar-section">

                    <span class="sidebar-label">
                        PREFERENCES
                    </span>

                    <nav class="sidebar-nav">

                        <button
                            class="nav-item"
                            data-page="settings"
                        >
                            <span class="nav-icon">⚙</span>
                            <span>Settings</span>
                        </button>

                    </nav>

                </div>

                <div class="sidebar-bottom">

                    <div class="sidebar-status">

                        <span class="status-indicator"></span>

                        <span>AI SYSTEM</span>

                        <span class="status-text">
                            Initializing
                        </span>

                    </div>

                    <div class="sidebar-version">
                        ryFX XAU v${RYFX_CONFIG.version}
                    </div>

                </div>

            </aside>

            <!-- MAIN AREA -->

            <div class="main-layout">

                <!-- TOPBAR -->

                <header class="topbar">

                    <div class="topbar-left">

                        <button
                            class="mobile-menu-btn"
                            type="button"
                            aria-label="Open navigation"
                        >
                            ☰
                        </button>

                        <div class="breadcrumb">

                            <span>Workspace</span>

                            <span class="breadcrumb-divider">
                                /
                            </span>

                            <strong id="currentPageTitle">
                                Dashboard
                            </strong>

                        </div>

                    </div>

                    <div class="topbar-right">

                        <div class="market-connection">

                            <span
                                class="status-indicator"
                                id="topbarMarketIndicator"
                            ></span>

                            <span id="topbarMarketStatus">
                                Connecting
                            </span>

                        </div>

                        <div
                            class="topbar-clock"
                            id="liveClock"
                        >
                            --:--:--
                        </div>

                        <div class="topbar-symbol">
                            XAUUSD
                        </div>

                    </div>

                </header>

                <!-- PAGE CONTENT -->

                <main
                    class="page-content"
                    id="pageContent"
                >

                    <div class="app-loading">
                        <div class="loading-spinner"></div>
                        <p>Initializing ryFX XAU...</p>
                    </div>

                </main>

            </div>

        </div>

    `;

}


/* APPLICATION INITIALIZATION */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);

function initializeApp() {

    if (RYFX_STATE.initialized) return;

    console.log("=================================");
    console.log("ryFX XAU APPLICATION");
    console.log("Version:", RYFX_CONFIG.version);
    console.log("Asset:", RYFX_CONFIG.asset);
    console.log("System initializing");
    console.log("=================================");

    renderApplicationShell();

    if (typeof initializeNavigation === "function") {
        initializeNavigation();
    }

    if (typeof initializeNotifications === "function") {
        initializeNotifications();
    }

    RYFX_STATE.initialized = true;

    document.dispatchEvent(
        new CustomEvent("ryfx:app-ready", {
            detail: {
                config: RYFX_CONFIG,
                state: RYFX_STATE
            }
        })
    );

}


/* PAGE INITIALIZATION */

document.addEventListener(
    "ryfx:page-loaded",
    event => {

        const page = event.detail?.page;

        if (!page) return;

        RYFX_STATE.currentPage = page;
        RYFX_STATE.pageLoaded = true;

        setPageTitle(page);

        initializeClock();

        console.log("[ryFX] Page loaded:", page);

    }
);


/* LIVE CLOCK */

let clockInterval = null;

function initializeClock() {

    const clock = $("#liveClock");

    if (clockInterval) {

        clearInterval(clockInterval);

        clockInterval = null;

    }

    if (!clock) return;

    function updateClock() {

        const now = new Date();

        clock.textContent = now.toLocaleTimeString(
            "en-GB",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );

    }

    updateClock();

    clockInterval = setInterval(
        updateClock,
        1000
    );

}


/* PAGE TITLE */

function setPageTitle(pageName) {

    const page = pageName
        .replace(/-/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());

    document.title =
        `${page} | ${RYFX_CONFIG.name}`;

    const titleElement = $("#currentPageTitle");

    if (titleElement) {

        titleElement.textContent = page;

    }

}


/* LOADING STATE */

function showLoading(
    element,
    message = "Loading..."
) {

    if (!element) return;

    element.innerHTML = `

        <div class="empty-state">

            <div class="empty-state-icon">◌</div>

            <p>${escapeHTML(message)}</p>

        </div>

    `;

}


function hideLoading(element) {

    if (!element) return;

    const loading = $(".empty-state", element);

    if (loading) {
        loading.remove();
    }

}


/* EMPTY STATE */

function showEmptyState(element, message) {

    if (!element) return;

    element.innerHTML = `

        <div class="empty-state">

            <div class="empty-state-icon">◈</div>

            <h3>No Data Available</h3>

            <p>${escapeHTML(message)}</p>

        </div>

    `;

}


/* HTML ESCAPE */

function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"

        })[character]
    );

}


/* NUMBER FORMATTER */

function formatPrice(value, decimals = 2) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "--";
    }

    return Number(value).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );

}


/* CURRENCY FORMATTER */

function formatCurrency(value, currency = "USD") {

    if (!Number.isFinite(Number(value))) {
        return "--";
    }

    return Number(value).toLocaleString(
        "en-US",
        {
            style: "currency",
            currency
        }
    );

}


/* ERROR HANDLER */

window.addEventListener("error", event => {

    console.error(
        "[ryFX XAU Error]",
        event.message
    );

});


window.addEventListener(
    "unhandledrejection",
    event => {

        console.error(
            "[ryFX XAU Promise Error]",
            event.reason
        );

    }
);


/* APPLICATION EXPORTS */

window.RYFX_CONFIG = RYFX_CONFIG;

window.RYFX_STATE = RYFX_STATE;

window.RYFX = {

    $,
    $$,

    setPageTitle,

    showLoading,
    hideLoading,
    showEmptyState,

    formatPrice,
    formatCurrency,

    escapeHTML

};
