"""
Manages connection to the Kite MCP server using Streamable HTTP transport.
Single-user singleton. All tool calls are serialised because the MCP
ClientSession streams are not concurrency-safe.
"""

import asyncio
import json
import logging
import re
from contextlib import AsyncExitStack
from typing import Any, Optional

logger = logging.getLogger(__name__)

_NOT_AUTHED_PHRASES = ("please log in", "failed to execute", "not logged in", "login required")


def _is_error_response(text: str) -> bool:
    return any(p in text.lower() for p in _NOT_AUTHED_PHRASES)


def _extract_url(text: str) -> Optional[str]:
    """Pull the plain https:// login URL out of the Kite login tool response."""
    match = re.search(r'https://kite\.zerodha\.com/connect/login\S+', text)
    return match.group(0).rstrip(").,") if match else None


class KiteSessionManager:
    MCP_URL: str = "https://mcp.kite.trade/mcp"

    def __init__(self) -> None:
        self._session: Any = None
        self._exit_stack: Optional[AsyncExitStack] = None
        self._authenticated: bool = False
        self._url: str = self.MCP_URL
        self._call_lock = asyncio.Lock()
        self._last_auth_check: float = 0   # epoch seconds

    def configure(self, url: str) -> None:
        self._url = url

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    async def _open_session(self) -> None:
        await self._close_session()
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        stack = AsyncExitStack()
        read, write, _ = await stack.enter_async_context(
            streamablehttp_client(self._url)
        )
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        self._exit_stack = stack
        self._session = session
        logger.info("Kite MCP session opened at %s", self._url)

    async def _close_session(self) -> None:
        if self._exit_stack:
            try:
                await self._exit_stack.aclose()
            except Exception:
                pass
        self._exit_stack = None
        self._session = None
        self._authenticated = False

    async def start(self) -> None:
        await self._open_session()
        # Check auth without marking True on error strings
        try:
            profile = await self._raw_call("get_profile", {})
            if isinstance(profile, dict) and ("user_id" in profile or "user_name" in profile):
                self._authenticated = True
                logger.info("Kite MCP: authenticated (user: %s)", profile.get("user_name", "?"))
            else:
                logger.info("Kite MCP: session open, not yet authenticated")
        except Exception as exc:
            logger.info("Kite MCP: session open, not yet authenticated (%s)", exc)

    async def stop(self) -> None:
        await self._close_session()

    # ------------------------------------------------------------------
    # Internal call helpers
    # ------------------------------------------------------------------

    async def _raw_call(self, tool: str, args: dict) -> Any:
        if self._session is None:
            raise RuntimeError("Kite MCP session not started")
        result = await self._session.call_tool(tool, args)
        if hasattr(result, "content") and result.content:
            raw = (
                result.content[0].text
                if hasattr(result.content[0], "text")
                else str(result.content[0])
            )
            try:
                return json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                return raw
        return result

    async def _call(self, tool: str, args: dict = {}) -> Any:
        """Serialised tool call with one reconnect retry on stream error."""
        async with self._call_lock:
            try:
                return await self._raw_call(tool, args)
            except (RuntimeError, Exception) as exc:
                if "ClosedResource" not in type(exc).__name__ and self._session is not None:
                    raise
                logger.warning("Kite MCP stream closed, reconnecting for '%s'…", tool)

            await self._open_session()
            return await self._raw_call(tool, args)

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def get_login_url(self) -> str:
        """
        Open a session (if needed) and call the login tool.
        Returns the Kite OAuth URL. Keeps the session alive so the
        session_id in the URL remains valid until the user authenticates.
        """
        if self._session is None:
            await asyncio.wait_for(self._open_session(), timeout=15)

        async with self._call_lock:
            raw = await self._raw_call("login", {})

        text = raw if isinstance(raw, str) else json.dumps(raw)
        url = _extract_url(text)
        if not url:
            raise ValueError(f"Could not extract login URL from Kite response: {text[:200]}")
        return url

    async def check_auth(self) -> bool:
        """
        Returns auth status. Only hits Kite MCP at most once every 10 seconds
        to avoid hammering the server while the frontend polls.
        """
        import time
        if self._authenticated:
            return True
        now = time.monotonic()
        if now - self._last_auth_check < 10:
            return False
        self._last_auth_check = now
        try:
            if self._session is None:
                await asyncio.wait_for(self._open_session(), timeout=15)
            async with self._call_lock:
                profile = await self._raw_call("get_profile", {})
            if isinstance(profile, dict) and ("user_id" in profile or "user_name" in profile):
                self._authenticated = True
                logger.info("Kite MCP: authentication confirmed (user: %s)", profile.get("user_name"))
        except Exception:
            pass
        return self._authenticated

    @property
    def is_authenticated(self) -> bool:
        return self._authenticated

    # ------------------------------------------------------------------
    # Kite MCP tool wrappers
    # ------------------------------------------------------------------

    async def get_profile(self) -> dict:
        data = await self._call("get_profile", {})
        if isinstance(data, str) and _is_error_response(data):
            raise RuntimeError(f"Kite not authenticated: {data}")
        return data if isinstance(data, dict) else {}

    async def get_holdings(self) -> list:
        data = await self._call("get_holdings", {})
        if isinstance(data, str):
            if _is_error_response(data):
                raise RuntimeError(f"Kite not authenticated: {data}")
            return []
        return data if isinstance(data, list) else data.get("data", [])

    async def get_mf_holdings(self) -> list:
        data = await self._call("get_mf_holdings", {})
        if isinstance(data, str):
            return []
        return data if isinstance(data, list) else data.get("data", [])

    async def get_positions(self) -> dict:
        data = await self._call("get_positions", {})
        if isinstance(data, str):
            return {"net": [], "day": []}
        return data if isinstance(data, dict) else {"net": data, "day": []}

    async def get_orders(self) -> list:
        data = await self._call("get_orders", {})
        if isinstance(data, str):
            return []
        return data if isinstance(data, list) else data.get("data", [])

    async def get_margins(self) -> dict:
        data = await self._call("get_margins", {})
        if isinstance(data, str):
            return {}
        return data if isinstance(data, dict) else {}


kite = KiteSessionManager()
