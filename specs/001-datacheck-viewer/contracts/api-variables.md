# Contract: Variable Endpoints

**Base path**: `/api/variables`  
**Source**: spec.md §4.2.5, §4.2.6

---

## GET /api/variables/search

Full-text search across all variables in the corpus. Searches `name` AND `description` fields simultaneously.

**Method**: GET  
**Path**: `/api/variables/search`

### Query Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | **required** | Search query — matched against column name and codebook description |
| `col_type` | string | — | Comma-separated col_type values to filter (e.g. `continuous,ordinal`) |
| `has_description` | boolean | — | If true, only return variables with a codebook label |
| `paper_id` | string | — | Scope search to one paper |
| `limit` | integer | 50 | Max results (max 500) |
| `offset` | integer | 0 | Pagination offset |

### Response: 200 OK

```json
{
  "total": 34,
  "query": "age",
  "results": [
    {
      "variable_id": 18421,
      "paper_id": "0956797614524581",
      "paper_title": "The Pen Is Mightier…",
      "doi": "https://doi.org/10.1177/…",
      "study_group": "ex1",
      "name": "age",
      "description": "Participant age in years",
      "col_type": "continuous",
      "source_file": "…/study1_data.csv",
      "sample_values": "19 | 22 | 21 | 20 | 23",
      "min_value": 18,
      "max_value": 35,
      "statistics": {
        "n": 67, "n_missing": 0, "mean": 21.4,
        "sd": 2.1, "se": 0.26, "median": 21,
        "p25": 20, "p75": 23, "iqr": 3,
        "skewness": 0.4, "kurtosis": -0.2
      }
    }
  ]
}
```

### Search Implementation

Primary (FTS5):
```sql
SELECT v.id as variable_id, v.name, v.description, v.col_type,
       v.source_file, v.sample_values, v.min_value, v.max_value,
       v.stat_n, v.stat_mean, ...
       p.paper_id, p.title as paper_title, p.doi,
       sg.study_group
FROM variables_fts fts
JOIN variables v ON fts.variable_id = v.id
JOIN study_groups sg ON v.study_group_id = sg.id
JOIN papers p ON v.paper_id = p.paper_id
WHERE variables_fts MATCH 'name:{q}* OR description:{q}*'
  [AND v.col_type IN (...)]
  [AND v.description IS NOT NULL]
  [AND v.paper_id = ?]
ORDER BY rank
LIMIT ? OFFSET ?
```

Fallback (catch `sqlite3.OperationalError`):
```sql
... WHERE (v.name LIKE '%{q}%' OR v.description LIKE '%{q}%') ...
```

### Response: 400 Bad Request

```json
{ "error": "q parameter is required" }
```

---

## GET /api/variables/:variable_id

Returns full variable detail plus source file context from the matching sidecar JSON.

**Method**: GET  
**Path**: `/api/variables/{variable_id}`

### Response: 200 OK

```json
{
  "variable_id": 18421,
  "paper_id": "0956797614524581",
  "study_group": "ex1",
  "name": "age",
  "description": "Participant age in years",
  "col_type": "continuous",
  "source_file": "Study_1/participants.csv",
  "sample_values": "19 | 22 | 21 | 20 | 23",
  "value_pattern": null,
  "min_value": 18,
  "max_value": 35,
  "statistics": {
    "n": 67, "n_missing": 0, "mean": 21.4, "sd": 2.1,
    "se": 0.26, "median": 21, "p25": 20, "p75": 23,
    "iqr": 3, "skewness": 0.4, "kurtosis": -0.2
  },
  "source_file_context": {
    "original_file": {
      "rel_path": "Study_1/participants.csv",
      "format": "csv",
      "size_bytes": 14290,
      "data_granularity": "combined"
    },
    "conversion": {
      "method": "read.csv",
      "encoding_normalized": false,
      "haven_labels_extracted": false,
      "rows_written": 67,
      "columns_written": 22
    },
    "sibling_variables": [
      { "name": "condition", "col_type": "categorical", "description": null },
      { "name": "score_factual", "col_type": "continuous", "description": "Factual score" }
    ]
  }
}
```

`source_file_context` is `null` when no matching sidecar exists.  
`sibling_variables` lists all OTHER variables in the same source file — names, types, descriptions only.  
`statistics` is `null` for non-numeric col_types.  
`value_pattern` is non-null only for `col_type = "binary"`.

### Sidecar Resolution (spec §6.5)

1. Get `source_file` for the variable (e.g. `"Study_1/participants.csv"`)
2. Extract filename: `participants.csv` → basename `participants`
3. Strip non-alphanumeric → `participants` (already clean in this case)
4. Lowercase → `participants`
5. Look for `source-participants_data.json` in `<psychds_dir>/<paper_id>/<study_dir>/data/`
6. If multiple sidecars, match by `metacheck:original_file.rel_path` field in each

### Response: 404 Not Found

```json
{ "error": "Variable not found: 18421" }
```

---

## GET /api/pipeline/stages

Static hardcoded documentation of pipeline stages.

**Method**: GET  
**Path**: `/api/pipeline/stages`

### Response: 200 OK

```json
{
  "stages": [
    {
      "id": "osf_download",
      "name": "OSF Download",
      "description": "Files are downloaded from the Open Science Framework (OSF) repository associated with the paper's DOI. The download is limited to 10 GB. All file types are downloaded regardless of content.",
      "outputs": ["data/<paper_id>/"]
    },
    {
      "id": "archive_unpack",
      "name": "Archive Unpacking",
      "description": "ZIP, TAR, TGZ, GZ, BZ2, and XZ archives are unpacked recursively…",
      "outputs": ["data/<paper_id>/"]
    },
    {
      "id": "file_classification",
      "name": "LLM File Classification",
      "description": "Each file path is classified into a type and assigned to an experiment group by a local LLM…",
      "outputs": ["outputs/<paper_id>/structure.csv"]
    },
    {
      "id": "ground_truth_override",
      "name": "Manual Ground Truth Override",
      "description": "After LLM classification, a human annotator may review file types…",
      "outputs": ["ground_truth/<paper_id>.csv"]
    },
    {
      "id": "column_extraction",
      "name": "Column Extraction and Statistics",
      "description": "Files classified as type=data with data_format=tabular are read…",
      "outputs": ["outputs/<paper_id>/columns.csv"]
    },
    {
      "id": "codebook_labelling",
      "name": "Codebook Labelling",
      "description": "Codebook and README files are parsed to extract variable descriptions…",
      "outputs": ["outputs/<paper_id>/labels.csv", "outputs/<paper_id>/codebook_coverage.csv"]
    },
    {
      "id": "psychds_conversion",
      "name": "PsychDS Conversion",
      "description": "The pipeline outputs are reorganized into the Psych-DS 0.1.0 directory structure…",
      "outputs": ["psychds/<paper_id>/"]
    }
  ]
}
```

Full description text is verbatim from spec §4.2.7 — embed as a Python constant in `viewer/backend/routers/pipeline.py`.

---

## GET /api/pipeline/col_types

Static documentation of column type vocabulary.

**Method**: GET  
**Path**: `/api/pipeline/col_types`

### Response: 200 OK

```json
{
  "col_types": [
    { "value": "continuous", "assigned_by": "Rule or LLM", "description": "Numeric measurement (float or integer with >20 unique values)" },
    { "value": "ordinal", "assigned_by": "LLM", "description": "Ordered integer scale (Likert, rating) with few levels" },
    { "value": "binary", "assigned_by": "Rule", "description": "Exactly two unique non-NA values" },
    { "value": "constant", "assigned_by": "Rule", "description": "Exactly one unique non-NA value" },
    { "value": "categorical", "assigned_by": "LLM", "description": "Unordered group label (condition names, gender codes)" },
    { "value": "date", "assigned_by": "Rule", "description": "Date-parseable values" },
    { "value": "id", "assigned_by": "Rule", "description": "Participant or row identifier (matched by column name pattern)" },
    { "value": "text", "assigned_by": "Rule or LLM", "description": "Free-text or long string values" },
    { "value": "continuous_comma_decimal", "assigned_by": "Rule", "description": "Numeric with comma as decimal separator (≥95% convertible)" },
    { "value": "continuous_outliers_excluded", "assigned_by": "Rule", "description": "Numeric with comma separator but 80–95% convertible" },
    { "value": "empty", "assigned_by": "Rule", "description": "All values are NA" },
    { "value": "unknown", "assigned_by": "LLM", "description": "Genuinely uninformative — cannot be classified" },
    { "value": "llm_error", "assigned_by": "Pipeline", "description": "LLM batch failed on all retries" }
  ]
}
```

---

## GET /api/pipeline/file_types

Static documentation of file type vocabulary.

**Method**: GET  
**Path**: `/api/pipeline/file_types`

### Response: 200 OK

```json
{
  "file_types": [
    { "value": "data", "description": "Research measurements — tabular or non-tabular" },
    { "value": "codebook", "description": "Variable dictionary whose primary purpose is describing what variables mean" },
    { "value": "code", "description": "Executable source file: R, Python, MATLAB, SQL, shell scripts" },
    { "value": "software", "description": "Experiment software: stimulus delivery tools, compiled binaries" },
    { "value": "output", "description": "File produced by executing a script: rendered notebooks, figures, logs" },
    { "value": "supplemental", "description": "Human-authored research material: manuscripts, preregistrations, survey instruments" },
    { "value": "readme", "description": "Files named README.*, LICENSE.*, or CONTRIBUTING.* only" },
    { "value": "asset", "description": "Participant-facing stimuli: images, audio, video shown to participants" },
    { "value": "other", "description": "No research content: OS metadata, environment config" },
    { "value": "llm_error", "description": "LLM classification failed on all retries" }
  ]
}
```
