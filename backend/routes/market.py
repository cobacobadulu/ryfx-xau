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
# LIVE MARKET DATA
# ============================================

@router.get("/xauusd")
async def get_xauusd_market():

    try:

        market = await get_market_data()

        if not market:

            raise HTTPException(
                status_code=503,
                detail="XAUUSD market data is unavailable."
            )


        return {

            "success": True,

            "symbol": "XAUUSD",

            "data": market,

            "timestamp": datetime.now(
                timezone.utc
            ).isoformat()

        }


    except HTTPException:

        raise


    except Exception as error:

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

    allowed_timeframes = [

        "1m",

        "5m",

        "15m",

        "30m",

        "1h",

        "4h",

        "1d"

    ]


    if timeframe not in allowed_timeframes:

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

            "timestamp": datetime.now(
                timezone.utc
            ).isoformat()

        }


    except HTTPException:

        raise


    except Exception as error:

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

        connected = bool(market)


        return {

            "success": True,

            "symbol": "XAUUSD",

            "connected": connected,

            "status": (

                "connected"

                if connected

                else "disconnected"

            ),

            "timestamp": datetime.now(
                timezone.utc
            ).isoformat()

        }


    except Exception:

        return {

            "success": True,

            "symbol": "XAUUSD",

            "connected": False,

            "status": "disconnected",

            "timestamp": datetime.now(
                timezone.utc
            ).isoformat()

        }
