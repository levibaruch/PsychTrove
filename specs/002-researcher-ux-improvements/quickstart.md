# Quickstart: Researcher UX Improvements

## Development Setup

### Prerequisites
- Docker + docker-compose
- PSYCHDS_DIR environment variable set (path to psychology dataset)
- PostgreSQL 16+ (via docker-compose)

### Start Full Stack
```bash
cd /Volumes/Models/dev/PsychTrove/viewer
export PSYCHDS_DIR=/path/to/psychds
docker-compose up --build
```

**Services**:
- Backend: http://localhost:8000 (API + health check)
- Frontend: http://localhost:3001 (React UI)
- PostgreSQL: localhost:5432 (database)

**Verify**:
```bash
curl http://localhost:8000/health
# Expected: { "indexed": true }
```

### Verify Database Migration
```bash
# Check that variables.py uses %s placeholders (PostgreSQL), not ? (SQLite)
grep -n "?" viewer/backend/routers/variables.py
# Should return: [any remaining ? placeholders that need fixing]

grep -n "%s" viewer/backend/routers/variables.py
# Should return: many matches (PostgreSQL style)
```

---

## Test Scenarios by Story

### Story 1: Sample Size Visible Without Clicking (P1)

**Setup**: Open http://localhost:3001 → Papers tab

**Test**: Each paper card displays participant count
- [ ] Cards show "up to N participants" (e.g. "up to 245 participants")
- [ ] Cards with no stat_n show "N unknown"
- [ ] Click paper → detail view → verify N matches max in variables

**Acceptance**: 
```bash
curl 'http://localhost:8000/api/papers?limit=5' | jq '.papers[] | {title, max_participant_n}'
# Expected: all entries have max_participant_n field (may be null)
```

**Manual Test**: 
1. Navigate to Papers list
2. Scan first 5 paper cards
3. Confirm each shows participant count or "N unknown"
4. Click one paper → Studies tab → find variable with stat_n
5. Verify stat_n on card ≥ any single variable's n

---

### Story 2: Search Variables Within a Paper (P1)

**Setup**: http://localhost:3001 → Papers → Select paper with 50+ variables → Studies tab → select study group

**Test**: Filter variables in table
- [ ] Type "age" in filter input → only age-related variables visible
- [ ] Clear filter → all variables restored
- [ ] No matches → "No matching variables" message
- [ ] Filter + col_type selector → both apply (AND logic)

**Acceptance**:
```bash
# Study group detail returns full variable list (no backend pagination)
curl 'http://localhost:8000/api/papers/[paper_id]/groups/[study_group]' | jq '.variables | length'
# Expected: 50+ variables for a large paper
```

**Manual Test**:
1. Navigate to large paper (e.g. 100+ variables)
2. Enter "depression" in within-paper filter
3. Verify count drops to ~5-10
4. Clear filter → count returns to ~100
5. Select col_type "continuous"
6. Verify count is intersection (both filters applied)

---

### Story 3: Study Descriptions Visible at a Glance (P2)

**Setup**: http://localhost:3001 → Papers → Paper with 2+ study groups

**Test**: Study description subtitles appear
- [ ] Each study row shows description subtitle (2 lines max)
- [ ] Studies with no description show no subtitle (no blank space)
- [ ] Hover shows full description in tooltip

**Acceptance**:
```bash
curl 'http://localhost:8000/api/papers/[paper_id]' | jq '.study_groups[] | {title, description}' | head -20
# Expected: description field present for all studies (may be null)
```

**Manual Test**:
1. Navigate to paper with 2+ studies
2. Look at Studies tab in paper detail
3. Verify each study shows name + description (truncated)
4. Verify description is clickable/hoverable for full text

---

### Story 4: Filter Variable Search by Minimum Sample Size (P2)

**Setup**: http://localhost:3001 → Variables search tab

**Test**: min_n filter excludes small-N variables
- [ ] Search "anxiety", no filters → 500 results
- [ ] Add min_n = 100 → results drop to 250
- [ ] Add min_n = 500 → results drop to 75
- [ ] Variables with NULL stat_n excluded from all filtered results
- [ ] Combine with col_type="continuous" → both filters apply

**Acceptance**:
```bash
# Test backend endpoint
curl 'http://localhost:8000/api/variables/search?q=anxiety&min_n=100&limit=50' | jq '.total'
# Expected: < 500 (filtered)

curl 'http://localhost:8000/api/variables/search?q=anxiety&min_n=100&limit=50' | jq '.results[].statistics.n' | sort -n | head
# Expected: all ≥ 100 (or null excluded)
```

**Manual Test**:
1. Search "anxiety" (no min_n)
2. Note result count
3. Enter min_n = 100
4. Verify count decreases
5. Verify result list sorted by N (default) shows values ≥ 100

---

### Story 5: Multi-Select Papers for Batch Download (P3)

**Setup**: http://localhost:3001 → Papers tab

**Test**: Select multiple papers, download all
- [ ] Each paper card has checkbox
- [ ] Click checkbox → "Download Selected (3)" button appears in header
- [ ] Click button → confirmation popover shows total size
- [ ] Confirm → downloads all 3 papers in sequence
- [ ] Deselect all → button disappears
- [ ] Click "Select All" → all visible papers selected

**Acceptance**:
```bash
# Verify download size endpoint works for multiple papers
curl 'http://localhost:8000/api/papers/[id1]/download/size' | jq '.size_bytes'
curl 'http://localhost:8000/api/papers/[id2]/download/size' | jq '.size_bytes'
# Frontend sums these for confirmation dialog
```

**Manual Test**:
1. Navigate to Papers list
2. Check 3 paper checkboxes
3. Click "Download Selected (3)"
4. See confirmation with total size
5. Click Confirm
6. Wait for all 3 downloads to complete
7. Verify files appear in downloads folder

---

## Edge Cases & Boundary Tests

### Sample Size Edge Cases
- [ ] Paper with 100 variables but max stat_n = NULL → show "N unknown"
- [ ] Paper with stat_n values: [10, 50, 800, 100] → show "up to 800 participants"
- [ ] Variable with stat_n = 0 → should be included in display, but filtered out by min_n=1

### Within-Paper Filter Edge Cases
- [ ] 0 matches → show "No variables match your filter"
- [ ] Filter + empty paper (0 variables) → show no results (not crash)
- [ ] Case-insensitive matching: "Age" matches "age" and "AGE"
- [ ] Special chars: filter "col-type" matches "col_type" (word boundary search)

### Min N Filter Edge Cases
- [ ] min_n = 0 → treated as no filter (all results)
- [ ] min_n = blank/empty → treated as no filter
- [ ] min_n = 1, all variables have stat_n ≥ 1 → all results returned
- [ ] min_n = 10000, no variables have stat_n ≥ 10000 → empty results, "No results" message

### Batch Download Edge Cases
- [ ] Select 1 paper → "Download Selected (1)"
- [ ] Select 15 papers → "Download Selected (15)" 
- [ ] Total > 500MB → show size warning in confirmation
- [ ] Download fails mid-sequence → user can retry

---

## Performance Expectations

| Action | Expected Time | Constraint |
|--------|---------------|-----------|
| List papers (100 papers) | <200ms | Pagination + count |
| Search variables (1000 results) | <500ms | FTS5 MATCH + sorting |
| Fetch study group (156 variables) | <100ms | Simple SELECT + JOINs |
| Within-paper filter (client) | <50ms | ILIKE in JavaScript |
| Batch download size calc | <1s | 3 sequential HTTP calls |

---

## Testing Commands Reference

### Backend Endpoints
```bash
# List papers with max_participant_n
curl -s 'http://localhost:8000/api/papers?limit=5' | jq '.papers[] | {title, max_participant_n}'

# Paper detail with study descriptions
curl -s 'http://localhost:8000/api/papers/[PAPER_ID]' | jq '.study_groups[] | {study_group, description}'

# Search variables with min_n filter
curl -s 'http://localhost:8000/api/variables/search?q=anxiety&min_n=100&limit=10' | jq '.total, .results[0]'

# Variable detail
curl -s 'http://localhost:8000/api/variables/[VAR_ID]' | jq '.name, .statistics.n'
```

### Frontend Console
```javascript
// Open DevTools Console → Network tab
// Watch requests and verify:

// 1. GET /api/papers includes max_participant_n
// 2. GET /api/papers/{id} includes study descriptions
// 3. GET /api/variables/search with ?min_n=100
// 4. GET /api/papers/{id}/download/size for batch downloads
```

---

## Debugging Checklist

**Database is PostgreSQL but queries fail with `?` placeholder**:
- [ ] Check variables.py for remaining SQLite-style placeholders
- [ ] Fix: Replace `?` with `%s`
- [ ] Test: `grep "?" viewer/backend/routers/variables.py | wc -l` should be 0

**max_participant_n always null**:
- [ ] Check: `SELECT COUNT(*) FROM variables WHERE stat_n IS NOT NULL`
- [ ] If 0, dataset has no stat_n data; show "N unknown" for all papers
- [ ] If >0, verify subquery in papers endpoint is correct

**Within-paper filter not working**:
- [ ] Check: Variables are fetched from backend
- [ ] Check: Frontend JavaScript is filtering on name + description
- [ ] Test: Type "xyz" → should show 0 results if no match

**Batch download not working**:
- [ ] Check: Download buttons exist on paper cards
- [ ] Check: Selection state is updated on checkbox toggle
- [ ] Test: Click 2 papers, verify "Download Selected (2)" appears
- [ ] Test: Click button, verify confirmation dialog shows sizes

---

## Next: Implementation

See `tasks.md` for task breakdown generated by `/speckit.tasks` (Phase 2).
