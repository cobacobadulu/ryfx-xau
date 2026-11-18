# ============================================
# RYFX XAU — AI ANALYSIS ROUTES
# GEMINI XAUUSD ANALYSIS API
# ============================================

import math

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from config import settings

from models.analysis import (
    AnalysisRequest,
    AnalysisResult
)

from services.market_data import get_market_candles
from services.technical_analysis import analyze_market
from services.ai_engine import analyze_xauusd

from routes.history import save_analysis


# ============================================
# ROUTER
# ============================================

router = APIRouter(
    prefix="/analysis",
    tags=["AI Market Analysis"]
)


# ============================================
# CONFIGURATION
# ============================================

MINIMUM_CANDLES = 200
REQUEST_CANDLES = 250


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

    except (TypeError, ValueError):

        return False


# ============================================
# MAIN ANALYSIS ENDPOINT
# ============================================

@router.post("/xauusd")
async def analyze_xauusd_market(
    request: AnalysisRequest
):

    # ========================================
    # STEP 1: VALIDATE REQUEST
    # ========================================

    if request.symbol != "XAUUSD":

        raise HTTPException(
            status_code=400,
            detail="Only XAUUSD analysis is supported."
        )

    try:

        # ====================================
        # STEP 2: GET MARKET CANDLES
        # ====================================

        candles = await get_market_candles(
            timeframe=request.timeframe,
            limit=REQUEST_CANDLES
        )

        if not isinstance(candles, list):

            raise ValueError(
                "Invalid market candle response."
            )

        if len(candles) < MINIMUM_CANDLES:

            raise HTTPException(
                status_code=503,
                detail=(
                    "Insufficient candle data. "
                    "At least 200 candles are required."
                )
            )

        # ====================================
        # STEP 3: VALIDATE LATEST CANDLE
        # ====================================

        latest_candle = candles[-1]

        if not isinstance(latest_candle, dict):

            raise ValueError(
                "Invalid latest market candle."
            )

        current_price = latest_candle.get(
            "close"
        )

        if not valid_price(current_price):

            raise ValueError(
                "Invalid latest XAUUSD market price."
            )

        # ====================================
        # STEP 4: TECHNICAL ANALYSIS
        # ====================================

        technical_data = analyze_market(
            candles
        )

        if not isinstance(technical_data, dict):

            raise ValueError(
                "Technical analysis returned invalid data."
            )

        technical_price = technical_data.get(
            "current_price"
        )

        if not valid_price(technical_price):

            raise ValueError(
                "Technical analysis returned an invalid price."
            )

        # ====================================
        # STEP 5: GEMINI AI ANALYSIS
        # ====================================

        ai_result = await analyze_xauusd(
            technical_data=technical_data,
            timeframe=request.timeframe,
            analysis_type=request.analysis_type
        )

        if not isinstance(ai_result, dict):

            raise ValueError(
                "AI engine returned an invalid response."
            )

        raw_analysis = ai_result.get(
            "analysis"
        )

        if not isinstance(raw_analysis, dict):

            raise ValueError(
                "AI analysis result is missing."
            )

        # ====================================
        # STEP 6: PYDANTIC VALIDATION
        # ====================================

        try:

            validated_analysis = (
                AnalysisResult.model_validate(
                    raw_analysis
                )
            )

            analysis = validated_analysis.model_dump(
                mode="json"
            )

        except ValidationError as error:

            print(
                f"RYFX XAU AI Validation Error: {error}"
            )

            raise ValueError(
                "AI returned analysis data that failed validation."
            ) from error

        # ====================================
        # STEP 7: MARKET SNAPSHOT
        # ====================================

        market_snapshot = {

            "symbol": "XAUUSD",

            "current_price": float(current_price),

            "timeframe": request.timeframe,

            "candles_analyzed": len(candles),

            "last_candle_time": latest_candle.get(
                "time"
            )

        }

        # ====================================
        # STEP 8: SAVE ANALYSIS HISTORY
        # ====================================

        history_record = save_analysis(

            analysis=analysis,

            timeframe=request.timeframe,

            analysis_type=request.analysis_type,

            market_data=market_snapshot

        )

        # ====================================
        # STEP 9: RETURN RESULT
        # ====================================

        return {

            "success": True,

            "symbol": "XAUUSD",

            "timeframe": request.timeframe,

            "analysis_type": request.analysis_type,

            "history_id": history_record["id"],

            "market_data": market_snapshot,

            "technical_analysis": technical_data,

            "analysis": analysis,

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
            status_code=422,
            detail=str(error)
        ) from error

    except Exception as error:

        print(
            f"RYFX XAU Analysis Error: {error}"
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to complete XAUUSD AI analysis."
        ) from error


# ============================================
# ANALYSIS SERVICE STATUS
# ============================================

@router.get("/status")
async def analysis_status():

    ai_configured = bool(
        settings.AI_API_KEY
    )

    market_configured = bool(
        settings.MARKET_API_KEY
        and settings.MARKET_API_URL
    )

    service_ready = (
        ai_configured
        and market_configured
    )

    return {

        "success": True,

        "service": "RYFX XAU AI Analysis",

        "symbol": "XAUUSD",

        "provider": settings.AI_PROVIDER,

        "status": (
            "configured"
            if service_ready
            else "not_configured"
        ),

        "ai_configured": ai_configured,

        "market_configured": market_configured,

        "timestamp": current_timestamp()

    }
