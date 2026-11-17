// ============================================
// RYFX XAU — NOTIFICATION SYSTEM
// ============================================

(() => {
  "use strict";

  const NOTIFICATION_CONFIG = {
    duration: 4000,
    maxNotifications: 5
  };

  let notificationContainer = null;

  function createNotificationContainer() {
    if (notificationContainer && document.body.contains(notificationContainer)) {
      return notificationContainer;
    }

    notificationContainer = document.createElement("div");
    notificationContainer.id = "ryfxNotifications";
    notificationContainer.className = "notification-container";

    notificationContainer.setAttribute("aria-live", "polite");
    notificationContainer.setAttribute("aria-atomic", "false");

    document.body.appendChild(notificationContainer);

    return notificationContainer;
  }

  function escapeNotificationText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[character];
    });
  }

  function showNotification(message, type = "info", duration) {
    const allowedTypes = ["success", "error", "warning", "info"];

    if (!allowedTypes.includes(type)) {
      type = "info";
    }

    const container = createNotificationContainer();

    while (container.children.length >= NOTIFICATION_CONFIG.maxNotifications) {
      container.firstElementChild?.remove();
    }

    const notification = document.createElement("div");

    notification.className = `ryfx-notification notification-${type}`;

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
        ${escapeNotificationText(message)}
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

    const closeButton = notification.querySelector(
      ".notification-close"
    );

    closeButton.addEventListener("click", () => {
      removeNotification(notification);
    });

    const timeout = Number.isFinite(Number(duration))
      ? Number(duration)
      : NOTIFICATION_CONFIG.duration;

    if (timeout > 0) {
      setTimeout(() => {
        removeNotification(notification);
      }, timeout);
    }

    return notification;
  }

  function removeNotification(notification) {
    if (!notification || !notification.isConnected) return;

    notification.classList.remove("show");

    setTimeout(() => {
      notification.remove();
    }, 250);
  }

  function notifySuccess(message) {
    return showNotification(message, "success");
  }

  function notifyError(message) {
    return showNotification(message, "error");
  }

  function notifyWarning(message) {
    return showNotification(message, "warning");
  }

  function notifyInfo(message) {
    return showNotification(message, "info");
  }

  // Global functions
  window.showNotification = showNotification;
  window.notifySuccess = notifySuccess;
  window.notifyError = notifyError;
  window.notifyWarning = notifyWarning;
  window.notifyInfo = notifyInfo;

  // Initialize notification system
  window.initializeNotifications = function () {
    createNotificationContainer();
  };

})();
