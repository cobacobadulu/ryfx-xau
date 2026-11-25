/* =========================================
   ryFX XAU — AI NEWS MODULE (LIVE API)
========================================= */

"use strict";

// Ganti URL ini sesuai environment backend Anda
const RYFX_NEWS_API = "https://ryfx-xau-production.up.railway.app/api/analysis/news";

document.addEventListener("ryfx:page-loaded", event => {
    if (event.detail.page !== "ai-news") return;
    
    // Load data saat halaman dibuka
    loadUpcomingNews();
});

// ==========================================
// 1. AMBIL DAFTAR BERITA (UPCOMING)
// ==========================================
async function loadUpcomingNews() {
    const analysisCard = document.getElementById("newsAnalysisCard");
    const newsList = document.getElementById("newsList");
    
    if (!analysisCard) return;

    // Tampilkan loading
    analysisCard.querySelector(".card-body").innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">◌</div>
            <p>Connecting to economic calendar...</p>
        </div>
    `;

    try {
        const response = await fetch(`${RYFX_NEWS_API}/upcoming?limit=5`);
        const data = await response.json();

        if (!data.success || !data.events || data.events.length === 0) {
            analysisCard.querySelector(".card-body").innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">◈</div>
                    <h3>Tidak Ada Berita</h3>
                    <p>Tidak ada jadwal rilis berita high-impact dalam waktu dekat.</p>
                </div>
            `;
            newsList.innerHTML = `<p class="text-muted">Tidak ada berita terkini.</p>`;
            return;
        }

        // Tampilkan daftar event sebagai tombol
        renderUpcomingList(analysisCard, data.events);
        
        // Otomatis analisis event pertama
        analyzeEvent(data.events[0].name);

    } catch (error) {
        console.error("[AI News] Fetch error:", error);
        analysisCard.querySelector(".card-body").innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠</div>
                <h3>Gagal Terhubung</h3>
                <p>Backend tidak merespons. Periksa koneksi Railway.</p>
            </div>
        `;
    }
}

// ==========================================
// 2. RENDER DAFTAR EVENT
// ==========================================
function renderUpcomingList(cardElement, events) {
    const body = cardElement.querySelector(".card-body");
    
    const buttonsHtml = events.map(e => `
        <button class="btn btn-outline" style="margin: 5px; text-align: left;" 
                onclick="analyzeEvent('${e.name}')">
            ${e.name} (${e.currency}) 
            <span style="color:#94a3b8; font-size:0.8em; display:block;">
                Forecast: ${e.forecast ?? "--"}
            </span>
        </button>
    `).join("");

    body.innerHTML = `
        <p style="margin-bottom: 1rem; color: #94a3b8;">Pilih berita untuk dianalisis:</p>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${buttonsHtml}
        </div>
    `;
}

// ==========================================
// 3. MINTA AI ANALISIS PRE-NEWS
// ==========================================
async function analyzeEvent(eventName) {
    const analysisCard = document.getElementById("newsAnalysisCard");
    const newsList = document.getElementById("newsList");
    const body = analysisCard.querySelector(".card-body");

    // Loading state
    body.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">◌</div>
            <p>AI sedang menganalisis ${eventName}...</p>
        </div>
    `;

    try {
        // POST request ke backend
        const response = await fetch(`${RYFX_NEWS_API}/analyze?event_name=${encodeURIComponent(eventName)}`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        
        const data = await response.json();

        if (!data.success || !data.data) {
            throw new Error(data.detail || "Analisis gagal.");
        }

        // Render hasil analisis
        renderAnalysis(body, data.data);
        
        // Tampilkan placeholder berita (jika backend mengirimnya)
        if (data.data.news_context) {
            newsList.innerHTML = `<p>${data.data.news_context}</p>`;
        } else {
            newsList.innerHTML = `<p class="text-muted">Konteks berita tidak tersedia.</p>`;
        }

    } catch (error) {
        console.error("[AI News] Analyze error:", error);
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠</div>
                <h3>Analisis Gagal</h3>
                <p>${error.message || "Terjadi kesalahan."}</p>
                <button class="btn btn-primary" onclick="loadUpcomingNews()">Coba Lagi</button>
            </div>
        `;
    }
}

// ==========================================
// 4. RENDER HASIL ANALISIS AI
// ==========================================
function renderAnalysis(container, aiData) {
    const analysis = aiData.analysis; // Berdasarkan format analyze_news_event
    
    const signalColor = analysis.direction === "BUY" ? "#22c55e" : 
                       (analysis.direction === "SELL" ? "#ef4444" : "#eab308");

    container.innerHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem;">
                ${aiData.event.name} (Pre-News Analysis)
            </div>
            <div style="font-size: 2rem; font-weight: bold; color: ${signalColor};">
                ${analysis.direction} XAUUSD
            </div>
            <div style="font-size: 0.9rem; color: #94a3b8; margin-top: 0.5rem;">
                Confidence: ${analysis.confidence}% | Impact: ${analysis.impact}
            </div>
        </div>
        <div style="border-top: 1px solid #334155; padding-top: 1rem;">
            <h4 style="margin-bottom: 0.5rem; font-size: 1rem;">AI Reasoning:</h4>
            <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap;">
                ${analysis.reasoning}
            </p>
        </div>
    `;
}

// Ekspos fungsi ke global window agar bisa dipanggil dari HTML onclick
window.loadUpcomingNews = loadUpcomingNews;
window.analyzeEvent = analyzeEvent;
