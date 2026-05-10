"""
Manages a persistent SSE connection to the Kite MCP server.
Single-user, singleton pattern — one session for the lifetime of the process.
"""

import asyncio
import logging
from contextlib import AsyncExitStack
from typing import Any, Optional

logger = logging.getLogger(__name__)


class KiteSessionManager:
    MCP_URL: str = "https://mcp.kite.trade/mcp"

    def __init__(self) -> None:
        self._session: Any = None
        self._exit_stack: Optional[AsyncExitStack] = None
        self._authenticated: bool = False
        self._login_url: Optional[str] = None
        self._lock = asyncio.Lock()
        self._url: str = self.MCP_URL

    def configure(self, url: str) -> None:
        self._url = url

    async def start(self) -> None:
        """Open the SSE connection and initialise the MCP session."""
        try:
            from mcp import ClientSession
            from mcp.client.sse import sse_client

            self._exit_stack = AsyncExitStack()
            read, write = await self._exit_stack.enter_async_context(
                sse_client(self._url)
            )
            self._session = await self._exit_stack.enter_async_context(
                ClientSession(read, write)
            )
            await self._session.initialize()
            logger.info("Kite MCP session initialised at %s", self._url)

            # Try calling get_profile to see if a prior session is still active.
            try:
                await self._call("get_profile", {})
                self._authenticated = True
                logger.info("Kite MCP: prior session is authenticated")
            except Exception:
                logger.info("Kite MCP: not yet authenticated")

        except Exception as exc:
            logger.error("Failed to initialise Kite MCP session: %s", exc)
            raise

    async def stop(self) -> None:
        if self._exit_stack:
            await self._exit_stack.aclose()
            self._exit_stack = None
            self._session = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _call(self, tool: str, args: dict) -> Any:
        if self._session is None:
            raise RuntimeError("Kite MCP session not started")
        result = await self._session.call_tool(tool, args)
        # MCP returns a list of content objects; extract text from the first one.
        if hasattr(result, "content") and result.content:
            import json
            raw = result.content[0].text if hasattr(result.content[0], "text") else str(result.content[0])
            try:
                return json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                return raw
        return result

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def get_login_url(self) -> str:
        """Call the Kite MCP login tool and return the URL for the user."""
        async with self._lock:
            data = await self._call("login", {})
            # The login tool returns either {"login_url": "..."} or a plain URL string.
            if isinstance(data, dict):
                url = data.get("login_url") or data.get("url") or str(data)
            else:
                url = str(data)
            self._login_url = url
            return url

    async def check_auth(self) -> bool:
        """Poll authentication status by attempting get_profile."""
        if self._authenticated:
            return True
        try:
            await self._call("get_profile", {})
            self._authenticated = True
        except Exception:
            self._authenticated = False
        return self._authenticated

    @property
    def is_authenticated(self) -> bool:
        return self._authenticated

    # ------------------------------------------------------------------
    # Kite MCP tool wrappers
    # ------------------------------------------------------------------

    async def get_profile(self) -> dict:
        return await self._call("get_profile", {})

    async def get_holdings(self) -> list:
        data = await self._call("get_holdings", {})
        return data if isinstance(data, list) else data.get("data", [])

    async def get_mf_holdings(self) -> list:
        data = await self._call("get_mf_holdings", {})
        return data if isinstance(data, list) else data.get("data", [])

    async def get_positions(self) -> dict:
        data = await self._call("get_positions", {})
        return data if isinstance(data, dict) else {"net": data, "day": []}

    async def get_orders(self) -> list:
        data = await self._call("get_orders", {})
        return data if isinstance(data, list) else data.get("data", [])

    async def get_margins(self) -> dict:
        data = await self._call("get_margins", {})
        return data if isinstance(data, dict) else {}


# Global singleton used by the FastAPI app
kite = KiteSessionManager()
