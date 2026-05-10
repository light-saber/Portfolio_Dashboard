"""
Serves the built React frontend from FastAPI when running in Docker.
Only mounted when the dist folder exists.
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


def mount_frontend(app: FastAPI) -> None:
    dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
    if not dist.exists():
        return

    # Serve static assets under /assets
    app.mount("/assets", StaticFiles(directory=str(dist / "assets")), name="assets")

    # Catch-all: serve index.html for React Router
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        index = dist / "index.html"
        return FileResponse(str(index))
