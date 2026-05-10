from fastapi import APIRouter, HTTPException
from ..kite_client import kite
from ..normaliser import build_portfolio

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

# In-memory cache (single user)
_cache: dict = {}


async def _fetch_and_build() -> dict:
    if not kite.is_authenticated:
        authenticated = await kite.check_auth()
        if not authenticated:
            raise HTTPException(status_code=401, detail="Not authenticated with Kite. Visit /api/auth/login first.")

    # Sequential calls — MCP ClientSession streams are not concurrent-safe
    profile = await kite.get_profile()
    equity = await kite.get_holdings()
    mf = await kite.get_mf_holdings()
    positions = await kite.get_positions()
    margins = await kite.get_margins()

    portfolio = await build_portfolio(
        profile=profile or {},
        equity_holdings=equity or [],
        mf_holdings=mf or [],
        positions_raw=positions or {},
        margins_raw=margins or {},
    )
    data = portfolio.model_dump()
    _cache["portfolio"] = data
    return data


@router.get("")
async def get_portfolio():
    """Fetch all portfolio data from Kite MCP and return normalised portfolio."""
    return await _fetch_and_build()


@router.post("/refresh")
async def refresh_portfolio():
    """Force-refresh all data from Kite MCP."""
    return await _fetch_and_build()


@router.get("/cached")
async def get_cached():
    """Return last cached portfolio (no Kite MCP call)."""
    if not _cache.get("portfolio"):
        return await _fetch_and_build()
    return _cache["portfolio"]
