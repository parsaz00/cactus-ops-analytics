# Cactus Ops Analytics — Regional Performance Dashboard (Prototype)

End-to-end analytics prototype built around a Regional Manager workflow.

**Goal:** demonstrate the “last mile of analytics”:
- governed metrics in SQL (semantic layer)
- fast, reusable reporting dataset
- front-end dashboard UX (filters + KPIs + charts)

## What’s in this repo

### Data layer (Postgres)
- **Dimensional model**: `dim_date`, `dim_location`, `dim_item`
- **Fact tables**: `fact_sales`, `fact_labor`
- **Governed views (semantic layer)**:
  - `vw_location_daily_summary`
  - `vw_labor_daily_summary`
  - `vw_daily_performance`
  - `vw_daily_performance_enriched`
  - `vw_location_weekly_performance`
  - `vw_menu_category_daily`

### API layer (Node + TypeScript)
- Serves aggregated operational metrics from governed views
- Example endpoint:
  - `GET /api/weekly-performance?year=2026&week=9&region=Alberta`

### Front-end (React + TypeScript)
- Regional dashboard with:
  - Apply/Reset filter pattern (enterprise BI UX)
  - KPI summary tiles
  - Top locations bar chart (Recharts)
  - Location table

## Quickstart (Local)

### 0) Prereqs
- Docker
- Node (recommended: Node 20+)
- Python 3

### 1) Start Postgres
```bash
docker compose up -d
docker ps
```

### 2) Create tables + views
```bash
docker exec -i cactus_ops_db psql -U cactus -d cactus_ops < data/schema.sql
docker exec -i cactus_ops_db psql -U cactus -d cactus_ops < data/views.sql
```

### 3) Seed synthetic data
```bash
python3 data/seeds/generate_and_load.py
```

### 4) Run the backend API
```bash
cd backend
npm install
npm run dev
```

Health check:
```bash
curl http://localhost:4000/api/health
```

Weekly performance examples:
```bash
curl "http://localhost:4000/api/weekly-performance?year=2026&week=9"
curl "http://localhost:4000/api/weekly-performance?year=2026&week=9&region=Alberta"
```

### 5) Run the frontend dashboard
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```

Open:
- http://localhost:5173

## Notes
- Dataset is synthetic and generated locally.
- This is a prototype intended to demonstrate analytics engineering + visualization patterns.