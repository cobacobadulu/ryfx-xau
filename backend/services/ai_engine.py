# ============================================
# RYFX XAU — AI ENGINE
# GEMINI GOLD MARKET INTELLIGENCE
# ============================================

import json
import re

import httpx

from typing import Any

from config import settings


# ============================================
# CONFIGURATION
# ============================================

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
)

AI_TIMEOUT = 60.0

MAX_OUTPUT_TOKENS = 3000


# ============================================
# SYSTEM INSTRUCTIONS
# ============================================

SYSTEM_INSTRUCTION = """
You are RYFX XAU AI, a professional gold market
analysis assistant specializing exclusively in XAUUSD.

Your task is to analyze real market information and
technical indicators provided by the backend.

STRICT RULES:

1. Analyze only XAUUSD.

2. Never invent market prices, candle data,
   technical indicators, or economic events.

3. Use only the supplied market data.

4. Do not create entry, stop loss, or take profit
   prices without sufficient technical justification.

5. If market conditions are unclear, return WAIT.

6. BUY means a potential bullish opportunity.

7. SELL means a potential bearish opportunity.

8. WAIT means there is no sufficiently clear setup.

9. Confidence must be a number between 0 and 100.
   It represents analytical confidence, not a
   guaranteed probability of winning.

10. Never promise profits or guaranteed results.

11. Explain the reasoning clearly and objectively.

12. If data is insufficient, explicitly state it.

13. Do not fabricate BOS, CHoCH, liquidity sweeps,
    support, resistance, or market structure.

14. Return valid JSON only.
"""


# ============================================
# RESPONSE SCHEMA
# ============================================

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {

        "direction": {
            "type": "STRING",
            "enum": ["BUY", "SELL", "WAIT"]
        },

        "confidence": {
            "type": "NUMBER"
        },

        "summary": {
            "type": "STRING"
        },

        "reasoning": {
            "type": "STRING"
        },

        "structure": {
            "type": "STRING"
        },

        "bos": {
            "type": "STRING"
        },

        "liquidity": {
            "type": "STRING"
        },

        "volatility": {
            "type": "STRING"
        },

        "entry": {
            "type": ["NUMBER", "NULL"]
        },

        "stop_loss": {
            "type": ["NUMBER", "NULL"]
        },

        "take_profits": {
            "type": "ARRAY",
            "items": {
                "type": "NUMBER"
            }
        },

        "risk_reward": {
            "type": ["STRING", "NULL"]
        }

    },

    "required": [
        "direction",
        "confidence",
        "summary",
        "reasoning",
        "structure",
        "bos",
        "liquidity",
        "volatility",
        "entry",
        "stop_loss",
        "take_profits",
        "risk_reward"
    ],

    "propertyOrdering": [
        "direction",
        "confidence",
        "summary",
        "reasoning",
        "structure",
        "bos",
        "liquidity",
        "volatility",
        "entry",
        "stop_loss",
        "take_profits",
        "risk_reward"
    ]
}


# ============================================
# BUILD ANALYSIS PROMPT
# ============================================

def build_analysis_prompt(
    technical_data: dict[str, Any],
    timeframe: str,
    analysis_type: str
) -> str:

    payload = {

        "symbol": "XAUUSD",

        "timeframe": timeframe,

        "analysis_type": analysis_type,

        "technical_data": technical_data

    }

    return (
        "Analyze the following XAUUSD market data.\n\n"
        "Determine whether the market currently presents "
        "a justified BUY, SELL, or WAIT opportunity.\n\n"
        "Only provide trade levels when the supplied data "
        "supports a technically justified setup.\n\n"
        "If the setup is unclear, return WAIT and use null "
        "for entry and stop_loss with an empty take_profits "
        "array.\n\n"
        "Return your analysis using the required JSON schema.\n\n"
        "MARKET DATA:\n"
        + json.dumps(payload, ensure_ascii=False)
    )


# ============================================
# CALL GEMINI API
# ============================================

async def call_gemini(
    prompt: str
) -> dict[str, Any]:

    api_key = settings.AI_API_KEY

    model = settings.AI_MODEL

    if not api_key:

        raise RuntimeError(
            "AI_API_KEY has not been configured."
        )

    if not model:

        raise RuntimeError(
            "AI_MODEL has not been configured."
        )

    url = (
        GEMINI_API_URL
        + model
        + ":generateContent"
    )

    headers = {

        "Content-Type": "application/json",

        "x-goog-api-key": api_key

    }

    payload = {

        "system_instruction": {

            "parts": [
                {
                    "text": SYSTEM_INSTRUCTION
                }
            ]

        },

        "contents": [

            {

                "role": "user",

                "parts": [
                    {
                        "text": prompt
                    }
                ]

            }

        ],

        "generationConfig": {

            "temperature": 0.2,

            "maxOutputTokens": MAX_OUTPUT_TOKENS,

            "responseMimeType": "application/json",

            "responseSchema": RESPONSE_SCHEMA

        }

    }

    async with httpx.AsyncClient(
        timeout=AI_TIMEOUT
    ) as client:

        response = await client.post(

            url,

            headers=headers,

            json=payload

        )

        if response.is_error:

            raise RuntimeError(
                f"Gemini API request failed: "
                f"HTTP {response.status_code}"
            )

        result = response.json()

    candidates = result.get("candidates", [])

    if not candidates:

        raise RuntimeError(
            "Gemini returned no analysis candidates."
        )

    candidate = candidates[0]

    finish_reason = candidate.get("finishReason")

    if finish_reason == "MAX_TOKENS":

        raise RuntimeError(
            "Gemini analysis was incomplete."
        )

    parts = (
        candidate.get("content", {})
        .get("parts", [])
    )

    text_parts = [

        part["text"]

        for part in parts

        if isinstance(part, dict)
        and isinstance(part.get("text"), str)

    ]

    if not text_parts:

        raise RuntimeError(
            "Gemini returned an empty response."
        )

    return parse_ai_response(
        "\n".join(text_parts)
    )


# ============================================
# PARSE AI RESPONSE
# ============================================

def parse_ai_response(
    response_text: str
) -> dict[str, Any]:

    cleaned = response_text.strip()

    cleaned = re.sub(
        r"^```(?:json)?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE
    )

    cleaned = re.sub(
        r"\s*```$",
        "",
        cleaned
    )

    try:

        result = json.loads(cleaned)

    except json.JSONDecodeError as error:

        raise ValueError(
            "Gemini returned invalid JSON."
        ) from error

    if not isinstance(result, dict):

        raise ValueError(
            "Invalid AI analysis structure."
        )

    direction = str(
        result.get("direction", "")
    ).upper()

    if direction not in [
        "BUY",
        "SELL",
        "WAIT"
    ]:

        raise ValueError(
            "Invalid AI trading direction."
        )

    try:

        confidence = float(
            result.get("confidence", 0)
        )

    except (TypeError, ValueError):

        raise ValueError(
            "Invalid AI confidence value."
        )

    if not 0 <= confidence <= 100:

        raise ValueError(
            "AI confidence must be between 0 and 100."
        )

    entry = result.get("entry")

    stop_loss = result.get("stop_loss")

    take_profits = result.get(
        "take_profits", []
    )

    if not isinstance(take_profits, list):

        raise ValueError(
            "Invalid take profit structure."
        )

    def validate_price(value, field_name):

        if value is None:

            return None

        if isinstance(value, bool):

            raise ValueError(
                f"Invalid {field_name}."
            )

        try:

            number = float(value)

        except (TypeError, ValueError):

            raise ValueError(
                f"Invalid {field_name}."
            )

        if number <= 0:

            raise ValueError(
                f"{field_name} must be positive."
            )

        return number

    entry = validate_price(
        entry,
        "entry"
    )

    stop_loss = validate_price(
        stop_loss,
        "stop_loss"
    )

    take_profits = [

        validate_price(
            value,
            "take_profit"
        )

        for value in take_profits

    ]

    if direction == "WAIT":

        entry = None

        stop_loss = None

        take_profits = []

    elif (
        entry is None
        or stop_loss is None
        or not take_profits
    ):

        raise ValueError(
            "BUY/SELL analysis requires complete trade levels."
        )

    if direction == "BUY":

        if stop_loss >= entry:

            raise ValueError(
                "BUY stop loss must be below entry."
            )

        if any(
            target <= entry
            for target in take_profits
        ):

            raise ValueError(
                "BUY take profits must be above entry."
            )

    if direction == "SELL":

        if stop_loss <= entry:

            raise ValueError(
                "SELL stop loss must be above entry."
            )

        if any(
            target >= entry
            for target in take_profits
        ):

            raise ValueError(
                "SELL take profits must be below entry."
            )

    return {

        "direction": direction,

        "confidence": confidence,

        "summary": str(
            result.get("summary", "")
        ),

        "reasoning": str(
            result.get("reasoning", "")
        ),

        "structure": str(
            result.get("structure", "")
        ),

        "bos": str(
            result.get("bos", "")
        ),

        "liquidity": str(
            result.get("liquidity", "")
        ),

        "volatility": str(
            result.get("volatility", "")
        ),

        "entry": entry,

        "stop_loss": stop_loss,

        "take_profits": take_profits,

        "risk_reward": result.get(
            "risk_reward"
        )

    }


# ============================================
# MAIN AI ANALYSIS FUNCTION
# ============================================

async def analyze_xauusd(
    technical_data: dict[str, Any],
    timeframe: str = "15m",
    analysis_type: str = "technical"
) -> dict[str, Any]:

    if not isinstance(technical_data, dict):

        raise ValueError(
            "Technical data must be a dictionary."
        )

    if not technical_data:

        raise ValueError(
            "Technical data is empty."
        )

    prompt = build_analysis_prompt(

        technical_data=technical_data,

        timeframe=timeframe,

        analysis_type=analysis_type

    )

    analysis = await call_gemini(
        prompt
    )

    return {

        "success": True,

        "symbol": "XAUUSD",

        "timeframe": timeframe,

        "analysis_type": analysis_type,

        "analysis": analysis

    }
