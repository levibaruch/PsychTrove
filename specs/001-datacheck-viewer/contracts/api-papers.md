# Contract: Paper Endpoints

**Base path**: `/api/papers`  
**Source**: spec.md §4.2.2, §4.2.3, §4.2.4

All responses are `Content-Type: application/json`. Errors return `{"error": "<message>"}` with appropriate HTTP status.

---

## GET /api/papers

Paginated list of papers with optional search and filters.

**Method**: GET  
**Path**: `/api/papers`

### Query Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Free-text search across title, description, keywords, authors |
| `has_labels` | boolean | — | Filter to papers with at least one labelled variable |
| `has_ground_truth` | boolean | — | Filter to papers with ground truth validation |
| `limit` | integer | 50 | Max results (max 500) |
| `offset` | integer | 0 | Pagination offset |

### Response: 200 OK

```json
{
  "total": 312,
  "papers": [
    {
      "paper_id": "0956797614557867",
      "title": "Psychological Language on Twitter…",
      "doi": "https://doi.org/10.1177/…",
      "authors": ["Eichstaedt J", "Smith R"],
      "keywords": ["Twitter", "heart disease"],
      "n_study_groups": 1,
      "n_variables": 29,
      "n_labelled_variables": 0,
      "has_ground_truth": false,
      "conversion_date": "2026-03-30"
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `paper_id` | string | Always string — never number |
| `authors` | string[] | Deserialized from JSON column |
| `keywords` | string[] | Deserialized from JSON column |
| `n_labelled_variables` | integer | `COUNT(*) FROM variables WHERE paper_id=? AND description IS NOT NULL` |
| `has_ground_truth` | boolean | `has_ground_truth = 1` in papers table |

**SQL for `q` search**:
```sql
SELECT * FROM papers
WHERE title LIKE '%q%'
   OR description LIKE '%q%'
   OR keywords LIKE '%q%'
   OR authors LIKE '%q%'
```

---

## GET /api/papers/:paper_id

Full paper metadata plus list of study groups.

**Method**: GET  
**Path**: `/api/papers/{paper_id}`

### Response: 200 OK

```json
{
  "paper_id": "0956797614557867",
  "title": "…",
  "description": "…",
  "authors": ["…"],
  "doi": "…",
  "keywords": ["…"],
  "pipeline_version": "021",
  "conversion_date": "2026-03-30",
  "study_groups": [
    {
      "study_group": "shared",
      "study_dir": "study-shared",
      "title": "… — Study SHARED",
      "pipeline_status": {
        "index_success": true,
        "codebook_success": false,
        "n_files_total": 24,
        "n_data_files": 5,
        "n_columns": 29,
        "n_labelled_columns": 0,
        "label_status": "no_codebook"
      },
      "n_variables": 29,
      "n_labelled": 0,
      "has_ground_truth": false
    }
  ]
}
```

`study_groups` ordered by `study_group` label alphabetically, `shared` last within a paper.

### Response: 404 Not Found

```json
{ "error": "Paper not found: 0956797614557867" }
```

---

## GET /api/papers/:paper_id/groups/:study_group

Full study group detail including variables and provenance.

**Method**: GET  
**Path**: `/api/papers/{paper_id}/groups/{study_group}`

### Response: 200 OK

```json
{
  "paper_id": "0956797614557867",
  "study_group": "shared",
  "title": "…",
  "description": "…",
  "authors": ["…"],
  "doi": "…",
  "keywords": ["…"],
  "schema_version": "Psych-DS 0.1.0",
  "pipeline_status": {
    "index_success": true,
    "codebook_success": false,
    "n_files_total": 24,
    "n_data_files": 5,
    "n_columns": 29,
    "n_labelled_columns": 0,
    "label_status": "no_codebook"
  },
  "source_repository": {
    "platform": "osf",
    "download_path": "data/0956797614557867/"
  },
  "shared_resources": "../shared/",
  "shared_files": ["file1.csv"],
  "variables": [
    {
      "id": 18421,
      "name": "county",
      "description": null,
      "col_type": "text",
      "source_file": "Twitter_Predicts_Heart_Disease/countyoutcomes.csv",
      "sample_values": "Autauga | Baldwin | Blount | Butler | Calhoun",
      "min_value": null,
      "max_value": null,
      "statistics": null
    },
    {
      "id": 18422,
      "name": "fips",
      "description": null,
      "col_type": "continuous",
      "source_file": "…",
      "sample_values": "1001 | 1003 | 1009 | 1013 | 1015",
      "min_value": 1001,
      "max_value": 56029,
      "statistics": {
        "n": 1347, "n_missing": 0, "mean": 30467.21,
        "sd": 15265.62, "se": 415.94, "median": 31019,
        "p25": 18101, "p75": 42099, "iqr": 23998,
        "skewness": -0.155, "kurtosis": -1.079
      }
    }
  ],
  "provenance": [
    {
      "id": 5421,
      "psychds_path": "data/raw/countyoutcomes.csv",
      "original_rel_path": "Twitter_Predicts_Heart_Disease/countyoutcomes/countyoutcomes.csv",
      "original_format": "csv",
      "pipeline_type": "data",
      "pipeline_group": "shared",
      "pipeline_data_granularity": "combined",
      "ground_truth_validated": false,
      "txt_extraction_attempted": null,
      "txt_extraction_skipped": null,
      "txt_skip_reason": null,
      "txt_psychds_path": null
    }
  ]
}
```

`variables` includes `id` field for linking to `/api/variables/:id`.  
`statistics` is `null` for non-numeric col_types.  
`shared_resources` and `shared_files` are `null` when absent.

### Response: 404 Not Found

```json
{ "error": "Study group not found: shared for paper 0956797614557867" }
```
