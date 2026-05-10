# Kite Portfolio Dashboard

Personal investment portfolio dashboard powered by Zerodha Kite MCP. Institutional-grade analytics in a modern dark-mode UI.

## Features

- **6-page dashboard**: Overview, Holdings, Performance, Projections, Tax & Optimization, Health Report
- **Live data** via Zerodha Kite MCP — no manual uploads
- **INR formatting** with lakh/crore notation throughout
- **Benchmark comparison** against Nifty 50, Midcap 150, Smallcap 250 (Yahoo Finance)
- **XIRR calculation** (Newton-Raphson, server-side)
- **Tax summary** per FY 2025-26 rules (LTCG/STCG)
- **Dark mode** default with light mode toggle

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env         # edit if needed
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # starts on http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:8000`.

### Auth flow

1. Open `http://localhost:5173` — you'll see the Login screen.
2. Click **Login with Zerodha Kite** — the backend calls the Kite MCP `login` tool.
3. Open the returned URL in your browser and complete Zerodha authentication.
4. Return to the dashboard — it will detect the session and load your portfolio automatically.

---

## Docker / VPS Deployment (Ubuntu 24.04)

```bash
# On your VPS (145.223.23.96)
git clone <repo> kite-dashboard
cd kite-dashboard
cp .env.example .env             # set KITE_MCP_URL if different
docker compose up -d
```

Dashboard will be available at `http://145.223.23.96:8000`.

To run behind NGINX with HTTPS, add a reverse proxy pointing to `localhost:8000`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `KITE_MCP_URL` | `https://mcp.kite.trade/mcp` | Kite MCP SSE endpoint |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `PORT` | `8000` | Backend server port |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check + auth status |
| POST | `/api/auth/login` | Trigger Kite OAuth → returns login URL |
| GET | `/api/auth/status` | Poll authentication status |
| GET | `/api/portfolio` | Fetch full portfolio (calls all Kite MCP tools) |
| POST | `/api/portfolio/refresh` | Force-refresh from Kite MCP |
| GET | `/api/benchmark/{symbol}` | Benchmark OHLC (nifty50, nifty_midcap150, nifty_smallcap250) |
| GET | `/api/benchmark/all` | All benchmarks at once |

---

## Notes

- **Expense ratios / rolling returns / Sharpe ratios**: Not available from Kite MCP — displayed as N/A with tooltip.
- **SIP vs lump sum**: Requires recurring same-date order pattern to classify. Falls back to "classification unavailable".
- **XIRR**: Server-side only. Displayed with confidence caveat when transaction history is incomplete.
- **AI recommendations** (Pages 5 & 6): Scaffolded, awaiting Claude API integration.
