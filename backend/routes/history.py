# ============================================
# RYFX XAU — ANALYSIS HISTORY ROUTES
# XAUUSD AI ANALYSIS HISTORY API
# ============================================

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from copy import deepcopy

from fastapi import APIRouter, HTTPException, Query


# ============================================
# ROUTER
# ============================================

router = APIRouter(
    prefix="/history",
    tags=["AI Analysis History"]
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

ALLOWED_ANALYSIS_TYPES = {
    "technical",
    "scalping",
    "intraday",
    "swing"
}

ALLOWED_DIRECTIONS = {
    "BUY",
    "SELL",
    "WAIT"
}


# ============================================
# TEMPORARY STORAGE
# ============================================

# Data is stored in memory.
# All records will be lost when the backend restarts.

ANALYSIS_HISTORY: dict[str, dict[str, Any]] = {}


# ============================================
# HELPERS
# ============================================

def current_timestamp() -> str:
    return datetime.now(
        timezone.utc
    ).isoformat()


def validate_history_data(
    analysis: dict[str, Any],
    timeframe: str,
    analysis_type: str
) -> None:

    if not isinstance(analysis, dict) or not analysis:
        raise ValueError(
            "Analysis data must be a non-empty dictionary."
        )

    if timeframe not in ALLOWED_TIMEFRAMES:
        raise ValueError(
            "Invalid analysis timeframe."
        )

    if analysis_type not in ALLOWED_ANALYSIS_TYPES:
        raise ValueError(
            "Invalid analysis type."
        )

    direction = analysis.get("direction")

    if direction not in ALLOWED_DIRECTIONS:
        raise ValueError(
            "Invalid analysis direction."
        )


# ============================================
# SAVE ANALYSIS
# ============================================

def save_analysis(
    analysis: dict[str, Any],
    timeframe: str = "15m",
    analysis_type: str = "technical",
    market_data: dict[str, Any] | None = None
) -> dict[str, Any]:

    validate_history_data(
        analysis,
        timeframe,
        analysis_type
    )

    if market_data is not None and not isinstance(
        market_data,
        dict
    ):
        raise ValueError(
            "Market data must be a dictionary."
        )

    history_id = str(uuid4())

    record = {
        "id": history_id,
        "symbol": "XAUUSD",
        "timeframe": timeframe,
        "analysis_type": analysis_type,
        "market_data": deepcopy(
            market_data or {}
        ),
        "analysis": deepcopy(analysis),
        "created_at": current_timestamp()
    }

    ANALYSIS_HISTORY[history_id] = record

    return deepcopy(record)


# ============================================
# GET ALL HISTORY
# ============================================

@router.get("/")
async def get_analysis_history(
    limit: int = Query(
        default=50,
        ge=1,
        le=500
    )
):

    records = sorted(
        ANALYSIS_HISTORY.values(),
        key=lambda item: item["created_at"],
        reverse=True
    )

    records = records[:limit]

    return {
        "success": True,
        "symbol": "XAUUSD",
        "count": len(records),
        "data": deepcopy(records)
    }


# ============================================
# HISTORY STATISTICS
# ============================================

@router.get("/statistics/summary")
async def get_history_statistics():

    records = list(
        ANALYSIS_HISTORY.values()
    )

    directions = [
        record.get("analysis", {}).get("direction")
        for record in records
    ]

    return {
        "success": True,
        "symbol": "XAUUSD",
        "total_analyses": len(records),
        "buy_analyses": directions.count("BUY"),
        "sell_analyses": directions.count("SELL"),
        "wait_analyses": directions.count("WAIT")
    }


# ============================================
# DELETE ALL HISTORY
# ============================================

@router.delete("/")
async def delete_all_history():

    deleted_count = len(
        ANALYSIS_HISTORY
    )

    ANALYSIS_HISTORY.clear()

    return {
        "success": True,
        "message": "All analysis history deleted.",
        "deleted_count": deleted_count
    }


# ============================================
# GET HISTORY DETAIL
# ============================================

@router.get("/{history_id}")
async def get_history_detail(
    history_id: str
):

    record = ANALYSIS_HISTORY.get(
        history_id
    )

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis history not found."
        )

    return {
        "success": True,
        "data": deepcopy(record)
    }


# ============================================
# DELETE HISTORY ITEM
# ============================================

@router.delete("/{history_id}")
async def delete_history_item(
    history_id: str
):

    if history_id not in ANALYSIS_HISTORY:
        raise HTTPException(
            status_code=404,
            detail="Analysis history not found."
        )

    del ANALYSIS_HISTORY[history_id]

    return {
        "success": True,
        "message": "Analysis history deleted.",
        "id": history_id
    }
