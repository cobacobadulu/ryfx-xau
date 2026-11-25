# ============================================
# RYFX XAU — ECONOMIC CALENDAR SERVICE
# BIQUOTE INTEGRATION (FREE, NO API KEY)
# ============================================

import logging
from typing import Any, Optional
from biquote import Biquote

logger = logging.getLogger("ryfx.calendar")

# ============================================
# CONFIGURATION
# ============================================

# Filter negara: US adalah penggerak utama XAU
# Bisa tambah "EU,GB" jika ingin mencakup berita Eropa/Inggris
DEFAULT_COUNTRIES = "US"

# Hanya ambil berita high impact
DEFAULT_IMPORTANCE = "high"

# ============================================
# CLIENT INITIALIZATION
# ============================================

_biquote_client: Optional[Biquote] = None


def get_client() -> Biquote:
    """Lazy initialization untuk client biquote."""
    global _biquote_client
    if _biquote_client is None:
        _biquote_client = Biquote()
    return _biquote_client


# ============================================
# FETCH HIGH-IMPACT EVENTS
# ============================================

async def fetch_high_impact_events(
    countries: str = DEFAULT_COUNTRIES,
    importance: str = DEFAULT_IMPORTANCE
) -> list[dict[str, Any]]:
    """
    Mengambil daftar berita ekonomi high impact dari biquote.
    
    Args:
        countries: Kode negara ISO alpha-2, dipisah koma (misal: "US,EU,GB")
        importance: Level minimum importance ("low", "medium", "high")
    
    Returns:
        List event dengan field: eventId, time, countryCode, currency,
        name, importance, actual, forecast, previous, unit, multiplier.
    """
    try:
        client = get_client()
        
        # biquote.calendar() mengembalikan events dalam format list of dict
        events = client.calendar(
            importance=importance,
            countries=countries
        )
        
        if not events:
            logger.info(f"[Calendar] Tidak ada event {importance} untuk {countries}")
            return []
        
        # Normalisasi dan filter field yang diperlukan AI
        normalized = []
        for event in events:
            normalized.append({
                "eventId": event.get("eventId"),
                "time": event.get("time"),
                "country": event.get("countryCode"),
                "currency": event.get("currency"),
                "name": event.get("name"),
                "importance": event.get("importance"),
                "actual": event.get("actual"),      # None jika belum rilis
                "forecast": event.get("forecast"),  # Angka konsensus (kunci utama)
                "previous": event.get("previous"),
                "unit": event.get("unit"),
                "multiplier": event.get("multiplier"),
                "timeMode": event.get("timeMode"),
            })
        
        logger.info(f"[Calendar] Ditemukan {len(normalized)} event high impact")
        return normalized
        
    except Exception as e:
        logger.error(f"[Calendar] Error fetching events: {e}")
        return []


# ============================================
# FETCH UPCOMING EVENTS (PRE-RELEASE)
# ============================================

async def fetch_upcoming_events(
    limit: int = 10,
    countries: str = DEFAULT_COUNTRIES,
    importance: str = DEFAULT_IMPORTANCE
) -> list[dict[str, Any]]:
    """
    Mengambil event yang akan datang (belum rilis).
    Cocok untuk sinyal PRE-NEWS.
    """
    try:
        client = get_client()
        
        # Menggunakan endpoint /api/calendar/upcoming via client jika tersedia
        # Jika tidak, fallback ke calendar() dan filter manual
        events = client.calendar(
            importance=importance,
            countries=countries
        )
        
        if not events:
            return []
        
        # Filter: hanya event yang actual-nya masih None (belum rilis)
        upcoming = [
            {
                "eventId": e.get("eventId"),
                "time": e.get("time"),
                "country": e.get("countryCode"),
                "currency": e.get("currency"),
                "name": e.get("name"),
                "importance": e.get("importance"),
                "forecast": e.get("forecast"),
                "previous": e.get("previous"),
                "unit": e.get("unit"),
                "multiplier": e.get("multiplier"),
            }
            for e in events
            if e.get("actual") is None
        ]
        
        # Urutkan berdasarkan waktu terdekat
        upcoming.sort(key=lambda x: x.get("time") or "")
        
        return upcoming[:limit]
        
    except Exception as e:
        logger.error(f"[Calendar] Error fetching upcoming: {e}")
        return []


# ============================================
# GET EVENT DETAIL (UNTUK AI PROMPT)
# ============================================

async def get_event_for_analysis(
    event_name: str,
    countries: str = DEFAULT_COUNTRIES
) -> Optional[dict[str, Any]]:
    """
    Mencari event spesifik berdasarkan nama (misal: "Core PCE", "Non-Farm").
    Mengembalikan event terbaru yang cocok untuk dianalisis AI.
    """
    try:
        client = get_client()
        events = client.calendar(
            importance="high",
            countries=countries
        )
        
        if not events:
            return None
        
        # Pencarian case-insensitive
        search_term = event_name.lower()
        matches = [
            e for e in events
            if search_term in (e.get("name") or "").lower()
        ]
        
        if not matches:
            return None
        
        # Ambil yang paling relevan (actual None = upcoming, atau terbaru)
        # Prioritaskan yang belum rilis
        upcoming = [m for m in matches if m.get("actual") is None]
        if upcoming:
            return upcoming[0]
        
        return matches[0]
        
    except Exception as e:
        logger.error(f"[Calendar] Error finding event: {e}")
        return None
