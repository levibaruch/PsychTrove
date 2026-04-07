# Psychtrove — Development Guidelines

Auto-generated from specs/001-datacheck-viewer/plan.md. Last updated: 2026-04-07

## Active Technologies

- **Backend**: Python 3.11 + FastAPI, SQLite (sqlite3 stdlib) with FTS5, zipstream-ng
- **Frontend**: React 18 + Vite 5, CSS custom properties, native fetch
- **Infra**: Docker + docker-compose, two services (backend :8000, frontend :3000)

## Project Structure

```text
viewer/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── config.py
│   ├── db/schema.py
│   ├── indexer/
│   │   ├── discovery.py
│   │   ├── parsers.py
│   │   ├── index_builder.py
│   │   └── runner.py
│   └── routers/
│       ├── health.py
│       ├── corpus.py
│       ├── papers.py
│       ├── variables.py
│       ├── downloads.py
│       ├── pipeline.py
│       └── admin.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── styles/variables.css
        ├── api/client.js
        ├── components/
        ├── views/
        ├── hooks/
        └── utils/
```

## Commands

```bash
# Start full stack
cd viewer && PSYCHDS_DIR=/path/to/psychds docker-compose up --build

# Backend only (dev)
cd viewer/backend && uvicorn main:app --reload --port 8000

# Frontend only (dev)
cd viewer/frontend && npm run dev

# Health check
curl http://localhost:8000/health
```

## Key Constraints (from spec)

- `paper_id` is ALWAYS a string — never cast to int/float at any layer
- Backend must NEVER write to the mounted `psychds/` volume
- ZIP downloads must stream — never buffer full archive in memory (use zipstream-ng)
- SQLite FTS5 MATCH query; fall back to LIKE on `sqlite3.OperationalError`
- `/health` returns 503 while indexing; frontend polls every 2s until `indexed: true`

## Recent Changes

- `specs/001-datacheck-viewer/` — Full spec, plan, research, data model, contracts, quickstart, tasks added (2026-04-07)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
