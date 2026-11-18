# ============================================
# RYFX XAU — MARKET DATA SERVICE
# MARKETAPI INTEGRATION
# ============================================

import math
import httpx

from datetime import datetime, timedelta, timezone
from typing import Any

from config import settings


# ============================================
# CONFIGURATION
# ============================================

MARKET_API_TIMEOUT = 15.0

MARKET_API_BASE_URL = (
    settings.MARKET_API_URL.rstrip("/")
    if settings.MARKET_API_URL
    else "https://api.marketapi.app/v1"
)

MARKET_SYMBOL = "XAUUSD"

TIMEFRAME_MAP = {
    "1m": "M1",
    "5m": "M5",
    "15m": "M15",
    "30m": "M30",
    "1h": "H1",
    "4h": "H4",
    "1d": "D1",
}

TIMEFRAME_MINUTES = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
}

HISTORY_WINDOW_MULTIPLIER = 1.6


# ============================================
# HTTP CLIENT
# ============================================

async def fetch_market_api(
    endpoint: str,
    params: dict | None = None
) -> dict[str, Any]:

    if not settings.MARKET_API_KEY:
        raise RuntimeError(
            "MARKET_API_KEY has not been configured."
        )

    headers = {
        "Accept": "application/json",
        "Authorization": (
            f"Bearer {settings.MARKET_API_KEY}"
        )
    }

    url = (
        MARKET_API_BASE_URL.rstrip("/")
        + "/"
        + endpoint.lstrip("/")
    )

    try:
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

    except httpx.TimeoutException as error:
        raise RuntimeError(
            "MarketAPI request timed out."
        ) from error

    except httpx.HTTPStatusError as error:
        status_code = error.response.status_code

        if status_code in (401, 403):
            raise RuntimeError(
                "MarketAPI authentication failed. "
                "Check the API key and permissions."
            ) from error

        raise RuntimeError(
            f"MarketAPI returned HTTP {status_code}."
        ) from error

    except httpx.RequestError as error:
        raise RuntimeError(
            "Unable to connect to MarketAPI."
        ) from error

    except ValueError as error:
        raise ValueError(
            "MarketAPI returned invalid JSON."
        ) from error

    if not isinstance(data, dict):
        raise ValueError(
            "Invalid MarketAPI response format."
        )

    return data


# ============================================
# SAFE NUMBER CONVERSION
# ============================================

def safe_float(value: Any) -> float | None:

    if value is None or isinstance(value, bool):
        return None

    if value == "":
        return None

    try:
        number = float(value)

    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(number):
        return None

    return number


# ============================================
# NORMALIZE MARKET DATA
# ============================================

def normalize_market_data(
    response: dict[str, Any]
) -> dict[str, Any]:

    quotes = response.get("data")

    if not isinstance(quotes, list):
        raise ValueError(
            "Invalid MarketAPI price response."
        )

    quote = next(
        (
            item for item in quotes
            if isinstance(item, dict)
            and item.get("symbol") == MARKET_SYMBOL
        ),
        None
    )

    if quote is None:
        raise ValueError(
            "No XAUUSD price is currently available."
        )

    bid = safe_float(quote.get("bid"))
    ask = safe_float(quote.get("ask"))
    last = safe_float(quote.get("last"))

    if (
        bid is not None
        and ask is not None
        and bid > 0
        and ask > 0
        and ask < bid
    ):
        raise ValueError(
            "Invalid XAUUSD bid/ask spread."
        )

    if last is not None and last > 0:
        price = last

    elif (
        bid is not None
        and ask is not None
        and bid > 0
        and ask >= bid
    ):
        price = (bid + ask) / 2

    else:
        raise ValueError(
            "MarketAPI returned an invalid XAUUSD quote."
        )

    status = quote.get("status", "UNKNOWN")

    if not isinstance(status, str):
        status = "UNKNOWN"

    status = status.upper()

    allowed_statuses = {
        "LIVE",
        "STALE",
        "MARKET_CLOSED",
        "UNKNOWN",
        "UNAVAILABLE",
    }

    if status not in allowed_statuses:
        status = "UNKNOWN"

    spread = None

    if (
        bid is not None
        and ask is not None
        and bid > 0
        and ask >= bid
    ):
        spread = ask - bid

    return {
        "symbol": MARKET_SYMBOL,
        "price": price,
        "bid": bid,
        "ask": ask,
        "spread": spread,
        "open": None,
        "high": None,
        "low": None,
        "change": None,
        "change_percent": None,
        "volume": None,
        "timestamp": quote.get("time"),
        "status": status,
        "is_live": status == "LIVE",
    }


# ============================================
# GET LIVE XAUUSD MARKET DATA
# ============================================

async def get_market_data() -> dict[str, Any]:

    response = await fetch_market_api(
        "prices/latest",
        params={
            "symbols": MARKET_SYMBOL
        }
    )

    return normalize_market_data(response)


# ============================================
# NORMALIZE TIMESTAMP
# ============================================

def normalize_timestamp(value: Any) -> int | None:

    if value is None or isinstance(value, bool):
        return None

    try:

        if isinstance(value, (int, float)):

            timestamp = float(value)

            if not math.isfinite(timestamp):
                return None

            if timestamp > 10_000_000_000:
                timestamp /= 1000

            if timestamp <= 0:
                return None

            return int(timestamp)

        if isinstance(value, str):

            value = value.strip()

            if not value:
                return None

            try:
                timestamp = float(value)

                if not math.isfinite(timestamp):
                    return None

                if timestamp > 10_000_000_000:
                    timestamp /= 1000

                if timestamp <= 0:
                    return None

                return int(timestamp)

            except ValueError:
                pass

            parsed = datetime.fromisoformat(
                value.replace("Z", "+00:00")
            )

            if parsed.tzinfo is None:
                parsed = parsed.replace(
                    tzinfo=timezone.utc
                )

            timestamp = parsed.timestamp()

            if not math.isfinite(timestamp) or timestamp <= 0:
                return None

            return int(timestamp)

    except (
        ValueError,
        TypeError,
        OverflowError,
        OSError
    ):
        return None

    return None


# ============================================
# NORMALIZE CANDLE DATA
# ============================================

def normalize_candles(
    response: Any
) -> list[dict[str, Any]]:

    if isinstance(response, dict):

        candles = (
            response.get("data")
            or response.get("bars")
            or response.get("candles")
            or response.get("results")
        )

    else:
        candles = response

    if not isinstance(candles, list):
        raise ValueError(
            "Invalid MarketAPI candle response."
        )

    normalized = []

    for candle in candles:

        if not isinstance(candle, dict):
            continue

        timestamp_value = candle.get("time")

        if timestamp_value is None:
            timestamp_value = candle.get("timestamp")

        timestamp = normalize_timestamp(
            timestamp_value
        )

        open_price = safe_float(
            candle.get("open")
        )

        high_price = safe_float(
            candle.get("high")
        )

        low_price = safe_float(
            candle.get("low")
        )

        close_price = safe_float(
            candle.get("close")
        )

        values = [
            open_price,
            high_price,
            low_price,
            close_price,
        ]

        if timestamp is None:
            continue

        if any(
            value is None or value <= 0
            for value in values
        ):
            continue

        if high_price < max(
            open_price,
            close_price,
            low_price,
        ):
            continue

        if low_price > min(
            open_price,
            close_price,
            high_price,
        ):
            continue

        # Ignore candles explicitly marked incomplete.
        if candle.get("complete") is False:
            continue

        normalized.append({
            "time": timestamp,
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close_price,
        })

    # Remove duplicate timestamps.
    unique_candles = {
        candle["time"]: candle
        for candle in normalized
    }

    # Sort oldest to newest.
    return [
        unique_candles[timestamp]
        for timestamp in sorted(unique_candles)
    ]


# ============================================
# GET XAUUSD CANDLES
# ============================================

async def get_market_candles(
    timeframe: str = "15m",
    limit: int = 200
) -> list[dict[str, Any]]:

    api_timeframe = TIMEFRAME_MAP.get(
        timeframe
    )

    if api_timeframe is None:
        raise ValueError(
            f"Unsupported timeframe: {timeframe}"
        )

    if (
        isinstance(limit, bool)
        or not isinstance(limit, int)
        or not 1 <= limit <= 1000
    ):
        raise ValueError(
            "Candle limit must be between 1 and 1000."
        )

    interval = TIMEFRAME_MINUTES[timeframe]

    end_time = datetime.now(
        timezone.utc
    )

    history_minutes = int(
        interval
        * (limit + 5)
        * HISTORY_WINDOW_MULTIPLIER
    )

    start_time = end_time - timedelta(
        minutes=history_minutes
    )

    response = await fetch_market_api(
        "bars",
        params={
            "symbol": MARKET_SYMBOL,
            "timeframe": api_timeframe,
            "from": start_time.isoformat(
                timespec="seconds"
            ).replace("+00:00", "Z"),
            "to": end_time.isoformat(
                timespec="seconds"
            ).replace("+00:00", "Z"),
            "limit": limit,
        }
    )

    candles = normalize_candles(response)

    if not candles:
        raise ValueError(
            "MarketAPI returned no valid XAUUSD candles."
        )

    current_timestamp = int(
        end_time.timestamp()
    )

    candles = [
        candle for candle in candles
        if candle["time"] <= current_timestamp
    ]

    if not candles:
        raise ValueError(
            "No valid historical XAUUSD candles found."
        )

    return candles[-limit:]
