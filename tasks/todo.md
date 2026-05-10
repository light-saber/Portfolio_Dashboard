# Kite Portfolio Dashboard — Build Plan

## Stack
- Backend: Python FastAPI + numpy-financial + mcp package (SSE to mcp.kite.trade)
- Frontend: React + Vite + Tailwind CSS + Recharts + TanStack Query
- Charts: Recharts
- Deployment: Docker + docker-compose (Ubuntu 24.04, 145.223.23.96)

## Build Steps

- [x] Scaffold directory structure
- [ ] Backend: requirements.txt, .env.example
- [ ] Backend: kite_client.py — MCP session manager (SSE singleton)
- [ ] Backend: models.py — Pydantic models
- [ ] Backend: xirr.py — Newton-Raphson XIRR calculator
- [ ] Backend: benchmark.py — Yahoo Finance fetcher
- [ ] Backend: routes/auth.py — login + status endpoints
- [ ] Backend: routes/portfolio.py — all portfolio data endpoints
- [ ] Backend: routes/benchmark.py — benchmark endpoints
- [ ] Backend: main.py — FastAPI app with lifespan
- [ ] Frontend: package.json, vite.config.js, tailwind.config.js
- [ ] Frontend: index.html, main.jsx, App.jsx, index.css
- [ ] Frontend: utils/format.js — INR formatter
- [ ] Frontend: hooks/usePortfolio.js — React Query hooks
- [ ] Frontend: components/Sidebar, Header, KPICard, Skeleton, ErrorCard
- [ ] Frontend: Page 1 — Overview
- [ ] Frontend: Page 2 — Holdings Breakdown
- [ ] Frontend: Page 3 — Performance Analysis
- [ ] Frontend: Page 4 — Future Projections
- [ ] Frontend: Page 5 — Tax & Optimization
- [ ] Frontend: Page 6 — Portfolio Health Report
- [ ] Docker: Dockerfile + docker-compose.yml
- [ ] README.md

## Notes
- AI recommendations on Pages 5 & 6: SKIPPED
- Benchmark: Yahoo Finance primary, static seed fallback
- Auth: one-time Kite MCP OAuth, no app-level login
