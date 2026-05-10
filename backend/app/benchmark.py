"""
Fetches benchmark OHLC data from Yahoo Finance.
Falls back to static seed data when the live fetch fails.
"""

from __future__ import annotations

import datetime
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SYMBOLS = {
    "nifty50": "^NSEI",
    "nifty_midcap150": "^NSEMDCP50",
    "nifty_smallcap250": "^CNXSC",
}

# Rough static seed: daily closes for the last 30 days (placeholder values)
_STATIC_SEED: dict[str, list[dict]] = {
    "nifty50": [{"date": "2025-04-10", "close": 22000}, {"date": "2025-05-10", "close": 23500}],
    "nifty_midcap150": [{"date": "2025-04-10", "close": 11000}, {"date": "2025-05-10", "close": 11800}],
    "nifty_smallcap250": [{"date": "2025-04-10", "close": 8500}, {"date": "2025-05-10", "close": 9100}],
}

_PERIOD_MAP = {
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1wk"),
    "1Y": ("1y", "1wk"),
    "3Y": ("3y", "1mo"),
    "Max": ("10y", "1mo"),
}


async def fetch_benchmark(symbol_key: str, period: str = "1Y") -> dict:
    """Return {symbol, period, data: [{date, close}], source}"""
    yahoo_symbol = SYMBOLS.get(symbol_key, "^NSEI")
    range_str, interval = _PERIOD_MAP.get(period, ("1y", "1wk"))
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}"
        f"?range={range_str}&interval={interval}"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            raw = resp.json()
            result = raw["chart"]["result"][0]
            timestamps = result["timestamp"]
            closes = result["indicators"]["quote"][0]["close"]
            data = [
                {
                    "date": datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"),
                    "close": round(c, 2) if c else None,
                }
                for ts, c in zip(timestamps, closes)
                if c is not None
            ]
            return {"symbol": symbol_key, "period": period, "data": data, "source": "Yahoo Finance"}
    except Exception as exc:
        logger.warning("Yahoo Finance fetch failed for %s: %s — using static seed", symbol_key, exc)
        return {
            "symbol": symbol_key,
            "period": period,
            "data": _STATIC_SEED.get(symbol_key, []),
            "source": "Static seed (Yahoo Finance unavailable)",
        }


async def fetch_all_benchmarks(period: str = "1Y") -> dict[str, dict]:
    import asyncio
    results = await asyncio.gather(
        *[fetch_benchmark(k, period) for k in SYMBOLS],
        return_exceptions=True,
    )
    out = {}
    for key, res in zip(SYMBOLS.keys(), results):
        if isinstance(res, Exception):
            out[key] = {"symbol": key, "period": period, "data": _STATIC_SEED.get(key, []), "source": "Static seed"}
        else:
            out[key] = res
    return out
