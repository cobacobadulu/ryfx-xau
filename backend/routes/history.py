# ============================================
# RYFX XAU — ANALYSIS HISTORY ROUTES
# XAUUSD AI ANALYSIS HISTORY API
# ============================================

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query


# ============================================
# ROUTER
# ============================================

router = APIRouter(
    prefix="/history",
    tags=["AI Analysis History"]
)


# ============================================
# TEMPORARY STORAGE
# ============================================

# Temporary in-memory storage.
# Data will be lost when the backend restarts.

ANALYSIS_HISTORY: dict[str, dict[str, Any]] = {}


# ============================================
# HELPERS
# ============================================

def current_timestamp() -> str:

    return datetime.now(
        timezone.utc
    ).isoformat()


# ============================================
# SAVE ANALYSIS
# ============================================

def save_analysis(
    analysis: dict[str, Any],
    timeframe: str = "15m",
    analysis_type: str = "technical",
    market_data: dict[str, Any] | None = None
) -> dict[str, Any]:

    if not isinstance(analysis, dict):

        raise ValueError(
            "Analysis must be a dictionary."
        )

    if not analysis:

        raise ValueError(
            "Analysis data is empty."
        )

    history_id = str(uuid4())

    record = {

        "id": history_id,

        "symbol": "XAUUSD",

        "timeframe": timeframe,

        "analysis_type": analysis_type,

        "market_data": market_data or {},

        "analysis": analysis,

        "created_at": current_timestamp()

    }

    ANALYSIS_HISTORY[history_id] = record

    return record.copy()


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

        "data": [
            record.copy()
            for record in records
        ]

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

        "data": record.copy()

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
# HISTORY STATISTICS
# ============================================

@router.get("/statistics/summary")
async def get_history_statistics():

    records = list(
        ANALYSIS_HISTORY.values()
    )

    directions = [

        record.get("analysis", {}).get(
            "direction",
            "UNKNOWN"
        )

        for record in records

    ]

    return {

        "success": True,

        "total_analyses": len(records),

        "buy_analyses": directions.count("BUY"),

        "sell_analyses": directions.count("SELL"),

        "wait_analyses": directions.count("WAIT"),

        "symbol": "XAUUSD"

    }
