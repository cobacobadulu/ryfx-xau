# ============================================
# RYFX XAU — AI ENGINE
# OPENROUTER INTEGRATION
# ============================================

import json
import math
import logging
import httpx

from typing import Any

from config import settings

logger = logging.getLogger("ryfx.ai")

AI_TIMEOUT = 120.0
MAX_OUTPUT_TOKENS = 3000
MAX_TAKE_PROFITS = 5
MAX_TEXT_LENGTH = 5000

ALLOWED_TIMEFRAMES = {"1m", "5m", "15m", "30m", "1h", "4h", "1d"}
ALLOWED_ANALYSIS_TYPES = {"technical", "scalping", "intraday", "swing"}

# --- SYSTEM PROMPT UNTUK TEKNIKAL ---
SYSTEM_INSTRUCTION = """
You are RYFX XAU AI, a professional gold market analysis assistant.
Analyze only the technical information supplied. Return ONLY valid JSON.
For WAIT: entry, stop_loss, risk_reward must be null and take_profits empty.
"""

# --- SYSTEM PROMPT UNTUK BERITA (NEW) ---
SYSTEM_INSTRUCTION_NEWS = """
You are RYFX XAU AI, a professional macroeconomic analyst focusing on Gold (XAUUSD).
Your task is to analyze upcoming economic news and recent market headlines to provide a PRE-NEWS trading signal.
Return ONLY valid JSON with this exact schema:
{
  "direction": "BUY" | "SELL" | "WAIT",
  "confidence": 0-100,
  "summary": "Short 1-sentence summary",
  "reasoning": "Detailed logical explanation based on macroeconomics, interest rates, and the provided news",
  "impact": "HIGH" | "MEDIUM" | "LOW"
}
Rules:
- If the news is expected to be hawkish (inflation high, rates up), it's bearish for Gold (SELL).
- If the news is expected to be dovish (inflation low, rates down), it's bullish for Gold (BUY).
- Use the forecast data and news context provided.
"""

def validate_number(value: Any, field_name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"Invalid {field_name}.")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{field_name} must be finite.")
    return number

def validate_price(value: Any, field_name: str):
    if value is None: return None
    number = validate_number(value, field_name)
    if number <= 0: raise ValueError(f"{field_name} must be positive.")
    return number

def validate_text(value: Any, field_name: str, required: bool = False) -> str:
    if not isinstance(value, str): raise ValueError(f"Invalid {field_name}.")
    value = value.strip()
    if required and not value: raise ValueError(f"{field_name} cannot be empty.")
    if len(value) > MAX_TEXT_LENGTH: raise ValueError(f"{field_name} is too long.")
    return value

def build_analysis_prompt(technical_data: dict[str, Any], timeframe: str, analysis_type: str) -> str:
    payload = {"symbol": "XAUUSD", "timeframe": timeframe, "analysis_type": analysis_type, "technical_data": technical_data}
    market_json = json.dumps(payload, ensure_ascii=False, allow_nan=False)
    return (
        "Analyze the following XAUUSD market data.\n"
        "Determine whether there is a justified BUY, SELL or WAIT opportunity.\n"
        "Return ONLY a raw JSON object with fields: direction (BUY/SELL/WAIT), confidence (0-100), summary, reasoning, structure, bos, liquidity, volatility, entry (or null), stop_loss (or null), take_profits (array), risk_reward (string or null).\n\n"
        "MARKET DATA:\n" + market_json
    )

# --- FUNGSI BARU: BUILD NEWS PROMPT ---
def build_news_prompt(event_data: dict[str, Any], news_context: str) -> str:
    return (
        f"Analyze the following upcoming economic event for XAUUSD trading:\n"
        f"Event Name: {event_data.get('name')}\n"
        f"Country/Currency: {event_data.get('country')} / {event_data.get('currency')}\n"
        f"Forecast: {event_data.get('forecast')}\n"
        f"Previous: {event_data.get('previous')}\n\n"
        f"Recent Market Headlines:\n{news_context}\n\n"
        "Provide your analysis as a JSON object."
    )

# --- FUNGSI BARU: PARSE NEWS RESPONSE ---
def parse_news_response(response_text: str) -> dict[str, Any]:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"): lines = lines[1:]
        if lines[-1].strip() == "```": lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        raise ValueError("AI returned invalid JSON.")

    direction = str(result.get("direction", "")).upper()
    if direction not in {"BUY", "SELL", "WAIT"}:
        raise ValueError("Invalid direction.")

    return {
        "direction": direction,
        "confidence": validate_number(result.get("confidence", 0), "confidence"),
        "summary": validate_text(result.get("summary", ""), "summary", True),
        "reasoning": validate_text(result.get("reasoning", ""), "reasoning", True),
        "impact": validate_text(result.get("impact", "MEDIUM"), "impact").upper()
    }

async def call_ai(prompt: str, system_prompt: str = SYSTEM_INSTRUCTION) -> dict[str, Any]:
    api_key = settings.AI_API_KEY.strip()
    if not api_key:
        raise RuntimeError("AI_API_KEY has not been configured.")

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "google/gemini-1.5-flash",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": MAX_OUTPUT_TOKENS
    }

    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.is_error:
                logger.error(f"OpenRouter error: {response.status_code} - {response.text}")
                raise RuntimeError(f"OpenRouter returned HTTP {response.status_code}.")
            result = response.json()
    except httpx.TimeoutException:
        raise RuntimeError("AI request timed out.")
    except Exception as e:
        raise RuntimeError(f"AI connection error: {str(e)}")

    try:
        text = result["choices"][0]["message"]["content"]
        # Deteksi format berdasarkan system prompt yang dipakai
        if system_prompt == SYSTEM_INSTRUCTION_NEWS:
            return parse_news_response(text)
        else:
            return parse_ai_response(text)
    except (KeyError, IndexError):
        raise RuntimeError("Invalid response from AI provider.")

def parse_ai_response(response_text: str) -> dict[str, Any]:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"): lines = lines[1:]
        if lines[-1].strip() == "```": lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        raise ValueError("AI returned invalid JSON.")

    direction = str(result.get("direction", "")).upper()
    if direction not in {"BUY", "SELL", "WAIT"}:
        raise ValueError("Invalid direction.")

    confidence = validate_number(result.get("confidence", 0), "confidence")
    summary = validate_text(result.get("summary", ""), "summary", True)
    reasoning = validate_text(result.get("reasoning", ""), "reasoning", True)

    entry = validate_price(result.get("entry"), "entry")
    stop_loss = validate_price(result.get("stop_loss"), "stop_loss")
    take_profits = [validate_price(v, "take_profit") for v in result.get("take_profits", [])]

    risk_reward = result.get("risk_reward")
    if direction == "WAIT":
        entry, stop_loss, take_profits, risk_reward = None, None, [], None
    elif entry is None or stop_loss is None or not take_profits:
        raise ValueError("BUY/SELL requires trade levels.")

    return {
        "direction": direction,
        "confidence": confidence,
        "summary": summary,
        "reasoning": reasoning,
        "structure": validate_text(result.get("structure", ""), "structure"),
        "bos": validate_text(result.get("bos", ""), "bos"),
        "liquidity": validate_text(result.get("liquidity", ""), "liquidity"),
        "volatility": validate_text(result.get("volatility", ""), "volatility"),
        "entry": entry,
        "stop_loss": stop_loss,
        "take_profits": take_profits,
        "risk_reward": risk_reward
    }

async def analyze_xauusd(technical_data: dict[str, Any], timeframe: str = "15m", analysis_type: str = "technical") -> dict[str, Any]:
    if not isinstance(technical_data, dict) or not technical_data:
        raise ValueError("Technical data is empty.")
    
    prompt = build_analysis_prompt(technical_data, timeframe, analysis_type)
    analysis = await call_ai(prompt)

    return {"success": True, "symbol": "XAUUSD", "timeframe": timeframe, "analysis_type": analysis_type, "analysis": analysis}


# ============================================
# RULE-BASED NEWS ANALYSIS (TANPA API KEY)
# ============================================

async def analyze_news_event(event_data: dict[str, Any], news_context: str) -> dict[str, Any]:
    """
    Menganalisis berita ekonomi menggunakan Logika Aturan (Rule-Based).
    Tidak memerlukan AI API Key.
    """
    if not event_data or not event_data.get("name"):
        raise ValueError("Event data is empty or invalid.")

    event_name = str(event_data.get("name", "")).lower()
    forecast = event_data.get("forecast")
    previous = event_data.get("previous")
    
    # Konversi ke float jika memungkinkan
    try:
        f_val = float(forecast) if forecast is not None else None
        p_val = float(previous) if previous is not None else None
    except (ValueError, TypeError):
        f_val = None
        p_val = None

    direction = "WAIT"
    confidence = 50
    summary = "Data tidak cukup untuk analisis."
    reasoning = "Forecast atau Previous tidak tersedia."
    impact = "MEDIUM"

    # ==========================================
    # LOGIKA ATURAN (RULE-BASED)
    # ==========================================
    
    # 1. Berita Inflasi (CPI, PCE, PPI)
    if any(k in event_name for k in ["cpi", "pce", "ppi", "inflation"]):
        impact = "HIGH"
        if f_val is not None and p_val is not None:
            if f_val < p_val:
                direction = "BUY"
                confidence = 75
                summary = f"Ekspektasi inflasi turun ({f_val}% vs {p_val}%)."
                reasoning = f"Forecast {event_name.upper()} lebih rendah dari sebelumnya. Ini mengindikasikan tekanan inflasi mereda (Dovish). The Fed berpotensi menurunkan suku bunga, yang akan melemahkan USD dan menguntungkan Emas (XAU)."
            elif f_val > p_val:
                direction = "SELL"
                confidence = 75
                summary = f"Ekspektasi inflasi naik ({f_val}% vs {p_val}%)."
                reasoning = f"Forecast {event_name.upper()} lebih tinggi dari sebelumnya. Ini mengindikasikan inflasi membandel (Hawkish). The Fed berpotensi mempertahankan suku bunga tinggi, yang akan memperkuat USD dan menekan Emas (XAU)."
            else:
                direction = "WAIT"
                confidence = 60
                summary = "Ekspektasi inflasi stabil."
                reasoning = f"Forecast {event_name.upper()} sama dengan sebelumnya. Pasar cenderung menunggu data aktual."

    # 2. Berita Tenaga Kerja (NFP, Unemployment, Jobless Claims)
    elif any(k in event_name for k in ["nfp", "non-farm", "employment", "unemployment", "jobless"]):
        impact = "HIGH"
        # Logika NFP: NFP tinggi = Ekonomi kuat = Hawkish = SELL Gold
        if f_val is not None and p_val is not None:
            if "unemployment" in event_name or "jobless" in event_name:
                # Untuk pengangguran: angka tinggi = ekonomi lemah = Dovish = BUY Gold
                if f_val > p_val:
                    direction = "BUY"
                    confidence = 70
                    summary = f"Ekspektasi pengangguran naik ({f_val}% vs {p_val}%)."
                    reasoning = f"Forecast {event_name.upper()} menunjukkan pelemahan pasar tenaga kerja. Ini akan membuat The Fed melunak (Dovish), melemahkan USD, dan mendorong Emas (XAU) naik."
                elif f_val < p_val:
                    direction = "SELL"
                    confidence = 70
                    summary = f"Ekspektasi pengangguran turun ({f_val}% vs {p_val}%)."
                    reasoning = f"Forecast {event_name.upper()} menunjukkan penguatan pasar tenaga kerja. Ini akan membuat The Fed hawkish, memperkuat USD, dan menekan Emas (XAU)."
            else:
                # Untuk NFP/Employment: angka tinggi = ekonomi kuat = SELL Gold
                if f_val > p_val:
                    direction = "SELL"
                    confidence = 75
                    summary = f"Ekspektasi tenaga kerja kuat ({f_val} vs {p_val})."
                    reasoning = f"Forecast {event_name.upper()} lebih tinggi dari sebelumnya. Pasar tenaga kerja yang solid akan mendorong The Fed mempertahankan suku bunga tinggi (Hawkish), menguatkan USD, dan menekan Emas (XAU)."
                elif f_val < p_val:
                    direction = "BUY"
                    confidence = 75
                    summary = f"Ekspektasi tenaga kerja melemah ({f_val} vs {p_val})."
                    reasoning = f"Forecast {event_name.upper()} lebih rendah dari sebelumnya. Pelemahan pasar tenaga kerja akan membuat The Fed melunak (Dovish), melemahkan USD, dan menguntungkan Emas (XAU)."

    # 3. Berita Suku Bunga (FOMC, Fed, Interest Rate)
    elif any(k in event_name for k in ["fomc", "fed", "interest rate", "rate decision"]):
        impact = "HIGH"
        direction = "WAIT"
        confidence = 50
        summary = "Berita Suku Bunga The Fed."
        reasoning = f"Event {event_name.upper()} sangat bergantung pada pernyataan (Statement) dan konferensi pers. Untuk pre-news, sinyal teknikal atau sentimen berita lebih dominan."

    # 4. Berita Lainnya
    else:
        impact = "MEDIUM"
        if f_val is not None and p_val is not None:
            if f_val > p_val:
                direction = "SELL"
                confidence = 60
                summary = f"Data ekonomi diperkirakan menguat."
                reasoning = f"Forecast {event_name.upper()} lebih tinggi dari sebelumnya, mengindikasikan ekonomi yang kuat dan cenderung menguntungkan USD (SELL Gold)."
            elif f_val < p_val:
                direction = "BUY"
                confidence = 60
                summary = f"Data ekonomi diperkirakan melemah."
                reasoning = f"Forecast {event_name.upper()} lebih rendah dari sebelumnya, mengindikasikan ekonomi yang lemah dan cenderung melemahkan USD (BUY Gold)."

    # Tambahkan konteks berita jika ada
    if news_context and news_context != "No recent news available.":
        reasoning += f"\n\nBerita Terkait:\n{news_context[:300]}..."

    return {
        "success": True,
        "event": event_data,
        "analysis": {
            "direction": direction,
            "confidence": confidence,
            "summary": summary,
            "reasoning": reasoning,
            "impact": impact
        }
    }
