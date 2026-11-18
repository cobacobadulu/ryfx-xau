# ============================================
# RYFX XAU — MARKET ROUTES
# MARKETAPI INTEGRATION
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


# ============================================
# HELPERS
# ============================================

def current_timestamp():

    return datetime.now(
        timezone.utc
    ).isoformat()


def valid_price(value):

    try:

        price = float(value)

        return (
            math.isfinite(price)
            and price > 0
        )

    except (TypeError, ValueError):

        return False


def validate_market_data(market):

    if not isinstance(market, dict):
        return False

    return valid_price(
        market.get("price")
    )


# ============================================
# LIVE MARKET DATA
# ============================================

@router.get("/xauusd")
async def get_xauusd_market():

    try:

        market = await get_market_data()

        if not validate_market_data(market):

            raise HTTPException(
                status_code=503,
                detail="Invalid XAUUSD market data."
            )

        return {

            "success": True,

            "symbol": "XAUUSD",

            "data": market,

            "timestamp": current_timestamp()

        }

    except HTTPException:

        raise

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

        if not candles:

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

    except Exception as error:

        print(
            f"RYFX XAU Candle Error: {error}"
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve XAUUSD candle data."
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

        return {

            "success": True,

            "symbol": "XAUUSD",

            "connected": connected,

            "status": (
                market.get("status", "UNKNOWN")
                if connected
                else "DISCONNECTED"
            ),

            "is_live": (
                market.get("is_live", False)
                if connected
                else False
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
