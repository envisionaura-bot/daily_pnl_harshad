# TradeDesk — Daily Execution Analysis Dashboard

A local Node.js dashboard to track daily trading P&L across multiple strategies.
All data is stored in `data/trades.json` — no database required.

## Quick Start

### Mac / Linux
```bash
chmod +x run-mac.sh
./run-mac.sh
```

### Windows
Double-click `run-windows.bat`

Then open **http://localhost:3000** in your browser.

---

## Features

### Dashboard
- **6 KPI Cards** — Total P&L, Return %, Win Rate, Profit Factor, Best Day, Worst Day
- **Last 30 Trading Days Bar Chart** — Daily P&L in green/red
- **Strategy Donut Chart** — Profit split by strategy
- **Calendar View** — Month-by-month heat map (green = profit, red = loss)
- **Monthly P&L % Bar Chart** — Monthly performance as % of capital
- **Cumulative P&L Line Chart** — Running total over time
- **Win/Loss Distribution Chart** — Histogram of trade outcomes
- **Strategy Performance Table** — Detailed breakdown per strategy

### Filters
- Filter by **strategy** (sidebar chips)
- Filter by **date range** (from / to)
- All charts update instantly

### Log Entry
- Add daily P&L for any strategy
- Update invested capital as it changes
- Delete past entries

### Strategies
- Add new strategies with custom name & color
- View all strategies with P&L summary
- Delete strategies (removes all related entries)

---

## Data Storage

All data lives in `data/trades.json`:
```json
{
  "strategies": [
    { "id": "momentum", "name": "Momentum", "color": "#00d4ff" }
  ],
  "entries": [
    { "date": "2025-04-11", "strategy": "momentum", "investedFunds": 100000, "pnl": 1500 }
  ]
}
```

You can manually edit this file or back it up at any time.

---

## Requirements
- Node.js v14 or higher (https://nodejs.org)
- No internet required after first load (fonts load from Google Fonts)
