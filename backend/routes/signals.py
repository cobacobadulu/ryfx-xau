# ============================================
# RYFX XAU — SIGNAL ROUTES
# XAUUSD TRADING SIGNAL API
# ============================================

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.signal_manager import (
    create_signal,
    get_signal,
    get_all_signals,
    update_signal_status,
    get_signal_statistics
)


# ============================================
# ROUTER
# ============================================

router = APIRouter(
    prefix="/signals",
    tags=["XAUUSD Trading Signals"]
)


# ============================================
# REQUEST MODELS
# ============================================

class CreateSignalRequest(BaseModel):

    direction: str

    entry: float = Field(gt=0)

    stop_loss: float = Field(gt=0)

    take_profits: list[float] = Field(
        min_length=1,
        max_length=5
    )

    timeframe: str = "15m"

    confidence: float = Field(
        default=0,
        ge=0,
        le=100
    )

    summary: str = ""

    reasoning: str = ""


class UpdateSignalRequest(BaseModel):

    status: str

    result: str | None = None


# ============================================
# CREATE SIGNAL
# ============================================

@router.post("/")
async def create_new_signal(
    request: CreateSignalRequest
):

    try:

        signal = create_signal(

            analysis={

                "direction": request.direction,

                "entry": request.entry,

                "stop_loss": request.stop_loss,

                "take_profits": request.take_profits,

                "confidence": request.confidence,

                "summary": request.summary,

                "reasoning": request.reasoning

            },

            timeframe=request.timeframe,

            source="API"

        )

        return {

            "success": True,

            "message": "XAUUSD signal created.",

            "data": signal

        }

    except ValueError as error:

        raise HTTPException(

            status_code=422,

            detail=str(error)

        ) from error


# ============================================
# GET ALL SIGNALS
# ============================================

@router.get("/")
async def list_signals(

    status: str | None = Query(
        default=None
    ),

    limit: int = Query(
        default=100,
        ge=1,
        le=500
    )

):

    try:

        signals = get_all_signals(

            status=status,

            limit=limit

        )

        return {

            "success": True,

            "symbol": "XAUUSD",

            "count": len(signals),

            "data": signals

        }

    except ValueError as error:

        raise HTTPException(

            status_code=400,

            detail=str(error)

        ) from error


# ============================================
# GET SIGNAL STATISTICS
# ============================================

@router.get("/statistics")
async def signal_statistics():

    return {

        "success": True,

        "data": get_signal_statistics(),

        "timestamp": datetime.now(
            timezone.utc
        ).isoformat()

    }


# ============================================
# GET SIGNAL DETAIL
# ============================================

@router.get("/{signal_id}")
async def signal_detail(
    signal_id: str
):

    signal = get_signal(
        signal_id
    )

    if signal is None:

        raise HTTPException(

            status_code=404,

            detail="Signal not found."

        )

    return {

        "success": True,

        "data": signal

    }


# ============================================
# UPDATE SIGNAL STATUS
# ============================================

@router.patch("/{signal_id}/status")
async def update_signal(

    signal_id: str,

    request: UpdateSignalRequest

):

    try:

        signal = update_signal_status(

            signal_id=signal_id,

            new_status=request.status,

            result=request.result

        )

        if signal is None:

            raise HTTPException(

                status_code=404,

                detail="Signal not found."

            )

        return {

            "success": True,

            "message": "Signal status updated.",

            "data": signal

        }

    except ValueError as error:

        raise HTTPException(

            status_code=400,

            detail=str(error)

        ) from error


# ============================================
# CANCEL SIGNAL
# ============================================

@router.post("/{signal_id}/cancel")
async def cancel_existing_signal(
    signal_id: str
):

    try:

        signal = update_signal_status(

            signal_id=signal_id,

            new_status="CANCELLED",

            result="CANCELLED"

        )

        if signal is None:

            raise HTTPException(

                status_code=404,

                detail="Signal not found."

            )

        return {

            "success": True,

            "message": "Signal cancelled.",

            "data": signal

        }

    except ValueError as error:

        raise HTTPException(

            status_code=400,

            detail=str(error)

        ) from error
