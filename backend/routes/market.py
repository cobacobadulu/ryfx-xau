# ============================================
# RYFX XAU — MARKET ROUTES
# TWELVEDATA INTEGRATION
# ============================================

import math

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from services.market_data import (
    get_market_data,
    get_market_candles
)


# ============================================
# ROUTER
# ============================================

router = APIRouter(
    prefix="/market",
    tags=["XAUUSD Market"]
)


# ============================================
# CONFIGURATION
# ============================================

ALLOWED_TIMEFRAMES = {
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1d"
}

VALID_MARKET_STATUSES = {
    "LIVE",
    "STALE",
    "MARKET_CLOSED",
    "CLOSED",
    "DELAYED",
    "UNKNOWN"
}


# ============================================
# HELPERS
# ============================================

def current_timestamp():

    return datetime.now(
        timezone.utc
    ).isoformat()


def valid_price(value):

    if isinstance(value, bool):
        return False

    try:

        price = float(value)

        return (
            math.isfinite(price)
            and price > 0
        )

    except (TypeError, ValueError, OverflowError):

        return False


def validate_market_data(market):

    if not isinstance(market, dict):
        return False

    if not valid_price(market.get("price")):
        return False

    # Twelve Data tidak menyediakan bid/ask, jadi kita longgarkan validasinya
    return True


def normalize_market_status(market):

    status = market.get(
        "status",
        "UNKNOWN"
    )

    if not isinstance(status, str):
        return "UNKNOWN"

    status = status.upper()

    if status not in VALID_MARKET_STATUSES:
        return "UNKNOWN"

    return status


# ============================================
# LIVE MARKET DATA
# ============================================

@router.get("/xauusd")
async def get_xauusd_market():

    try:

        market = await get_market_data()

        if not validate_market_data(market):

            raise HTTPException(
                status_code=502,
                detail="Invalid XAUUSD market data."
            )

        market["status"] = normalize_market_status(
            market
        )

        return {

            "success": True,

            "symbol": "XAUUSD",

            "data": market,

            "timestamp": current_timestamp()

        }

    except HTTPException:

        raise

    except RuntimeError as error:

        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error

    except Exception as error:

        print(
            f"RYFX XAU Market Error: {error}"
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve XAUUSD market data."
        ) from error


# ============================================
# XAUUSD CANDLE DATA
# ============================================

@router.get("/candles")
async def get_xauusd_candles(

    timeframe: str = Query(
        default="15m"
    ),

    limit: int = Query(
        default=200,
        ge=1,
        le=1000
    )

):

    if timeframe not in ALLOWED_TIMEFRAMES:

        raise HTTPException(
            status_code=400,
            detail="Unsupported timeframe."
        )

    try:

        candles = await get_market_candles(
            timeframe=timeframe,
            limit=limit
        )

        if not isinstance(candles, list) or not candles:

            raise HTTPException(
                status_code=503,
                detail="XAUUSD candle data is unavailable."
            )

        return {

            "success": True,

            "symbol": "XAUUSD",

            "timeframe": timeframe,

            "count": len(candles),

            "data": candles,

            "timestamp": current_timestamp()

        }

    except HTTPException:

        raise

    except RuntimeError as error:

        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=502,
            detail=str(error)
        ) from error

    except Exception as error:

        print(
            f"RYFX XAU Candle Error: {error}"
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve XAUUSD candle data."
        ) from error


# ============================================
# XAUUSD LIVE CANDLE
# ============================================

@router.get("/live")
async def get_xauusd_live_candle(

    timeframe: str = Query(
        default="15m"
    )

):

    if timeframe not in ALLOWED_TIMEFRAMES:

        raise HTTPException(
            status_code=400,
            detail="Unsupported timeframe."
        )

    try:

        candles = await get_market_candles(
            timeframe=timeframe,
            limit=2
        )

        if not isinstance(candles, list) or not candles:

            raise HTTPException(
                status_code=503,
                detail="XAUUSD live candle is unavailable."
            )

        last_candle = candles[-1]

        required_fields = ("time", "open", "high", "low", "close")

        if not all(
            field in last_candle
            for field in required_fields
        ):

            raise HTTPException(
                status_code=502,
                detail="Malformed candle data."
            )

        return {

            "success": True,

            "symbol": "XAUUSD",

            "timeframe": timeframe,

            "data": {

                "time": last_candle["time"],

                "open": last_candle["open"],

                "high": last_candle["high"],

                "low": last_candle["low"],

                "close": last_candle["close"]

            },

            "timestamp": current_timestamp()

        }

    except HTTPException:

        raise

    except RuntimeError as error:

        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=502,
            detail=str(error)
        ) from error

    except Exception as error:

        print(
            f"RYFX XAU Live Candle Error: {error}"
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve XAUUSD live candle."
        ) from error


# ============================================
# MARKET STATUS
# ============================================

@router.get("/status")
async def get_market_status():

    try:

        market = await get_market_data()

        connected = validate_market_data(
            market
        )

        status = (
            normalize_market_status(market)
            if connected
            else "DISCONNECTED"
        )

        return {

            "success": True,

            "symbol": "XAUUSD",

            "connected": connected,

            "status": status,

            "is_live": (
                connected
                and status == "LIVE"
            ),

            "price": (
                market.get("price")
                if connected
                else None
            ),

            "timestamp": current_timestamp()

        }

    except Exception as error:

        print(
            f"RYFX XAU Market Status Error: {error}"
        )

        return {

            "success": True,

            "symbol": "XAUUSD",

            "connected": False,

            "status": "DISCONNECTED",

            "is_live": False,

            "price": None,

            "timestamp": current_timestamp()

        }
