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

    // Sembunyikan sidebar, topbar, dan overlay saat animasi berjalan
    const sidebar = document.querySelector(".sidebar");
    const topbar = document.querySelector(".topbar");
    const overlay = document.querySelector(".sidebar-overlay");
    
    if (sidebar) sidebar.style.display = "none";
    if (topbar) topbar.style.display = "none";
    if (overlay) overlay.style.display = "none";

    // Teks bahasa Inggris (Total waktu teks: 13.5 detik)
    const steps = [
    { text: "⎚ Initializing ryFX Engine...", delay: 4500, color: "#eab308" }, 
    { text: "⎚ Connecting to server...", delay: 4500, color: "#eab308" },     
    { text: "⎚ Access granted...", delay: 4500, color: "#eab308" },
    { text: "⎚ Welcome", delay: 4500, color: "#eab308" } 
  ];
    let currentStep = 0;
    
    // --- LOGIKA PROGRESS BAR 15 DETIK ---
    let progressTime = 0;
    const totalDuration = 15000; // 15.000 milidetik = 15 detik
    const intervalTime = 100; // Update setiap 0.1 detik
    
    const progressInterval = setInterval(() => {
        progressTime += intervalTime;
        
        // Hitung persentase (0 - 100)
        let percent = Math.round((progressTime / totalDuration) * 100);
        
        // Pastikan tidak lebih dari 100%
        if (percent > 100) percent = 100;
        
        updateProgress(percent);

        // Jika sudah 15 detik, hentikan timer
        if (progressTime >= totalDuration) {
            clearInterval(progressInterval);
        }
    }, intervalTime);
    // ------------------------------------

    // Fungsi untuk menambah teks log (Warna default BIRU)
    function addLog(message, color = "#eab308") {
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
        progressText.textContent = `INITIALIZING ${targetPercent}%`; 
    }

    // Fungsi utama untuk menjalankan urutan teks
    function runSequence() {
        if (currentStep >= steps.length) {
            // Jika semua teks selesai (13.5 detik), tunggu sisa waktu hingga 15 detik
            setTimeout(() => {
                // Munculkan kembali sidebar, topbar, dan overlay sebelum pindah halaman
                if (sidebar) sidebar.style.display = "";
                if (topbar) topbar.style.display = "";
                if (overlay) overlay.style.display = "";

                if (window.RYFX_NAVIGATION && typeof window.RYFX_NAVIGATION.navigateTo === "function") {
                    window.RYFX_NAVIGATION.navigateTo("dashboard");
                }
            }, 1500); // Jeda 1.5 detik terakhir (total jadi 15 detik)
            return;
        }

        const step = steps[currentStep];
        
        // Tampilkan teks
        addLog(step.text, step.color);

        // Lanjut ke step berikutnya
        currentStep++;
        setTimeout(runSequence, step.delay);
    }

    // Mulai animasi setelah 0.5 detik halaman dimuat
    setTimeout(runSequence, 500);
}
