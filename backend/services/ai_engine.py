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

SYSTEM_INSTRUCTION = """
You are RYFX XAU AI, a professional gold market analysis assistant.
Analyze only the technical information supplied. Return ONLY valid JSON.
For WAIT: entry, stop_loss, risk_reward must be null and take_profits empty.
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

async def call_ai(prompt: str) -> dict[str, Any]:
    api_key = settings.AI_API_KEY.strip()
    if not api_key:
        raise RuntimeError("AI_API_KEY has not been configured.")

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "google/gemini-1.5-flash", # OpenRouter menyediakan Gemini
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
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

    # Validasi minimal
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
