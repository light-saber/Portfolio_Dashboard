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

logger = logging.getLogger(__name__)

# Keywords used to infer instrument category
_ETF_KEYWORDS = ["ETF", "BEES", "IETF", "GOLDETF"]
_SGB_KEYWORDS = ["SGB", "SGBD", "GOLD BOND"]
_LARGE_CAP_KEYWORDS = ["LARGE", "BLUECHIP", "TOP100", "NIFTY50", "SENSEX"]
_MID_CAP_KEYWORDS = ["MIDCAP", "MID CAP", "MID-CAP", "MIDSMALL"]
_SMALL_CAP_KEYWORDS = ["SMALLCAP", "SMALL CAP", "SMALL-CAP"]
_INTL_KEYWORDS = ["US", "NASDAQ", "NYSE", "GLOBAL", "INTERN", "WORLD", "HANG SENG", "N100"]
_DEBT_KEYWORDS = ["DEBT", "LIQUID", "OVERNIGHT", "GILT", "MONEY MARKET", "ULTRA SHORT", "LOW DURATION", "SHORT TERM", "BOND", "CREDIT RISK", "FMP"]


def _infer_type(name: str, exchange: str = "") -> InstrumentType:
    u = name.upper()
    if any(k in u for k in _SGB_KEYWORDS):
        return InstrumentType.SGB
    if any(k in u for k in _ETF_KEYWORDS):
        return InstrumentType.ETF
    if exchange in ("NSE", "BSE"):
        return InstrumentType.EQUITY
    return InstrumentType.MF


def _infer_category(name: str, instrument_type: InstrumentType) -> str:
    u = name.upper()
    if instrument_type in (InstrumentType.EQUITY, InstrumentType.ETF, InstrumentType.SGB):
        if any(k in u for k in _LARGE_CAP_KEYWORDS):
            return "Large Cap"
        if any(k in u for k in _MID_CAP_KEYWORDS):
            return "Mid Cap"
        if any(k in u for k in _SMALL_CAP_KEYWORDS):
            return "Small Cap"
        return "Multi Cap"
    # MF
    if any(k in u for k in _DEBT_KEYWORDS):
        return "Debt"
    if any(k in u for k in _LARGE_CAP_KEYWORDS):
        return "Large Cap"
    if any(k in u for k in _MID_CAP_KEYWORDS):
        return "Mid Cap"
    if any(k in u for k in _SMALL_CAP_KEYWORDS):
        return "Small Cap"
    if "FLEXI" in u:
        return "Flexi Cap"
    if "MULTI" in u:
        return "Multi Cap"
    if "ELSS" in u:
        return "ELSS"
    return "Other"


def _is_international(name: str) -> bool:
    return any(k in name.upper() for k in _INTL_KEYWORDS)


def _is_debt(category: str) -> bool:
    return category == "Debt"


def _normalise_equity_holding(raw: dict) -> Holding:
    name = raw.get("tradingsymbol") or raw.get("instrument_token") or "Unknown"
    exchange = raw.get("exchange", "NSE")
    units = float(raw.get("quantity", 0))
    avg_price = float(raw.get("average_price", 0))
    last_price = float(raw.get("last_price", avg_price))
    invested = units * avg_price
    current_value = units * last_price
    pnl = current_value - invested
    pnl_pct = (pnl / invested * 100) if invested else 0

    itype = _infer_type(name, exchange)
    category = _infer_category(name, itype)

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


def _normalise_mf_holding(raw: dict) -> Holding:
    name = raw.get("fund_name") or raw.get("tradingsymbol") or "Unknown Fund"
    units = float(raw.get("quantity", 0))
    nav = float(raw.get("last_price", 0)) or float(raw.get("nav", 0))
    avg_nav = float(raw.get("average_price", 0)) or nav
    invested = units * avg_nav
    current_value = units * nav
    pnl = current_value - invested
    pnl_pct = (pnl / invested * 100) if invested else 0

    itype = InstrumentType.MF
    category = _infer_category(name, itype)

    return Holding(
        name=name,
        isin=raw.get("isin"),
        instrument_type=itype,
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
    """Heuristic risk score 1–10."""
    score = 5.0

    # Small cap heavy → higher risk
    if summary.small_cap_pct > 40:
        score += 2
    elif summary.small_cap_pct > 20:
        score += 1

    # Debt reduces risk
    if summary.debt_pct > 30:
        score -= 1.5
    elif summary.debt_pct > 15:
        score -= 0.5

    # Concentration risk
    max_holding_pct = max((h.current_value / summary.current_value * 100 for h in holdings if summary.current_value), default=0)
    if max_holding_pct > 30:
        score += 1.5
    elif max_holding_pct > 15:
        score += 0.5

    # International exposure reduces domestic risk
    if summary.international_pct > 10:
        score -= 0.5

    return round(max(1.0, min(10.0, score)), 1)


def _detect_overlap_warnings(holdings: list[Holding]) -> list[str]:
    warnings = []
    flexi_funds = [h.name for h in holdings if h.instrument_type == InstrumentType.MF and "FLEXI" in h.name.upper()]
    multi_funds = [h.name for h in holdings if h.instrument_type == InstrumentType.MF and "MULTI" in h.name.upper()]
    if len(flexi_funds) > 1:
        warnings.append(f"Multiple flexi-cap funds detected ({', '.join(flexi_funds[:3])}). Likely stock overlap — consider consolidating.")
    if len(multi_funds) + len(flexi_funds) > 2:
        warnings.append("High overlap risk: several multi-cap/flexi-cap funds likely hold the same underlying stocks.")
    largecap_funds = [h.name for h in holdings if h.category == "Large Cap" and h.instrument_type == InstrumentType.MF]
    if len(largecap_funds) > 2:
        warnings.append(f"Multiple large-cap funds ({len(largecap_funds)}). Top 100 stocks are shared — consider an index fund instead.")
    return warnings


def build_portfolio(
    profile: dict,
    equity_holdings: list[dict],
    mf_holdings: list[dict],
    positions_raw: dict,
    margins_raw: dict,
) -> Portfolio:
    today = datetime.date.today()

    equity = [_normalise_equity_holding(h) for h in equity_holdings if float(h.get("quantity", 0)) > 0]
    mfs = [_normalise_mf_holding(h) for h in mf_holdings if float(h.get("quantity", 0)) > 0]
    net_positions = positions_raw.get("net", []) if isinstance(positions_raw, dict) else []
    positions = [_normalise_position(p) for p in net_positions if int(p.get("quantity", 0)) != 0]

    all_holdings = equity + mfs

    # Margins
    eq_margins = margins_raw.get("equity", {}) if isinstance(margins_raw, dict) else {}
    available_cash = float(eq_margins.get("available", {}).get("live_balance", 0) or eq_margins.get("net", 0) or 0)
    used_margin = float(eq_margins.get("utilised", {}).get("debits", 0) or 0)
    margins = Margins(available_cash=available_cash, used_margin=used_margin, net=available_cash - used_margin)

    # Aggregates
    total_invested = sum(h.invested for h in all_holdings)
    current_value = sum(h.current_value for h in all_holdings) + available_cash
    total_pnl = sum(h.pnl for h in all_holdings)
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested else 0
    day_change = sum(h.day_change for h in all_holdings if h.day_change is not None)
    invested_no_cash = total_invested or 1
    day_change_pct = (day_change / invested_no_cash * 100)

    # Allocation by type
    equity_value = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.EQUITY)
    etf_value = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.ETF)
    mf_value = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.MF)
    sgb_value = sum(h.current_value for h in all_holdings if h.instrument_type == InstrumentType.SGB)
    cash_value = available_cash

    # Cap exposure (heuristic)
    total_cv = current_value or 1
    large_cap_pct = sum(h.current_value for h in all_holdings if h.category == "Large Cap") / total_cv * 100
    mid_cap_pct = sum(h.current_value for h in all_holdings if h.category == "Mid Cap") / total_cv * 100
    small_cap_pct = sum(h.current_value for h in all_holdings if h.category == "Small Cap") / total_cv * 100

    # International vs domestic
    intl_pct = sum(h.current_value for h in all_holdings if _is_international(h.name)) / total_cv * 100
    domestic_pct = 100 - intl_pct

    # Equity vs debt split (simplified: ETF+equity+SGB = equity side; debt MFs = debt)
    debt_value = sum(h.current_value for h in all_holdings if _is_debt(h.category))
    equity_side = current_value - debt_value - cash_value
    equity_pct = equity_side / total_cv * 100
    debt_pct = debt_value / total_cv * 100

    # Portfolio XIRR (simplified: treat total invested as single outflow at earliest holding date)
    xirr_val = None
    try:
        oldest = datetime.date.today() - datetime.timedelta(days=365 * 3)  # fallback
        xirr_val = simple_xirr(total_invested, current_value, oldest, today)
    except Exception:
        pass

    # Per-holding XIRR
    xirr_per_holding: dict[str, float | None] = {}
    for h in all_holdings:
        try:
            xirr_per_holding[h.name] = simple_xirr(h.invested, h.current_value, today - datetime.timedelta(days=365), today)
        except Exception:
            xirr_per_holding[h.name] = None

    # Concentration flags
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
        cash_value=round(cash_value, 2),
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
