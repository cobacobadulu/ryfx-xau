# ============================================
# RYFX XAU — MARKET DATA SERVICE
# REAL-TIME GOLD MARKET DATA
# ============================================

import httpx

from typing import Any

from config import settings


# ============================================
# CONFIGURATION
# ============================================

MARKET_API_TIMEOUT = 15.0

MARKET_SYMBOL = "XAUUSD"


# ============================================
# HTTP CLIENT
# ============================================

async def fetch_market_api(
    endpoint: str,
    params: dict | None = None
) -> dict[str, Any]:

    if not settings.MARKET_API_URL:

        raise RuntimeError(
            "MARKET_API_URL has not been configured."
        )

    headers = {
        "Accept": "application/json"
    }

    if settings.MARKET_API_KEY:

        headers["Authorization"] = (
            f"Bearer {settings.MARKET_API_KEY}"
        )

    url = (
        settings.MARKET_API_URL.rstrip("/")
        + "/"
        + endpoint.lstrip("/")
    )

    async with httpx.AsyncClient(
        timeout=MARKET_API_TIMEOUT
    ) as client:

        response = await client.get(
            url,
            headers=headers,
            params=params
        )

        response.raise_for_status()

        data = response.json()

    if not isinstance(data, dict):

        raise ValueError(
            "Invalid market API response."
        )

    return data


# ============================================
# NORMALIZE MARKET DATA
# ============================================

def normalize_market_data(
    data: dict[str, Any]
) -> dict[str, Any]:

    source = data.get("data", data)

    if not isinstance(source, dict):

        raise ValueError(
            "Invalid XAUUSD market data."
        )

    price = source.get(
        "price",
        source.get(
            "close",
            source.get("last")
        )
    )

    if price is None:

        raise ValueError(
            "Market price is missing."
        )

    try:

        price = float(price)

    except (TypeError, ValueError):

        raise ValueError(
            "Invalid market price."
        )

    if price <= 0:

        raise ValueError(
            "Market price must be positive."
        )

    return {

        "symbol": MARKET_SYMBOL,

        "price": price,

        "open": source.get("open"),

        "high": source.get(
            "high",
            source.get("day_high")
        ),

        "low": source.get(
            "low",
            source.get("day_low")
        ),

        "change": source.get("change"),

        "change_percent": source.get(
            "change_percent",
            source.get("percent_change")
        ),

        "volume": source.get("volume"),

        "timestamp": source.get("timestamp")

    }


# ============================================
# GET LIVE XAUUSD MARKET DATA
# ============================================

async def get_market_data() -> dict[str, Any]:

    response = await fetch_market_api(
        "quote",
        params={
            "symbol": MARKET_SYMBOL
        }
    )

    return normalize_market_data(response)


# ============================================
# NORMALIZE CANDLE DATA
# ============================================

def normalize_candles(
    data: Any
) -> list[dict[str, Any]]:

    if isinstance(data, dict):

        candles = (
            data.get("data")
            or data.get("candles")
            or data.get("results")
        )

    else:

        candles = data

    if not isinstance(candles, list):

        raise ValueError(
            "Invalid candle response."
        )

    normalized = []

    for candle in candles:

        if not isinstance(candle, dict):

            continue

        try:

            timestamp = candle.get(
                "time",
                candle.get("timestamp")
            )

            open_price = float(candle["open"])

            high_price = float(candle["high"])

            low_price = float(candle["low"])

            close_price = float(candle["close"])

        except (
            KeyError,
            TypeError,
            ValueError
        ):

            continue

        if not timestamp:

            continue

        if min(
            open_price,
            high_price,
            low_price,
            close_price
        ) <= 0:

            continue

        if high_price < max(
            open_price,
            close_price,
            low_price
        ):

            continue

        if low_price > min(
            open_price,
            close_price,
            high_price
        ):

            continue

        normalized.append({

            "time": timestamp,

            "open": open_price,

            "high": high_price,

            "low": low_price,

            "close": close_price

        })

    normalized.sort(
        key=lambda item: str(item["time"])
    )

    return normalized


# ============================================
# GET XAUUSD CANDLES
# ============================================

async def get_market_candles(
    timeframe: str = "15m",
    limit: int = 200
) -> list[dict[str, Any]]:

    response = await fetch_market_api(

        "candles",

        params={

            "symbol": MARKET_SYMBOL,

            "timeframe": timeframe,

            "limit": limit

        }

    )

    candles = normalize_candles(response)

    return candles[-limit:]
