from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class InstrumentType(str, Enum):
    EQUITY = "equity"
    ETF = "etf"
    MF = "mf"
    SGB = "sgb"
    CASH = "cash"


class Holding(BaseModel):
    name: str
    isin: Optional[str] = None
    instrument_token: Optional[int] = None
    instrument_type: InstrumentType
    category: Optional[str] = None        # large cap / midcap / flexi / etc.
    units: float
    avg_buy_price: float
    current_price: float
    invested: float
    current_value: float
    pnl: float
    pnl_pct: float
    day_change: Optional[float] = None
    day_change_pct: Optional[float] = None
    exchange: Optional[str] = None


class Position(BaseModel):
    tradingsymbol: str
    exchange: str
    quantity: int
    average_price: float
    last_price: float
    pnl: float
    product: str


class Margins(BaseModel):
    available_cash: float
    used_margin: float
    net: float


class PortfolioSummary(BaseModel):
    total_invested: float
    current_value: float
    total_pnl: float
    total_pnl_pct: float
    day_change: float
    day_change_pct: float
    xirr: Optional[float] = None
    risk_score: Optional[float] = None

    equity_value: float = 0
    mf_value: float = 0
    etf_value: float = 0
    sgb_value: float = 0
    cash_value: float = 0

    large_cap_pct: float = 0
    mid_cap_pct: float = 0
    small_cap_pct: float = 0
    international_pct: float = 0
    domestic_pct: float = 0

    equity_pct: float = 0
    debt_pct: float = 0


class Portfolio(BaseModel):
    profile: dict = Field(default_factory=dict)
    summary: PortfolioSummary
    holdings: list[Holding] = Field(default_factory=list)
    positions: list[Position] = Field(default_factory=list)
    margins: Margins
    last_updated: str
    xirr_per_holding: dict[str, Optional[float]] = Field(default_factory=dict)
    concentration_flags: list[str] = Field(default_factory=list)
    overlap_warnings: list[str] = Field(default_factory=list)
