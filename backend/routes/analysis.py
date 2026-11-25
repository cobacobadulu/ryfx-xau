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
from services.ai_engine import analyze_xauusd, analyze_news_event

# --- IMPORT BARU UNTUK NEWS ---
from services.econ_calendar import fetch_upcoming_events, get_event_for_analysis
from services.news_fetcher import build_news_context

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
    return datetime.now(timezone.utc).isoformat()


def valid_price(value):
    if value is None or isinstance(value, bool):
        return False
    try:
        price = float(value)
        return (math.isfinite(price) and price > 0)
    except (TypeError, ValueError, OverflowError):
        return False


def validate_analysis_request(request):
    if request.symbol != "XAUUSD":
        raise HTTPException(status_code=400, detail="Only XAUUSD analysis is supported.")
    if request.timeframe not in SUPPORTED_TIMEFRAMES:
        raise HTTPException(status_code=422, detail="Unsupported analysis timeframe.")
    if request.analysis_type not in SUPPORTED_ANALYSIS_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported analysis type.")


def validate_candle_data(candles):
    if not isinstance(candles, list):
        raise ValueError("Invalid market candle response.")
    if len(candles) < MINIMUM_CANDLES:
        raise HTTPException(status_code=503, detail="Insufficient candle data. At least 200 candles are required.")

    previous_timestamp = None
    for candle in candles:
        if not isinstance(candle, dict):
            raise ValueError("Invalid candle data.")
        timestamp = candle.get("time")
        if (isinstance(timestamp, bool) or not isinstance(timestamp, (int, float)) or not math.isfinite(timestamp) or timestamp <= 0):
            raise ValueError("Invalid candle timestamp.")
        if previous_timestamp is not None and timestamp <= previous_timestamp:
            raise ValueError("Candle timestamps must be chronological.")
        previous_timestamp = timestamp

        for field in ("open", "high", "low", "close"):
            if not valid_price(candle.get(field)):
                raise ValueError(f"Invalid candle {field} price.")

        open_price = float(candle["open"])
        high_price = float(candle["high"])
        low_price = float(candle["low"])
        close_price = float(candle["close"])

        if high_price < max(open_price, close_price, low_price):
            raise ValueError("Invalid candle high price.")
        if low_price > min(open_price, close_price, high_price):
            raise ValueError("Invalid candle low price.")


def validate_technical_price(technical_data, current_price):
    if not isinstance(technical_data, dict):
        raise ValueError("Technical analysis returned invalid data.")
    technical_price = technical_data.get("current_price")
    if not valid_price(technical_price):
        raise ValueError("Technical analysis returned an invalid price.")
    if not math.isclose(float(technical_price), float(current_price), rel_tol=1e-8, abs_tol=1e-8):
        raise ValueError("Technical analysis price does not match the latest candle.")


# ============================================
# MAIN ANALYSIS ENDPOINT
# ============================================

@router.post("/xauusd")
async def analyze_xauusd_market(request: AnalysisRequest):
    validate_analysis_request(request)

    try:
        candles = await get_market_candles(timeframe=request.timeframe, limit=REQUEST_CANDLES)
        validate_candle_data(candles)
        
        latest_candle = candles[-1]
        current_price = latest_candle.get("close")
        if not valid_price(current_price):
            raise ValueError("Invalid latest XAUUSD market price.")

        technical_data = analyze_market(candles)
        validate_technical_price(technical_data, current_price)

        ai_result = await analyze_xauusd(
            technical_data=technical_data,
            timeframe=request.timeframe,
            analysis_type=request.analysis_type
        )
        if not isinstance(ai_result, dict):
            raise ValueError("AI engine returned an invalid response.")

        raw_analysis = ai_result.get("analysis")
        if not isinstance(raw_analysis, dict):
            raise ValueError("AI analysis result is missing.")

        try:
            validated_analysis = AnalysisResult.model_validate(raw_analysis)
            analysis = validated_analysis.model_dump(mode="json")
        except ValidationError as error:
            logger.warning("AI analysis validation failed: %s", error)
            raise ValueError("AI returned analysis data that failed validation.") from error

        market_snapshot = {
            "symbol": "XAUUSD",
            "current_price": float(current_price),
            "timeframe": request.timeframe,
            "candles_analyzed": len(candles),
            "last_candle_time": latest_candle.get("time"),
        }

        history_record = save_analysis(
            analysis=analysis,
            timeframe=request.timeframe,
            analysis_type=request.analysis_type,
            market_data=market_snapshot
        )

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
        logger.error("Market or AI service error: %s", error)
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        logger.warning("Analysis validation error: %s", error)
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unexpected XAUUSD analysis error.")
        raise HTTPException(status_code=502, detail="Unable to complete XAUUSD AI analysis.") from error


# ============================================
# TECHNICAL ANALYSIS METRICS (TREND, STRUCTURE, VOLATILITY)
# ============================================

@router.get("/xauusd/technical")
async def get_technical_metrics(timeframe: str = "15m"):
    if timeframe not in SUPPORTED_TIMEFRAMES:
        raise HTTPException(status_code=422, detail="Unsupported timeframe.")

    try:
        candles = await get_market_candles(timeframe=timeframe, limit=REQUEST_CANDLES)
        if not candles or len(candles) < 10:
            raise HTTPException(status_code=503, detail="Insufficient candle data.")

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
        raise HTTPException(status_code=502, detail="Unable to calculate technical metrics.") from error


# ============================================
# CHART SCANNER ANALYSIS (AI STRATEGY)
# ============================================

@router.get("/scanner")
async def run_chart_scanner(timeframe: str = "15m", strategy: str = "technical"):
    if timeframe not in SUPPORTED_TIMEFRAMES:
        raise HTTPException(status_code=422, detail="Unsupported timeframe.")

    if strategy not in SUPPORTED_ANALYSIS_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported strategy type.")

    try:
        candles = await get_market_candles(timeframe=timeframe, limit=REQUEST_CANDLES)
        if not candles or len(candles) < 10:
            raise HTTPException(status_code=503, detail="Insufficient candle data.")

        analysis = analyze_market(candles)
        
        trend = analysis["trend"]
        structure = analysis["market_structure"]["structure"]
        support = analysis["support_resistance"]["support"]
        resistance = analysis["support_resistance"]["resistance"]
        atr = analysis["indicators"]["atr"]["value"]
        rsi = analysis["indicators"]["rsi"]["value"]

        direction = "WAIT"
        confidence = 50
        summary = "Market is ranging."
        
        if trend == "BULLISH":
            direction = "BUY"
            confidence = 75
            summary = "Bullish trend detected. Price is above major EMAs."
        elif trend == "BEARISH":
            direction = "SELL"
            confidence = 75
            summary = "Bearish trend detected. Price is below major EMAs."

        # Logika Spesifik per Strategi
        if strategy == "scalping":
            if trend == "BULLISH" and rsi and rsi < 70:
                confidence = 85
                summary = "Scalping Setup: Bullish momentum with room to grow (RSI < 70)."
            elif trend == "BEARISH" and rsi and rsi > 30:
                confidence = 85
                summary = "Scalping Setup: Bearish momentum with room to drop (RSI > 30)."
            else:
                confidence = 60
                summary = "Scalping Setup: Waiting for better momentum confirmation."

        elif strategy == "intraday":
            if structure in ["BULLISH", "BEARISH"]:
                confidence = 80
                summary = f"Intraday Setup: Clear {structure} market structure on this timeframe."
            else:
                summary = "Intraday Setup: Market is consolidating. Wait for a breakout."

        elif strategy == "swing":
            if atr and atr > 5:
                confidence = 80
                summary = "Swing Setup: High volatility detected, suitable for swing entries."
            else:
                summary = "Swing Setup: Low volatility. Better to wait for a larger move."

        return {
            "success": True,
            "data": {
                "direction": direction,
                "confidence": confidence,
                "summary": summary,
                "structure": structure,
                "liquidity": "Normal" if atr and atr < 10 else "High Volatility",
                "bos": "Detected" if structure in ["BULLISH", "BEARISH"] else "None",
                "supply_zone": resistance,
                "demand_zone": support,
                "insight": summary
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Scanner error: %s", error)
        raise HTTPException(status_code=502, detail="Unable to scan chart.") from error


# ============================================
# FULL AI ANALYSIS (SINGLE TIMEFRAME + TRADE LEVELS)
# ============================================

@router.get("/full-analysis")
async def run_full_analysis(timeframe: str = "15m"):
    if timeframe not in SUPPORTED_TIMEFRAMES:
        raise HTTPException(status_code=422, detail="Unsupported timeframe.")

    try:
        candles = await get_market_candles(timeframe=timeframe, limit=REQUEST_CANDLES)
        if not candles or len(candles) < 10:
            raise HTTPException(status_code=503, detail="Insufficient candle data.")

        analysis = analyze_market(candles)
        trend = analysis["trend"]
        structure = analysis["market_structure"]["structure"]
        entry_price = analysis["current_price"]

        direction = "WAIT"
        confidence = 50
        summary = "Market is ranging. No clear setup."
        
        sl_price = None
        tp1_price = None
        tp2_price = None
        tp3_price = None
        rr_ratio = "--"

        if trend == "BULLISH":
            direction = "BUY"
            confidence = 80
            summary = "Bullish trend detected with strong momentum."
            
            sl_price = round(entry_price - 5.0, 2)
            tp1_price = round(entry_price + 5.0, 2)
            tp2_price = round(entry_price + 10.0, 2)
            tp3_price = round(entry_price + 20.0, 2)
            rr_ratio = "1:1 / 1:2 / 1:4"

        elif trend == "BEARISH":
            direction = "SELL"
            confidence = 80
            summary = "Bearish trend detected with strong momentum."
            
            sl_price = round(entry_price + 5.0, 2)
            tp1_price = round(entry_price - 5.0, 2)
            tp2_price = round(entry_price - 10.0, 2)
            tp3_price = round(entry_price - 20.0, 2)
            rr_ratio = "1:1 / 1:2 / 1:4"

        smc_data = "Order Block & FVG Detected" if structure != "RANGING" else "No clear SMC setup"
        support_data = f"Sup: {analysis['support_resistance']['support']} | Res: {analysis['support_resistance']['resistance']}"
        supply_demand_data = f"Supply: {analysis['support_resistance']['resistance']} | Demand: {analysis['support_resistance']['support']}"
        sentiment_data = "Bullish" if trend == "BULLISH" else ("Bearish" if trend == "BEARISH" else "Neutral")
        bias_data = "BULLISH" if trend == "BULLISH" else ("BEARISH" if trend == "BEARISH" else "NEUTRAL")

        return {
            "success": True,
            "data": {
                "direction": direction,
                "confidence": confidence,
                "summary": summary,
                "reasoning": summary + f" Market structure is currently {structure}.",
                "structure": structure,
                "bos": "Detected" if structure in ["BULLISH", "BEARISH"] else "None",
                "liquidity": "Normal",
                "volatility": "High" if analysis["indicators"]["atr"]["value"] > 5 else "Normal",
                "entry": entry_price,
                "stop_loss": sl_price,
                "take_profits": [tp1_price, tp2_price, tp3_price],
                "risk_reward": rr_ratio,
                "smc": smc_data,
                "support_resistance": support_data,
                "supply_demand": supply_demand_data,
                "sentiment": sentiment_data,
                "bias": bias_data,
                "timeframe_analysis": {
                    timeframe: trend
                },
                "timestamp": current_timestamp()
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Full analysis error: {error}")
        raise HTTPException(status_code=502, detail="Unable to analyze market.") from error


# ============================================
# NEWS ANALYSIS ENDPOINTS (NEW)
# ============================================

@router.get("/news/upcoming")
async def get_upcoming_news(limit: int = 10):
    """
    Mengambil daftar berita ekonomi high-impact yang akan datang (belum rilis).
    Digunakan Frontend untuk menampilkan daftar jadwal.
    """
    try:
        events = await fetch_upcoming_events(limit=limit)
        return {
            "success": True,
            "count": len(events),
            "events": events,
            "timestamp": current_timestamp()
        }
    except Exception as e:
        logger.error(f"Upcoming news error: {e}")
        raise HTTPException(status_code=502, detail="Unable to fetch upcoming news.")


@router.post("/news/analyze")
async def analyze_upcoming_news(event_name: str):
    """
    Menganalisis berita spesifik (misal 'PCE') berdasarkan Forecast dan berita terkini.
    Menghasilkan sinyal Pre-News (BUY/SELL) beserta alasannya.
    """
    try:
        # 1. Cari event berdasarkan nama
        event = await get_event_for_analysis(event_name)
        if not event:
            raise HTTPException(status_code=404, detail=f"Event '{event_name}' not found in calendar.")

        # 2. Ambil berita terkini sebagai konteks (sentimen pasar)
        news_context = await build_news_context(event_name=event.get("name"), limit=5)

        # 3. Minta AI menganalisis
        ai_result = await analyze_news_event(event_data=event, news_context=news_context)

        return {
            "success": True,
            "data": ai_result,
            "timestamp": current_timestamp()
        }
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error(f"AI News error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"News analysis error: {e}")
        raise HTTPException(status_code=502, detail="Unable to analyze news.")


# ============================================
# ANALYSIS SERVICE STATUS
# ============================================

@router.get("/status")
async def analysis_status():
    ai_configured = bool(settings.AI_API_KEY)
    market_configured = bool(settings.MARKET_API_KEY and settings.MARKET_API_URL)
    service_ready = (ai_configured and market_configured)

    return {
        "success": True,
        "service": "RYFX XAU AI Analysis",
        "symbol": "XAUUSD",
        "provider": settings.AI_PROVIDER,
        "status": ("configured" if service_ready else "not_configured"),
        "ai_configured": ai_configured,
        "market_configured": market_configured,
        "timestamp": current_timestamp()
    }
