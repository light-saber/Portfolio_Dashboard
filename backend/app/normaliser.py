"""
Normalises raw Kite MCP responses into the unified Portfolio model.
"""

from __future__ import annotations

import datetime
import logging
import re
from typing import Any

from .models import (
    Holding,
    InstrumentType,
    Margins,
    Portfolio,
    PortfolioSummary,
    Position,
)
from .xirr import simple_xirr
from .market_cap import classify_equity_cap
from .amfi import resolve_mf

logger = logging.getLogger(__name__)

_ETF_KEYWORDS = ["ETF", "BEES", "IETF", "GOLDETF"]
_SGB_KEYWORDS = ["SGB", "SGBD", "GOLD BOND"]
_INTL_KEYWORDS = ["US", "NASDAQ", "NYSE", "GLOBAL", "INTERN", "WORLD", "HANG SENG", "N100", "NASDAQ100"]
_DEBT_CATEGORIES = {"Debt"}


def _is_isin(s: str) -> bool:
    return bool(re.match(r"INF[A-Z0-9]{9}", s))


def _infer_equity_type(name: str) -> InstrumentType:
    u = name.upper()
    if any(k in u for k in _SGB_KEYWORDS):
        return InstrumentType.SGB
    if any(k in u for k in _ETF_KEYWORDS):
        return InstrumentType.ETF
    return InstrumentType.EQUITY


def _is_international(name: str) -> bool:
    return any(k in name.upper() for k in _INTL_KEYWORDS)


def _is_debt(category: str) -> bool:
    return category in _DEBT_CATEGORIES


def _normalise_equity_holding(raw: dict) -> Holding:
    """Handles equities, ETFs and SGBs from get_holdings."""
    name = raw.get("tradingsymbol") or "Unknown"
    exchange = raw.get("exchange", "NSE")
    units = float(raw.get("quantity", 0))
    avg_price = float(raw.get("average_price", 0))
    last_price = float(raw.get("last_price", avg_price))
    invested = units * avg_price
    current_value = units * last_price
    pnl = current_value - invested
    pnl_pct = (pnl / invested * 100) if invested else 0

    itype = _infer_equity_type(name)

    # Cap classification from Nifty index membership
    if itype == InstrumentType.EQUITY:
        category = classify_equity_cap(name)
    elif itype == InstrumentType.ETF:
        u = name.upper()
        if "MIDCAP" in u or "MID" in u:
            category = "Mid Cap"
        elif "SMALL" in u:
            category = "Small Cap"
        else:
            category = "Large Cap"
    else:
        category = "SGB"

    day_change = raw.get("day_change")
    day_change_pct = raw.get("day_change_percentage")

    return Holding(
        name=name,
        isin=raw.get("isin"),
        instrument_token=raw.get("instrument_token"),
        instrument_type=itype,
        category=category,
        units=units,
        avg_buy_price=round(avg_price, 4),
        current_price=round(last_price, 4),
        invested=round(invested, 2),
        current_value=round(current_value, 2),
        pnl=round(pnl, 2),
        pnl_pct=round(pnl_pct, 2),
        day_change=round(float(day_change), 2) if day_change is not None else None,
        day_change_pct=round(float(day_change_pct), 2) if day_change_pct is not None else None,
        exchange=exchange,
    )


def _normalise_mf_holding(raw: dict, isin_map: dict) -> Holding:
    """
    Handles MF holdings. If tradingsymbol is an ISIN (INF...), resolves
    the real fund name and SEBI category via AMFI data.
    """
    tradingsymbol = raw.get("tradingsymbol") or raw.get("fund_name") or "Unknown"
    units = float(raw.get("quantity", 0))
    nav = float(raw.get("last_price", 0)) or float(raw.get("nav", 0))
    avg_nav = float(raw.get("average_price", 0)) or nav
    invested = units * avg_nav
    current_value = units * nav
    pnl = current_value - invested
    pnl_pct = (pnl / invested * 100) if invested else 0

    # Resolve ISIN → human-readable name + AMFI category
    if _is_isin(tradingsymbol):
        name, category = resolve_mf(tradingsymbol, isin_map)
        isin = tradingsymbol
    else:
        name = tradingsymbol
        isin = raw.get("isin")
        if isin and _is_isin(isin):
            resolved_name, category = resolve_mf(isin, isin_map)
            if resolved_name != isin:        # only override if lookup succeeded
                name = resolved_name
        else:
            category = "Other"

    return Holding(
        name=name,
        isin=isin,
        instrument_type=InstrumentType.MF,
        category=category,
        units=units,
        avg_buy_price=round(avg_nav, 4),
        current_price=round(nav, 4),
        invested=round(invested, 2),
        current_value=round(current_value, 2),
        pnl=round(pnl, 2),
        pnl_pct=round(pnl_pct, 2),
    )


def _normalise_position(raw: dict) -> Position:
    return Position(
        tradingsymbol=raw.get("tradingsymbol", ""),
        exchange=raw.get("exchange", ""),
        quantity=int(raw.get("quantity", 0)),
        average_price=float(raw.get("average_price", 0)),
        last_price=float(raw.get("last_price", 0)),
        pnl=float(raw.get("pnl", 0)),
        product=raw.get("product", ""),
    )


def _compute_risk_score(holdings: list[Holding], summary: PortfolioSummary) -> float:
    score = 5.0
    if summary.small_cap_pct > 40:
        score += 2
    elif summary.small_cap_pct > 20:
        score += 1
    if summary.debt_pct > 30:
        score -= 1.5
    elif summary.debt_pct > 15:
        score -= 0.5
    total = summary.current_value or 1
    max_holding_pct = max((h.current_value / total * 100 for h in holdings), default=0)
    if max_holding_pct > 30:
        score += 1.5
    elif max_holding_pct > 15:
        score += 0.5
    if summary.international_pct > 10:
        score -= 0.5
    return round(max(1.0, min(10.0, score)), 1)


def _detect_overlap_warnings(holdings: list[Holding]) -> list[str]:
    warnings = []
    flexi = [h.name for h in holdings if h.instrument_type == InstrumentType.MF and "Flexi" in h.name]
    multi = [h.name for h in holdings if h.instrument_type == InstrumentType.MF and "Multi" in h.name]
    if len(flexi) > 1:
        warnings.append(f"Multiple flexi-cap funds detected. Likely stock overlap — consider consolidating.")
    if len(flexi) + len(multi) > 2:
        warnings.append("High overlap risk: flexi/multi-cap funds likely hold the same underlying stocks.")
    lc_funds = [h for h in holdings if h.category == "Large Cap" and h.instrument_type == InstrumentType.MF]
    if len(lc_funds) > 2:
        warnings.append(f"Multiple large-cap funds ({len(lc_funds)}). Top 100 stocks overlap — consider a single index fund.")
    return warnings


async def build_portfolio(
    profile: dict,
    equity_holdings: list[dict],
    mf_holdings: list[dict],
    positions_raw: dict,
    margins_raw: dict,
) -> Portfolio:
    """
    Async so it can fetch AMFI data before normalising.
    equity_holdings covers equities + any MF held via Coin (tradingsymbol = ISIN).
    mf_holdings is from get_mf_holdings (may be empty if Kite MCP doesn't support it).
    """
    from .amfi import get_isin_map
    isin_map = await get_isin_map()

    today = datetime.date.today()

    # Split equity_holdings into real equities and MF-via-Coin (ISIN tradingsymbol)
    raw_equities = [h for h in equity_holdings if not _is_isin(h.get("tradingsymbol", ""))]
    mf_via_coin  = [h for h in equity_holdings if _is_isin(h.get("tradingsymbol", ""))]

    equity_list = [_normalise_equity_holding(h) for h in raw_equities if float(h.get("quantity", 0)) > 0]
    mf_list     = [_normalise_mf_holding(h, isin_map) for h in (mf_via_coin + mf_holdings) if float(h.get("quantity", 0)) > 0]

    net_positions = positions_raw.get("net", []) if isinstance(positions_raw, dict) else []
    positions = [_normalise_position(p) for p in net_positions if int(p.get("quantity", 0)) != 0]

    # Margins
    eq_margins = margins_raw.get("equity", {}) if isinstance(margins_raw, dict) else {}
    available_cash = float(
        eq_margins.get("available", {}).get("live_balance", 0)
        or eq_margins.get("net", 0)
        or 0
    )
    used_margin = float(eq_margins.get("utilised", {}).get("debits", 0) or 0)
    margins = Margins(available_cash=available_cash, used_margin=used_margin, net=available_cash - used_margin)

    all_holdings = equity_list + mf_list

    total_invested = sum(h.invested for h in all_holdings)
    current_value  = sum(h.current_value for h in all_holdings) + available_cash
    total_pnl      = sum(h.pnl for h in all_holdings)
    total_pnl_pct  = (total_pnl / total_invested * 100) if total_invested else 0
    day_change     = sum(h.day_change for h in all_holdings if h.day_change is not None)
    day_change_pct = (day_change / (total_invested or 1)) * 100

    equity_value = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.EQUITY)
    etf_value    = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.ETF)
    mf_value     = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.MF)
    sgb_value    = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.SGB)

    total_cv = current_value or 1

    # Cap exposure across equities and MFs
    large_cap_pct = sum(h.current_value for h in all_holdings if h.category == "Large Cap") / total_cv * 100
    mid_cap_pct   = sum(h.current_value for h in all_holdings if h.category == "Mid Cap")   / total_cv * 100
    small_cap_pct = sum(h.current_value for h in all_holdings if h.category == "Small Cap") / total_cv * 100

    intl_pct     = sum(h.current_value for h in all_holdings if _is_international(h.name)) / total_cv * 100
    domestic_pct = 100 - intl_pct

    debt_value   = sum(h.current_value for h in all_holdings if _is_debt(h.category))
    equity_side  = current_value - debt_value - available_cash
    equity_pct   = equity_side / total_cv * 100
    debt_pct     = debt_value  / total_cv * 100

    # Portfolio XIRR (rough estimate — treat total as single buy 3 years ago)
    xirr_val = None
    try:
        oldest = today - datetime.timedelta(days=365 * 3)
        xirr_val = simple_xirr(total_invested, current_value, oldest, today)
    except Exception:
        pass

    xirr_per_holding: dict[str, float | None] = {}
    for h in all_holdings:
        try:
            xirr_per_holding[h.name] = simple_xirr(
                h.invested, h.current_value,
                today - datetime.timedelta(days=365), today
            )
        except Exception:
            xirr_per_holding[h.name] = None

    concentration_flags = [
        f"{h.name} is {h.current_value / total_cv * 100:.1f}% of portfolio — high concentration"
        for h in all_holdings
        if total_cv and h.current_value / total_cv > 0.15
    ]

    overlap_warnings = _detect_overlap_warnings(all_holdings)

    summary = PortfolioSummary(
        total_invested=round(total_invested, 2),
        current_value=round(current_value, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_pct=round(total_pnl_pct, 2),
        day_change=round(day_change, 2),
        day_change_pct=round(day_change_pct, 2),
        xirr=xirr_val,
        equity_value=round(equity_value, 2),
        mf_value=round(mf_value, 2),
        etf_value=round(etf_value, 2),
        sgb_value=round(sgb_value, 2),
        cash_value=round(available_cash, 2),
        large_cap_pct=round(large_cap_pct, 2),
        mid_cap_pct=round(mid_cap_pct, 2),
        small_cap_pct=round(small_cap_pct, 2),
        international_pct=round(intl_pct, 2),
        domestic_pct=round(domestic_pct, 2),
        equity_pct=round(equity_pct, 2),
        debt_pct=round(debt_pct, 2),
    )
    summary.risk_score = _compute_risk_score(all_holdings, summary)

    return Portfolio(
        profile=profile,
        summary=summary,
        holdings=all_holdings,
        positions=positions,
        margins=margins,
        last_updated=datetime.datetime.now().isoformat(),
        xirr_per_holding=xirr_per_holding,
        concentration_flags=concentration_flags,
        overlap_warnings=overlap_warnings,
    )
