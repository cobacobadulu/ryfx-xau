# ============================================
# RYFX XAU — SIGNAL ROUTES
# XAUUSD TRADING SIGNAL API
# ============================================

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from models.signal import (
    SignalCreate,
    SignalStatusUpdate
)

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
# CREATE SIGNAL
# ============================================

@router.post("/")
async def create_new_signal(
    request: SignalCreate
):

    if request.timeframe not in ALLOWED_TIMEFRAMES:

        raise HTTPException(
            status_code=422,
            detail="Unsupported signal timeframe."
        )

    try:

        signal_data = request.model_dump()

        timeframe = signal_data.pop(
            "timeframe"
        )

        signal_data.pop(
            "symbol",
            None
        )

        signal = create_signal(

            analysis=signal_data,

            timeframe=timeframe,

            source="API"

        )

        return {

            "success": True,

            "message": "XAUUSD signal created.",

            "symbol": "XAUUSD",

            "data": signal,

            "timestamp": current_timestamp()

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

            "data": signals,

            "timestamp": current_timestamp()

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

        "symbol": "XAUUSD",

        "data": get_signal_statistics(),

        "timestamp": current_timestamp()

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

    request: SignalStatusUpdate

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

            "data": signal,

            "timestamp": current_timestamp()

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

            "data": signal,

            "timestamp": current_timestamp()

        }

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error
