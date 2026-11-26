/* =========================================
   ryFX XAU — TRADING SIGNALS MODULE
========================================= */

"use strict";

const SIGNALS_API = window.RYFX_API ? window.RYFX_API.BASE_URL : "https://ryfx-xau-production.up.railway.app";

// Event listener saat halaman signals dimuat
document.addEventListener("ryfx:page-loaded", event => {
    if (event.detail.page !== "signals") return;
    
    // Setup tombol refresh
    const refreshBtn = document.getElementById("refreshSignals");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadSignals();
            loadStatistics();
        });
    }

    // Panggil data saat halaman dibuka
    loadSignals();
    loadStatistics();
});

// ==========================================
// 1. AMBIL DAFTAR SINYAL
// ==========================================
async function loadSignals() {
    const container = document.getElementById("signalsList");
    if (!container) return;

    // --- DATA TIRUAN UNTUK TES UI ---
    const dummySignals = [
        {
            id: "12345",
            symbol: "XAUUSD",
            direction: "BUY",
            entry: 2050.50,
            stop_loss: 2045.00,
            take_profits: [2055.00, 2060.00, 2070.00],
            risk_reward: "1:2",
            status: "ACTIVE",
            summary: "Bullish momentum terdeteksi."
        }
    ];

    // Render data tiruan ini
    renderSignalsList(container, dummySignals);
    updateOverviewCounts(1, 1, 0, 0);
    displaySignalDetails(dummySignals[0]);
}

// ==========================================
// 2. RENDER DAFTAR SINYAL
// ==========================================
function renderSignalsList(container, signals) {
    const html = signals.map(signal => {
        const colorClass = signal.direction === "BUY" ? "text-green" : (signal.direction === "SELL" ? "text-red" : "text-yellow");
        
        return `
            <div class="card" style="margin-bottom: 1rem; cursor: pointer; border: 1px solid #334155; padding: 1rem;" 
                 onclick="window.selectSignal('${signal.id}')">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 1.2rem; color: ${signal.direction === 'BUY' ? '#22c55e' : '#ef4444'};">
                            ${signal.direction} ${signal.symbol}
                        </strong>
                        <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 4px;">
                            ${signal.summary || signal.source || "AI Signal"}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span style="background: #1e293b; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">
                            ${signal.status}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    container.innerHTML = html;
}

function renderEmptySignals(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⌁</div>
            <h3>No Active Signals</h3>
            <p>Belum ada sinyal trading aktif dari AI saat ini.</p>
        </div>
    `;
}

// ==========================================
// 3. UPDATE STATISTIK OVERVIEW
// ==========================================
function updateOverviewCounts(active, buy, sell, wait) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    
    setVal("activeSignalCount", active);
    setVal("buySignalCount", buy);
    setVal("sellSignalCount", sell);
    setVal("waitSignalCount", wait);
}

// ==========================================
// 4. TAMPILKAN DETAIL SINYAL
// ==========================================
window.selectSignal = async function(signalId) {
    try {
        // Ambil detail sinyal (sesuaikan endpoint jika ada)
        const response = await fetch(`${SIGNALS_API}/api/signals/${signalId}`);
        const data = await response.json();
        const signal = data.signal || data.data || data; // Fallback jika format beda

        if (signal) {
            displaySignalDetails(signal);
        }
    } catch (error) {
        console.error("[Signals] Error fetching detail:", error);
    }
};

function displaySignalDetails(signal) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setVal("selectedSignalTitle", `${signal.symbol || 'XAUUSD'} Trade`);
    
    const directionEl = document.getElementById("selectedSignalDirection");
    if (directionEl) {
        directionEl.textContent = signal.direction || "--";
        directionEl.className = "signal-badge"; // Reset class
        if (signal.direction === "BUY") directionEl.style.backgroundColor = "#22c55e";
        else if (signal.direction === "SELL") directionEl.style.backgroundColor = "#ef4444";
        else directionEl.style.backgroundColor = "#eab308";
    }

    // Isi Harga
    const formatPrice = (val) => val ? Number(val).toFixed(2) : "--";
    
    setVal("signalEntry", formatPrice(signal.entry));
    setVal("signalStopLoss", formatPrice(signal.stop_loss));
    
    const tps = signal.take_profits || [];
    setVal("signalTP1", formatPrice(tps[0]));
    setVal("signalTP2", formatPrice(tps[1]));
    setVal("signalTP3", formatPrice(tps[2]));

    setVal("signalRiskReward", signal.risk_reward || "--");
}

// ==========================================
// 5. AMBIL STATISTIK PERFORMA
// ==========================================
async function loadStatistics() {
    try {
        const response = await fetch(`${SIGNALS_API}/api/signals/statistics`);
        const data = await response.json();
        
        // Sesuaikan dengan response backend (bisa jadi data.data atau data.statistics)
        const stats = data.statistics || data.data || data;

        if (stats) {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val !== undefined && val !== null ? val : "--";
            };

            setVal("totalSignalCount", stats.total_signals);
            setVal("signalTPHitCount", stats.tp_hit);
            setVal("signalSLHitCount", stats.sl_hit);
            
            const winRate = stats.win_rate;
            setVal("signalWinRate", winRate !== undefined ? `${winRate}%` : "--");
        }
    } catch (error) {
        console.error("[Signals] Error loading statistics:", error);
    }
}
