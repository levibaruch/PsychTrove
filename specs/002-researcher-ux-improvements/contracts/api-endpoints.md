# API Endpoint Contracts: Researcher UX Improvements

## Modified Endpoints

### 1. GET /api/papers

**Purpose**: List papers with basic info + new max_participant_n field

**Query Parameters**:
| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| q | string | No | null | Search title/description/keywords/authors |
| has_labels | boolean | No | null | Filter by has any described variables |
| has_ground_truth | boolean | No | null | Filter by ground truth availability |
| limit | integer | No | 50 | [1-500] |
| offset | integer | No | 0 | [0+] |

**Response** (200 OK):
```json
{
  "total": 42,
  "papers": [
    {
      "paper_id": "doi_1234567890",
      "title": "Depression in Adolescence: A Longitudinal Study",
      "doi": "10.1234/example",
      "authors": ["Smith, J.", "Doe, A."],
      "keywords": ["depression", "adolescence", "longitudinal"],
      "n_study_groups": 2,
      "n_variables": 87,
      "n_labelled_variables": 34,
      "has_ground_truth": false,
      "conversion_date": "2025-06-10",
      "max_participant_n": 245
    }
  ]
}
```

**Behavior**:
- max_participant_n computed as MAX(variables.stat_n) for paper
- If no variables have stat_n, field is null
- Sorted by paper title (existing behavior)

**Error** (404): Paper not found

---

### 2. GET /api/papers/{paper_id}

**Purpose**: Detailed paper view with study groups (now including descriptions)

**Path Parameters**:
| Parameter | Type | Notes |
|-----------|------|-------|
| paper_id | string | Paper ID; always string, never numeric |

**Response** (200 OK):
```json
{
  "paper_id": "doi_1234567890",
  "title": "Depression in Adolescence: A Longitudinal Study",
  "description": "A 3-year longitudinal study examining...",
  "authors": ["Smith, J.", "Doe, A."],
  "doi": "10.1234/example",
  "keywords": ["depression", "adolescence"],
  "pipeline_version": "v2.1",
  "conversion_date": "2025-06-10",
  "study_groups": [
    {
      "study_group": "wave_1",
      "study_dir": "study_01",
      "title": "Wave 1: Baseline",
      "description": "Initial assessment at study entry. Includes demographics, clinical interviews, and questionnaires. N=342 baseline participants.",
      "pipeline_status": {
        "index_success": true,
        "codebook_success": true,
        "n_files_total": 12,
        "n_data_files": 8,
        "n_columns": 156,
        "n_labelled_columns": 87,
        "label_status": "complete"
      },
      "n_variables": 156,
      "n_labelled": 87,
      "has_ground_truth": false
    },
    {
      "study_group": "wave_2",
      "study_dir": "study_02",
      "title": "Wave 2: Follow-up (1 year)",
      "description": "12-month follow-up assessment. N=310 retained participants.",
      "pipeline_status": { ... },
      "n_variables": 145,
      "n_labelled": 78,
      "has_ground_truth": false
    }
  ]
}
```

**Behavior**:
- study_groups now include `description` field (was in schema, not returned before)
- Sorted: "shared" studies first, then alphabetically by study_group
- description can be null; frontend omits subtitle if so

**Error** (404): Paper not found

---

### 3. GET /api/papers/{paper_id}/groups/{study_group}

**Purpose**: Full study group detail with all variables

**Path Parameters**:
| Parameter | Type | Notes |
|-----------|------|-------|
| paper_id | string | Paper ID |
| study_group | string | Study group name (e.g. "wave_1") |

**Response** (200 OK):
```json
{
  "paper_id": "doi_1234567890",
  "study_group": "wave_1",
  "title": "Wave 1: Baseline",
  "description": "Initial assessment at study entry. Includes demographics, clinical interviews, and questionnaires. N=342 baseline participants.",
  "authors": ["Smith, J.", "Doe, A."],
  "doi": "10.1234/example",
  "keywords": ["depression", "adolescence"],
  "pipeline_status": { ... },
  "source_repository": null,
  "shared_resources": null,
  "shared_files": null,
  "variables": [
    {
      "id": 42,
      "name": "age_baseline",
      "description": "Participant age at baseline assessment in years",
      "col_type": "continuous",
      "source_file": "demographics.csv",
      "sample_values": "[18, 22, 45, 28, ...]",
      "value_pattern": null,
      "min_value": 14.2,
      "max_value": 89.5,
      "statistics": {
        "n": 342,
        "n_missing": 2,
        "mean": 42.3,
        "sd": 15.8,
        "se": 0.86,
        "median": 40.1,
        "p25": 28.5,
        "p75": 55.2,
        "iqr": 26.7,
        "skewness": 0.34,
        "kurtosis": -0.12
      }
    }
  ],
  "provenance": [ ... ]
}
```

**Behavior** (unchanged for API; frontend applies filters):
- All variables for study returned (no server-side filter)
- Frontend applies within-paper filter client-side on name/description

**Error** (404): Study group not found

---

### 4. GET /api/variables/search

**Purpose**: Search variables across all papers with optional minimum N filter

**Query Parameters**:
| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| q | string | Yes | - | Search query (FTS5/ILIKE, supports AND/OR/NOT, phrases, wildcards) |
| col_type | string | No | null | Comma-separated column types (e.g. "continuous,ordinal") |
| has_description | boolean | No | null | Filter by description presence |
| min_n | integer | No | null | **[NEW]** Minimum sample size. Excludes NULL stat_n. |
| paper_id | string | No | null | Filter by paper |
| paper_q | string | No | null | Filter by paper title substring |
| sort_by | string | No | null | Sort column: name, description, col_type, paper_title, stat_n, stat_mean, stat_sd |
| sort_dir | string | No | "asc" | "asc" or "desc" |
| limit | integer | No | 50 | [1-500] |
| offset | integer | No | 0 | [0+] |

**Response** (200 OK):
```json
{
  "total": 127,
  "query": "anxiety min_n:100",
  "results": [
    {
      "variable_id": 1024,
      "paper_id": "doi_abc123",
      "paper_title": "Anxiety Disorders in Young Adults",
      "doi": "10.1234/anxiety",
      "study_group": "wave_1",
      "name": "anxiety_trait_score",
      "description": "Spielberger Trait Anxiety Inventory score",
      "col_type": "continuous",
      "source_file": "questionnaires.csv",
      "sample_values": "[32, 45, 28, 51, ...]",
      "min_value": 20,
      "max_value": 80,
      "statistics": {
        "n": 245,
        "n_missing": 5,
        "mean": 45.2,
        "sd": 12.8,
        "se": 0.82,
        "median": 44.0,
        "p25": 35.0,
        "p75": 54.0,
        "iqr": 19.0,
        "skewness": 0.28,
        "kurtosis": -0.15
      }
    }
  ]
}
```

**Filtering Logic**:
- FTS5 MATCH on name/description/sample_values (PostgreSQL: tsvector + GIN)
- Fallback to ILIKE on null/error
- min_n filter: `WHERE v.stat_n IS NOT NULL AND v.stat_n >= ?`
  - NULL stat_n excluded (unknown treated as not meeting threshold)
- col_type filter: `WHERE v.col_type IN (...)`
- has_description: `WHERE v.description IS NOT NULL` (or IS NULL)
- paper_id: exact match
- paper_q: `ILIKE %substring%`
- All filters combined with AND logic

**Sort Behavior**:
- NULLS LAST (unknown stat_n values appear at end)

**Error** (400): Invalid query or parameter

---

### 5. GET /api/variables/{variable_id}

**Purpose**: Detail view for single variable

**Path Parameters**:
| Parameter | Type | Notes |
|-----------|------|-------|
| variable_id | integer | Variable ID |

**Response** (200 OK):
```json
{
  "variable_id": 1024,
  "paper_id": "doi_abc123",
  "study_group": "wave_1",
  "name": "anxiety_trait_score",
  "description": "Spielberger Trait Anxiety Inventory score",
  "col_type": "continuous",
  "source_file": "questionnaires.csv",
  "sample_values": "[32, 45, 28, 51, ...]",
  "value_pattern": null,
  "min_value": 20,
  "max_value": 80,
  "statistics": { ... },
  "source_file_context": {
    "original_file": { ... },
    "conversion": { ... },
    "sibling_variables": [
      {
        "name": "anxiety_state_score",
        "col_type": "continuous",
        "description": "Spielberger State Anxiety Inventory score"
      }
    ]
  }
}
```

**Behavior** (unchanged)

**Error** (404): Variable not found

---

## New Client-Side Features (No API Changes)

### Within-Paper Variable Filter (Story 2)
- **Component**: VariableTable (in study group detail)
- **Filter State**: filterText: string
- **Application**: ILIKE %filterText% on (name, description)
- **Combination**: AND logic with col_type filter

### Paper Selection for Batch Download (Story 5)
- **Component**: PaperCard + PapersView
- **Selection State**: Set<paper_id>
- **UI**:
  - Checkbox on each PaperCard
  - "Download Selected (N)" button in header when N > 0
  - DownloadConfirmationPopover shows total size (sum of individual `/api/papers/{id}/download/size` calls)
- **Implementation**: Sequential client-side downloads (loop over selected papers, trigger `/api/papers/{id}/download` URLs)
