# PsychTrove

A self-contained, Dockerized web application for browsing PsychDS dataset outputs.

## Quick Start

```bash
cd viewer/
PSYCHDS_DIR=/path/to/your/psychds docker-compose up --build
PSYCHDS_DIR=/Volumes/NINJAV/DataCheckOut/psychds docker-compose up --build
```

Then open **http://localhost:3000** in your browser.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PSYCHDS_DIR` | **yes** | — | Host path to the `psychds/` output directory (mounted read-only) |
| `INDEX_ON_START` | no | `true` | Build the search index on container start |
| `INDEX_MAX_WORKERS` | no | `4` | Parallel workers for the initial index build |
| `LOG_LEVEL` | no | `info` | Backend log level: `debug`, `info`, `warning`, `error` |

## Startup Sequence

1. Backend container starts and mounts `PSYCHDS_DIR` as `/data/psychds` (read-only)
2. If `INDEX_ON_START=true`, the indexer walks the directory tree and builds a SQLite database at `/tmp/viewer_index.db`
3. `GET /health` returns `{"status":"indexing"}` (HTTP 503) until indexing completes
4. Once indexing is done, health returns `{"status":"ok","indexed":true}` (HTTP 200)
5. Frontend container starts (waits for healthy backend via `depends_on: condition: service_healthy`)
6. The UI transitions from the loading screen to the main interface

## Trigger Re-index

```bash
curl -X POST http://localhost:8000/api/admin/reindex
```

## Development

**Backend** (Python 3.11 + FastAPI):

```bash
cd viewer/backend
pip install -r requirements.txt
PSYCHDS_DIR=/path/to/psychds uvicorn main:app --reload --port 8000
```

**Frontend** (React + Vite):

```bash
cd viewer/frontend
npm install
npm run dev   # proxies /api to localhost:8000
```

## Architecture

- **Backend**: FastAPI with synchronous SQLite queries via thread pool. SQLite FTS5 powers the variable full-text search.
- **Frontend**: React 18 SPA with no external state library. Two views: Papers (browse/detail) and Variables (cross-corpus search).
- **Downloads**: All ZIP archives are streamed via `zipstream-ng` — no full-archive buffering.

## Notes

- The viewer is **read-only** — it never writes to the mounted `psychds/` directory.
- `paper_id` values are always treated as strings (leading zeros are significant).
- The SQLite database at `/tmp/viewer_index.db` is ephemeral — it is rebuilt on each container start if `INDEX_ON_START=true`.
