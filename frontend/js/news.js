/* =========================================
   ryFX XAU — AI NEWS MODULE
========================================= */

"use strict";

document.addEventListener("ryfx:page-loaded", event => {
    // Hanya jalankan script ini jika halaman yang dimuat adalah ai-news
    if (event.detail.page !== "ai-news") return;

    console.log("[AI News] Halaman dimuat, siap mengambil data...");
    
    // Panggil fungsi untuk mengambil data
    fetchNewsAnalysis();
});

async function fetchNewsAnalysis() {
    const analysisCard = document.getElementById("newsAnalysisCard");
    const newsList = document.getElementById("newsList");

    if (!analysisCard || !newsList) return;

    try {
        // Simulasi fetch ke backend (Kita gunakan setTimeout dulu untuk tes UI)
        // Nanti URL ini diganti dengan: `${window.RYFX_API.BASE_URL}/api/analyze-news`
        
        // TAMPILAN LOADING
        analysisCard.querySelector(".card-body").innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◌</div>
                <p>Analyzing market data...</p>
            </div>
        `;

        // --- SIMULASI RESPON BACKEND (DUMMY DATA) ---
        // Hapus blok setTimeout ini nanti jika backend sudah siap
        const dummyResponse = await new Promise(resolve => setTimeout(() => {
            resolve({
                event: { name: "Core PCE MoM", actual: 0.4, forecast: 0.3 },
                analysis: {
                    signal: "SELL",
                    asset: "XAUUSD",
                    confidence: 75,
                    reasons: [
                        "Data Core PCE (0.4%) lebih tinggi dari ekspektasi (0.3%).",
                        "Inflasi membandel membuat The Fed menunda penurunan suku bunga.",
                        "Suku bunga tinggi memperkuat USD, menekan harga Emas (XAU)."
                    ]
                },
                related_news: [
                    { title: "Inflasi AS Masih Panas, Emas Tertekan", url: "#" },
                    { title: "Fed Officials Signal Higher for Longer", url: "#" }
                ]
            });
        }, 1500));
        // --------------------------------------------

        // Tampilkan Analisis
        renderAnalysis(analysisCard, dummyResponse.analysis);
        
        // Tampilkan Berita
        renderNewsList(newsList, dummyResponse.related_news);

    } catch (error) {
        console.error("[AI News Error]", error);
        analysisCard.querySelector(".card-body").innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠</div>
                <p>Gagal mengambil data analisis.</p>
            </div>
        `;
    }
}

function renderAnalysis(cardElement, analysis) {
    const body = cardElement.querySelector(".card-body");
    
    // Tentukan warna sinyal
    const signalColor = analysis.signal === "BUY" ? "#22c55e" : (analysis.signal === "SELL" ? "#ef4444" : "#eab308");

    const reasonsHtml = analysis.reasons.map(r => `<li>${r}</li>`).join("");

    body.innerHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem;">Current Signal</div>
            <div style="font-size: 2rem; font-weight: bold; color: ${signalColor};">
                ${analysis.signal} ${analysis.asset}
            </div>
            <div style="font-size: 0.9rem; color: #94a3b8; margin-top: 0.5rem;">
                Confidence: ${analysis.confidence}%
            </div>
        </div>
        <div style="border-top: 1px solid #334155; padding-top: 1rem;">
            <h4 style="margin-bottom: 0.5rem; font-size: 1rem;">Reasoning:</h4>
            <ul style="padding-left: 1.2rem; color: #cbd5e1; font-size: 0.9rem; line-height: 1.6;">
                ${reasonsHtml}
            </ul>
        </div>
    `;
}

function renderNewsList(container, newsArray) {
    if (!newsArray || newsArray.length === 0) {
        container.innerHTML = `<p class="text-muted">Tidak ada berita terbaru.</p>`;
        return;
    }

    const newsHtml = newsArray.map(news => `
        <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #334155;">
            <a href="${news.url}" target="_blank" style="color: #e2e8f0; text-decoration: none; font-weight: 500;">
                ${news.title}
            </a>
        </div>
    `).join("");

    container.innerHTML = newsHtml;
}
