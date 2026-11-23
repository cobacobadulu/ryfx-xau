# ============================================
# RYFX XAU — MARKET DATA SERVICE
# TWELVEDATA INTEGRATION
# ============================================

import math
import httpx

from datetime import datetime, timezone
from typing import Any

from config import settings

# ============================================
# CONFIGURATION
# ============================================

MARKET_API_TIMEOUT = 15.0
MARKET_API_BASE_URL = "https://api.twelvedata.com"

MARKET_SYMBOL = "XAU/USD" # Twelve Data pakai format XAU/USD

TIMEFRAME_MAP = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1day",
}

# ============================================
# HTTP CLIENT
# ============================================

async def fetch_market_api(
    endpoint: str,
    params: dict | None = None
) -> dict[str, Any]:

    if not settings.MARKET_API_KEY:
        raise RuntimeError("MARKET_API_KEY has not been configured.")

    headers = {
        "Accept": "application/json"
    }
    
    # Twelve Data menggunakan API Key di URL parameter
    params = params or {}
    params["apikey"] = settings.MARKET_API_KEY

    url = f"{MARKET_API_BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"

    try:
        async with httpx.AsyncClient(timeout=MARKET_API_TIMEOUT) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

            # Twelve Data mengembalikan status error di dalam JSON (walau HTTP 200)
            if isinstance(data, dict) and data.get("status") == "error":
                raise RuntimeError(data.get("message", "Unknown API error"))

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
    # 1. Ambil harga spot terbaru
    response = await fetch_market_api("price", params={"symbol": MARKET_SYMBOL})
    
    price = safe_float(response.get("price"))
    if price is None:
        raise ValueError("Invalid price format from Twelve Data")

    # 2. Ambil data harian untuk High/Low/Open
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
        "bid": price, # Twelve Data spot tidak selalu sediakan bid/ask, gunakan price
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
# NORMALIZE TIMESTAMP
# ============================================

def normalize_timestamp(value: Any) -> int | None:
    if value is None:
        return None
    try:
        # Twelve Data menggunakan format string: "YYYY-MM-DD HH:MM:SS"
        if isinstance(value, str):
            parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
            parsed = parsed.replace(tzinfo=timezone.utc)
            return int(parsed.timestamp())
        return None
    except Exception:
        return None

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

    # Twelve Data free tier maksimal 5000 candle per request, tapi kita batasi limit
    params = {
        "symbol": MARKET_SYMBOL,
        "interval": api_timeframe,
        "outputsize": limit,
        "timezone": "UTC"
    }

    response = await fetch_market_api("time_series", params=params)

    values = response.get("values", [])
    if not values:
        raise ValueError("MarketAPI returned no valid candles.")

    normalized = []
    for candle in values:
        timestamp = normalize_timestamp(candle.get("datetime"))
        open_p = safe_float(candle.get("open"))
        high_p = safe_float(candle.get("high"))
        low_p = safe_float(candle.get("low"))
        close_p = safe_float(candle.get("close"))
        vol = safe_float(candle.get("volume"))

        if timestamp and open_p and high_p and low_p and close_p:
            normalized.append({
                "time": timestamp,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": vol
            })

    # Twelve Data mengembalikan data dari yang terbaru ke terlama. Kita balik.
    normalized.reverse()

    if not normalized:
        raise ValueError("MarketAPI returned no valid XAUUSD candles.")

    return normalized[-limit:]
