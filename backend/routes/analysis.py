# ============================================
# RYFX XAU — AI ANALYSIS ROUTES
# GEMINI XAUUSD ANALYSIS API
# ============================================

import math
import logging

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
# LOGGER
# ============================================

logger = logging.getLogger("ryfx.analysis")


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

SUPPORTED_TIMEFRAMES = {
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1d",
}

SUPPORTED_ANALYSIS_TYPES = {
    "technical",
    "scalping",
    "intraday",
    "swing",
}


# ============================================
# HELPERS
# ============================================

def current_timestamp():

    return datetime.now(
        timezone.utc
    ).isoformat()


def valid_price(value):

    if value is None or isinstance(value, bool):
        return False

    try:

        price = float(value)

        return (
            math.isfinite(price)
            and price > 0
        )

    except (
        TypeError,
        ValueError,
        OverflowError
    ):

        return False


def validate_analysis_request(request):

    if request.symbol != "XAUUSD":

        raise HTTPException(
            status_code=400,
            detail="Only XAUUSD analysis is supported."
        )

    if request.timeframe not in SUPPORTED_TIMEFRAMES:

        raise HTTPException(
            status_code=422,
            detail="Unsupported analysis timeframe."
        )

    if request.analysis_type not in SUPPORTED_ANALYSIS_TYPES:

        raise HTTPException(
            status_code=422,
            detail="Unsupported analysis type."
        )


def validate_candle_data(candles):

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

    previous_timestamp = None

    for candle in candles:

        if not isinstance(candle, dict):

            raise ValueError(
                "Invalid candle data."
            )

        timestamp = candle.get("time")

        if (
            isinstance(timestamp, bool)
            or not isinstance(timestamp, (int, float))
            or not math.isfinite(timestamp)
            or timestamp <= 0
        ):

            raise ValueError(
                "Invalid candle timestamp."
            )

        if (
            previous_timestamp is not None
            and timestamp <= previous_timestamp
        ):

            raise ValueError(
                "Candle timestamps must be chronological."
            )

        previous_timestamp = timestamp

        for field in (
            "open",
            "high",
            "low",
            "close"
        ):

            if not valid_price(candle.get(field)):

                raise ValueError(
                    f"Invalid candle {field} price."
                )

        open_price = float(candle["open"])
        high_price = float(candle["high"])
        low_price = float(candle["low"])
        close_price = float(candle["close"])

        if high_price < max(
            open_price,
            close_price,
            low_price
        ):

            raise ValueError(
                "Invalid candle high price."
            )

        if low_price > min(
            open_price,
            close_price,
            high_price
        ):

            raise ValueError(
                "Invalid candle low price."
            )


def validate_technical_price(
    technical_data,
    current_price
):

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

    if not math.isclose(
        float(technical_price),
        float(current_price),
        rel_tol=1e-8,
        abs_tol=1e-8
    ):

        raise ValueError(
            "Technical analysis price does not match the latest candle."
        )


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

    validate_analysis_request(request)

    try:

        # ====================================
        # STEP 2: GET MARKET CANDLES
        # ====================================

        candles = await get_market_candles(
            timeframe=request.timeframe,
            limit=REQUEST_CANDLES
        )

        # ====================================
        # STEP 3: VALIDATE CANDLE DATA
        # ====================================

        validate_candle_data(candles)

        latest_candle = candles[-1]

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

        validate_technical_price(
            technical_data,
            current_price
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

            validated_analysis = AnalysisResult.model_validate(
                raw_analysis
            )

            analysis = validated_analysis.model_dump(
                mode="json"
            )

        except ValidationError as error:

            logger.warning(
                "AI analysis validation failed: %s",
                error
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
            ),

        }

        # ====================================
        # STEP 8: SAVE ANALYSIS HISTORY
        # ========================================

        history_record = save_analysis(

            analysis=analysis,

            timeframe=request.timeframe,

            analysis_type=request.analysis_type,

            market_data=market_snapshot

        )

        # ====================================
        # STEP 9: RETURN RESULT
        # ========================================

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

        logger.error(
            "Market or AI service error: %s",
            error
        )

        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error

    except ValueError as error:

        logger.warning(
            "Analysis validation error: %s",
            error
        )

        raise HTTPException(
            status_code=422,
            detail=str(error)
        ) from error

    except Exception as error:

        logger.exception(
            "Unexpected XAUUSD analysis error."
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to complete XAUUSD AI analysis."
        ) from error


# ============================================
# TECHNICAL ANALYSIS METRICS (TREND, STRUCTURE, VOLATILITY)
# ============================================

@router.get("/xauusd/technical")
async def get_technical_metrics(
    timeframe: str = "15m"
):
    if timeframe not in SUPPORTED_TIMEFRAMES:
        raise HTTPException(
            status_code=422,
            detail="Unsupported timeframe."
        )

    try:
        candles = await get_market_candles(
            timeframe=timeframe,
            limit=REQUEST_CANDLES
        )

        if not candles or len(candles) < 10:
            raise HTTPException(
                status_code=503,
                detail="Insufficient candle data."
            )

        analysis = analyze_market(candles)
        
        atr_value = analysis["indicators"]["atr"]["value"]
        volatility = "HIGH" if (atr_value and atr_value > 5) else "NORMAL"

        return {
            "success": True,
            "data": {
                "trend": analysis["trend"],
                "structure": analysis["market_structure"]["structure"],
                "volatility": volatility
            }
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error("Technical metrics error: %s", error)
        raise HTTPException(
            status_code=502,
            detail="Unable to calculate technical metrics."
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
