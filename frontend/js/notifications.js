// ============================================
// RYFX XAU — NOTIFICATION SYSTEM
// MARKET & AI ALERTS
// ============================================

(() => {
    "use strict";

    /* CONFIGURATION */

    const NOTIFICATION_CONFIG = {
        duration: 4000,
        maxNotifications: 5,
        removeDelay: 250,
        duplicateWindow: 3000
    };

    /* STATE */

    let notificationContainer = null;

    const activeTimers = new Map();
    const recentNotifications = new Map();

    /* CREATE CONTAINER */

    function createNotificationContainer() {

        if (
            notificationContainer &&
            document.body.contains(notificationContainer)
        ) {
            return notificationContainer;
        }

        notificationContainer = document.createElement("div");

        notificationContainer.id = "ryfxNotifications";

        notificationContainer.className =
            "notification-container";

        notificationContainer.setAttribute(
            "aria-live",
            "polite"
        );

        notificationContainer.setAttribute(
            "aria-atomic",
            "false"
        );

        document.body.appendChild(notificationContainer);

        return notificationContainer;

    }

    /* ESCAPE TEXT */

    function escapeNotificationText(value) {

        return String(value ?? "").replace(
            /[&<>"']/g,
            character => {

                const entities = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"

                };

                return entities[character];

            }
        );

    }

    /* REMOVE NOTIFICATION */

    function removeNotification(notification) {

        if (
            !notification ||
            !notification.isConnected ||
            notification.dataset.removing === "true"
        ) {
            return;
        }

        notification.dataset.removing = "true";

        const timer = activeTimers.get(notification);

        if (timer) {

            clearTimeout(timer);

            activeTimers.delete(notification);

        }

        notification.classList.remove("show");

        setTimeout(() => {

            notification.remove();

        }, NOTIFICATION_CONFIG.removeDelay);

    }

    /* SHOW NOTIFICATION */

    function showNotification(
        message,
        type = "info",
        duration
    ) {

        const allowedTypes = [
            "success",
            "error",
            "warning",
            "info"
        ];

        if (!allowedTypes.includes(type)) {

            type = "info";

        }

        const safeMessage = String(message ?? "").trim();

        if (!safeMessage) return null;

        /* PREVENT DUPLICATE NOTIFICATIONS */

        const duplicateKey = `${type}:${safeMessage}`;

        const now = Date.now();

        const previousTime =
            recentNotifications.get(duplicateKey);

        if (
            previousTime &&
            now - previousTime <
                NOTIFICATION_CONFIG.duplicateWindow
        ) {
            return null;
        }

        recentNotifications.set(
            duplicateKey,
            now
        );

        /* CLEAN OLD DUPLICATE RECORDS */

        for (const [key, timestamp] of recentNotifications) {

            if (now - timestamp > 10000) {

                recentNotifications.delete(key);

            }

        }

        const container = createNotificationContainer();

        /* LIMIT NOTIFICATIONS */

        while (
            container.children.length >=
            NOTIFICATION_CONFIG.maxNotifications
        ) {

            const oldest = container.firstElementChild;

            if (!oldest) break;

            removeNotification(oldest);

            // Remove immediately to enforce the limit.

            oldest.remove();

        }

        const notification = document.createElement("div");

        notification.className =
            `ryfx-notification notification-${type}`;

        const icons = {

            success: "✓",
            error: "✕",
            warning: "!",
            info: "i"

        };

        notification.innerHTML = `

            <span class="notification-icon">
                ${icons[type]}
            </span>

            <span class="notification-message">
                ${escapeNotificationText(safeMessage)}
            </span>

            <button
                class="notification-close"
                type="button"
                aria-label="Close notification"
            >
                ×
            </button>

        `;

        container.appendChild(notification);

        requestAnimationFrame(() => {

            notification.classList.add("show");

        });

        /* CLOSE BUTTON */

        const closeButton = notification.querySelector(
            ".notification-close"
        );

        closeButton.addEventListener("click", () => {

            removeNotification(notification);

        });

        /* AUTO REMOVE */

        const timeout =
            duration === undefined
                ? NOTIFICATION_CONFIG.duration
                : Number(duration);

        if (Number.isFinite(timeout) && timeout > 0) {

            const timer = setTimeout(() => {

                removeNotification(notification);

            }, timeout);

            activeTimers.set(
                notification,
                timer
            );

        }

        return notification;

    }

    /* BASIC NOTIFICATIONS */

    function notifySuccess(message, duration) {

        return showNotification(
            message,
            "success",
            duration
        );

    }

    function notifyError(message, duration) {

        return showNotification(
            message,
            "error",
            duration
        );

    }

    function notifyWarning(message, duration) {

        return showNotification(
            message,
            "warning",
            duration
        );

    }

    function notifyInfo(message, duration) {

        return showNotification(
            message,
            "info",
            duration
        );

    }

    /* XAUUSD SIGNAL NOTIFICATIONS */

    function notifySignal(direction, details = {}) {

        const validDirections = [
            "BUY",
            "SELL",
            "WAIT"
        ];

        const normalizedDirection =
            String(direction || "").toUpperCase();

        if (!validDirections.includes(normalizedDirection)) {

            return notifyWarning(
                "Unknown XAUUSD signal direction."
            );

        }

        if (normalizedDirection === "WAIT") {

            return notifyInfo(
                "XAUUSD: AI recommends waiting for confirmation."
            );

        }

        const entry = details.entry
            ? ` | Entry: ${details.entry}`
            : "";

        return showNotification(

            `XAUUSD ${normalizedDirection} signal${entry}`,

            normalizedDirection === "BUY"
                ? "success"
                : "warning",

            6000

        );

    }

    /* MARKET CONNECTION ALERTS */

    function notifyMarketConnected() {

        return notifySuccess(
            "XAUUSD market connection restored."
        );

    }

    function notifyMarketDisconnected() {

        return notifyError(
            "XAUUSD market connection lost.",
            6000
        );

    }

    /* AI ANALYSIS ALERTS */

    function notifyAnalysisCompleted(data = {}) {

        const direction =
            String(data.direction || "").toUpperCase();

        if (direction === "BUY" || direction === "SELL") {

            return notifySuccess(
                `AI analysis completed. XAUUSD signal: ${direction}.`
            );

        }

        return notifyInfo(
            "XAUUSD AI market analysis completed."
        );

    }

    /* MARKET EVENT LISTENERS */

    document.addEventListener(
        "ryfx:analysis-completed",
        event => {

            notifyAnalysisCompleted(
                event.detail || {}
            );

        }
    );

    document.addEventListener(
        "ryfx:market-connected",
        () => {

            notifyMarketConnected();

        }
    );

    document.addEventListener(
        "ryfx:market-disconnected",
        () => {

            notifyMarketDisconnected();

        }
    );

    document.addEventListener(
        "ryfx:signal-generated",
        event => {

            const signal = event.detail || {};

            notifySignal(
                signal.direction,
                signal
            );

        }
    );

    /* INITIALIZE */

    function initializeNotifications() {

        createNotificationContainer();

    }

    /* GLOBAL EXPORTS */

    window.showNotification = showNotification;

    window.notifySuccess = notifySuccess;

    window.notifyError = notifyError;

    window.notifyWarning = notifyWarning;

    window.notifyInfo = notifyInfo;

    window.notifySignal = notifySignal;

    window.notifyMarketConnected = notifyMarketConnected;

    window.notifyMarketDisconnected = notifyMarketDisconnected;

    window.notifyAnalysisCompleted = notifyAnalysisCompleted;

    window.initializeNotifications =
        initializeNotifications;

})();
