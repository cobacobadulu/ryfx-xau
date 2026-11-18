# ============================================
# RYFX XAU — AI ANALYSIS ROUTES
# GEMINI XAUUSD ANALYSIS API
# ============================================

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.market_data import get_market_candles
from services.technical_analysis import analyze_market
from services.ai_engine import analyze_xauusd


# ============================================
# ROUTER
# ============================================

router = APIRouter(
    prefix="/analysis",
    tags=["AI Market Analysis"]
)


# ============================================
# REQUEST MODEL
# ============================================

class AnalysisRequest(BaseModel):

    symbol: str = "XAUUSD"

    timeframe: str = "15m"

    analysis_type: str = "technical"


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

ALLOWED_ANALYSIS_TYPES = [
    "technical",
    "scalping",
    "intraday",
    "swing"
]


# ============================================
# MAIN ANALYSIS ENDPOINT
# ============================================

@router.post("/xauusd")
async def analyze_xauusd_market(
    request: AnalysisRequest
):

    # Validate symbol

    if request.symbol.upper() != "XAUUSD":

        raise HTTPException(
            status_code=400,
            detail="Only XAUUSD analysis is supported."
        )

    # Validate timeframe

    if request.timeframe not in ALLOWED_TIMEFRAMES:

        raise HTTPException(
            status_code=400,
            detail="Unsupported timeframe."
        )

    # Validate analysis type

    if request.analysis_type not in ALLOWED_ANALYSIS_TYPES:

        raise HTTPException(
            status_code=400,
            detail="Unsupported analysis type."
        )

    try:

        # STEP 1: GET REAL MARKET CANDLES

        candles = await get_market_candles(

            timeframe=request.timeframe,

            limit=250

        )

        if len(candles) < 200:

            raise HTTPException(
                status_code=503,
                detail=(
                    "Insufficient candle data. "
                    "At least 200 candles are required."
                )
            )

        # STEP 2: TECHNICAL ANALYSIS

        technical_data = analyze_market(
            candles
        )

        # STEP 3: GEMINI AI ANALYSIS

        ai_result = await analyze_xauusd(

            technical_data=technical_data,

            timeframe=request.timeframe,

            analysis_type=request.analysis_type

        )

        # STEP 4: RETURN RESULT

        return {

            "success": True,

            "symbol": "XAUUSD",

            "timeframe": request.timeframe,

            "analysis_type": request.analysis_type,

            "market_data": {

                "current_price": (
                    technical_data["current_price"]
                ),

                "candles_analyzed": len(candles)

            },

            "technical_analysis": technical_data,

            "analysis": ai_result["analysis"],

            "timestamp": datetime.now(
                timezone.utc
            ).isoformat()

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

        raise HTTPException(

            status_code=502,

            detail="Unable to complete XAUUSD AI analysis."

        ) from error


# ============================================
# ANALYSIS SERVICE STATUS
# ============================================

@router.get("/status")
async def analysis_status():

    return {

        "success": True,

        "service": "RYFX XAU AI Analysis",

        "symbol": "XAUUSD",

        "provider": "Gemini",

        "status": "available",

        "timestamp": datetime.now(
            timezone.utc
        ).isoformat()

    }
