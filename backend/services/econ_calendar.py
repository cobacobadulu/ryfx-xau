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

DEFAULT_COUNTRIES = "US"
DEFAULT_IMPORTANCE = "high"

# DAFTAR KATA KUNCI BERITA YANG DIIZINKAN (WHITELIST)
# Hanya berita yang mengandung kata kunci ini yang akan diproses
ALLOWED_KEYWORDS = [
    "nfp", 
    "non-farm", 
    "cpi", 
    "ppi", 
    "pce", 
    "fomc", 
    "retail sales", 
    "unemployment", 
    "jobless"
]

# ============================================
# CLIENT INITIALIZATION
# ============================================

_biquote_client: Optional[Biquote] = None

def get_client() -> Biquote:
    global _biquote_client
    if _biquote_client is None:
        _biquote_client = Biquote()
    return _biquote_client

# ============================================
# HELPER: VALIDASI BERITA
# ============================================

def is_relevant_event(event_name: str) -> bool:
    """Cek apakah nama berita mengandung kata kunci yang diizinkan."""
    if not event_name:
        return False
    name_lower = event_name.lower()
    return any(keyword in name_lower for keyword in ALLOWED_KEYWORDS)

def has_valid_data(event: dict) -> bool:
    """Cek apakah berita memiliki angka Forecast dan Previous."""
    return event.get("forecast") is not None and event.get("previous") is not None

# ============================================
# FETCH HIGH-IMPACT EVENTS
# ============================================

async def fetch_high_impact_events(
    countries: str = DEFAULT_COUNTRIES,
    importance: str = DEFAULT_IMPORTANCE
) -> list[dict[str, Any]]:
    """
    Mengambil daftar berita ekonomi high impact dari biquote.
    Hanya mengembalikan berita yang ada di whitelist dan punya data lengkap.
    """
    try:
        client = get_client()
        
        events = client.calendar(
            importance=importance,
            countries=countries
        )
        
        if not events:
            logger.info(f"[Calendar] Tidak ada event {importance} untuk {countries}")
            return []
        
        normalized = []
        for event in events:
            name = event.get("name", "")
            
            # Filter 1: Harus berita penting
            if not is_relevant_event(name):
                continue
                
            # Filter 2: Harus ada angka Forecast & Previous
            if not has_valid_data(event):
                continue

            normalized.append({
                "eventId": event.get("eventId"),
                "time": event.get("time"),
                "country": event.get("countryCode"),
                "currency": event.get("currency"),
                "name": name,
                "importance": event.get("importance"),
                "actual": event.get("actual"),
                "forecast": event.get("forecast"),
                "previous": event.get("previous"),
                "unit": event.get("unit"),
                "multiplier": event.get("multiplier"),
                "timeMode": event.get("timeMode"),
            })
        
        logger.info(f"[Calendar] Ditemukan {len(normalized)} event relevan")
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
        
        events = client.calendar(
            importance=importance,
            countries=countries
        )
        
        if not events:
            return []
        
        upcoming = []
        for e in events:
            # Harus berita penting
            if not is_relevant_event(e.get("name", "")):
                continue
            
            # Harus belum rilis (Actual kosong)
            if e.get("actual") is not None:
                continue
                
            # Harus ada forecast dan previous untuk dianalisis
            if not has_valid_data(e):
                continue

            upcoming.append({
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
            })
        
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
    """
    try:
        client = get_client()
        events = client.calendar(
            importance="high",
            countries=countries
        )
        
        if not events:
            return None
        
        search_term = event_name.lower()
        matches = [
            e for e in events
            if search_term in (e.get("name") or "").lower()
            and is_relevant_event(e.get("name"))
            and has_valid_data(e)
        ]
        
        if not matches:
            return None
        
        upcoming = [m for m in matches if m.get("actual") is None]
        if upcoming:
            return upcoming[0]
        
        return matches[0]
        
    except Exception as e:
        logger.error(f"[Calendar] Error finding event: {e}")
        return None
