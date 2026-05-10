from fastapi import APIRouter, HTTPException
from ..kite_client import kite

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login():
    """Trigger Kite OAuth — returns the URL the user must visit."""
    try:
        url = await kite.get_login_url()
        return {"login_url": url}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Kite MCP login failed: {exc}")


@router.get("/status")
async def auth_status():
    """Poll this until authenticated == true."""
    authenticated = await kite.check_auth()
    return {"authenticated": authenticated}
