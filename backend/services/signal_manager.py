# ============================================
# RYFX XAU — SIGNAL MANAGER
# XAUUSD TRADING SIGNAL MANAGEMENT
# ============================================

import math
import os

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from supabase import create_client


# ============================================
# CONFIGURATION
# ============================================

VALID_DIRECTIONS = [
    "BUY",
    "SELL"
]

VALID_STATUSES = [
    "ACTIVE",
    "TP HIT",
    "SL HIT",
    "CANCELLED",
    "EXPIRED"
]

VALID_TIMEFRAMES = [
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1d"
]

MAX_TAKE_PROFITS = 5


# ============================================
# SUPABASE CLIENT
# ============================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL dan SUPABASE_SERVICE_KEY wajib diset.")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ============================================
# PERSISTENT STORAGE (SUPABASE)
# ============================================

def load_signals_from_supabase() -> dict[str, dict[str, Any]]:
    try:
        response = supabase.table("signals").select("id, data").execute()
        return {row["id"]: row["data"] for row in response.data}
    except Exception as e:
        print(f"[SignalManager] Gagal load dari Supabase: {e}")
        return {}

def save_signal_to_supabase(signal: dict[str, Any]) -> None:
    try:
        supabase.table("signals").upsert({
            "id": signal["id"],
            "data": signal
        }).execute()
    except Exception as e:
        print(f"[SignalManager] Gagal simpan ke Supabase: {e}")

# Muat data saat server pertama kali menyala
SIGNAL_STORAGE: dict[str, dict[str, Any]] = load_signals_from_supabase()


# ============================================
# HELPERS
# ============================================

def current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()

def validate_price(value: Any, field_name: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"Invalid {field_name}.")
    try:
        price = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be numeric.")
    if not math.isfinite(price) or price <= 0:
        raise ValueError(f"{field_name} must be a finite positive number.")
    return price

def validate_confidence(value: Any) -> float:
    if isinstance(value, bool):
        raise ValueError("Invalid confidence.")
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        raise ValueError("Confidence must be numeric.")
    if not math.isfinite(confidence) or confidence < 0 or confidence > 100:
        raise ValueError("Confidence must be between 0 and 100.")
    return confidence

# ============================================
# CALCULATE RISK REWARD
# ============================================

def calculate_risk_reward(direction: str, entry: float, stop_loss: float, take_profit: float) -> float:
    if direction == "BUY":
        risk = entry - stop_loss
        reward = take_profit - entry
    elif direction == "SELL":
        risk = stop_loss - entry
        reward = entry - take_profit
    else:
        raise ValueError("Invalid signal direction.")

    if risk <= 0 or reward <= 0:
        raise ValueError("Invalid risk or reward levels.")

    return round(reward / risk, 2)


# ============================================
# VALIDATE SIGNAL
# ============================================

def validate_signal(direction: str, entry: Any, stop_loss: Any, take_profits: list) -> dict[str, Any]:
    direction = str(direction).upper()
    if direction not in VALID_DIRECTIONS:
        raise ValueError("Signal direction must be BUY or SELL.")
    if not isinstance(take_profits, list) or not take_profits:
        raise ValueError("At least one take profit is required.")
    if len(take_profits) > MAX_TAKE_PROFITS:
        raise ValueError("Maximum 5 take profit levels are allowed.")

    entry = validate_price(entry, "entry")
    stop_loss = validate_price(stop_loss, "stop_loss")
    take_profits = [validate_price(target, "take_profit") for target in take_profits]

    if direction == "BUY":
        if stop_loss >= entry:
            raise ValueError("BUY stop loss must be below entry.")
        if any(target <= entry for target in take_profits):
            raise ValueError("BUY take profits must be above entry.")
        if take_profits != sorted(take_profits):
            raise ValueError("BUY take profits must be ascending.")
    elif direction == "SELL":
        if stop_loss <= entry:
            raise ValueError("SELL stop loss must be above entry.")
        if any(target >= entry for target in take_profits):
            raise ValueError("SELL take profits must be below entry.")
        if take_profits != sorted(take_profits, reverse=True):
            raise ValueError("SELL take profits must be descending.")

    risk_reward = calculate_risk_reward(direction, entry, stop_loss, take_profits[-1])

    return {
        "direction": direction,
        "entry": entry,
        "stop_loss": stop_loss,
        "take_profits": take_profits,
        "risk_reward": risk_reward
    }

# ============================================
# CREATE SIGNAL
# ============================================

def create_signal(analysis: dict[str, Any], timeframe: str = "15m", source: str = "AI") -> dict[str, Any]:
    if not isinstance(analysis, dict):
        raise ValueError("Analysis must be a dictionary.")
    if timeframe not in VALID_TIMEFRAMES:
        raise ValueError("Unsupported signal timeframe.")

    direction = str(analysis.get("direction", "")).upper()
    if direction not in VALID_DIRECTIONS:
        raise ValueError("Only BUY and SELL analyses can create signals.")

    validated = validate_signal(
        direction=direction,
        entry=analysis.get("entry"),
        stop_loss=analysis.get("stop_loss"),
        take_profits=analysis.get("take_profits", [])
    )

    confidence = validate_confidence(analysis.get("confidence", 0))
    summary = analysis.get("summary", "")
    reasoning = analysis.get("reasoning", "")

    if not isinstance(summary, str) or not isinstance(reasoning, str):
        raise ValueError("Summary and reasoning must be text.")
    if not isinstance(source, str) or not source.strip():
        raise ValueError("Signal source must be text.")

    timestamp = current_timestamp()
    signal_id = str(uuid4())

    signal = {
        "id": signal_id,
        "symbol": "XAUUSD",
        "direction": validated["direction"],
        "timeframe": timeframe,
        "entry": validated["entry"],
        "stop_loss": validated["stop_loss"],
        "take_profits": validated["take_profits"],
        "risk_reward": validated["risk_reward"],
        "confidence": confidence,
        "summary": summary,
        "reasoning": reasoning,
        "source": source.strip(),
        "status": "ACTIVE",
        "created_at": timestamp,
        "updated_at": timestamp,
        "closed_at": None,
        "result": None
    }

    SIGNAL_STORAGE[signal_id] = signal
    save_signal_to_supabase(signal)

    return signal.copy()


# ============================================
# GET SIGNAL
# ============================================

def get_signal(signal_id: str) -> dict[str, Any] | None:
    signal = SIGNAL_STORAGE.get(signal_id)
    if signal is None:
        return None
    return signal.copy()


# ============================================
# GET ALL SIGNALS
# ============================================

def get_all_signals(status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    if limit < 1 or limit > 500:
        raise ValueError("Limit must be between 1 and 500.")

    signals = list(SIGNAL_STORAGE.values())

    if status:
        normalized_status = status.upper()
        if normalized_status not in VALID_STATUSES:
            raise ValueError("Invalid signal status.")
        signals = [signal for signal in signals if signal["status"] == normalized_status]

    signals.sort(key=lambda signal: signal["created_at"], reverse=True)
    return [signal.copy() for signal in signals[:limit]]


# ============================================
# UPDATE SIGNAL STATUS
# ============================================

def update_signal_status(signal_id: str, new_status: str, result: str | None = None) -> dict[str, Any] | None:
    signal = SIGNAL_STORAGE.get(signal_id)
    if signal is None:
        return None

    new_status = str(new_status).upper()
    if new_status not in VALID_STATUSES:
        raise ValueError("Invalid signal status.")
    if signal["status"] != "ACTIVE":
        raise ValueError("Only active signals can be updated.")
    if new_status == "ACTIVE":
        raise ValueError("Signal is already active.")
    if result is not None and not isinstance(result, str):
        raise ValueError("Signal result must be text.")

    timestamp = current_timestamp()
    signal["status"] = new_status
    signal["updated_at"] = timestamp
    signal["closed_at"] = timestamp
    signal["result"] = result or new_status

    save_signal_to_supabase(signal)
    return signal.copy()


# ============================================
# CANCEL SIGNAL
# ============================================

def cancel_signal(signal_id: str) -> dict[str, Any] | None:
    return update_signal_status(signal_id, "CANCELLED", "CANCELLED")


# ============================================
# TRACK RECORD STATISTICS
# ============================================

def get_signal_statistics() -> dict[str, Any]:
    signals = list(SIGNAL_STORAGE.values())
    total = len(signals)
    active = sum(signal["status"] == "ACTIVE" for signal in signals)
    tp_hit = sum(signal["status"] == "TP HIT" for signal in signals)
    sl_hit = sum(signal["status"] == "SL HIT" for signal in signals)
    cancelled = sum(signal["status"] == "CANCELLED" for signal in signals)
    expired = sum(signal["status"] == "EXPIRED" for signal in signals)

    closed = tp_hit + sl_hit
    win_rate = (tp_hit / closed) * 100 if closed > 0 else 0

    return {
        "symbol": "XAUUSD",
        "total_signals": total,
        "active_signals": active,
        "tp_hit": tp_hit,
        "sl_hit": sl_hit,
        "cancelled": cancelled,
        "expired": expired,
        "closed_signals": closed,
        "win_rate": round(win_rate, 2)
    }


# ============================================
# CLEAR SIGNAL STORAGE
# ============================================

def clear_signal_storage() -> None:
    SIGNAL_STORAGE.clear()
    try:
        supabase.table("signals").delete().neq("id", "").execute()
    except Exception as e:
        print(f"[SignalManager] Gagal hapus data Supabase: {e}")
