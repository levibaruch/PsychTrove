# Tasks: PsychDS Dataset Viewer

**Input**: Design documents from `/specs/001-datacheck-viewer/`
**Prerequisites**: spec.md (custom spec — all design, API, and UI requirements derived from it directly)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All file paths are relative to the repo root

## Tech Stack (derived from spec §8)

- **Backend**: Python + FastAPI, `aiosqlite`/`sqlite3` (FTS5), `zipstream-ng` for streaming ZIP
- **Frontend**: React 18 + Vite, native `fetch`, CSS custom properties (no UI framework required)
- **Infra**: Docker + docker-compose (two services: backend port 8000, frontend port 3000)

## Project Structure

```
viewer/
  docker-compose.yml
  backend/
    Dockerfile
    requirements.txt
    main.py
    db/
    indexer/
    routers/
  frontend/
    Dockerfile
    package.json
    src/
      styles/
      components/
      views/
      hooks/
      utils/
```

---

## Phase 1: Setup

**Purpose**: Project scaffold and Docker wiring

- [X] T001 Create viewer/ directory structure: viewer/backend/, viewer/frontend/ subdirectories per spec §3.1
- [X] T002 Initialize Python FastAPI backend: viewer/backend/requirements.txt (fastapi, uvicorn, aiosqlite, zipstream-ng, python-multipart)
- [X] T003 [P] Initialize React+Vite frontend: viewer/frontend/package.json with react, react-dom, vite dependencies
- [X] T004 [P] Write viewer/docker-compose.yml with backend and frontend services, volume mount, healthcheck, env vars per spec §3.2
- [X] T005 Write viewer/backend/Dockerfile (python:3.11-slim base, uvicorn entrypoint, port 8000)
- [X] T006 [P] Write viewer/frontend/Dockerfile (node:20-alpine build stage, serve/nginx for static output, port 3000)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Indexer, SQLite schema, and API skeleton — must be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement SQLite schema in viewer/backend/db/schema.py: CREATE TABLE statements for papers, study_groups, variables, provenance tables exactly per spec §4.1.2 (paper_id as TEXT, all FK constraints)
- [X] T008 Implement FTS5 virtual table creation in viewer/backend/db/schema.py: variables_fts using fts5(variable_id UNINDEXED, name, description, sample_values) per spec §4.1.2
- [X] T009 Implement conversion_summary.csv parser in viewer/backend/indexer/discovery.py: read psychds/ root CSV, return list of (paper_id, study_group) tuples where success=TRUE, treat paper_id as string always
- [X] T010 [P] Implement dataset_description.json parser in viewer/backend/indexer/parsers.py: extract all top-level fields and schema:variableMeasured array per spec §2.2, handle missing optional fields gracefully
- [X] T011 [P] Implement provenance.json parser in viewer/backend/indexer/parsers.py: extract file_provenance array per spec §2.4, all optional fields nullable
- [X] T012 Implement full index build in viewer/backend/indexer/index_builder.py: walk psychds/ using discovery.py, parse each study dir, insert into all four tables, populate FTS5, skip dirs without dataset_description.json, fallback to glob walk if conversion_summary.csv absent (spec §4.1.1)
- [X] T013 Create FastAPI app in viewer/backend/main.py: app instance, CORS middleware, JSON error handler returning {"error": "..."}, router includes, startup event that triggers indexer when INDEX_ON_START=true
- [X] T014 Implement GET /health endpoint in viewer/backend/routers/health.py: return {"status":"ok","indexed":true} when ready, 503 {"status":"indexing"} while build is running; healthcheck only resolves true after index_builder completes

**Checkpoint**: Backend container can start, index a psychds/ directory, and respond to /health

---

## Phase 3: User Story 1 — Paper Browsing (Priority: P1) 🎯 MVP

**Goal**: Researchers can browse and search papers, view study group details, inspect variables and provenance for each study group

**Independent Test**: Start the stack, open the app, search for a paper by title, click it, expand a study group, verify variables and provenance rows appear with correct data

### Backend — Paper Browsing

- [X] T015 [P] [US1] Implement GET /api/corpus/stats in viewer/backend/routers/corpus.py: query DB for n_papers, n_study_groups, n_variables, n_labelled_variables, n_ground_truth_validated_files, pipeline_version, last_indexed (spec §4.2.1)
- [X] T016 [P] [US1] Implement GET /api/papers in viewer/backend/routers/papers.py: full-text search across title/description/keywords/authors with q param, has_labels and has_ground_truth boolean filters, limit/offset pagination, return total + papers array per spec §4.2.2
- [X] T017 [US1] Implement GET /api/papers/:paper_id in viewer/backend/routers/papers.py: return paper metadata + study_groups array ordered by study_group label (shared last) per spec §4.2.3
- [X] T018 [US1] Implement GET /api/papers/:paper_id/groups/:study_group in viewer/backend/routers/papers.py: return full dataset_description content + variables array + provenance array per spec §4.2.4
- [X] T019 [P] [US1] Implement GET /api/pipeline/stages, /api/pipeline/col_types, /api/pipeline/file_types in viewer/backend/routers/pipeline.py: all three return hardcoded static data embedded in the module per spec §4.2.7 and §2.5, §2.6

### Frontend — Paper Browsing

- [X] T020 [P] [US1] Write viewer/frontend/src/styles/variables.css: full CSS custom property palette for light and dark mode per spec §5.7.2, typography scale per §5.7.3, badge anatomy styles per §5.7.5
- [X] T021 [P] [US1] Build TypeBadge component in viewer/frontend/src/components/TypeBadge.jsx: renders colored pill for any col_type or pipeline_type value using exact hex colors from spec §5.7.5 tables, always includes text label
- [X] T022 [US1] Build App shell in viewer/frontend/src/App.jsx: sticky 56px header with app name, corpus stats from /api/corpus/stats, Papers/Variables tab navigation, dark/light toggle button placeholder; poll /health on startup and show "Building search index…" full-page spinner until indexed:true (spec §5.7.10)
- [X] T023 [US1] Build PaperCard component in viewer/frontend/src/components/PaperCard.jsx: title (2-line clamp), first 3 authors + "et al.", n_study_groups/n_variables/n_labelled stats, GT badge when has_ground_truth=true, download icon button that does NOT trigger paper selection, border-left accent when selected (spec §5.7.6)
- [X] T024 [US1] Build PaperList component in viewer/frontend/src/components/PaperList.jsx: search input calling GET /api/papers?q=..., "Has codebook labels" and "Has ground truth" checkboxes, scrollable card list, calls onSelectPaper on card body click
- [X] T025 [US1] Build PaperDetail component in viewer/frontend/src/components/PaperDetail.jsx: three-tab panel (Overview, Studies, All Variables); Overview tab shows title, description with "Show more" expand, DOI link, authors, keywords chips, pipeline metadata, Download full paper button placeholder; Studies tab lists study group rows with pipeline status icons, label_status badge (spec §5.7.11), N variables/labelled, download button placeholder; All Variables tab shows merged variable table with study_group column
- [X] T026 [US1] Build VariableTable component in viewer/frontend/src/components/VariableTable.jsx: columns Name/Description/Type/Source File/N/Mean/SD/Sample Values; TypeBadge for col_type; sortable Name and Description columns; null stats show "—"; llm_error rows red; row click opens VariableDetailModal placeholder; dimmed appearance for null description rows
- [X] T027 [US1] Build ProvenanceTable component in viewer/frontend/src/components/ProvenanceTable.jsx: columns PsychDS Path/Original Path/Format/Type/Group/Granularity/GT Validated; TypeBadge for pipeline_type; GT Validated shows ✓ or —; llm_error rows highlighted
- [X] T028 [US1] Build SampleValueChips component in viewer/frontend/src/components/SampleValueChips.jsx: split pipe-separated string into individual chips, truncate each at 24 chars with full value in title attribute, chip styles per spec §5.7.8
- [X] T029 [US1] Build PapersView in viewer/frontend/src/views/PapersView.jsx: two-panel layout with resizable divider, left panel min-width 280px max-width 360px containing PaperList, right panel containing PaperDetail; tablet breakpoint collapses to single-panel with back navigation (spec §5.7.12)

**Checkpoint**: Full paper browsing is functional — papers, study groups, variables, and provenance all visible

---

## Phase 4: User Story 2 — Variable Search (Priority: P2)

**Goal**: Researchers can search all variables across every paper by column name or codebook description, see match highlights, and drill into variable detail with source file context

**Independent Test**: Enter "age" in the Variables search, verify results show highlighted matches from multiple papers, click a row, verify the detail modal shows statistics, sibling variables, and provenance pipeline stages

### Backend — Variable Search

- [X] T030 [US2] Implement GET /api/variables/search in viewer/backend/routers/variables.py: FTS5 MATCH query on variables_fts across name AND description, fallback to LIKE '%q%' on FTS parse failure, q/col_type/has_description/paper_id filters, limit/offset pagination, return total + results array per spec §4.2.5
- [X] T031 [P] [US2] Implement GET /api/variables/:variable_id in viewer/backend/routers/variables.py: fetch variable record, resolve source-*_data.json sidecar using slug algorithm from spec §6.5, return variable + source_file_context block (original_file, conversion, sibling_variables) or null if sidecar absent (spec §4.2.6)

### Frontend — Variable Search

- [X] T032 [US2] Build VariablesView in viewer/frontend/src/views/VariablesView.jsx: 44px search input, col_type multi-select dropdown filter, has_description checkbox, debounced 300ms calls to GET /api/variables/search, results count line, empty state illustration, zero-results message (spec §5.4)
- [X] T033 [US2] Build results table in viewer/frontend/src/views/VariablesView.jsx: columns Variable Name/Description/Type/Paper/Study/Source File/N/Mean/Min/Max; matched term highlighted in Name and Description cells; Paper column links to paper detail; row click opens VariableDetailModal (spec §5.4.2)
- [X] T034 [US2] Build StatisticsGrid component in viewer/frontend/src/components/StatisticsGrid.jsx: 2-column grid layout per spec §5.7.7 wireframe (left: N valid, N missing, Min, Max; right: Mean, SD, SE, Median, IQR, P25, P75, Skewness, Kurtosis), monospace 12px tabular-nums, negative sign shown without "+" for positive values
- [X] T035 [US2] Build VariableDetailModal in viewer/frontend/src/components/VariableDetailModal.jsx: modal width min(720px,95vw) max-height 85vh; Variable tab with col_type badge + vocabulary explanation, source file path, SampleValueChips, StatisticsGrid (numeric only), valuePattern for binary, sample_values for others; Provenance tab with source file context (original file details, conversion info), sibling variable chips colored by col_type, pipeline stages from /api/pipeline/stages as collapsible cards; sticky footer with download buttons placeholder; Escape to close, focus trap (spec §5.5, §7.3)
- [X] T036 [P] [US2] Build PipelineTransparencyPanel component in viewer/frontend/src/components/PipelineTransparencyPanel.jsx: full-page overlay with data flow diagram (static ASCII SVG from spec §5.6), stage detail cards from /api/pipeline/stages, col_types and file_types vocabulary tables from /api/pipeline endpoints; accessible via "?" footer link
- [X] T037 [P] [US2] Wire VariableDetailModal into both VariablesView results table and PapersView VariableTable row clicks; pass variable_id, fetch /api/variables/:variable_id on open in viewer/frontend/src/components/VariableDetailModal.jsx

**Checkpoint**: Variable search, results table, and variable detail modal fully functional

---

## Phase 5: User Story 3 — Downloads (Priority: P3)

**Goal**: Researchers can download full paper ZIPs, individual study group ZIPs, or cross-paper variable collections as ZIPs, with size confirmation before initiating

**Independent Test**: Click download on a paper, confirm size popover shows file count and size, confirm download, verify ZIP contains all study group directories and a MANIFEST.csv at the root

### Backend — Downloads

- [X] T038 [P] [US3] Implement GET /api/papers/:paper_id/download/size in viewer/backend/routers/downloads.py: sum file sizes from disk metadata for all files under psychds/<paper_id>/, return n_files, total_bytes_uncompressed, per-study-group breakdown (spec §4.2.8)
- [X] T039 [US3] Implement GET /api/papers/:paper_id/download in viewer/backend/routers/downloads.py: stream ZIP of full psychds/<paper_id>/ tree using zipstream-ng, inject DOWNLOAD_MANIFEST.csv at ZIP root (generated from provenance table), filename psychds-<paper_id>.zip, Content-Disposition header, 120s timeout (spec §4.2.8, §4.2.10)
- [X] T040 [P] [US3] Implement GET /api/papers/:paper_id/groups/:study_group/download in viewer/backend/routers/downloads.py: stream ZIP of single study group directory, same manifest injection, filename psychds-<paper_id>-<study_group>.zip (spec §4.2.8)
- [X] T041 [P] [US3] Implement GET /api/variables/search/download/size in viewer/backend/routers/downloads.py: resolve matching source-*_data.csv files from search params (deduplicate_files default true), sum sizes, return n_matching_variables, n_source_files, n_papers, total_bytes_uncompressed (spec §4.2.9)
- [X] T042 [US3] Implement GET /api/variables/search/download in viewer/backend/routers/downloads.py: stream ZIP of matching source-*_data.csv files organized as <paper_id>/<study_dir>/<csv>, inject MANIFEST.csv with all columns per spec §4.2.9, filename variable-search-<q_slugified>.zip
- [X] T043 [P] [US3] Implement GET /api/variables/:variable_id/download in viewer/backend/routers/downloads.py: single-variable download equivalent to search download scoped to that variable's source file, filename variable-<name_slugified>.zip (spec §4.2.9)

### Frontend — Downloads

- [X] T044 [US3] Build DownloadConfirmationPopover component in viewer/frontend/src/components/DownloadConfirmationPopover.jsx: inline popover anchored to trigger button, width min(340px,90vw), loading spinner while size API is in flight, shows file count and ~size (MB), for variable downloads shows variable/file/paper counts and Deduplicate checkbox, Cancel and Download buttons, download button shows spinner + disabled state after click until first byte received (spec §5.7.9)
- [X] T045 [US3] Create useDownload hook in viewer/frontend/src/hooks/useDownload.js: encapsulates size-fetch → popover → stream-download flow; wire to paper download icon in PaperCard, "Download full paper" in PaperDetail Overview tab, per-study-group download in Studies tab, "Download all matching data files" button in VariablesView (enabled only when query non-empty), and both download buttons in VariableDetailModal footer
- [X] T046 [P] [US3] Build Toast component in viewer/frontend/src/components/Toast.jsx: bottom-right dismissible toast with "Preparing download…" message, 8s auto-dismiss, re-enabled on first byte received; wire to useDownload hook (spec §5.7.10)

**Checkpoint**: All download flows (paper, study group, variable search, variable detail) complete end-to-end with size confirmation

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Dark mode, responsive layout, accessibility, number formatting, admin endpoint

- [X] T047 [P] Implement useTheme hook in viewer/frontend/src/hooks/useTheme.js: toggle data-theme="dark" on <html>, persist preference to localStorage, initialize from stored value on load; wire toggle button in App header
- [X] T048 Implement responsive layout in viewer/frontend/src/styles/responsive.css: tablet breakpoint 768–1023px (Papers view single-panel, Variables hides Source File and Paper columns), mobile <768px (StatisticsGrid single-column, modal full-screen) per spec §5.7.12
- [X] T049 [P] Implement number formatting utility in viewer/frontend/src/utils/format.js: locale thousands separators, 4 significant figures max, tabular-nums class helper, "—" for null/undefined numeric values, sign rules for skewness/kurtosis (no "+" for positive, always show "−" for negative) per spec §7.2
- [X] T050 [P] Implement keyboard navigation in viewer/frontend/src/components/VariableTable.jsx: arrow-key row navigation, Enter to open modal; ensure VariableDetailModal traps focus within the modal and Escape closes it per spec §7.3
- [X] T051 [P] Implement POST /api/admin/reindex in viewer/backend/routers/admin.py: triggers a full re-index of the psychds/ directory, resets indexed state during build, returns {"status":"started"}
- [X] T052 [P] Wire provenance indicators throughout UI per spec §5.7.11: Ground Truth Reviewed badge (success color) on paper cards, provenance rows, and variable modal source file context; LLM Error badge (error color) with tooltip on variable rows and provenance rows where col_type/pipeline_type="llm_error"; label_status badges (ok/no_match/no_codebook) in Studies tab rows
- [X] T053 Write viewer/README.md: docker-compose usage, PSYCHDS_DIR env variable, INDEX_ON_START/INDEX_MAX_WORKERS/LOG_LEVEL options, example startup command

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1 - Papers)**: Depends on Phase 2 completion
- **Phase 4 (US2 - Variables)**: Depends on Phase 2; US1 backend APIs not required but US1 frontend components (TypeBadge, SampleValueChips) used by US2
- **Phase 5 (US3 - Downloads)**: Depends on Phase 2; independent of US1/US2 backend; download buttons wired after US1/US2 frontend exists
- **Phase 6 (Polish)**: Depends on Phase 3–5 being substantially complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3 — fully independent
- **US2 (P2)**: Reuses TypeBadge, SampleValueChips, StatisticsGrid from US1 frontend (build those first); backend is independent
- **US3 (P3)**: Backend routes are independent; frontend wires into US1 and US2 components

### Within Each Phase

- Backend routers can all be built in parallel once Foundational (Phase 2) is done
- Frontend components marked [P] within a phase can be built in parallel
- Models → Parsers → Index builder → Routers (within Phase 2, sequential)

---

## Parallel Execution Examples

### Phase 2 — Run in parallel after T007, T008

```
Task T009: Implement conversion_summary.csv parser
Task T010: Implement dataset_description.json parser     [P]
Task T011: Implement provenance.json parser              [P]
→ Then T012 (index_builder) sequentially
```

### Phase 3 (US1) — Backend all parallel after Phase 2

```
Task T015: GET /api/corpus/stats                [P]
Task T016: GET /api/papers                      [P]
Task T019: GET /api/pipeline/*                  [P]
→ T017, T018 after T016 (same router file)
```

### Phase 3 (US1) — Frontend parallel starting points

```
Task T020: Write CSS variables                  [P]
Task T021: Build TypeBadge                      [P]
Task T028: Build SampleValueChips               [P]
→ Then T022, T023, T024 (depend on TypeBadge)
→ Then T025, T026, T027 (depend on T020–T024)
→ T029 last (PapersView composes all)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: Paper browsing (US1)
4. **Validate**: Start Docker stack, browse papers, inspect variables and provenance
5. Deploy or demo — fully functional read-only paper browser

### Incremental Delivery

1. Setup + Foundational → container boots, health endpoint works
2. US1 (Papers) → full paper browsing, no downloads yet
3. US2 (Variables) → cross-corpus variable search + detail modal
4. US3 (Downloads) → all download flows with confirmation
5. Polish → dark mode, responsive, keyboard nav, formatting

---

## Summary

| Phase | Tasks | Story | Notes |
|---|---|---|---|
| Phase 1: Setup | T001–T006 | — | 6 tasks |
| Phase 2: Foundational | T007–T014 | — | 8 tasks — blocks everything |
| Phase 3: US1 Papers | T015–T029 | US1 | 15 tasks — MVP |
| Phase 4: US2 Variables | T030–T037 | US2 | 8 tasks |
| Phase 5: US3 Downloads | T038–T046 | US3 | 9 tasks |
| Phase 6: Polish | T047–T053 | — | 7 tasks |
| **Total** | **53 tasks** | | |

**Parallel opportunities per phase**: 3–5 parallel tracks available in Phases 2–5  
**Suggested MVP scope**: Phases 1–3 (29 tasks = fully functional paper browser)
