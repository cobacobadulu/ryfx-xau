# ============================================
# RYFX XAU — MARKET DATA SERVICE
# XAUS.COM INTEGRATION (FIXED)
# ============================================

import math
import httpx

from datetime import datetime, timezone
from typing import Any

# ============================================
# CONFIGURATION
# ============================================

MARKET_API_TIMEOUT = 15.0
MARKET_API_BASE_URL = "https://xaus.com"

# xaus.com menggunakan simbol "xau" untuk Gold
MARKET_SYMBOL = "xau"

TIMEFRAME_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}

# ============================================
# HTTP CLIENT
# ============================================

async def fetch_market_api(
    endpoint: str,
    params: dict | None = None
) -> dict[str, Any]:

    headers = {
        "Accept": "application/json"
    }
    
    params = params or {}

    url = f"{MARKET_API_BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"

    try:
        async with httpx.AsyncClient(timeout=MARKET_API_TIMEOUT) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

    except httpx.TimeoutException as error:
        raise RuntimeError("MarketAPI request timed out.") from error
    except httpx.HTTPStatusError as error:
        raise RuntimeError(f"MarketAPI returned HTTP {error.response.status_code}.") from error
    except httpx.RequestError as error:
        raise RuntimeError("Unable to connect to MarketAPI.") from error
    except ValueError as error:
        raise ValueError("MarketAPI returned invalid JSON.") from error

    return data

# ============================================
# SAFE NUMBER CONVERSION
# ============================================

def safe_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        number = float(value)
        if not math.isfinite(number):
            return None
        return number
    except (TypeError, ValueError, OverflowError):
        return None

# ============================================
# GET LIVE XAUUSD MARKET DATA
# ============================================

async def get_market_data() -> dict[str, Any]:
    
    response = await fetch_market_api("api/v1/spot")
    
    price = None
    # FIX: Ambil dari objek "xau" -> "price" (3622.05)
    if isinstance(response, dict):
        if "xau" in response and isinstance(response["xau"], dict):
            price = safe_float(response["xau"].get("price"))
        elif "spot_usd_oz" in response:
            price = safe_float(response.get("spot_usd_oz"))
        elif "price" in response:
            price = safe_float(response.get("price"))

    if price is None:
        raise ValueError("Invalid price format from xaus.com")

    # Ambil 1 candle daily untuk High/Low/Open
    try:
        candles = await get_market_candles(timeframe="1d", limit=1)
        latest_candle = candles[-1] if candles else {}
    except Exception:
        latest_candle = {}

    open_price = latest_candle.get("open")
    high_price = latest_candle.get("high")
    low_price = latest_candle.get("low")

    change = None
    change_percent = None
    if open_price:
        change = price - open_price
        change_percent = (change / open_price) * 100

    return {
        "symbol": "XAUUSD",
        "price": price,
        "bid": price, 
        "ask": price,
        "spread": 0.0,
        "open": open_price,
        "high": high_price,
        "low": low_price,
        "change": change,
        "change_percent": change_percent,
        "volume": latest_candle.get("volume"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "LIVE",
        "is_live": True,
    }

# ============================================
# GET XAUUSD CANDLES
# ============================================

async def get_market_candles(
    timeframe: str = "15m",
    limit: int = 200
) -> list[dict[str, Any]]:

    api_timeframe = TIMEFRAME_MAP.get(timeframe)
    if not api_timeframe:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    api_range = "1mo" if limit > 100 else "5d"

    params = {
        "symbol": MARKET_SYMBOL,
        "range": api_range,
        "interval": api_timeframe
    }

    response = await fetch_market_api("api/v1/chart", params=params)

    points = response.get("points", [])
    if not points:
        raise ValueError("MarketAPI returned no valid candles.")

    normalized = []
    for p in points:
        t = p.get("t")
        o = safe_float(p.get("o"))
        h = safe_float(p.get("h"))
        l = safe_float(p.get("l"))
        c = safe_float(p.get("c"))
        v = safe_float(p.get("v"))

        if t and o and h and l and c:
            normalized.append({
                "time": int(t),
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": v
            })

    if not normalized:
        raise ValueError("MarketAPI returned no valid XAUUSD candles.")

    return normalized[-limit:]
