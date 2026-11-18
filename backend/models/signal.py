# ============================================
# RYFX XAU — SIGNAL DATA MODELS
# XAUUSD TRADING SIGNAL SCHEMAS
# ============================================

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


# ============================================
# TYPE DEFINITIONS
# ============================================

SignalDirection = Literal["BUY", "SELL"]

SignalStatus = Literal[
    "ACTIVE",
    "TP HIT",
    "SL HIT",
    "CANCELLED",
    "EXPIRED"
]


# ============================================
# SIGNAL CREATE MODEL
# ============================================

class SignalCreate(BaseModel):

    symbol: Literal["XAUUSD"] = "XAUUSD"

    direction: SignalDirection

    timeframe: str = "15m"

    entry: float = Field(gt=0)

    stop_loss: float = Field(gt=0)

    take_profits: list[float] = Field(
        min_length=1,
        max_length=5
    )

    confidence: float = Field(
        default=0,
        ge=0,
        le=100
    )

    summary: str = ""

    reasoning: str = ""

    @model_validator(mode="after")
    def validate_trade_levels(self):

        if self.direction == "BUY":

            if self.stop_loss >= self.entry:

                raise ValueError(
                    "BUY stop loss must be below entry."
                )

            if any(
                target <= self.entry
                for target in self.take_profits
            ):

                raise ValueError(
                    "BUY take profits must be above entry."
                )

            if self.take_profits != sorted(
                self.take_profits
            ):

                raise ValueError(
                    "BUY take profits must be ascending."
                )

        elif self.direction == "SELL":

            if self.stop_loss <= self.entry:

                raise ValueError(
                    "SELL stop loss must be above entry."
                )

            if any(
                target >= self.entry
                for target in self.take_profits
            ):

                raise ValueError(
                    "SELL take profits must be below entry."
                )

            if self.take_profits != sorted(
                self.take_profits,
                reverse=True
            ):

                raise ValueError(
                    "SELL take profits must be descending."
                )

        return self


# ============================================
# SIGNAL RESPONSE MODEL
# ============================================

class SignalResponse(BaseModel):

    id: str

    symbol: Literal["XAUUSD"] = "XAUUSD"

    direction: SignalDirection

    timeframe: str

    entry: float

    stop_loss: float

    take_profits: list[float]

    risk_reward: float

    confidence: float

    summary: str = ""

    reasoning: str = ""

    source: str = "AI"

    status: SignalStatus = "ACTIVE"

    created_at: datetime

    updated_at: datetime

    closed_at: datetime | None = None

    result: str | None = None


# ============================================
# SIGNAL STATUS UPDATE MODEL
# ============================================

class SignalStatusUpdate(BaseModel):

    status: SignalStatus

    result: str | None = None


# ============================================
# SIGNAL STATISTICS MODEL
# ============================================

class SignalStatistics(BaseModel):

    symbol: Literal["XAUUSD"] = "XAUUSD"

    total_signals: int = 0

    active_signals: int = 0

    tp_hit: int = 0

    sl_hit: int = 0

    cancelled: int = 0

    expired: int = 0

    closed_signals: int = 0

    win_rate: float = 0


# ============================================
# SIGNAL LIST RESPONSE MODEL
# ============================================

class SignalListResponse(BaseModel):

    success: bool = True

    symbol: Literal["XAUUSD"] = "XAUUSD"

    count: int = 0

    data: list[SignalResponse] = Field(
        default_factory=list
    )
