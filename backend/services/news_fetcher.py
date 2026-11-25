# ============================================
# RYFX XAU — NEWS FETCHER SERVICE
# MARKETAUX / NEWSAPI INTEGRATION
# ============================================

import logging
import httpx

from typing import Any, Optional
from config import settings

logger = logging.getLogger("ryfx.news")

# ============================================
# CONFIGURATION
# ============================================

NEWS_TIMEOUT = 10.0

# Marketaux API endpoint
MARKETAUX_BASE_URL = "https://api.marketaux.com/v1/news/all"

# Default query untuk XAUUSD
DEFAULT_QUERY = "gold XAUUSD inflation Federal Reserve"

# Maksimal artikel yang diambil per request
DEFAULT_LIMIT = 5


# ============================================
# MARKETAUX FETCHER
# ============================================

async def fetch_news_marketaux(
    query: str = DEFAULT_QUERY,
    limit: int = DEFAULT_LIMIT
) -> list[dict[str, Any]]:
    """
    Mengambil berita terbaru dari Marketaux.
    Memerlukan MARKETAUX_API_KEY di config.
    """
    api_key = getattr(settings, "MARKETAUX_API_KEY", "").strip()
    if not api_key:
        logger.warning("[News] MARKETAUX_API_KEY tidak diset, melewati Marketaux.")
        return []

    params = {
        "api_token": api_key,
        "search": query,
        "language": "en",
        "limit": limit,
    }

    try:
        async with httpx.AsyncClient(timeout=NEWS_TIMEOUT) as client:
            response = await client.get(MARKETAUX_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        logger.error("[News] Marketaux timeout.")
        return []
    except httpx.HTTPStatusError as e:
        logger.error(f"[News] Marketaux HTTP {e.response.status_code}.")
        return []
    except Exception as e:
        logger.error(f"[News] Marketaux error: {e}")
        return []

    articles = data.get("data", [])

    # Normalisasi field agar seragam
    return [
        {
            "title": article.get("title"),
            "snippet": article.get("snippet"),
            "source": article.get("source"),
            "url": article.get("url"),
            "published_at": article.get("published_at"),
        }
        for article in articles
        if article.get("title")
    ]


# ============================================
# NEWSAPI FALLBACK (OPSIONAL)
# ============================================

NEWSAPI_BASE_URL = "https://newsapi.org/v2/everything"


async def fetch_news_newsapi(
    query: str = DEFAULT_QUERY,
    limit: int = DEFAULT_LIMIT
) -> list[dict[str, Any]]:
    """
    Fallback jika Marketaux tidak tersedia.
    Memerlukan NEWSAPI_API_KEY di config.
    """
    api_key = getattr(settings, "NEWSAPI_API_KEY", "").strip()
    if not api_key:
        logger.warning("[News] NEWSAPI_API_KEY tidak diset, melewati NewsAPI.")
        return []

    params = {
        "apiKey": api_key,
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": limit,
    }

    try:
        async with httpx.AsyncClient(timeout=NEWS_TIMEOUT) as client:
            response = await client.get(NEWSAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        logger.error("[News] NewsAPI timeout.")
        return []
    except Exception as e:
        logger.error(f"[News] NewsAPI error: {e}")
        return []

    articles = data.get("articles", [])

    return [
        {
            "title": article.get("title"),
            "snippet": article.get("description"),
            "source": (article.get("source") or {}).get("name"),
            "url": article.get("url"),
            "published_at": article.get("publishedAt"),
        }
        for article in articles
        if article.get("title")
    ]


# ============================================
# UNIFIED FETCHER
# ============================================

async def fetch_latest_news(
    query: str = DEFAULT_QUERY,
    limit: int = DEFAULT_LIMIT
) -> list[dict[str, Any]]:
    """
    Fungsi utama untuk mengambil berita.
    Mencoba Marketaux dulu, lalu fallback ke NewsAPI.
    """
    articles = await fetch_news_marketaux(query, limit)

    if not articles:
        logger.info("[News] Marketaux kosong, mencoba NewsAPI...")
        articles = await fetch_news_newsapi(query, limit)

    if not articles:
        logger.warning("[News] Tidak ada berita dari semua sumber.")

    return articles


# ============================================
# BUILD NEWS CONTEXT UNTUK AI
# ============================================

async def build_news_context(
    event_name: Optional[str] = None,
    limit: int = 5
) -> str:
    """
    Membuat string konteks berita yang siap dimasukkan ke prompt AI.
    Fokus pada event tertentu jika diberikan (misal: "PCE").
    """
    query = f"gold {event_name} Federal Reserve" if event_name else DEFAULT_QUERY

    articles = await fetch_latest_news(query=query, limit=limit)

    if not articles:
        return "No recent news available."

    lines = []
    for i, a in enumerate(articles, start=1):
        lines.append(f"{i}. {a['title']} ({a['source']})")
        if a.get("snippet"):
            lines.append(f"   {a['snippet'][:200]}")
    
    return "\n".join(lines)
