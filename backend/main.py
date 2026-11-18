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

    print("================================")
    print("RYFX XAU BACKEND READY")
    print("================================")

    yield

    print("================================")
    print("RYFX XAU BACKEND SHUTTING DOWN")
    print("================================")


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

cors_origins = settings.cors_origins

if not cors_origins:
    raise RuntimeError(
        "ALLOWED_ORIGINS must contain at least one origin."
    )

app.add_middleware(

    CORSMiddleware,

    allow_origins=cors_origins,

    allow_credentials=True,

    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept"
    ]

)


# ============================================
# API ROUTER REGISTRATION
# ============================================

API_PREFIX = settings.API_PREFIX.rstrip("/")

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

        "symbol": "XAUUSD",

        "documentation": "/docs",

        "health": "/health"

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

        "version": settings.APP_VERSION,

        "environment": settings.ENVIRONMENT

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


# ============================================
# SERVICE CONFIGURATION STATUS
# ============================================

@app.get("/api/services")
async def service_information():

    return {

        "success": True,

        "symbol": "XAUUSD",

        "services": {

            "market_api": {

                "provider": "MarketAPI",

                "configured": bool(
                    settings.MARKET_API_KEY
                    and settings.MARKET_API_URL
                )

            },

            "ai_engine": {

                "provider": settings.AI_PROVIDER,

                "configured": bool(
                    settings.AI_API_KEY
                )

            },

            "database": {

                "configured": bool(
                    settings.DATABASE_URL
                ),

                "storage": "Not yet integrated"

            }

        }

    }
