<div align="center">

# 📈 Kite Portfolio Dashboard

**Institutional-grade investment analytics for your Zerodha account**

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)

Live portfolio data from **Zerodha Kite MCP** · Dark mode · INR lakh/crore formatting · No manual uploads

</div>

---

## ✨ Features

| Page | What you get |
|------|-------------|
| **Overview** | Total invested, current value, P&L, XIRR, risk score, allocation donut charts |
| **Holdings** | Sortable tables per instrument type, overlap warnings, concentration flags, XIRR per holding |
| **Performance** | Nifty 50 / Midcap 150 / Smallcap 250 benchmark comparison, best & worst performers |
| **Projections** | SIP step-up calculator, 3-scenario corpus forecast (8 / 11 / 14% CAGR), inflation adjustment |
| **Tax & Optimization** | LTCG / STCG summary (FY 2025-26 rules), tax harvesting flags, rebalancing alerts |
| **Health Report** | Diversification, risk-adjusted return, tax efficiency & liquidity scorecards |

**Other highlights**

- 🔴 **Live data** — all figures fetched directly from Kite MCP, no CSV uploads
- 🇮🇳 **Indian number system** — ₹12.5L, ₹1.2Cr notation everywhere
- 📊 **XIRR** — Newton-Raphson, calculated server-side
- 🏷️ **MF name resolution** — ISINs resolved to real scheme names via AMFI data
- 📉 **Market cap classification** — Nifty 50 / 100 / Midcap 150 index membership
- 🌙 **Dark mode** by default, toggle to light
- 🔄 **Auto-refresh** every 5 minutes during market hours (9:15 AM – 3:30 PM IST)

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Browser                           │
│         React + Tailwind + Recharts (Vite)          │
└───────────────────┬──────────────────────────────────┘
                    │ /api/*
┌───────────────────▼──────────────────────────────────┐
│              FastAPI (Python 3.12)                   │
│   kite_client · normaliser · xirr · amfi · bench    │
└───────────────────┬──────────────────────────────────┘
                    │ MCP Streamable HTTP
┌───────────────────▼──────────────────────────────────┐
│          Zerodha Kite MCP  (mcp.kite.trade)          │
└──────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.12+
- Node.js 20+

### 1 · Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

### 2 · Frontend

```bash
cd frontend
npm install
npm run dev                     # → http://localhost:5173
```

> The Vite dev server proxies all `/api` requests to `localhost:8000` — no CORS config needed in dev.

### 3 · Authenticate

1. Open **http://localhost:5173**
2. Click **Login with Zerodha Kite**
3. Visit the Kite OAuth URL that appears and log in with your Zerodha credentials
4. The dashboard detects the session automatically and loads your portfolio

---

## 🐳 Docker Deployment (Ubuntu 24.04 VPS)

```bash
git clone https://github.com/light-saber/Portfolio_Dashboard kite-dashboard
cd kite-dashboard

# Optional: override defaults
cp .env.example .env

docker compose up -d
```

Dashboard is available at **http://your-server:8000**

To serve over HTTPS, point an NGINX reverse proxy at `localhost:8000`.

### docker-compose.yml at a glance

```yaml
services:
  dashboard:
    build: .
    ports: ["8000:8000"]
    restart: unless-stopped
```

The multi-stage Dockerfile builds the React app first, then embeds the static output into the FastAPI image — single container, single port.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KITE_MCP_URL` | `https://mcp.kite.trade/mcp` | Kite MCP endpoint |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `PORT` | `8000` | Backend port |

Copy `.env.example` → `.env` and edit as needed.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check · Kite connection status |
| `POST` | `/api/auth/login` | Start Kite OAuth → returns login URL |
| `GET` | `/api/auth/status` | Poll until `authenticated: true` |
| `GET` | `/api/portfolio` | Full normalised portfolio |
| `POST` | `/api/portfolio/refresh` | Force-refresh from Kite MCP |
| `GET` | `/api/benchmark/{symbol}` | OHLC data — `nifty50` · `nifty_midcap150` · `nifty_smallcap250` |
| `GET` | `/api/benchmark/all` | All three benchmarks in one call |

---

## 📁 Project Structure

```
Portfolio_Dashboard/
├── backend/
│   └── app/
│       ├── main.py          # FastAPI app + lifespan
│       ├── kite_client.py   # MCP session manager (Streamable HTTP)
│       ├── normaliser.py    # Raw API → unified Portfolio model
│       ├── models.py        # Pydantic models
│       ├── xirr.py          # Newton-Raphson XIRR engine
│       ├── amfi.py          # ISIN → fund name (AMFI data, 24h cache)
│       ├── market_cap.py    # Nifty index membership lookup
│       ├── benchmark.py     # Yahoo Finance fetcher + static fallback
│       └── routes/
│           ├── auth.py
│           ├── portfolio.py
│           └── benchmark.py
├── frontend/
│   └── src/
│       ├── pages/           # Overview · Holdings · Performance · Projections · Tax · Health
│       ├── components/      # Sidebar · Header · KPICard · Skeleton · ErrorCard
│       ├── hooks/           # usePortfolio · useAuth · useRefresh · useBenchmark
│       └── utils/format.js  # INR lakh/crore formatter
├── Dockerfile               # Multi-stage: React build → FastAPI image
├── docker-compose.yml
└── .env.example
```

---

## 📌 Known Limitations

| Item | Status |
|------|--------|
| Expense ratios, rolling returns, Sharpe ratio | Not available from Kite MCP — shown as N/A |
| XIRR confidence | Improves with more transaction history in Kite orders |
| AI recommendations (Pages 5 & 6) | Scaffolded — awaiting Claude API integration |
| Market cap classification | Based on Nifty index membership snapshot (May 2025) |
| Mobile layout | Desktop and iPad (≥768px) only |
