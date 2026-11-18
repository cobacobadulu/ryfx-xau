# ============================================
# RYFX XAU — TECHNICAL ANALYSIS ENGINE
# XAUUSD TECHNICAL INTELLIGENCE
# ============================================

from typing import Any


# ============================================
# CONFIGURATION
# ============================================

EMA_PERIODS = [20, 50, 200]

RSI_PERIOD = 14

ATR_PERIOD = 14

MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9

DEFAULT_LOOKBACK = 100


# ============================================
# DATA VALIDATION
# ============================================

def validate_candles(
    candles: list[dict[str, Any]]
) -> list[dict[str, float]]:

    if not isinstance(candles, list):

        raise ValueError("Candles must be a list.")

    validated = []

    for candle in candles:

        try:

            open_price = float(candle["open"])
            high_price = float(candle["high"])
            low_price = float(candle["low"])
            close_price = float(candle["close"])

        except (
            KeyError,
            TypeError,
            ValueError
        ):

            continue

        if min(
            open_price,
            high_price,
            low_price,
            close_price
        ) <= 0:

            continue

        if high_price < max(
            open_price,
            close_price,
            low_price
        ):

            continue

        if low_price > min(
            open_price,
            close_price,
            high_price
        ):

            continue

        validated.append({

            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close_price

        })

    if len(validated) < 2:

        raise ValueError(
            "At least two valid candles are required."
        )

    return validated


# ============================================
# EXPONENTIAL MOVING AVERAGE
# ============================================

def calculate_ema(
    prices: list[float],
    period: int
) -> list[float | None]:

    if period <= 0:

        raise ValueError(
            "EMA period must be positive."
        )

    if len(prices) < period:

        return [None] * len(prices)

    multiplier = 2 / (period + 1)

    result = [None] * len(prices)

    initial_sma = sum(
        prices[:period]
    ) / period

    ema = initial_sma

    result[period - 1] = ema

    for index in range(
        period,
        len(prices)
    ):

        ema = (
            prices[index] * multiplier
            +
            ema * (1 - multiplier)
        )

        result[index] = ema

    return result


# ============================================
# RELATIVE STRENGTH INDEX
# ============================================

def calculate_rsi(
    prices: list[float],
    period: int = RSI_PERIOD
) -> list[float | None]:

    if period <= 0:

        raise ValueError(
            "RSI period must be positive."
        )

    result = [None] * len(prices)

    if len(prices) <= period:

        return result

    gains = []
    losses = []

    for index in range(1, len(prices)):

        change = (
            prices[index] - prices[index - 1]
        )

        gains.append(max(change, 0))

        losses.append(max(-change, 0))

    average_gain = sum(
        gains[:period]
    ) / period

    average_loss = sum(
        losses[:period]
    ) / period

    def get_rsi(
        gain: float,
        loss: float
    ) -> float:

        if loss == 0:

            return 100.0

        if gain == 0:

            return 0.0

        relative_strength = gain / loss

        return (
            100 - (100 / (1 + relative_strength))
        )

    result[period] = get_rsi(
        average_gain,
        average_loss
    )

    for index in range(
        period + 1,
        len(prices)
    ):

        current_gain = gains[index - 1]

        current_loss = losses[index - 1]

        average_gain = (
            average_gain * (period - 1)
            +
            current_gain
        ) / period

        average_loss = (
            average_loss * (period - 1)
            +
            current_loss
        ) / period

        result[index] = get_rsi(
            average_gain,
            average_loss
        )

    return result


# ============================================
# MACD
# ============================================

def calculate_macd(
    prices: list[float]
) -> dict[str, list[float | None]]:

    fast_ema = calculate_ema(
        prices,
        MACD_FAST
    )

    slow_ema = calculate_ema(
        prices,
        MACD_SLOW
    )

    macd_line = []

    for fast, slow in zip(
        fast_ema,
        slow_ema
    ):

        if fast is None or slow is None:

            macd_line.append(None)

        else:

            macd_line.append(
                fast - slow
            )

    valid_macd = [
        value
        for value in macd_line
        if value is not None
    ]

    signal_values = calculate_ema(
        valid_macd,
        MACD_SIGNAL
    )

    signal_line = [None] * len(prices)

    start_index = (
        len(prices) - len(valid_macd)
    )

    for index, value in enumerate(
        signal_values
    ):

        signal_line[
            start_index + index
        ] = value

    histogram = []

    for macd, signal in zip(
        macd_line,
        signal_line
    ):

        if macd is None or signal is None:

            histogram.append(None)

        else:

            histogram.append(
                macd - signal
            )

    return {

        "macd": macd_line,

        "signal": signal_line,

        "histogram": histogram

    }


# ============================================
# AVERAGE TRUE RANGE
# ============================================

def calculate_atr(
    candles: list[dict[str, float]],
    period: int = ATR_PERIOD
) -> list[float | None]:

    if period <= 0:

        raise ValueError(
            "ATR period must be positive."
        )

    result = [None] * len(candles)

    if len(candles) <= period:

        return result

    true_ranges = []

    for index, candle in enumerate(candles):

        if index == 0:

            true_range = (
                candle["high"] - candle["low"]
            )

        else:

            previous_close = (
                candles[index - 1]["close"]
            )

            true_range = max(

                candle["high"] - candle["low"],

                abs(
                    candle["high"] - previous_close
                ),

                abs(
                    candle["low"] - previous_close
                )

            )

        true_ranges.append(true_range)

    atr = sum(
        true_ranges[1:period + 1]
    ) / period

    result[period] = atr

    for index in range(
        period + 1,
        len(candles)
    ):

        atr = (
            atr * (period - 1)
            +
            true_ranges[index]
        ) / period

        result[index] = atr

    return result


# ============================================
# SUPPORT AND RESISTANCE
# ============================================

def calculate_support_resistance(
    candles: list[dict[str, float]],
    lookback: int = DEFAULT_LOOKBACK
) -> dict[str, float | None]:

    recent = candles[-lookback:]

    if not recent:

        return {
            "support": None,
            "resistance": None
        }

    support = min(
        candle["low"]
        for candle in recent
    )

    resistance = max(
        candle["high"]
        for candle in recent
    )

    return {

        "support": support,

        "resistance": resistance

    }


# ============================================
# MARKET STRUCTURE
# ============================================

def detect_market_structure(
    candles: list[dict[str, float]],
    swing_window: int = 2
) -> dict[str, Any]:

    highs = [
        candle["high"]
        for candle in candles
    ]

    lows = [
        candle["low"]
        for candle in candles
    ]

    swing_highs = []

    swing_lows = []

    for index in range(
        swing_window,
        len(candles) - swing_window
    ):

        high = highs[index]

        low = lows[index]

        left_highs = highs[
            index - swing_window:index
        ]

        right_highs = highs[
            index + 1:index + swing_window + 1
        ]

        left_lows = lows[
            index - swing_window:index
        ]

        right_lows = lows[
            index + 1:index + swing_window + 1
        ]

        if (
            high > max(left_highs)
            and
            high >= max(right_highs)
        ):

            swing_highs.append(high)

        if (
            low < min(left_lows)
            and
            low <= min(right_lows)
        ):

            swing_lows.append(low)

    structure = "UNDEFINED"

    if len(swing_highs) >= 2 and len(swing_lows) >= 2:

        higher_high = (
            swing_highs[-1] > swing_highs[-2]
        )

        higher_low = (
            swing_lows[-1] > swing_lows[-2]
        )

        lower_high = (
            swing_highs[-1] < swing_highs[-2]
        )

        lower_low = (
            swing_lows[-1] < swing_lows[-2]
        )

        if higher_high and higher_low:

            structure = "BULLISH"

        elif lower_high and lower_low:

            structure = "BEARISH"

        else:

            structure = "RANGING"

    return {

        "structure": structure,

        "swing_highs": swing_highs[-5:],

        "swing_lows": swing_lows[-5:]

    }


# ============================================
# TREND ANALYSIS
# ============================================

def analyze_trend(
    ema20: float | None,
    ema50: float | None,
    ema200: float | None,
    current_price: float
) -> str:

    if any(
        value is None
        for value in [ema20, ema50, ema200]
    ):

        return "INSUFFICIENT_DATA"

    if (
        current_price > ema20
        and ema20 > ema50
        and ema50 > ema200
    ):

        return "BULLISH"

    if (
        current_price < ema20
        and ema20 < ema50
        and ema50 < ema200
    ):

        return "BEARISH"

    return "SIDEWAYS"


# ============================================
# MAIN TECHNICAL ANALYSIS
# ============================================

def analyze_market(
    raw_candles: list[dict[str, Any]]
) -> dict[str, Any]:

    candles = validate_candles(
        raw_candles
    )

    closes = [
        candle["close"]
        for candle in candles
    ]

    current_price = closes[-1]

    ema_results = {

        period: calculate_ema(
            closes,
            period
        )

        for period in EMA_PERIODS

    }

    ema20 = ema_results[20][-1]

    ema50 = ema_results[50][-1]

    ema200 = ema_results[200][-1]

    rsi_values = calculate_rsi(
        closes
    )

    macd_results = calculate_macd(
        closes
    )

    atr_values = calculate_atr(
        candles
    )

    support_resistance = (
        calculate_support_resistance(
            candles
        )
    )

    market_structure = (
        detect_market_structure(
            candles
        )
    )

    current_rsi = rsi_values[-1]

    current_macd = (
        macd_results["macd"][-1]
    )

    current_signal = (
        macd_results["signal"][-1]
    )

    current_atr = atr_values[-1]

    if current_rsi is None:

        rsi_condition = "INSUFFICIENT_DATA"

    elif current_rsi >= 70:

        rsi_condition = "OVERBOUGHT"

    elif current_rsi <= 30:

        rsi_condition = "OVERSOLD"

    else:

        rsi_condition = "NEUTRAL"

    if (
        current_macd is None
        or current_signal is None
    ):

        macd_condition = "INSUFFICIENT_DATA"

    elif current_macd > current_signal:

        macd_condition = "BULLISH"

    elif current_macd < current_signal:

        macd_condition = "BEARISH"

    else:

        macd_condition = "NEUTRAL"

    trend = analyze_trend(
        ema20,
        ema50,
        ema200,
        current_price
    )

    return {

        "symbol": "XAUUSD",

        "current_price": current_price,

        "trend": trend,

        "indicators": {

            "ema": {

                "ema20": ema20,

                "ema50": ema50,

                "ema200": ema200

            },

            "rsi": {

                "value": current_rsi,

                "condition": rsi_condition

            },

            "macd": {

                "value": current_macd,

                "signal": current_signal,

                "histogram": (
                    macd_results["histogram"][-1]
                ),

                "condition": macd_condition

            },

            "atr": {

                "value": current_atr

            }

        },

        "support_resistance": (
            support_resistance
        ),

        "market_structure": (
            market_structure
        ),

        "candles_analyzed": len(candles)

    }
