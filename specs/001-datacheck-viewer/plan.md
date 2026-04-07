# Implementation Plan: PsychDS Dataset Viewer

**Branch**: `001-datacheck-viewer` | **Date**: 2026-04-07 | **Spec**: `specs/001-datacheck-viewer/spec.md`  
**Input**: Feature specification from `/specs/001-datacheck-viewer/spec.md`

---

## Summary

A self-contained, Dockerized web application for browsing psychology datasets at the paper level, searching across all variables by column name or codebook description, and downloading data as ZIP archives. The backend indexes a read-only `psychds/` directory into a SQLite database with FTS5 full-text search. The frontend is a React SPA with two views: Papers (browse/detail) and Variables (cross-corpus search). No authentication, no writes to the mounted volume, no external dependencies beyond SQLite.

---

## Technical Context

**Language/Version**: Python 3.11 (backend), Node.js 20 (frontend build)  
**Primary Dependencies**:
- Backend: FastAPI 0.110+, uvicorn, sqlite3 (stdlib), zipstream-ng, python-multipart
- Frontend: React 18, Vite 5, native fetch, CSS custom properties

**Storage**: SQLite at `/tmp/viewer_index.db` — ephemeral per container lifecycle, rebuilt from `psychds/` on start if absent  
**Testing**: None required (no test tasks in scope — not requested in spec)  
**Target Platform**: Docker on Linux (amd64); `docker-compose up` as the deployment target  
**Performance Goals**:
- Initial index build < 60s for 300 papers / 90,000 variables on 4-core machine
- `/api/papers` < 100ms
- `/api/variables/search` < 200ms
- `/download/size` < 300ms
- First byte of ZIP stream within 2s

**Constraints**:
- Read-only volume mount — backend must never write to `psychds/`
- `paper_id` always treated as string at every layer
- Streaming ZIP — no in-memory buffering of full archive
- No authentication

**Scale/Scope**: ~300 papers, ~500 study groups, ~90,000 variables  
**Project Type**: Dockerized web service (REST API + SPA)

---

## Constitution Check

The project constitution is a template (not filled in). No formal gates apply. The spec itself is the governing document.

Key principles derived from spec:
- **Read-only**: Backend never modifies mounted data
- **Transparency first**: Every piece of data is traceable to its source JSON field
- **Simplicity**: SQLite-only, no external search service, no auth
- **Streaming**: Large downloads must not buffer to memory

No violations found. Proceeding.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-datacheck-viewer/
├── plan.md              ← this file
├── spec.md              ← full feature specification (custom — serves as combined spec+plan)
├── research.md          ← Phase 0: technology decisions and rationale
├── data-model.md        ← Phase 1: SQLite schema, entity relationships
├── quickstart.md        ← Phase 1: validation scenarios and mock data
├── contracts/           ← Phase 1: REST API contracts
│   ├── api-health-corpus.md
│   ├── api-papers.md
│   ├── api-variables.md
│   └── api-downloads.md
└── tasks.md             ← Phase 2: implementation checklist (already generated)
```

### Source Code (repository root)

```text
viewer/
├── docker-compose.yml          ← PSYCHDS_DIR volume mount, healthcheck, two services
├── backend/
│   ├── Dockerfile              ← python:3.11-slim, uvicorn on port 8000
│   ├── requirements.txt        ← fastapi, uvicorn, zipstream-ng, python-multipart
│   ├── main.py                 ← FastAPI app, CORS, startup hook (indexer)
│   ├── config.py               ← env var reading: PSYCHDS_DIR, INDEX_ON_START, etc.
│   ├── db/
│   │   └── schema.py           ← CREATE TABLE / FTS5 / index SQL + init function
│   ├── indexer/
│   │   ├── discovery.py        ← read conversion_summary.csv, find study dirs
│   │   ├── parsers.py          ← parse dataset_description.json + provenance.json
│   │   ├── index_builder.py    ← insert rows, populate FTS5, update _meta
│   │   └── runner.py           ← ThreadPoolExecutor orchestration, health state
│   └── routers/
│       ├── health.py           ← GET /health
│       ├── corpus.py           ← GET /api/corpus/stats
│       ├── papers.py           ← GET /api/papers, /api/papers/:id, /groups/:sg
│       ├── variables.py        ← GET /api/variables/search, /api/variables/:id
│       ├── downloads.py        ← all /download and /download/size endpoints
│       ├── pipeline.py         ← GET /api/pipeline/stages, /col_types, /file_types
│       └── admin.py            ← POST /api/admin/reindex
└── frontend/
    ├── Dockerfile              ← node:20-alpine build, serve static, port 3000
    ├── package.json            ← react, react-dom, vite
    ├── vite.config.js          ← proxy /api → backend:8000 in dev
    └── src/
        ├── main.jsx            ← React entry point
        ├── App.jsx             ← App shell, header, tab nav, health polling
        ├── styles/
        │   ├── variables.css   ← CSS custom properties (light + dark) per spec §5.7.2
        │   └── responsive.css  ← breakpoints: tablet 768-1023px, mobile <768px
        ├── api/
        │   └── client.js       ← fetch wrapper for all backend endpoints
        ├── components/
        │   ├── TypeBadge.jsx           ← col_type + pipeline_type colored pills
        │   ├── SampleValueChips.jsx    ← pipe-split chips, 24-char truncation
        │   ├── StatisticsGrid.jsx      ← 2-col numeric stats layout
        │   ├── VariableTable.jsx       ← sortable table with keyboard nav
        │   ├── ProvenanceTable.jsx     ← file provenance table
        │   ├── VariableDetailModal.jsx ← Variable + Provenance tabs, focus trap
        │   ├── DownloadConfirmationPopover.jsx ← inline size-check + confirm
        │   ├── PipelineTransparencyPanel.jsx   ← stages + type vocabularies
        │   ├── Toast.jsx               ← bottom-right download progress toast
        │   └── StateViews.jsx          ← loading spinner, empty states, errors
        ├── views/
        │   ├── PapersView.jsx          ← two-panel split with resizable divider
        │   └── VariablesView.jsx       ← search bar, filters, results table
        ├── pages/
        │   └── Loading.jsx             ← startup "Building search index…" screen
        ├── hooks/
        │   ├── useDownload.js          ← size-fetch → confirm → stream flow
        │   └── useTheme.js             ← light/dark toggle + localStorage
        └── utils/
            └── format.js              ← thousands separators, 4 sig figs, "—" for null
```

**Structure Decision**: Web application layout. Backend is a pure Python REST API; frontend is a pure SPA. Both containerized as separate services with docker-compose. Source lives in `viewer/` at repo root since the rest of the repository is the pipeline that produced the data.

---

## Complexity Tracking

No constitution violations requiring justification.

---

## Key Design Decisions

### 1. SQLite sync access via thread pool (not aiosqlite)

FastAPI endpoints run async but delegate SQLite queries to a thread pool via `asyncio.get_event_loop().run_in_executor(None, ...)`. The sync sqlite3 stdlib is simpler to use for FTS5 MATCH queries and fallback LIKE logic. See research.md Decision 2.

### 2. FTS5 MATCH with LIKE fallback

Primary search uses FTS5 `MATCH 'name:{q}* OR description:{q}*'`. On `sqlite3.OperationalError` (malformed query), falls back to `LIKE '%q%'` without FTS. See research.md Decision 4.

### 3. Sidecar slug resolution

Variable detail requires reading `source-<slug>_data.json` on demand. The slug is derived from the source file's basename with non-alphanumeric chars stripped and lowercased. When ambiguous, match by `metacheck:original_file.rel_path`. See data-model.md and research.md Decision 5.

### 4. paper_id as string at all layers

SQLite TEXT, Pydantic `str`, FastAPI path param `str`, JSON string — never `int()`. Enforced in schema.py and parsers.py. See research.md Decision 6.

### 5. Streaming ZIP via zipstream-ng

`StreamingResponse` wraps the `ZipStream` generator. `MANIFEST.csv` and `DOWNLOAD_MANIFEST.csv` are injected as in-memory bytes generators. Timeout set to 120s. See research.md Decision 3.

### 6. CSS custom properties (no component library)

The spec provides verbatim CSS variable names and hex values. Implementing them directly as CSS custom properties avoids component library override complexity. CSS Modules for component-scoped styles.

---

## Phase 1 Re-evaluation (Constitution Check Post-Design)

After generating data-model.md and contracts:

- No new complexity introduced
- All 4 database tables map directly to spec §4.1.2
- FTS5 virtual table is the only non-standard feature — well within SQLite stdlib
- REST API contracts confirm all endpoints are straightforward CRUD + streaming
- No external services required beyond Docker

**Constitution gates**: All pass.

---

## Artifacts Generated

| Artifact | Path | Status |
|---|---|---|
| Spec (custom) | `specs/001-datacheck-viewer/spec.md` | ✓ Pre-existing |
| Plan | `specs/001-datacheck-viewer/plan.md` | ✓ This file |
| Research | `specs/001-datacheck-viewer/research.md` | ✓ Generated |
| Data Model | `specs/001-datacheck-viewer/data-model.md` | ✓ Generated |
| API Contracts | `specs/001-datacheck-viewer/contracts/` | ✓ Generated (4 files) |
| Quickstart | `specs/001-datacheck-viewer/quickstart.md` | ✓ Generated |
| Tasks | `specs/001-datacheck-viewer/tasks.md` | ✓ Pre-generated (from /speckit-tasks) |
