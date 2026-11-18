# ============================================
# RYFX XAU — BACKEND CONFIGURATION
# ============================================

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ============================================
# PROJECT PATH
# ============================================

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


# ============================================
# APPLICATION SETTINGS
# ============================================

class Settings(BaseSettings):

    # APPLICATION
    APP_NAME: str = "ryFX XAU"
    APP_VERSION: str = "1.0.0"

    APP_DESCRIPTION: str = (
        "AI-Powered Gold Trading Intelligence Platform"
    )

    DEBUG: bool = False
    API_PREFIX: str = "/api"

    # AI CONFIGURATION
    AI_PROVIDER: str = "gemini"
    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-2.5-flash"

    # MARKET API CONFIGURATION
    MARKET_API_KEY: str = ""
    MARKET_API_URL: str = (
        "https://api.marketapi.app/v1"
    )

    MARKET_SYMBOL: str = "XAUUSD"

    MARKET_REFRESH_INTERVAL: int = Field(
        default=30,
        ge=1,
        le=3600
    )

    # DATABASE
    DATABASE_URL: str = ""

    # SECURITY
    SECRET_KEY: str = ""

    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:5500"
    )

    ENVIRONMENT: str = "development"

    # ENVIRONMENT CONFIGURATION
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        validate_default=True
    )

    # ========================================
    # VALIDATION
    # ========================================

    @field_validator("AI_PROVIDER")
    @classmethod
    def validate_ai_provider(cls, value):
        value = value.strip().lower()

        if value not in {"gemini"}:
            raise ValueError(
                "Unsupported AI provider. Currently supported: gemini"
            )

        return value

    @field_validator("MARKET_SYMBOL")
    @classmethod
    def validate_market_symbol(cls, value):
        value = value.strip().upper()

        if value != "XAUUSD":
            raise ValueError(
                "RYFX XAU currently supports XAUUSD only."
            )

        return value

    @field_validator("API_PREFIX")
    @classmethod
    def validate_api_prefix(cls, value):
        value = value.strip()

        if not value:
            return ""

        if not value.startswith("/"):
            value = "/" + value

        return value.rstrip("/")

    @field_validator("MARKET_API_URL")
    @classmethod
    def validate_market_api_url(cls, value):
        value = value.strip().rstrip("/")

        if not value.startswith(("http://", "https://")):
            raise ValueError("Invalid MARKET_API_URL.")

        return value

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, value):
        value = value.strip().lower()

        allowed = {
            "development",
            "production",
            "testing"
        }

        if value not in allowed:
            raise ValueError("Invalid ENVIRONMENT value.")

        return value

    # ========================================
    # CORS CONFIGURATION
    # ========================================

    @property
    def cors_origins(self):
        return [
            origin.strip().rstrip("/")
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]


# ============================================
# SETTINGS INSTANCE
# ============================================

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
