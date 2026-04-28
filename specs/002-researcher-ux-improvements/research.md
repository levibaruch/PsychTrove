# Research: Researcher UX Improvements

**Phase 0** — Resolve unknowns and clarify integration points.

## Clarifications Needed

### 1. Database Migration Status (RESOLVED)

**Finding**: Branch 002-researcher-ux-improvements migrating SQLite → PostgreSQL:
- requirements.txt: psycopg2-binary present, no sqlite3
- docker-compose.yml: postgres:16-alpine service + healthcheck
- schema.py: psycopg2 + PostgreSQL CREATE TABLE syntax
- DATABASE_URL: postgresql://...@postgres:5432/psychtrove
- papers.py: RealDictCursor + ILIKE (PostgreSQL-ready)
- variables.py: Partially converted (some `?` placeholders remain, needs review)

**Decision**: ✓ Build feature on PostgreSQL (migration active path)

**Action**: Fix remaining `?` placeholders in variables.py to `%s` (PostgreSQL); verify papers.py works end-to-end.

---

### 2. Sample Size Aggregation Query

**Context**: Feature Story 1 requires showing `max_participant_n` on paper cards (derived from MAX(stat_n) across a paper's variables).

**Current State**:
- papers.py `_paper_list_item()` returns: paper_id, title, doi, authors, keywords, n_study_groups, n_variables, n_labelled_variables, has_ground_truth, conversion_date
- No sample size field yet

**Required Implementation**:
- Extend papers list/detail response to include `max_participant_n` field
- Backend: Add computed MAX(stat_n) subquery to papers endpoint  
- Handle NULL stat_n (show "N unknown")
- Handle edge case where max_n varies wildly (show "up to N" with tooltip in spec)

**Database Query Pattern** (PostgreSQL): 
```sql
SELECT MAX(v.stat_n) FROM variables v WHERE v.paper_id = p.paper_id
```

---

### 3. Study Description Visibility (Story 3)

**Context**: Study groups tab needs to show description subtitles (truncated to 2 lines).

**Current State**: 
- Study group detail includes `description` field (schema shows `description TEXT`)
- Paper detail response lists study_groups with `title`, `pipeline_status`, `n_variables`, `n_labelled`, `has_ground_truth`
- **Missing**: `description` field is NOT included in the study_groups array

**Required Implementation**:
- Add `description` to study_groups list in `_get_paper_detail()` response
- Frontend: Render as subtitle (truncate 2 lines, full text in title tooltip)

---

### 4. Within-Paper Variable Filtering (Story 2)

**Context**: "All Variables" tab needs client-side text filter on variable name/description.

**Current State**:
- Study group detail endpoint (`/papers/{paper_id}/groups/{study_group}`) returns full `variables` array
- Frontend receives all variables at once — no need for backend pagination

**Implementation**:
- **Client-side only** — no backend changes needed (per spec assumption)
- React state: `filterText`, apply ILIKE on name + description
- Apply simultaneously with existing `col_type` filter (AND logic)
- Show "No variables match" message on zero results

---

### 5. Minimum N Filter for Variable Search (Story 4)

**Context**: Variable search `/api/variables/search` needs optional `min_n` parameter.

**Current State**: 
- variables.py `_search_variables()` accepts col_types, has_description, paper_id, paper_q, limit, offset
- No min_n parameter yet

**Required Implementation**:
- Add `min_n` query parameter to route (optional, default=0)
- Backend SQL: `WHERE v.stat_n >= ? OR v.stat_n IS NULL` → exclude NULLs per spec (unknown N treated as not meeting threshold)
- Clarification: Should NULL stat_n be excluded strictly (`v.stat_n >= min_n`), or included (`v.stat_n IS NULL OR v.stat_n >= min_n`)? Spec says NULL = "does not meet threshold" → exclude strictly.

---

### 6. Batch Multi-Select Download (Story 5)

**Context**: Paper list needs checkboxes + "Download Selected (N)" button for batch download.

**Current State**:
- downloads.py has `/api/papers/{paper_id}/download` endpoint
- No multi-paper batch endpoint yet
- Spec assumption: "Batch download triggers sequential individual paper downloads client-side; no new backend batch endpoint required"

**Implementation Strategy**:
- **Frontend**:
  - Checkbox state per paper (Set of selected IDs)
  - "Download Selected (N)" button
  - Size confirmation popover (use existing DownloadConfirmationPopover + new size query)
  - On confirm: loop over selected papers, call `/api/papers/{paper_id}/download/size` then trigger individual download URLs
- **Backend** (minimal):
  - Extend size endpoint to accept multiple paper IDs or implement lightweight multi-size endpoint?
  - Or: Frontend calls `/api/papers/{id1}/download/size`, `/api/papers/{id2}/download/size` in sequence, sums results

**Decision**: How to calculate total size? Single endpoint call with array param, or N individual calls?

---

### 7. Testing Strategy (per Constitution)

**Context**: Constitution file not yet filled; testing approach unclear.

**Current State**: No visible test suite in viewer/ structure.

**Needed**:
- pytest coverage for backend endpoints (col_types filtering, min_n filtering, sorting, paper_q param)
- vitest/jest coverage for frontend components (PaperCard checkboxes, VariableTable within-paper filter, StudyGroupRow descriptions)
- Integration tests: FTS5/PostgreSQL fallback, download size calculations

---

## Research Findings

### Database Compatibility Patterns

**SQLite FTS5** (current HEAD):
- Full-text search on variables table via virtual table
- Fallback to LIKE on OperationalError
- No tsvector needed

**PostgreSQL** (current working directory):
- tsvector + GIN index on variables (search_vector column)
- websearch_to_tsquery() for flexible search
- ILIKE for LIKE-equivalent

---

## Decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| Build on PostgreSQL | **BLOCKED** | Database migration in progress; need to confirm destination DB before proceeding |
| Max participant N = MAX(stat_n) | ✓ Decided | Spec confirms this approximation with "up to N" label |
| min_n filter excludes NULL | ✓ Decided | Spec: "unknown N treated as not meeting threshold" |
| Batch download: sequential client-side | ✓ Decided | Spec explicitly allows this, avoids backend complexity |
| Study descriptions: add to response | ✓ Decided | Field exists in schema, just needs to be included in endpoint |
| Within-paper filter: client-side | ✓ Decided | Spec allows this assumption; variables array already returned |

---

## Next Steps (Phase 1)

1. ✓ Verify database (PostgreSQL or SQLite) — run docker-compose, test endpoints
2. ✓ Confirm if papers.py + variables.py routers are both PostgreSQL-ready or need fixes
3. Generate data-model.md with API contract changes
4. Generate contracts/ with endpoint signatures
5. Generate quickstart.md with test scenarios
