from fastapi import APIRouter, Query
from ..benchmark import fetch_benchmark, fetch_all_benchmarks, SYMBOLS

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])


@router.get("/all")
async def all_benchmarks(period: str = Query("1Y", regex="^(1M|3M|6M|1Y|3Y|Max)$")):
    return await fetch_all_benchmarks(period)


@router.get("/{symbol}")
async def single_benchmark(symbol: str, period: str = Query("1Y", regex="^(1M|3M|6M|1Y|3Y|Max)$")):
    if symbol not in SYMBOLS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol}'. Valid: {list(SYMBOLS.keys())}")
    return await fetch_benchmark(symbol, period)
