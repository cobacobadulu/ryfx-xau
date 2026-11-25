/* =========================================
   ryFX XAU — NAVIGATION SYSTEM
   SPA PAGE MANAGEMENT
   APPLICATION SHELL COMPATIBLE
========================================= */

"use strict";


/* PAGE CONFIGURATION */

const RYFX_PAGES = {

    dashboard: "pages/dashboard.html",

    "live-market": "pages/live-market.html",

    "ai-analysis": "pages/ai-analysis.html",

    "ai-strategy": "pages/ai-scanner.html",

    "ai-news": "pages/ai-news.html",

    signals: "pages/signals.html",

    "track-record": "pages/track-record.html",

    journal: "pages/journal.html",

    calculator: "pages/calculator.html",

    settings: "pages/settings.html"

};


/* NAVIGATION STATE */

let navigationInitialized = false;

let activeRequest = 0;


/* NAVIGATION INITIALIZATION */

function initializeNavigation() {

    if (navigationInitialized) return;

    const pageContent = document.getElementById("pageContent");

    if (!pageContent) {
        console.error("[Navigation] #pageContent not found.");
        return;
    }

    navigationInitialized = true;


    /* GLOBAL PAGE CLICK */

    document.addEventListener("click", event => {

        const link = event.target.closest("[data-page]");

        if (!link) return;

        const page = link.dataset.page;

        if (!RYFX_PAGES[page]) return;

        event.preventDefault();

        navigateTo(page);

    });


    /* MOBILE MENU */

    document.addEventListener("click", event => {

        const menuButton = event.target.closest(
            ".mobile-menu-btn"
        );

        const overlay = event.target.closest(
            ".sidebar-overlay"
        );

        if (menuButton) {
            toggleMobileMenu();
        }

        if (overlay) {
            closeMobileMenu();
        }

    });


    /* BROWSER BACK / FORWARD */

    window.addEventListener("popstate", () => {

        const page =
            location.hash.replace("#", "") || "dashboard";

        loadPage(page);

    });


    /* INITIAL PAGE */

    const initialPage =
        location.hash.replace("#", "") || "dashboard";

    loadPage(initialPage);

}


/* PAGE NAVIGATION */

async function navigateTo(page) {

    if (!RYFX_PAGES[page]) {
        console.error("[Navigation] Page not found:", page);
        return;
    }

    if (
        page === RYFX_STATE.currentPage &&
        RYFX_STATE.pageLoaded
    ) {
        closeMobileMenu();
        return;
    }

    history.pushState(
        { page },
        "",
        `#${page}`
    );

    await loadPage(page);

}


/* LOAD PAGE */

async function loadPage(page) {

    const pageContent = document.getElementById("pageContent");

    if (!pageContent) {
        console.error("[Navigation] #pageContent not found.");
        return;
    }

    if (!RYFX_PAGES[page]) {
        console.error("[Navigation] Invalid page:", page);
        return;
    }


    const requestId = ++activeRequest;


    try {

        /* LOADING STATE */

        pageContent.className = "page-content";

        pageContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◌</div>
                <p>Loading ${page}...</p>
            </div>
        `;


        /* FETCH PAGE */

        const response = await fetch(RYFX_PAGES[page]);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();


        /* PREVENT OLD REQUEST OVERRIDE */

        if (requestId !== activeRequest) return;


        /* PARSE HTML */

        const parser = new DOMParser();

        const pageDocument = parser.parseFromString(
            html,
            "text/html"
        );


        const content =
            pageDocument.querySelector("[data-page-content]") ||
            pageDocument.querySelector("main") ||
            pageDocument.body;


        if (!content) {
            throw new Error("Page content not found.");
        }


        /* PRESERVE PAGE ROOT CLASS */

        const pageClasses = Array.from(content.classList)
            .filter(className => className !== "page-content");

        pageContent.className = [
            "page-content",
            ...pageClasses
        ].join(" ");


        /* INSERT PAGE CONTENT */

        pageContent.innerHTML = content.innerHTML;


        /* UPDATE APPLICATION STATE */

        RYFX_STATE.currentPage = page;

        RYFX_STATE.pageLoaded = true;


        /* UPDATE INTERFACE */

        updateActiveMenu(page);

        setPageTitle(page);


        /* SCROLL TO TOP */

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });


        /* PAGE LOADED EVENT */

        document.dispatchEvent(
            new CustomEvent("ryfx:page-loaded", {

                detail: {
                    page,
                    content: pageContent
                }

            })
        );

        /* TAMBAHAN BARU: Jalankan fungsi AI News jika halaman yang dimuat adalah ai-news */
        if (page === "ai-news" && typeof fetchNewsAnalysis === "function") {
            fetchNewsAnalysis();
        }


        /* CLOSE MOBILE MENU */

        closeMobileMenu();


        console.log("[ryFX] Page loaded:", page);


    } catch (error) {

        if (requestId !== activeRequest) return;

        console.error("[Navigation Error]", error);


        pageContent.className = "page-content";

        pageContent.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">⚠</div>

                <h3>Unable to Load Page</h3>

                <p>
                    ${page} could not be loaded.
                    Please check the page file or server connection.
                </p>

                <button
                    class="btn btn-primary"
                    data-page="dashboard"
                >
                    Back to Dashboard
                </button>

            </div>
        `;

    }

}


/* ACTIVE MENU */

function updateActiveMenu(page) {

    document.querySelectorAll("[data-page]").forEach(item => {

        if (
            item.classList.contains("nav-item") ||
            item.classList.contains("menu-item")
        ) {

            item.classList.toggle(
                "active",
                item.dataset.page === page
            );

        }

    });

}


/* MOBILE MENU */

function toggleMobileMenu() {

    const sidebar = document.querySelector(".sidebar");

    const overlay = document.querySelector(".sidebar-overlay");
    
    const topbar = document.querySelector(".topbar");

    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle("open");

    if (overlay) {
        overlay.classList.toggle("active", isOpen);
    }
    
    /* Sembunyikan topbar saat menu dibuka di mobile */
    if (topbar) {
        if (isOpen && window.innerWidth <= 900) {
            topbar.style.display = "none";
        } else {
            topbar.style.display = "";
        }
    }

}


/* CLOSE MOBILE MENU */

function closeMobileMenu() {

    const sidebar = document.querySelector(".sidebar");

    const overlay = document.querySelector(".sidebar-overlay");
    
    const topbar = document.querySelector(".topbar");

    sidebar?.classList.remove("open");

    overlay?.classList.remove("active");
    
    /* Tampilkan kembali topbar */
    if (topbar) {
        topbar.style.display = "";
    }

}


/* EXPORT */

window.RYFX_NAVIGATION = {

    navigateTo,

    loadPage,

    updateActiveMenu,

    toggleMobileMenu,

    closeMobileMenu

};
