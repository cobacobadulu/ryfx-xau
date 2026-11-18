# ============================================
# RYFX XAU — MARKET ROUTES
# XAUUSD LIVE MARKET API
# ============================================

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

ALLOWED_TIMEFRAMES = [
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1d"
]


# ============================================
# HELPERS
# ============================================

def current_timestamp():

    return datetime.now(
        timezone.utc
    ).isoformat()


# ============================================
# LIVE MARKET DATA
# ============================================

@router.get("/xauusd")
async def get_xauusd_market():

    try:

        market = await get_market_data()

        if not isinstance(market, dict) or not market:

            raise HTTPException(
                status_code=503,
                detail="XAUUSD market data is unavailable."
            )

        price = market.get("price")

        if price is None or float(price) <= 0:

            raise HTTPException(
                status_code=503,
                detail="Invalid XAUUSD market price."
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

        connected = isinstance(
            market,
            dict
        ) and bool(market)

        price = (
            market.get("price")
            if connected
            else None
        )

        if price is None or float(price) <= 0:

            connected = False

        return {

            "success": True,

            "symbol": "XAUUSD",

            "connected": connected,

            "status": (
                "connected"
                if connected
                else "disconnected"
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

            "status": "disconnected",

            "timestamp": current_timestamp()

        }
