# Research: PsychDS Dataset Viewer

**Phase**: 0 — Pre-design research  
**Spec**: `specs/001-datacheck-viewer/spec.md`  
**Date**: 2026-04-07

All major technology decisions are prescribed in spec §8. This document captures rationale, confirms choices, and resolves the few open questions not explicitly answered in the spec.

---

## Decision 1: Backend Language and Framework

- **Decision**: Python 3.11 + FastAPI  
- **Rationale**: Spec §8 recommends it as the primary option. FastAPI provides async I/O natively, automatic OpenAPI docs, fast JSON serialization via Pydantic, and a clean `StreamingResponse` primitive needed for ZIP downloads. The dataset is read-only so no complex ORM is needed.
- **Alternatives considered**: Node.js/Fastify (ergonomic JSON, `better-sqlite3` is synchronous which simplifies FTS5 use), Go (single binary, fast). Python chosen because it has the most mature ecosystem for the scientific Python audience that will deploy this viewer.

---

## Decision 2: SQLite Access — sync vs async

- **Decision**: Use the synchronous `sqlite3` stdlib (via a thread pool executor) rather than `aiosqlite`  
- **Rationale**: SQLite with WAL mode handles concurrent reads well. FTS5 `MATCH` queries require careful fallback handling for invalid query syntax — this is easier to implement and test in sync code. `aiosqlite` is a thin async wrapper over the same sqlite3 driver anyway. FastAPI's `run_in_executor` pattern gives us async endpoints without sacrificing the simpler sync query style.  
- **Alternatives considered**: `aiosqlite` (spec mentions it) — adds complexity without meaningful throughput gain since SQLite is not truly concurrent.

---

## Decision 3: Streaming ZIP Library

- **Decision**: `zipstream-ng`  
- **Rationale**: Spec §4.2.10 explicitly names `zipstream-ng` first. It supports Python generators as file sources, enabling true streaming without buffering the entire archive. Its API (`ZipStream`, `add()`) cleanly handles the MANIFEST.csv injection requirement (pass a bytes generator as the file source for the injected CSV).  
- **Alternatives considered**: `zipfly` — fewer stars, less maintained. `zipfile` stdlib — buffers to disk by default. Both rejected.

---

## Decision 4: FTS5 Partial Matching Strategy

- **Decision**: `MATCH 'name:query* OR description:query*'` with a fallback to `LIKE '%query%'`  
- **Rationale**: Spec §4.2.5 requires searching both `name` AND `description` fields simultaneously and specifies the `MATCH` with `*` prefix/suffix for partial matching. SQLite FTS5 `*` suffix enables prefix search. FTS5 rejects queries containing special characters (e.g. `%`, `(`, `)`); for those, fall back to `LIKE '%q%'` on the real table without the FTS index — acceptable for edge cases.  
- **Edge cases resolved**:
  - Single-character query: valid FTS5 prefix match
  - Quoted phrase: pass through to FTS5 unchanged
  - Special chars (`%`, `(`, `)`, `/`): catch `sqlite3.OperationalError` and fall back to LIKE

---

## Decision 5: Sidecar JSON Slug Algorithm

- **Decision**: Implement exactly as described in spec §6.5  
- **Rationale**: The slug is derived by stripping all non-alphanumeric characters from the base filename (excluding extension), lowercasing, then looking for `source-<slug>_data.json` in `<paper_id>/<study_dir>/data/`. When multiple sidecars exist in that directory, match by the `metacheck:original_file.rel_path` field inside each sidecar.
- **Confirmed behavior**:
  - `"Some_Study/data.csv"` → basename = `data` → slug = `data` → look for `source-data_data.json`
  - `"Study_1/participants.csv"` → basename = `participants` → slug = `participants` → `source-participants_data.json`
  - Ambiguous cases: iterate all `source-*_data.json` files in the directory and compare `metacheck:original_file.rel_path` to the variable's `metacheck:source_file`

---

## Decision 6: paper_id String Safety

- **Decision**: Enforce TEXT type at every boundary — SQLite schema, Pydantic models, URL path parameters, JSON serialization, frontend API client  
- **Rationale**: Spec §6.1 is explicit: paper IDs like `"0956797614557867"` lose leading zeros if cast to number. In Python, FastAPI path parameters are strings by default. SQLite stores them as TEXT. The risk is in `json.loads()` — Python's json module preserves string types from the source JSON, so `dataset_description.json` values arrive as strings. The indexer must never coerce them via `int()` or numeric comparison.

---

## Decision 7: Frontend Framework and Styling

- **Decision**: React 18 + Vite + CSS custom properties (no UI component library)  
- **Rationale**: Spec §5.1 mandates React+Vite and explicitly says "no UI component framework required." The spec provides exact CSS custom property names, hex values, and layout dimensions — implementing these directly avoids the overhead of overriding a component library's defaults. Tailwind CSS is acceptable but the level of spec detail makes plain CSS properties equally maintainable.
- **CSS approach**: Single global `variables.css` (the spec's CSS block verbatim) + component-scoped styles via CSS Modules.

---

## Decision 8: SQLite Index Persistence

- **Decision**: `/tmp/viewer_index.db` ephemeral path, rebuilt on reindex, SQLite WAL mode  
- **Rationale**: Spec §7.1 requires the DB to survive container restarts to avoid re-indexing delay. `/tmp` persists across FastAPI restarts within the same container. Docker containers don't restart `/tmp` unless the container is fully removed. Adding WAL mode (`PRAGMA journal_mode=WAL`) enables concurrent reads during ongoing writes (index rebuild).  
- **Startup logic**: Check if DB exists and `papers` table is non-empty → skip indexing. If absent or empty → run indexer. Explicit `POST /api/admin/reindex` always rebuilds.

---

## Decision 9: Indexer Parallelism

- **Decision**: `concurrent.futures.ThreadPoolExecutor` with `INDEX_MAX_WORKERS` (default 4)  
- **Rationale**: The indexer reads many JSON files from disk — I/O bound, not CPU bound. Thread pool parallelism handles this well without the complexity of multiprocessing. Each thread parses one study group's `dataset_description.json` and `provenance.json`, then passes results to a single-threaded SQLite writer to avoid concurrent write contention.

---

## Decision 10: React State Management

- **Decision**: No external state library — React `useState`/`useEffect`/`useCallback` hooks + a custom `useDownload` hook  
- **Rationale**: The app has two views and one modal. There is no complex cross-component state that would justify Redux or Zustand. API calls are triggered by user interaction in each component; results live in local component state. The download flow (size check → confirm → stream) is self-contained in `useDownload.js`.

---

## Open Questions Resolved

| Question | Resolution |
|---|---|
| Do we need SSR? | No — pure SPA (spec §8) |
| Database migrations? | No — DB is ephemeral, rebuilt from psychds/ on start |
| Authentication? | No — spec §7.4 explicitly excludes it |
| WebSocket for index progress? | No — poll `/health` every 2s (spec §5.7.10) |
| ZIP MIME type? | `application/zip` with `Content-Disposition: attachment` |
| Chunked transfer encoding? | Yes — FastAPI `StreamingResponse` uses chunked encoding automatically |
| Study group "single" mapping | `study_group = "single"` → find the only study dir present or `study-ex1` (spec §4.1.1) |
