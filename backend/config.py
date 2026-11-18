# ============================================
# RYFX XAU — BACKEND CONFIGURATION
# ============================================

from functools import lru_cache
from pathlib import Path

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
    MARKET_REFRESH_INTERVAL: int = 30

    # DATABASE
    DATABASE_URL: str = ""

    # SECURITY
    SECRET_KEY: str = ""

    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:5500"
    )

    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def cors_origins(self):
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]


# ============================================
# SETTINGS INSTANCE
# ============================================

@lru_cache
def get_settings():
    return Settings()


settings = get_settings()
