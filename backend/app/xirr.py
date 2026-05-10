"""
XIRR calculation using Newton-Raphson method.
Operates on a list of (date, cashflow) tuples where outflows are negative.
"""

from __future__ import annotations

import datetime
from typing import Optional


def _npv(rate: float, cashflows: list[tuple[float, float]]) -> float:
    """Net present value of cashflows at a given rate."""
    t0 = cashflows[0][0]
    return sum(
        cf / (1 + rate) ** ((t - t0) / 365.0)
        for t, cf in cashflows
    )


def _dnpv(rate: float, cashflows: list[tuple[float, float]]) -> float:
    """Derivative of NPV with respect to rate."""
    t0 = cashflows[0][0]
    return sum(
        -((t - t0) / 365.0) * cf / (1 + rate) ** ((t - t0) / 365.0 + 1)
        for t, cf in cashflows
    )


def xirr(
    dates: list[datetime.date],
    amounts: list[float],
    guess: float = 0.1,
    tol: float = 1e-6,
    max_iter: int = 1000,
) -> Optional[float]:
    """
    Returns annualised XIRR or None if it cannot converge.
    amounts: outflows negative, inflows positive (current value is last positive inflow).
    """
    if len(dates) != len(amounts) or len(dates) < 2:
        return None

    # Convert dates to ordinals for arithmetic
    cashflows = [(float(d.toordinal()), a) for d, a in zip(dates, amounts)]

    rate = guess
    for _ in range(max_iter):
        npv = _npv(rate, cashflows)
        dnpv = _dnpv(rate, cashflows)
        if dnpv == 0:
            return None
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < tol:
            return round(new_rate * 100, 2)   # return as percentage
        rate = new_rate

    return None


def simple_xirr(
    invested: float,
    current_value: float,
    buy_date: datetime.date,
    today: Optional[datetime.date] = None,
) -> Optional[float]:
    """Convenience wrapper for a single buy-and-hold position."""
    if today is None:
        today = datetime.date.today()
    if invested <= 0 or current_value <= 0:
        return None
    return xirr(
        dates=[buy_date, today],
        amounts=[-invested, current_value],
    )
