# Data Model: PsychDS Dataset Viewer

**Source**: spec.md §4.1.2, §2.2, §2.3, §2.4  
**Storage**: SQLite at `/tmp/viewer_index.db`  
**Note**: All data is derived by indexing the mounted `psychds/` directory. The DB is read-only after indexing (except on reindex). No user-writable data.

---

## Entity Overview

```
papers (1) ──< study_groups (1) ──< variables
                      │
                      └──< provenance
                      
variables ──> variables_fts  (FTS5 virtual table, content='variables')
```

---

## Entity: `papers`

One row per paper (across all study groups). `paper_id` is the canonical string identifier.

| Column | Type | Constraints | Source |
|---|---|---|---|
| `paper_id` | TEXT | PRIMARY KEY | `metacheck:paper_id` in `dataset_description.json` — always string |
| `title` | TEXT | NOT NULL | `schema:name` |
| `description` | TEXT | | `schema:description` |
| `authors` | TEXT | | JSON array string from `schema:author[*].schema:name` |
| `doi` | TEXT | | `schema:identifier` |
| `keywords` | TEXT | | JSON array string from `schema:keywords` |
| `n_study_groups` | INTEGER | NOT NULL DEFAULT 0 | Count of study dirs with `dataset_description.json` |
| `has_ground_truth` | INTEGER | NOT NULL DEFAULT 0 | 1 if any study group has `has_ground_truth=TRUE` in conversion_summary.csv |
| `conversion_date` | TEXT | | `metacheck:conversion_date` from any study group |
| `pipeline_version` | TEXT | | `metacheck:pipeline_version` |

**Key constraints**:
- `paper_id` MUST be stored and queried as TEXT — never cast to integer
- `authors` and `keywords` are JSON-serialized arrays (not normalized — query via `json_each` if needed)

**Indexes**:
```sql
CREATE INDEX idx_papers_has_ground_truth ON papers(has_ground_truth);
```

---

## Entity: `study_groups`

One row per study group per paper. A paper with 3 study groups has 3 rows here.

| Column | Type | Constraints | Source |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `paper_id` | TEXT | NOT NULL, FK → papers(paper_id) | |
| `study_group` | TEXT | NOT NULL | `metacheck:study_group` (e.g. `ex1`, `shared`) |
| `study_dir` | TEXT | NOT NULL | Directory name (e.g. `study-ex1`, `study-shared`) |
| `title` | TEXT | | `schema:name` |
| `description` | TEXT | | `schema:description` |
| `index_success` | INTEGER | NOT NULL DEFAULT 0 | `metacheck:pipeline_status.index_success` |
| `codebook_success` | INTEGER | NOT NULL DEFAULT 0 | `metacheck:pipeline_status.codebook_success` |
| `n_files_total` | INTEGER | | `metacheck:pipeline_status.n_files_total` |
| `n_data_files` | INTEGER | | `metacheck:pipeline_status.n_data_files` |
| `n_columns` | INTEGER | | `metacheck:pipeline_status.n_columns` |
| `n_labelled_columns` | INTEGER | NOT NULL DEFAULT 0 | `metacheck:pipeline_status.n_labelled_columns` |
| `label_status` | TEXT | | `metacheck:pipeline_status.label_status` — `"ok"`, `"no_match"`, or `"no_codebook"` |
| `has_ground_truth` | INTEGER | NOT NULL DEFAULT 0 | from `conversion_summary.csv` |
| `n_variables` | INTEGER | NOT NULL DEFAULT 0 | from `conversion_summary.csv` |
| `n_labelled_csv` | INTEGER | NOT NULL DEFAULT 0 | from `conversion_summary.csv` |

**Unique constraint**: `UNIQUE(paper_id, study_group)`

**Indexes**:
```sql
CREATE INDEX idx_study_groups_paper_id ON study_groups(paper_id);
```

---

## Entity: `variables`

One row per variable per study group. A study group with 29 columns has 29 rows here.

| Column | Type | Constraints | Source |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `paper_id` | TEXT | NOT NULL, FK → papers(paper_id) | |
| `study_group_id` | INTEGER | NOT NULL, FK → study_groups(id) | |
| `name` | TEXT | NOT NULL | `schema:variableMeasured[i].name` |
| `description` | TEXT | | `schema:variableMeasured[i].description` — NULL when no codebook match |
| `col_type` | TEXT | NOT NULL | `metacheck:col_type` — see vocabulary in spec §2.6 |
| `source_file` | TEXT | NOT NULL | `metacheck:source_file` — relative path of source data file |
| `sample_values` | TEXT | | `metacheck:sample_values` — pipe-separated, up to 5 values |
| `value_pattern` | TEXT | | `valuePattern` — binary columns only, pipe-separated unique values |
| `min_value` | REAL | | `minValue` — numeric columns only |
| `max_value` | REAL | | `maxValue` — numeric columns only |
| `stat_n` | INTEGER | | `metacheck:statistics.n` |
| `stat_n_missing` | INTEGER | | `metacheck:statistics.n_missing` |
| `stat_mean` | REAL | | `metacheck:statistics.mean` |
| `stat_sd` | REAL | | `metacheck:statistics.sd` |
| `stat_se` | REAL | | `metacheck:statistics.se` |
| `stat_median` | REAL | | `metacheck:statistics.median` |
| `stat_p25` | REAL | | `metacheck:statistics.p25` |
| `stat_p75` | REAL | | `metacheck:statistics.p75` |
| `stat_iqr` | REAL | | `metacheck:statistics.iqr` |
| `stat_skewness` | REAL | | `metacheck:statistics.skewness` |
| `stat_kurtosis` | REAL | | `metacheck:statistics.kurtosis` |

**Notes**:
- Statistics columns are NULL for non-numeric col_types (text, categorical, binary, ordinal, id, date, constant, empty, unknown, llm_error)
- `description` is NULL for the majority of variables (only filled when codebook match found)
- `col_type` uses the controlled vocabulary from spec §2.6 — 13 possible values

**Indexes**:
```sql
CREATE INDEX idx_variables_paper_id ON variables(paper_id);
CREATE INDEX idx_variables_study_group_id ON variables(study_group_id);
CREATE INDEX idx_variables_col_type ON variables(col_type);
CREATE INDEX idx_variables_name ON variables(name);
```

---

## Entity: `provenance`

One row per file per study group. A study group with 24 files has 24 rows.

| Column | Type | Constraints | Source |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `study_group_id` | INTEGER | NOT NULL, FK → study_groups(id) | |
| `psychds_path` | TEXT | NOT NULL | `file_provenance[i].psychds_path` |
| `original_rel_path` | TEXT | | `file_provenance[i].original_rel_path` |
| `original_format` | TEXT | | `file_provenance[i].original_format` |
| `pipeline_type` | TEXT | | `file_provenance[i].pipeline_type` — controlled vocabulary §2.5 |
| `pipeline_group` | TEXT | | `file_provenance[i].pipeline_group` |
| `pipeline_data_granularity` | TEXT | | `file_provenance[i].pipeline_data_granularity` — NULL for non-data files |
| `ground_truth_validated` | INTEGER | NOT NULL DEFAULT 0 | `file_provenance[i].ground_truth_validated` |
| `txt_extraction_attempted` | INTEGER | | `file_provenance[i].txt_extraction_attempted` |
| `txt_extraction_skipped` | INTEGER | | `file_provenance[i].txt_extraction_skipped` |
| `txt_skip_reason` | TEXT | | `file_provenance[i].txt_skip_reason` |
| `txt_psychds_path` | TEXT | | `file_provenance[i].txt_psychds_path` |

**Indexes**:
```sql
CREATE INDEX idx_provenance_study_group_id ON provenance(study_group_id);
CREATE INDEX idx_provenance_pipeline_type ON provenance(pipeline_type);
```

---

## Virtual Table: `variables_fts`

FTS5 full-text search index over `variables`. Enables sub-200ms search across the full corpus.

```sql
CREATE VIRTUAL TABLE variables_fts USING fts5(
  variable_id UNINDEXED,
  name,
  description,
  sample_values,
  content='variables',
  content_rowid='id'
);
```

**Population**: Insert `(id, name, description, sample_values)` for every row in `variables` immediately after the variables table is fully populated.

**Query pattern**:
```sql
-- Primary: FTS5 MATCH for prefix search
SELECT v.*, p.title as paper_title, p.doi,
       sg.study_group
FROM variables_fts fts
JOIN variables v ON fts.variable_id = v.id
JOIN study_groups sg ON v.study_group_id = sg.id
JOIN papers p ON v.paper_id = p.paper_id
WHERE variables_fts MATCH 'name:age* OR description:age*'
ORDER BY rank
LIMIT 50 OFFSET 0;

-- Fallback: LIKE when FTS parser rejects query
SELECT v.*, p.title as paper_title, p.doi,
       sg.study_group
FROM variables v
JOIN study_groups sg ON v.study_group_id = sg.id
JOIN papers p ON v.paper_id = p.paper_id
WHERE v.name LIKE '%age%' OR v.description LIKE '%age%'
LIMIT 50 OFFSET 0;
```

---

## Corpus Metadata (In-Memory / DB)

The following values are tracked in a `_meta` key-value table to support `/api/corpus/stats`:

```sql
CREATE TABLE _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Populated with: last_indexed (ISO timestamp), pipeline_version
```

---

## Data Flow: Indexing → Storage

```
psychds/conversion_summary.csv
    ↓  (discovery.py)
List[(paper_id: str, study_group: str)]
    ↓  (for each pair)
psychds/<paper_id>/<study_dir>/dataset_description.json  → papers + study_groups + variables rows
psychds/<paper_id>/<study_dir>/provenance.json           → provenance rows
    ↓  (after all inserts)
INSERT INTO variables_fts SELECT id, name, description, sample_values FROM variables
INSERT INTO _meta VALUES ('last_indexed', datetime('now'))
```

---

## File Access at Request Time (Not Indexed)

The following files are NOT indexed — they are accessed on-demand during API requests:

| File | Access trigger | Used for |
|---|---|---|
| `source-*_data.json` | GET /api/variables/:id | `source_file_context` in variable detail |
| `source-*_data.csv` | GET /api/variables/search/download | Streamed into ZIP |
| `data/raw/*`, `analysis/`, etc. | GET /api/papers/:id/download | Streamed into ZIP |

**Sidecar resolution** (see research.md Decision 5): strip non-alphanumeric from source filename → `source-<slug>_data.json`.

---

## Column Type Vocabulary (spec §2.6)

Valid values for `variables.col_type`:

`continuous` | `ordinal` | `binary` | `constant` | `categorical` | `date` | `id` | `text` | `continuous_comma_decimal` | `continuous_outliers_excluded` | `empty` | `unknown` | `llm_error`

## File Type Vocabulary (spec §2.5)

Valid values for `provenance.pipeline_type`:

`data` | `codebook` | `code` | `software` | `output` | `supplemental` | `readme` | `asset` | `other` | `llm_error`
