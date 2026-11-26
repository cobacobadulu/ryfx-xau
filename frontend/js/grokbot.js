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

    // Teks bahasa Inggris yang baru
    const steps = [
        { text: "> Initializing ryFX Engine...", delay: 800 },
        { text: "> Connecting to server...", delay: 1000 },
        { text: "> Access granted. Welcome, Trader.", delay: 1500, color: "#3b82f6" }
    ];

    let currentStep = 0;

    // Fungsi untuk menambah teks log (Warna default BIRU)
    function addLog(message, color = "#3b82f6") {
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
        addLog(step.text, step.color);
        
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
