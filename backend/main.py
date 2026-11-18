# ============================================
# RYFX XAU — MAIN APPLICATION
# AI-POWERED GOLD INTELLIGENCE PLATFORM
# ============================================

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

# ============================================
# ROUTE IMPORTS
# ============================================

from routes import market
from routes import analysis
from routes import signals
from routes import history


# ============================================
# APPLICATION LIFECYCLE
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    print("================================")
    print("RYFX XAU BACKEND STARTING")
    print("================================")

    print(f"Application: {settings.APP_NAME}")
    print(f"Version: {settings.APP_VERSION}")
    print(f"Environment: {settings.ENVIRONMENT}")

    print("API ROUTERS:")
    print("- Market API")
    print("- AI Analysis API")
    print("- Trading Signals API")
    print("- Analysis History API")

    yield

    print("RYFX XAU BACKEND SHUTTING DOWN")


# ============================================
# FASTAPI APPLICATION
# ============================================

app = FastAPI(

    title=settings.APP_NAME,

    description=settings.APP_DESCRIPTION,

    version=settings.APP_VERSION,

    debug=settings.DEBUG,

    lifespan=lifespan

)


# ============================================
# CORS CONFIGURATION
# ============================================

app.add_middleware(

    CORSMiddleware,

    allow_origins=settings.cors_origins,

    allow_credentials=True,

    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allow_headers=["*"]

)


# ============================================
# API ROUTER REGISTRATION
# ============================================

API_PREFIX = settings.API_PREFIX

app.include_router(
    market.router,
    prefix=API_PREFIX
)

app.include_router(
    analysis.router,
    prefix=API_PREFIX
)

app.include_router(
    signals.router,
    prefix=API_PREFIX
)

app.include_router(
    history.router,
    prefix=API_PREFIX
)


# ============================================
# ROOT ENDPOINT
# ============================================

@app.get("/")
async def root():

    return {

        "success": True,

        "application": settings.APP_NAME,

        "version": settings.APP_VERSION,

        "message": "RYFX XAU Backend is running.",

        "symbol": settings.MARKET_SYMBOL,

        "documentation": "/docs"

    }


# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
async def health_check():

    return {

        "success": True,

        "status": "healthy",

        "application": settings.APP_NAME,

        "version": settings.APP_VERSION

    }


# ============================================
# API INFORMATION
# ============================================

@app.get("/api")
async def api_information():

    return {

        "success": True,

        "name": settings.APP_NAME,

        "version": settings.APP_VERSION,

        "description": settings.APP_DESCRIPTION,

        "symbol": "XAUUSD",

        "available_endpoints": [

            "/",

            "/health",

            "/api",

            "/docs",

            "/api/market/xauusd",

            "/api/market/candles",

            "/api/market/status",

            "/api/analysis/xauusd",

            "/api/analysis/status",

            "/api/signals/",

            "/api/signals/statistics",

            "/api/history/",

            "/api/history/statistics/summary"

        ]

    }
