# ============================================
# RYFX XAU — BACKEND CONFIGURATION
# GOLD MARKET INTELLIGENCE PLATFORM
# ============================================

import os

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # APPLICATION

    APP_NAME: str = "ryFX XAU"

    APP_VERSION: str = "1.0.0"

    APP_DESCRIPTION: str = (
        "AI-Powered Gold Trading Intelligence Platform"
    )

    DEBUG: bool = False


    # API CONFIGURATION

    API_PREFIX: str = "/api"


    # AI CONFIGURATION

    AI_PROVIDER: str = "gemini"

    AI_API_KEY: str = ""

    AI_MODEL: str = "gemini-2.5-flash"


    # MARKET DATA CONFIGURATION

    MARKET_API_KEY: str = ""

    MARKET_API_URL: str = ""

    MARKET_SYMBOL: str = "XAUUSD"

    MARKET_REFRESH_INTERVAL: int = 30


    # DATABASE CONFIGURATION

    DATABASE_URL: str = ""


    # CORS CONFIGURATION

    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:5500"
    )


    # SECURITY

    SECRET_KEY: str = ""

    
    # ENVIRONMENT

    ENVIRONMENT: str = "development"


    model_config = SettingsConfigDict(

        env_file=".env",

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


@lru_cache
def get_settings():

    return Settings()


settings = get_settings()
