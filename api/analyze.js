export default async function handler(req, res) {
    // Hanya izinkan metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ detail: "Method Not Allowed" });
    }

    const { timeframe, analysis_type } = req.body;
    const apiKey = process.env.AI_API_KEY; // Ambil dari environment Vercel

    if (!apiKey) {
        return res.status(500).json({ detail: "AI_API_KEY not configured in Vercel" });
    }

    // PERHATIKAN: URL Gemini pakai format yang benar
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Prompt sederhana
    const prompt = `
        Analyze XAUUSD for timeframe ${timeframe} using ${analysis_type} approach.
        Return ONLY a JSON object with fields: direction (BUY/SELL/WAIT), confidence (0-100), summary, reasoning.
        No markdown, no backticks, just JSON.
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ detail: data.error?.message || "Gemini Error" });
        }

        const text = data.candidates[0].content.parts[0].text;
        const analysis = JSON.parse(text);

        return res.status(200).json({ success: true, analysis: analysis });

    } catch (error) {
        return res.status(500).json({ detail: error.message });
    }
}
