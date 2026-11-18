# ============================================
# RYFX XAU — MAIN APPLICATION
# AI-POWERED GOLD INTELLIGENCE PLATFORM
# ============================================

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


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

    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],

    allow_headers=["*"]

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

        "symbol": settings.MARKET_SYMBOL

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

        "available_endpoints": [

            "/",

            "/health",

            "/api",

            "/docs"

        ]

    }


# ============================================
# FUTURE ROUTE INTEGRATION
# ============================================

# Market, AI Analysis, Signals, and History
# routes will be registered here after
# their implementations are completed.
