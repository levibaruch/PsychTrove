# Implementation Plan: Researcher UX Improvements

**Branch**: `002-researcher-ux-improvements` | **Date**: 2026-04-21 | **Spec**: `specs/002-researcher-ux-improvements/spec.md`
**Input**: Feature specification from `/specs/002-researcher-ux-improvements/spec.md`

## Summary

Five UX improvements for PsychTrove researcher workflow: (P1) participant count visible on paper cards + sortable by N; (P1) within-paper variable filtering; (P2) study description subtitles; (P2) min N filter for variable search; (P3) multi-select batch download for papers. All improvements standalone and testable independently.

## Technical Context

**Language/Version**: Python 3.11 (backend) + React 18 (frontend)  
**Primary Dependencies**: FastAPI, Vite, SQLite with FTS5, react, fastapi  
**Storage**: SQLite with FTS5 virtual table + external content table  
**Testing**: pytest (backend), vitest/jest (frontend) — NEEDS CLARIFICATION on current test suite  
**Target Platform**: Web (browser + Linux server)  
**Project Type**: Web application (researcher tool for psychology data corpus)  
**Performance Goals**: Search results <500ms p95 (quick researcher screening workflows)  
**Constraints**: `paper_id` always string (never int), no writes to mounted psychds volume, ZIP downloads must stream (no in-memory buffering), FTS5 MATCH fallback to LIKE on OperationalError  
**Scale/Scope**: Indexed corpus of psychology papers; variable counts per paper likely 50–500; researcher expects sub-second interactive response

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file (`/.specify/memory/constitution.md`) not yet filled; using project constraints from `CLAUDE.md`:
- ✓ `paper_id` string constraint observed
- ✓ No writes to psychds volume
- ✓ ZIP downloads stream (zipstream-ng)
- ✓ FTS5 MATCH with LIKE fallback
- ✓ Health endpoint + indexing gate behavior documented
- ⚠ **NEEDS CLARIFICATION**: Testing strategy (pytest coverage targets, fixture strategy, integration test scope)

## Project Structure

### Documentation (this feature)

```text
specs/002-researcher-ux-improvements/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
viewer/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── config.py
│   ├── db/
│   │   └── schema.py
│   ├── indexer/
│   │   ├── discovery.py
│   │   ├── parsers.py
│   │   ├── index_builder.py
│   │   └── runner.py
│   └── routers/
│       ├── health.py
│       ├── corpus.py
│       ├── papers.py         ← /api/papers/... — sample size field added
│       ├── variables.py       ← /api/variables/search — min_n param added
│       ├── downloads.py       ← /api/papers/.../download — multi-paper support
│       ├── pipeline.py
│       └── admin.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── api/
        │   └── client.js      ← API methods updated
        ├── components/
        │   ├── PaperCard.jsx              ← Sample N display + checkbox
        │   ├── VariableTable.jsx          ← Within-paper filter + columns
        │   └── StudyGroupRow.jsx          ← Study descriptions
        ├── views/
        │   ├── PapersView.jsx             ← Batch download UX
        │   └── VariablesView.jsx          ← Min N filter UI
        ├── hooks/
        │   ├── useDownload.js
        │   └── [filter/batch selection hooks]
        ├── styles/
        └── utils/
            └── format.js
```

**Structure Decision**: Web application (Option 2). Changes span both backend and frontend:
- **Backend**: Extend papers + variables endpoints with new query params (`max_participant_n` response field, `min_n` search param), accept multi-select download
- **Frontend**: Add participant count + checkboxes to PaperCard, within-paper filter to VariableTable, study descriptions to StudyGroupRow, batch selection state to PapersView, min N input to VariablesView

## Complexity Tracking

No architecture violations. Feature additions are orthogonal:
- Story 1 (max_participant_n): Single computed field, no schema changes
- Story 2 (within-paper filter): Client-side only, no backend changes  
- Story 3 (study descriptions): Field exists, just include in response
- Story 4 (min_n filter): Single query parameter, standard WHERE clause
- Story 5 (batch download): Client-side selection + sequential downloads, no new endpoint

All stories fit existing patterns. No need for new abstractions.
