/* =========================================
   ryFX XAU — MAIN APPLICATION
   AI POWERED GOLD TRADING INTELLIGENCE
========================================= */

"use strict";

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


/* DOM SELECTORS */

const $ = (selector, parent = document) => {
    return parent.querySelector(selector);
};

const $$ = (selector, parent = document) => {
    return [...parent.querySelectorAll(selector)];
};


/* APPLICATION INITIALIZATION */

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {

    if (RYFX_STATE.initialized) return;

    console.log("=================================");
    console.log("ryFX XAU APPLICATION");
    console.log("Version:", RYFX_CONFIG.version);
    console.log("Asset:", RYFX_CONFIG.asset);
    console.log("System initialized");
    console.log("=================================");

    initializeNavigation();
    initializeNotifications();

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

document.addEventListener("ryfx:page-loaded", event => {

    const page = event.detail?.page;

    if (!page) return;

    RYFX_STATE.currentPage = page;
    RYFX_STATE.pageLoaded = true;

    setPageTitle(page);

    initializeClock();

    console.log("[ryFX] Page loaded:", page);

});


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

    clockInterval = setInterval(updateClock, 1000);
}


/* PAGE TITLE */

function setPageTitle(pageName) {

    const page = pageName
        .replace(/-/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());

    document.title = `${page} | ${RYFX_CONFIG.name}`;
}


/* LOADING STATE */

function showLoading(element, message = "Loading...") {

    if (!element) return;

    element.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">◌</div>
            <p>${message}</p>
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
            <p>${message}</p>
        </div>
    `;
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

    return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}


/* CURRENCY FORMATTER */

function formatCurrency(value, currency = "USD") {

    if (!Number.isFinite(Number(value))) {
        return "--";
    }

    return Number(value).toLocaleString("en-US", {
        style: "currency",
        currency
    });
}


/* ERROR HANDLER */

window.addEventListener("error", event => {

    console.error(
        "[ryFX XAU Error]",
        event.message
    );

});


window.addEventListener("unhandledrejection", event => {

    console.error(
        "[ryFX XAU Promise Error]",
        event.reason
    );

});


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
    formatCurrency

};
