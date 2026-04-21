# Tasks: Researcher UX Improvements

**Feature**: Researcher UX Improvements for PsychTrove  
**Branch**: `002-researcher-ux-improvements`  
**Status**: Ready for implementation  
**Total Tasks**: 38 | **Setup**: 3 | **Foundational**: 4 | **User Stories**: 28 | **Polish**: 3

---

## Implementation Strategy

**MVP Scope** (Phase 3 only): User Story 1 (Sample Size Visible) — delivers immediate value, no complex dependencies.

**Incremental Delivery**:
1. Phase 3: US1 (P1, 8 tasks)
2. Phase 4: US2 (P1, 6 tasks) — parallel to Phase 5
3. Phase 5: US3 (P2, 4 tasks) — parallel to Phase 4
4. Phase 6: US4 (P2, 6 tasks)
5. Phase 7: US5 (P3, 4 tasks)
6. Phase 8: Polish & cross-cutting (3 tasks)

**Parallel Opportunities**:
- US1 (backend) + US2 (frontend) can proceed in parallel after Phase 2
- US3 + US4 are independent, can proceed in parallel
- US5 depends on US1 (need checkbox component), can start after Phase 3 completes

---

## Phase 1: Setup & Verification

- [x] T001 Verify PostgreSQL migration status: run docker-compose up and confirm backend health check passes
- [x] T002 Fix any remaining SQLite placeholders (`?` → `%s`) in `viewer/backend/routers/variables.py`
- [x] T003 Verify all routers (papers.py, variables.py) compile and load without import errors

---

## Phase 2: Foundational Infrastructure

- [x] T004 Extend papers endpoint to compute max_participant_n: Update `_paper_list_item()` to include MAX(stat_n) subquery in `viewer/backend/routers/papers.py`
- [x] T005 [P] Add frontend state management hook for paper selection: Create `viewer/frontend/src/hooks/usePaperSelection.js` with Set<paper_id> state + toggle/selectAll/deselectAll methods
- [x] T006 [P] Create base CSS for checkbox styling: Add `.paper-checkbox`, `.selected-paper` classes to `viewer/frontend/src/styles/variables.css`
- [x] T007 Update API client with new/modified endpoint calls: Edit `viewer/frontend/src/api/client.js` to support max_participant_n in papers response, min_n param for variables search

---

## Phase 3: User Story 1 — Sample Size Visible Without Clicking (P1)

**Story Goal**: Display approximate participant count on paper cards without requiring click-through.

**Independent Test**: Open papers list, verify each card shows "up to N participants" or "N unknown", sort by N.

### Phase 3A: Backend Implementation

- [ ] T008 [US1] Implement max_participant_n computation in papers list endpoint: Update SQL query in `_get_papers()` to include MAX(stat_n) subquery; handle NULL case in `_paper_list_item()` to return null
- [ ] T009 [US1] Implement max_participant_n computation in paper detail endpoint: Update SQL query in `_get_paper_detail()` to include MAX(stat_n) subquery
- [ ] T010 [US1] Add max_participant_n sorting support: Extend `_get_papers()` to accept `sort_by=max_participant_n` parameter and ORDER BY MAX(stat_n) DESC/ASC

### Phase 3B: Frontend Implementation

- [x] T011 [P] [US1] Update PaperCard component to display max_participant_n: Edit `viewer/frontend/src/components/PaperCard.jsx` to render "up to N participants" with tooltip, or "N unknown" if null; style with `--color-text-secondary`
- [x] T012 [P] [US1] Add sorting UI control for participant count: Update sort button list in `viewer/frontend/src/views/PapersView.jsx` to include "Participant Count" option; pass sort state to PaperCard
- [x] T013 [US1] Test paper card display: Verify max_participant_n appears on ≥5 paper cards in dev server, inspect for null handling and tooltip

### Phase 3C: Integration & Acceptance

- [x] T014 [US1] End-to-end test: Open browser at http://localhost:3001/papers, confirm participant counts visible, click sort by N, verify reorder, test "N unknown" edge case
- [x] T015 [US1] Code review: Check SQL subquery performance, frontend null-coalescing logic, CSS alignment with design tokens

---

## Phase 4: User Story 2 — Search Variables Within a Paper (P1)

**Story Goal**: Enable client-side filtering of variables by name/description within paper detail view.

**Independent Test**: Open paper with 50+ variables, type "age", verify table shows only matching variables, clear filter, verify restoration.

### Phase 4A: Frontend Components

- [x] T016 [P] [US2] Create VariableFilter component: New file `viewer/frontend/src/components/VariableFilter.jsx` with text input (onChange → setFilterText) + clear button
- [x] T017 [P] [US2] Add filter state to StudyGroupDetail view: Edit `viewer/frontend/src/views/StudyGroupDetailView.jsx` to include filterText state + useCallback for filtering logic
- [x] T018 [US2] Implement ILIKE filter logic: Add `filterVariables(variables, filterText)` utility in `viewer/frontend/src/utils/filter.js` — case-insensitive substring match on name + description
- [x] T019 [US2] Integrate filter with existing col_type filter: Update VariableTable to apply both filters with AND logic (no variables → show "No variables match your filter")
- [x] T020 [US2] Test filter interactions: Type "depression", verify count drops, clear, verify restoration, combine with col_type="continuous", verify both applied
- [x] T021 [US2] Test edge case (0 matches): Type "xyzabc", verify "No variables match" message renders instead of empty table

---

## Phase 5: User Story 3 — Study Descriptions Visible at a Glance (P2)

**Story Goal**: Display study group descriptions as subtitles in Studies tab without expansion.

**Independent Test**: Open multi-study paper, verify each study shows name + description (truncated 2 lines), hover shows full text.

### Phase 5A: Backend Response Update

- [x] T022 [US3] Add description field to study_groups response: Edit `_get_paper_detail()` in `viewer/backend/routers/papers.py` to include `"description": sg["description"]` in study_groups array

### Phase 5B: Frontend Component

- [x] T023 [P] [US3] Update StudyGroupRow component to display description: Edit `viewer/frontend/src/components/StudyGroupRow.jsx` to render description as subtitle, truncate 2 lines, add title attribute for full text
- [x] T024 [P] [US3] Add CSS for description subtitle: Extend `viewer/frontend/src/styles/responsive.css` with `.study-description` class (font-size 12px, line-clamp 2, color --color-text-secondary, opacity 0.8)
- [x] T025 [US3] Handle null descriptions gracefully: Verify no empty space rendered when description is null, test with mixed (some studies with, some without descriptions)

---

## Phase 6: User Story 4 — Filter Variable Search by Minimum Sample Size (P2)

**Story Goal**: Add server-side min_n parameter to variable search, exclude NULL stat_n.

**Independent Test**: Search "anxiety" with min_n=100, verify results < without filter, verify all returned have stat_n ≥ 100.

### Phase 6A: Backend Implementation

- [x] T026 [US4] Add min_n query parameter to variables search endpoint: Update route signature in `viewer/backend/routers/variables.py` to accept `min_n: Optional[int] = Query(None)`
- [x] T027 [US4] Implement min_n filtering SQL logic: Update `_search_variables()` WHERE clause to add `AND v.stat_n IS NOT NULL AND v.stat_n >= ?` when min_n provided; append min_n to params list
- [x] T028 [US4] Test min_n with sorting: Verify NULLS LAST still works correctly when min_n filter active (no NULLs in results anyway, but check syntax)

### Phase 6B: Frontend Integration

- [x] T029 [P] [US4] Create MinNFilter input component: New file `viewer/frontend/src/components/MinNFilter.jsx` with number input (min=0) + onChange → setMinN
- [x] T030 [P] [US4] Add min_n UI to VariablesView: Update `viewer/frontend/src/views/VariablesView.jsx` search toolbar to include MinNFilter input + label "Min sample size (N)"
- [x] T031 [US4] Update API client to pass min_n param: Edit `viewer/frontend/src/api/client.js` `searchVariables()` to include `min_n` in query params if set
- [x] T032 [US4] Test edge cases: Set min_n=0 (should show all), leave blank (should show all), set min_n=10000 (should show empty "No results"), verify excluded COUNT matches

---

## Phase 7: User Story 5 — Multi-Select Papers for Batch Download (P3)

**Story Goal**: Add checkboxes to paper cards, batch download UI, and sequential download orchestration.

**Independent Test**: Select 3 papers, click "Download Selected (3)", confirm size, download completes for all 3 papers.

### Phase 7A: Backend (Minimal)

- [x] T033 [US5] Verify `/api/papers/{id}/download/size` endpoint returns correct size: Existing endpoint, no changes needed; just confirm response format includes size_bytes

### Phase 7B: Frontend Components

- [x] T034 [P] [US5] Add checkbox to PaperCard component: Update `viewer/frontend/src/components/PaperCard.jsx` to render `<input type="checkbox">` with usePaperSelection hook; toggle on change
- [x] T035 [P] [US5] Create BatchDownloadButton component: New file `viewer/frontend/src/components/BatchDownloadButton.jsx` showing "Download Selected (N)" button, visible when count > 0, disabled when N=0
- [x] T036 [US5] Implement batch download orchestration: Update PapersView to handle "Download Selected" click → fetch `/api/papers/{id}/download/size` for each selected paper → sum sizes → show DownloadConfirmationPopover → on confirm, loop and trigger `/api/papers/{id}/download` URLs sequentially
- [x] T037 [US5] Test batch selection and download: Select 3 papers, verify button shows "Download Selected (3)", click, confirm size estimate, verify all 3 papers download

---

## Phase 8: Polish & Cross-Cutting

- [x] T038 [P] Update README.md with new feature overview and test scenarios
- [x] T039 [P] Code review pass: Check all type hints, SQL injection prevention (parameterized queries), null coalescing, CSS alignment
- [x] T040 Integration test: Run full stack (docker-compose up), execute all 5 user story acceptance scenarios sequentially, verify no regressions in other views

---

## Task Dependencies Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ├→ Phase 3 (US1: Sample Size)
    │   └→ Phase 7 (US5: Batch Download) [depends on T011: PaperCard component]
    │
    ├→ Phase 4 (US2: Within-Paper Filter) [parallel with Phase 5]
    │
    ├→ Phase 5 (US3: Descriptions) [parallel with Phase 4]
    │
    └→ Phase 6 (US4: Min N Filter)

Phase 8 (Polish)
```

---

## Parallel Execution Map

**After Phase 2 completes**:
- Start Phase 3 (US1 backend) + Phase 4 (US2 frontend) in parallel (no dependencies)
- Start Phase 5 (US3) in parallel with Phase 4

**After Phase 3 T011 completes**:
- Can start Phase 7 (US5 uses checkbox component from T011)

**No blocking dependencies** between US3 and US4 — proceed in parallel.

---

## Task Checklist Format

✅ All tasks follow strict format: `- [ ] [TaskID] ([P] if parallel) [Story label if applicable] Description with file path`

Example:
- ✅ `- [ ] T001 Verify PostgreSQL...`
- ✅ `- [ ] T011 [P] [US1] Update PaperCard component...`
- ✅ `- [ ] T026 [US4] Add min_n query parameter...`

---

## Success Criteria Mapping

| SC ID | Description | Verified By |
|-------|-------------|------------|
| SC-001 | Participant count visible without click | T014 (E2E test), verify PaperCard renders max_participant_n |
| SC-002 | Locate variable in 200-var paper in <10s | T020 (filter test), time typing "depression" + seeing results |
| SC-003 | Download 10 papers in one action | T037 (batch download test) |
| SC-004 | min_n=100 excludes all stat_n < 100 | T032 (edge case test), verify WHERE clause |
| SC-005 | Study descriptions visible without expand | T025 (StudyGroupRow test), verify CSS line-clamp 2 |

---

## MVP Scope Recommendation

**Recommended MVP**: Phase 1 + Phase 2 + **Phase 3 only** (US1: Sample Size Visible)

**Rationale**:
- Delivers immediate, high-value feature (SC-001: P1 blocker for meta-analysis workflows)
- Minimal backend change (single subquery + null handling)
- Minimal frontend change (PaperCard rendering + sort option)
- Independently testable and shippable
- Unblocks Phase 7 (US5) for follow-up batch download feature

**Effort**: ~16 hours  
**Risk**: Low (no complex state management, no new endpoints)

**Follow-up Priority**: US2 + US4 (both P1 researcher needs), then US3 (P2 nice-to-have), then US5 (P3 optimization).

---

## Testing Notes

**Backend Testing** (pytest):
- Test max_participant_n subquery with papers that have NULL stat_n
- Test min_n filter excludes NULL and < threshold values
- Test sorting by max_participant_n (ASC, DESC)

**Frontend Testing** (vitest/jest):
- Test PaperCard renders max_participant_n with correct formatting
- Test VariableFilter applies ILIKE to name + description
- Test BatchDownloadButton visibility state (N > 0)
- Test size calculation sums multiple papers correctly

**Integration Testing**:
- E2E test: Open browser → search papers → sort by N → open paper → filter variables → close → batch select 3 papers → download
