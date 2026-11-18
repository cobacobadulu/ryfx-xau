# ============================================
# RYFX XAU — AI ANALYSIS DATA MODELS
# GOLD MARKET INTELLIGENCE
# ============================================

import math

from datetime import datetime, timezone
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    model_validator,
    field_validator
)


# ============================================
# TYPE DEFINITIONS
# ============================================

AnalysisDirection = Literal[
    "BUY",
    "SELL",
    "WAIT"
]

AnalysisTimeframe = Literal[
    "1m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1d"
]

AnalysisType = Literal[
    "technical",
    "scalping",
    "intraday",
    "swing"
]


# ============================================
# SHARED NUMBER VALIDATION
# ============================================

def validate_finite_number(value):

    if value is None:
        return value

    if isinstance(value, bool):

        raise ValueError(
            "Boolean values are not valid numbers."
        )

    number = float(value)

    if not math.isfinite(number):

        raise ValueError(
            "Number must be finite."
        )

    return number


# ============================================
# TRADE LEVELS MODEL
# ============================================

class TradeLevels(BaseModel):

    entry: float | None = Field(
        default=None,
        gt=0
    )

    stop_loss: float | None = Field(
        default=None,
        gt=0
    )

    take_profits: list[float] = Field(
        default_factory=list,
        max_length=5
    )

    risk_reward: str | None = None

    @field_validator(
        "entry",
        "stop_loss",
        mode="before"
    )
    @classmethod
    def validate_prices(cls, value):

        return validate_finite_number(value)

    @field_validator(
        "take_profits",
        mode="before"
    )
    @classmethod
    def validate_take_profits(cls, values):

        if not isinstance(values, list):

            raise ValueError(
                "Take profits must be a list."
            )

        return [
            validate_finite_number(value)
            for value in values
        ]


# ============================================
# AI ANALYSIS RESULT MODEL
# ============================================

class AnalysisResult(BaseModel):

    direction: AnalysisDirection

    confidence: float = Field(
        ge=0,
        le=100
    )

    summary: str

    reasoning: str

    structure: str = ""

    bos: str = ""

    liquidity: str = ""

    volatility: str = ""

    entry: float | None = Field(
        default=None,
        gt=0
    )

    stop_loss: float | None = Field(
        default=None,
        gt=0
    )

    take_profits: list[float] = Field(
        default_factory=list,
        max_length=5
    )

    risk_reward: str | None = None

    # ========================================
    # FINITE NUMBER VALIDATION
    # ========================================

    @field_validator(
        "confidence",
        "entry",
        "stop_loss",
        mode="before"
    )
    @classmethod
    def validate_numeric_fields(cls, value):

        return validate_finite_number(value)

    @field_validator(
        "take_profits",
        mode="before"
    )
    @classmethod
    def validate_tp_numbers(cls, values):

        if not isinstance(values, list):

            raise ValueError(
                "Take profits must be a list."
            )

        return [
            validate_finite_number(value)
            for value in values
        ]

    # ========================================
    # TEXT VALIDATION
    # ========================================

    @field_validator(
        "summary",
        "reasoning"
    )
    @classmethod
    def validate_required_text(cls, value):

        if not value.strip():

            raise ValueError(
                "This text field cannot be empty."
            )

        return value.strip()

    # ========================================
    # TRADE LEVEL VALIDATION
    # ========================================

    @model_validator(mode="after")
    def validate_trade_levels(self):

        if self.direction == "WAIT":

            self.entry = None

            self.stop_loss = None

            self.take_profits = []

            self.risk_reward = None

            return self

        if (
            self.entry is None
            or self.stop_loss is None
            or not self.take_profits
        ):

            raise ValueError(
                "BUY/SELL requires complete trade levels."
            )

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
# ANALYSIS REQUEST MODEL
# ============================================

class AnalysisRequest(BaseModel):

    symbol: Literal["XAUUSD"] = "XAUUSD"

    timeframe: AnalysisTimeframe = "15m"

    analysis_type: AnalysisType = "technical"


# ============================================
# ANALYSIS RESPONSE MODEL
# ============================================

class AnalysisResponse(BaseModel):

    success: bool = True

    symbol: Literal["XAUUSD"] = "XAUUSD"

    timeframe: AnalysisTimeframe

    analysis_type: AnalysisType

    analysis: AnalysisResult

    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(
            timezone.utc
        )
    )


# ============================================
# ANALYSIS HISTORY MODEL
# ============================================

class AnalysisHistoryItem(BaseModel):

    id: str

    symbol: Literal["XAUUSD"] = "XAUUSD"

    timeframe: AnalysisTimeframe

    analysis_type: AnalysisType

    direction: AnalysisDirection

    confidence: float = Field(
        ge=0,
        le=100
    )

    summary: str

    created_at: datetime

    @field_validator("confidence", mode="before")
    @classmethod
    def validate_confidence(cls, value):

        return validate_finite_number(value)


# ============================================
# ANALYSIS HISTORY RESPONSE
# ============================================

class AnalysisHistoryResponse(BaseModel):

    success: bool = True

    count: int = 0

    data: list[AnalysisHistoryItem] = Field(
        default_factory=list
    )
