"""
Fetches AMFI NAV data to resolve MF ISINs → scheme name + category.
Cached in-process for 24 hours to avoid repeated network calls.
"""

import asyncio
import logging
import re
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_CACHE: dict = {}           # {"data": {...}, "ts": float}
_CACHE_TTL = 86400          # 24 hours
_FETCH_LOCK = asyncio.Lock()

AMFI_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"

# Map AMFI category text → simplified label
_CAT_MAP = [
    ("Large Cap",       "Large Cap"),
    ("Large & Mid Cap", "Large & Mid Cap"),
    ("Mid Cap",         "Mid Cap"),
    ("Small Cap",       "Small Cap"),
    ("Flexi Cap",       "Flexi Cap"),
    ("Multi Cap",       "Multi Cap"),
    ("ELSS",            "ELSS"),
    ("Liquid",          "Debt"),
    ("Overnight",       "Debt"),
    ("Ultra Short",     "Debt"),
    ("Low Duration",    "Debt"),
    ("Short Duration",  "Debt"),
    ("Medium Duration", "Debt"),
    ("Long Duration",   "Debt"),
    ("Gilt",            "Debt"),
    ("Banking and PSU", "Debt"),
    ("Credit Risk",     "Debt"),
    ("Floater",         "Debt"),
    ("Money Market",    "Debt"),
    ("Dynamic Bond",    "Debt"),
    ("Debt",            "Debt"),
    ("Hybrid",          "Hybrid"),
    ("Arbitrage",       "Hybrid"),
    ("Gold",            "Gold"),
    ("Index",           "Index"),
    ("ETF",             "ETF"),
    ("International",   "International"),
    ("Overseas",        "International"),
    ("Sectoral",        "Sectoral"),
    ("Thematic",        "Thematic"),
    ("Dividend Yield",  "Dividend Yield"),
    ("Value",           "Value"),
    ("Contra",          "Contra"),
    ("Focused",         "Focused"),
]


def _map_category(raw_section: str) -> str:
    for keyword, label in _CAT_MAP:
        if keyword.lower() in raw_section.lower():
            return label
    return "Other"


def _parse_amfi(text: str) -> dict[str, dict]:
    """Parse NAVAll.txt into {ISIN: {name, category}}."""
    result: dict[str, dict] = {}
    current_cat = "Other"

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Section header e.g. "Open Ended Schemes(Equity Scheme - Large Cap Fund)"
        if line.startswith(("Open Ended", "Close Ended", "Interval")):
            current_cat = _map_category(line)
            continue

        # Skip column headers
        if "Scheme Code" in line or "Scheme Name" in line:
            continue

        parts = line.split(";")
        if len(parts) < 4:
            continue

        isin_growth = parts[1].strip()
        isin_div    = parts[2].strip()
        name        = parts[3].strip()

        for isin in (isin_growth, isin_div):
            if isin and re.match(r"INF[A-Z0-9]{9}", isin):
                result[isin] = {"name": name, "category": current_cat}

    return result


async def get_isin_map() -> dict[str, dict]:
    """Return cached {ISIN: {name, category}} map, refreshing when stale."""
    now = time.time()
    if _CACHE.get("data") and now - _CACHE.get("ts", 0) < _CACHE_TTL:
        return _CACHE["data"]

    async with _FETCH_LOCK:
        # Re-check after acquiring lock
        if _CACHE.get("data") and now - _CACHE.get("ts", 0) < _CACHE_TTL:
            return _CACHE["data"]
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                resp = await client.get(AMFI_URL, headers={"User-Agent": "Mozilla/5.0"})
                resp.raise_for_status()
            data = _parse_amfi(resp.text)
            _CACHE["data"] = data
            _CACHE["ts"] = time.time()
            logger.info("AMFI ISIN map loaded: %d entries", len(data))
            return data
        except Exception as exc:
            logger.warning("AMFI fetch failed: %s — using empty map", exc)
            return _CACHE.get("data", {})


def resolve_mf(isin: str, isin_map: dict) -> tuple[str, str]:
    """Return (fund_name, category) for an ISIN, falling back to the raw ISIN."""
    entry = isin_map.get(isin)
    if entry:
        return entry["name"], entry["category"]
    return isin, "Other"
