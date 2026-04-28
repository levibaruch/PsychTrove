# PsychTrove — Database Schema

PostgreSQL 16. All text IDs stay as `TEXT` — never cast to int/float.

---

## Tables

### `papers`

One row per paper (top-level directory in `psychds/`).

| Column | Type | Notes |
|--------|------|-------|
| `paper_id` | TEXT PK | Directory name, always string |
| `title` | TEXT NOT NULL | From `dataset_description.json` |
| `description` | TEXT | Abstract / study description |
| `authors` | TEXT | JSON array serialized as string |
| `doi` | TEXT | |
| `keywords` | TEXT | JSON array serialized as string |
| `n_study_groups` | INTEGER | Denormalized count, updated after bulk insert |
| `has_ground_truth` | INTEGER | 0/1, MAX of study_groups |
| `conversion_date` | TEXT | ISO-8601 |
| `pipeline_version` | TEXT | |

---

### `study_groups`

One row per study directory within a paper.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `paper_id` | TEXT FK → papers | |
| `study_group` | TEXT | Label: `ex1`, `ex2`, `single`, etc. |
| `study_dir` | TEXT | Actual directory name (`study-ex1` or paper dir for flat) |
| `title` | TEXT | |
| `description` | TEXT | |
| `index_success` | INTEGER | 0/1 |
| `codebook_success` | INTEGER | 0/1 |
| `n_files_total` | INTEGER | |
| `n_data_files` | INTEGER | |
| `n_columns` | INTEGER | |
| `n_labelled_columns` | INTEGER | |
| `label_status` | TEXT | `full`, `partial`, `none` |
| `has_ground_truth` | INTEGER | 0/1 |
| `n_variables` | INTEGER | |
| `n_labelled_csv` | INTEGER | Variables with non-null description |

**Unique constraint:** `(paper_id, study_group)`

---

### `variables`

One row per variable (column) parsed from data files.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `paper_id` | TEXT FK → papers | Denormalized for fast filtering |
| `study_group_id` | INTEGER FK → study_groups | |
| `name` | TEXT NOT NULL | Column name |
| `description` | TEXT | Human-readable label / codebook entry |
| `col_type` | TEXT NOT NULL | `numeric`, `character`, `factor`, `logical`, `integer` |
| `source_file` | TEXT NOT NULL | Original filename (before conversion) |
| `sample_values` | TEXT | Space-separated sample values |
| `value_pattern` | TEXT | Regex or enum pattern |
| `min_value` | DOUBLE PRECISION | |
| `max_value` | DOUBLE PRECISION | |
| `stat_n` | INTEGER | Non-missing count |
| `stat_n_missing` | INTEGER | |
| `stat_mean` | DOUBLE PRECISION | |
| `stat_sd` | DOUBLE PRECISION | |
| `stat_se` | DOUBLE PRECISION | |
| `stat_median` | DOUBLE PRECISION | |
| `stat_p25` | DOUBLE PRECISION | |
| `stat_p75` | DOUBLE PRECISION | |
| `stat_iqr` | DOUBLE PRECISION | |
| `stat_skewness` | DOUBLE PRECISION | |
| `stat_kurtosis` | DOUBLE PRECISION | |
| `search_vector` | tsvector GENERATED STORED | `name` (weight A) + `description` (B) + `sample_values` (C) |

**Full-text search:** `search_vector @@ plainto_tsquery('english', <query>)` with GIN index.

---

### `provenance`

One row per source file processed by the pipeline.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `study_group_id` | INTEGER FK → study_groups | |
| `psychds_path` | TEXT NOT NULL | Path within psychds volume |
| `original_rel_path` | TEXT | Relative path in original dataset |
| `original_format` | TEXT | `sav`, `csv`, `xlsx`, etc. |
| `pipeline_type` | TEXT | `haven`, `readr`, etc. |
| `pipeline_group` | TEXT | |
| `pipeline_data_granularity` | TEXT | `subject`, `trial`, `aggregate` |
| `ground_truth_validated` | INTEGER | 0/1 |
| `txt_extraction_attempted` | INTEGER | 0/1 |
| `txt_extraction_skipped` | INTEGER | 0/1 |
| `txt_skip_reason` | TEXT | |
| `txt_psychds_path` | TEXT | Path to extracted text file |

---

### `_meta`

Key-value store for index metadata.

| Column | Type |
|--------|------|
| `key` | TEXT PK |
| `value` | TEXT NOT NULL |

**Keys used:** `last_indexed` (ISO-8601), `pipeline_version`

---

## Relationships

```
papers
  └── study_groups  (paper_id)
        ├── variables    (study_group_id, paper_id denorm)
        └── provenance   (study_group_id)
```

---

## Indexes

| Index | Table | Column(s) |
|-------|-------|-----------|
| PK | papers | paper_id |
| PK | study_groups | id |
| UNIQUE | study_groups | (paper_id, study_group) |
| PK | variables | id |
| PK | provenance | id |
| idx_papers_has_ground_truth | papers | has_ground_truth |
| idx_study_groups_paper_id | study_groups | paper_id |
| idx_variables_paper_id | variables | paper_id |
| idx_variables_study_group_id | variables | study_group_id |
| idx_variables_col_type | variables | col_type |
| idx_variables_name | variables | name |
| idx_variables_search_vector | variables | search_vector (GIN) |
| idx_provenance_study_group_id | provenance | study_group_id |
| idx_provenance_pipeline_type | provenance | pipeline_type |

---

## Discovery logic

Index rebuilt by scanning `PSYCHDS_DIR` folder-by-folder:

```
psychds/
  {paper_id}/
    study-{group}/          ← nested layout
      dataset_description.json
    study-{group}/
      ...
    dataset_description.json  ← flat layout (study_group = "single")
```

No dependency on `conversion_summary.csv`.
