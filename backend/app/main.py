import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from .kite_client import kite
from .routes import auth, portfolio, benchmark

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    url = os.getenv("KITE_MCP_URL", "https://mcp.kite.trade/mcp")
    kite.configure(url)
    try:
        import asyncio
        await asyncio.wait_for(kite.start(), timeout=15)
    except asyncio.TimeoutError:
        logger.warning("Kite MCP connection timed out — will retry on first request.")
    except Exception as exc:
        logger.warning("Kite MCP not connected at startup (%s) — will retry on first request.", exc)
    yield
    await kite.stop()


app = FastAPI(title="Kite Portfolio Dashboard API", lifespan=lifespan)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(benchmark.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "kite_connected": kite._session is not None, "authenticated": kite.is_authenticated}


# Mount frontend SPA (only active in Docker where dist/ exists)
from .static import mount_frontend
mount_frontend(app)
