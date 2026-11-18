# ============================================
# RYFX XAU — AI ANALYSIS ROUTES
# GEMINI XAUUSD ANALYSIS API
# ============================================

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from config import settings

from models.analysis import AnalysisRequest

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
        # STEP 2: GET REAL MARKET CANDLES
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
        # STEP 3: TECHNICAL ANALYSIS
        # ====================================

        technical_data = analyze_market(
            candles
        )

        if not isinstance(technical_data, dict):

            raise ValueError(
                "Technical analysis returned invalid data."
            )

        # ====================================
        # STEP 4: GEMINI AI ANALYSIS
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

        analysis = ai_result.get("analysis")

        if not isinstance(analysis, dict):

            raise ValueError(
                "AI analysis result is missing."
            )

        # ====================================
        # STEP 5: SAVE ANALYSIS HISTORY
        # ====================================

        market_snapshot = {
            "current_price": technical_data.get(
                "current_price"
            ),
            "candles_analyzed": len(candles)
        }

        history_record = save_analysis(
            analysis=analysis,
            timeframe=request.timeframe,
            analysis_type=request.analysis_type,
            market_data=market_snapshot
        )

        # ====================================
        # STEP 6: RETURN RESULT
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
        settings.MARKET_API_URL
    )

    service_ready = (
        ai_configured and market_configured
    )

    return {

        "success": True,

        "service": "RYFX XAU AI Analysis",

        "symbol": "XAUUSD",

        "provider": "Gemini",

        "status": (
            "configured"
            if service_ready
            else "not_configured"
        ),

        "ai_configured": ai_configured,

        "market_configured": market_configured,

        "timestamp": datetime.now(
            timezone.utc
        ).isoformat()

    }
