# Data Model: Researcher UX Improvements

## Entities

### Paper (extended)

**Existing Fields** (from HEAD):
- paper_id: TEXT PRIMARY KEY
- title: TEXT
- description: TEXT
- authors: TEXT (JSON)
- doi: TEXT
- keywords: TEXT (JSON)
- n_study_groups: INTEGER
- has_ground_truth: INTEGER (bool)
- conversion_date: TEXT
- pipeline_version: TEXT

**New Field** (for Story 1: Sample Size Visibility):
- `max_participant_n`: INTEGER (computed, not stored)
  - Derived: `SELECT MAX(v.stat_n) FROM variables v WHERE v.paper_id = p.paper_id`
  - NULL if no variables have stat_n
  - Frontend displays as "up to N participants" or "N unknown"

**Validation Rules**:
- max_participant_n must be ≥ 0 if not NULL
- Handle all papers, even those with zero variables (show "N unknown")

---

### StudyGroup (extended)

**Existing Fields** (from HEAD):
- id: INTEGER PRIMARY KEY
- paper_id: TEXT REFERENCES papers
- study_group: TEXT
- study_dir: TEXT
- title: TEXT
- description: TEXT
- index_success: INTEGER (bool)
- codebook_success: INTEGER (bool)
- n_files_total: INTEGER
- n_data_files: INTEGER
- n_columns: INTEGER
- n_labelled_columns: INTEGER
- label_status: TEXT
- has_ground_truth: INTEGER (bool)
- n_variables: INTEGER
- n_labelled_csv: INTEGER

**Already in DB, Currently Missing from API Response**:
- `description`: TEXT (needed for Story 3: Study Descriptions)
  - Currently not included in `/papers/{paper_id}` detail endpoint
  - Backend has field, frontend response just needs to include it

**Frontend Presentation** (Story 3):
- Render as subtitle under study_group name
- Truncate to 2 lines, ellipsis if longer
- Full text in title attribute (tooltip)
- Omit subtitle if description is NULL

---

### Variable (no schema changes, frontend filters added)

**Existing Fields** (unchanged):
- id, paper_id, study_group_id, name, description, col_type, source_file, sample_values, value_pattern, min_value, max_value, stat_n, stat_n_missing, stat_mean, stat_sd, stat_se, stat_median, stat_p25, stat_p75, stat_iqr, stat_skewness, stat_kurtosis

**New Backend Query Parameter** (Story 4: Min N Filter):
- `min_n`: INTEGER (optional, default NULL = no filter)
  - Semantics: Exclude variables where `stat_n IS NULL OR stat_n < min_n`
  - NULL stat_n treated as "unknown, does not meet threshold"

**New Frontend State** (Story 2: Within-Paper Filter):
- `filterText`: STRING (client-side, not persisted)
  - Applied to name + description with case-insensitive substring match
  - Combined with col_type filter via AND logic

---

### Selection State (new, client-side only)

**Purpose**: Track selected papers for batch download (Story 5)

**Type**: Set<paper_id: string>

**Lifecycle**:
- User toggles checkbox on PaperCard
- Selection state updated in PapersView
- "Download Selected (N)" button visible when count > 0
- On confirm: iterate selected papers, fetch sizes, trigger downloads

---

## Relationships

### Paper ↔ StudyGroup
- One Paper has many StudyGroups
- StudyGroup.paper_id REFERENCES papers(paper_id)
- Paper detail response includes `study_groups: [...]` array

### StudyGroup ↔ Variable
- One StudyGroup has many Variables
- Variable.study_group_id REFERENCES study_groups(id)
- Study group detail response includes `variables: [...]` array

### Variable ↔ stat_n
- Variable.stat_n is INTEGER, nullable
- Represents maximum observed sample size in a variable's dataset
- NULL = unknown (not present in the collected data)

---

## State Transitions

### Paper Selection (Story 5)
```
Initial: SelectionSet = { }
  ↓ User clicks checkbox on PaperCard
  ↓ Toggle paper_id in SelectionSet
  ↓ Re-render: "Download Selected (3)" button appears
  ↓ User clicks button
  ↓ Show DownloadConfirmationPopover with size
  ↓ User confirms
  ↓ Call /api/papers/{id}/download/size for each selected paper
  ↓ Sum sizes, trigger downloads sequentially
  ↓ Return to Initial state (optional: clear selection after success)
```

### Variable Filter Combination (Story 2)
```
filterText: "" + col_type: "" → all variables
  ↓ User types "age"
  ↓ filterText: "age"
  ↓ Show only variables matching ILIKE %age% on (name, description)
  ↓ User selects col_type: "continuous"
  ↓ Show only (ILIKE %age%) AND (col_type = "continuous")
  ↓ User clears filterText
  ↓ Show all variables with col_type = "continuous"
```

---

## Computed Fields

### max_participant_n (Paper)
- **Computation**: `SELECT MAX(v.stat_n) FROM variables v WHERE v.paper_id = papers.paper_id`
- **Caching**: Recompute on-demand (no materialized column; fast for typical paper size)
- **Display**: 
  - If value ≥ 1: "up to N participants"
  - If NULL: "N unknown"

---

## API Response Contracts (Changes)

### GET /api/papers (list)
**Current Response**:
```json
{
  "total": 42,
  "papers": [
    {
      "paper_id": "12345",
      "title": "...",
      "doi": "...",
      "authors": [...],
      "keywords": [...],
      "n_study_groups": 3,
      "n_variables": 150,
      "n_labelled_variables": 45,
      "has_ground_truth": true,
      "conversion_date": "2025-06-10"
    }
  ]
}
```

**After (Story 1)**:
```json
{
  ...
  "papers": [
    {
      ...
      "max_participant_n": 245    // NEW
    }
  ]
}
```

---

### GET /api/papers/{paper_id}
**Current**: Includes `study_groups: [{ study_group, study_dir, title, pipeline_status, n_variables, n_labelled, has_ground_truth }]`

**After (Story 3)**: Add `description` to each study group
```json
{
  "study_groups": [
    {
      "study_group": "EX1",
      "study_dir": "...",
      "title": "Experiment 1",
      "description": "Participants performed task X...",  // NEW
      "pipeline_status": { ... },
      ...
    }
  ]
}
```

---

### GET /api/variables/search
**New Query Parameter** (Story 4):
- `min_n`: integer (optional)
  - WHERE v.stat_n IS NOT NULL AND v.stat_n >= %s

**Example**: `/api/variables/search?q=anxiety&min_n=100` → only variables with stat_n ≥ 100

---

### GET /api/papers/{paper_id}/groups/{study_group}
**Current**: Includes `variables: [...]` array

**For Story 2**: No backend changes needed; frontend filters client-side on existing `variables` array
