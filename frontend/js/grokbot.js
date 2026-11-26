/* =========================================
   ryFX XAU — GROKBOT INTRO ANIMATION
========================================= */

"use strict";

document.addEventListener("ryfx:page-loaded", event => {
    if (event.detail.page !== "grokbot") return;
    
    startGrokbotIntro();
});

function startGrokbotIntro() {
    const logsContainer = document.getElementById("terminal-logs");
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");
    
    if (!logsContainer) return;

    const steps = [
        { text: "> Booting ryFX Engine...", delay: 500 },
        { text: "> Connecting to XAUUSD Market Stream...", delay: 1000 },
        { text: "> Fetching AI Analysis parameters...", delay: 800 },
        { text: "> Syncing Database (Supabase)...", delay: 1200 },
        { text: "> Structuring Workspace Sidebar...", delay: 600 },
        { text: "> Loading Modules: [Dashboard, Live Market, AI News, Signals]...", delay: 900 },
        { text: "> System Online. Welcome.", delay: 1000, color: "#ec4899" }
    ];

    let currentStep = 0;

    // Fungsi untuk menambah teks log
    function addLog(message, color = "#22c55e") {
        const p = document.createElement("div");
        p.innerHTML = message;
        p.style.color = color;
        p.style.opacity = "0";
        p.style.transition = "opacity 0.5s ease";
        logsContainer.appendChild(p);
        
        setTimeout(() => {
            p.style.opacity = "1";
        }, 50);
    }

    // Fungsi untuk mengupdate progress bar
    function updateProgress(targetPercent) {
        progressBar.style.width = `${targetPercent}%`;
        progressText.textContent = `${targetPercent}%`;
    }

    // Fungsi utama untuk menjalankan urutan
    function runSequence() {
        if (currentStep >= steps.length) {
            // Jika semua langkah selesai, pindah ke dashboard
            setTimeout(() => {
                if (window.RYFX_NAVIGATION && typeof window.RYFX_NAVIGATION.navigateTo === "function") {
                    window.RYFX_NAVIGATION.navigateTo("dashboard");
                }
            }, 1500); // Jeda 1.5 detik sebelum pindah
            return;
        }

        const step = steps[currentStep];
        
        // Tampilkan teks
        addLog(step.text, step.color || "#22c55e");
        
        // Hitung persentase progress
        const percent = Math.round(((currentStep + 1) / steps.length) * 100);
        updateProgress(percent);

        // Lanjut ke step berikutnya
        currentStep++;
        setTimeout(runSequence, step.delay);
    }

    // Mulai animasi setelah 0.5 detik halaman dimuat
    setTimeout(runSequence, 500);
}
