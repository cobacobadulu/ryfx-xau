/* =========================================
   ryFX XAU — NAVIGATION SYSTEM
========================================= */

"use strict";

/* PAGE CONFIGURATION */

const RYFX_PAGES = {
    dashboard: "pages/dashboard.html",
    "live-market": "pages/live-market.html",
    "ai-analysis": "pages/ai-analysis.html",
    "ai-scanner": "pages/ai-scanner.html",
    signals: "pages/signals.html",
    "track-record": "pages/track-record.html",
    journal: "pages/journal.html",
    calculator: "pages/calculator.html",
    settings: "pages/settings.html"
};

/* NAVIGATION INITIALIZATION */

function initializeNavigation() {

    const app = document.getElementById("app");

    if (!app) return;

    initializeMobileMenu();

    document.addEventListener("click", event => {

        const link = event.target.closest("[data-page]");

        if (!link) return;

        event.preventDefault();

        const page = link.dataset.page;

        navigateTo(page);

    });

    window.addEventListener("popstate", () => {

        const page = location.hash.replace("#", "") || "dashboard";

        loadPage(page, false);

    });

    const initialPage = location.hash.replace("#", "") || "dashboard";

    loadPage(initialPage, false);
}

/* PAGE NAVIGATION */

async function navigateTo(page) {

    if (!RYFX_PAGES[page]) {
        console.error("Page not found:", page);
        return;
    }

    history.pushState(
        { page },
        "",
        `#${page}`
    );

    await loadPage(page, true);
}

/* LOAD PAGE */

async function loadPage(page, updateTitle = true) {

    const app = document.getElementById("app");

    if (!app) return;

    const pagePath = RYFX_PAGES[page];

    if (!pagePath) {
        console.error("Invalid page:", page);
        return;
    }

    try {

        app.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◌</div>
                <p>Loading ${page}...</p>
            </div>
        `;

        const response = await fetch(pagePath);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        const parser = new DOMParser();

        const pageDocument = parser.parseFromString(
            html,
            "text/html"
        );

        const content =
            pageDocument.querySelector("[data-page-content]") ||
            pageDocument.querySelector("main") ||
            pageDocument.body;

        app.innerHTML = content.innerHTML;

        RYFX_STATE.currentPage = page;

        updateActiveMenu(page);

        if (updateTitle) {
            setPageTitle(page);
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        document.dispatchEvent(
            new CustomEvent("ryfx:page-loaded", {
                detail: { page }
            })
        );

        closeMobileMenu();

    } catch (error) {

        console.error("[Navigation Error]", error);

        app.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠</div>
                <h3>Unable to Load Page</h3>
                <p>${page} could not be loaded. Please check the page file.</p>
                <button class="btn btn-primary" data-page="dashboard">
                    Back to Dashboard
                </button>
            </div>
        `;

    }
}

/* ACTIVE MENU */

function updateActiveMenu(page) {

    document.querySelectorAll(".menu-item").forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.page === page
        );

    });

}

/* MOBILE MENU */

function initializeMobileMenu() {

    const menuButton = document.querySelector(".mobile-menu-btn");

    const sidebar = document.querySelector(".sidebar");

    const overlay = document.querySelector(".sidebar-overlay");

    if (!menuButton || !sidebar) return;

    menuButton.addEventListener("click", () => {

        sidebar.classList.toggle("open");

        if (overlay) {
            overlay.classList.toggle("active");
        }

    });

    if (overlay) {

        overlay.addEventListener("click", closeMobileMenu);

    }

}

/* CLOSE MOBILE MENU */

function closeMobileMenu() {

    document.querySelector(".sidebar")?.classList.remove("open");

    document.querySelector(".sidebar-overlay")?.classList.remove("active");

}

/* EXPORT */

window.RYFX_NAVIGATION = {
    navigateTo,
    loadPage,
    updateActiveMenu,
    closeMobileMenu
};
