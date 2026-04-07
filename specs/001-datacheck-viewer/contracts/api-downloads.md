# Contract: Download Endpoints

**Base path**: `/api`  
**Source**: spec.md §4.2.8, §4.2.9, §4.2.10

All download endpoints stream ZIP archives. Do NOT buffer the full archive in memory. Use `zipstream-ng`.

---

## GET /api/papers/:paper_id/download/size

Pre-flight size estimate. Frontend calls this before showing the download confirmation popover.

**Method**: GET  
**Path**: `/api/papers/{paper_id}/download/size`

### Response: 200 OK

```json
{
  "paper_id": "0956797614557867",
  "n_files": 24,
  "total_bytes_uncompressed": 14920381,
  "study_groups": [
    { "study_group": "shared", "n_files": 24, "total_bytes_uncompressed": 14920381 }
  ]
}
```

Implementation: `os.path.getsize()` summed over all files under `<psychds_dir>/<paper_id>/`. Must respond within 300ms — no file contents read.

### Response: 404

```json
{ "error": "Paper not found: 0956797614557867" }
```

---

## GET /api/papers/:paper_id/download

Streams ZIP of the full paper directory.

**Method**: GET  
**Path**: `/api/papers/{paper_id}/download`

### Response: 200 OK (streaming)

```
Content-Type: application/zip
Content-Disposition: attachment; filename="psychds-0956797614557867.zip"
Transfer-Encoding: chunked
```

**ZIP structure**:
```
psychds-0956797614557867.zip
  DOWNLOAD_MANIFEST.csv          ← injected at ZIP root (generated, not on disk)
  study-shared/
    dataset_description.json
    provenance.json
    data/
      raw/
        countyoutcomes.csv
      source-countyoutcomes_data.csv
      source-countyoutcomes_data.json
    analysis/
    documentation/
    materials/
```

**DOWNLOAD_MANIFEST.csv columns** (one row per file):

| Column | Description |
|---|---|
| `psychds_path` | Relative path within the ZIP |
| `original_rel_path` | Original path in OSF download tree (from provenance table) |
| `original_format` | Original file extension |
| `pipeline_type` | Pipeline classification |
| `pipeline_group` | Experiment group |
| `ground_truth_validated` | Whether manually reviewed |
| `study_group` | Study group label |

**Implementation notes**:
- Stream using `zipstream-ng.ZipStream`
- `data/raw/` files are included verbatim — may be large
- Response timeout: 120s
- `DOWNLOAD_MANIFEST.csv` is generated from the `provenance` table (not read from disk)

### Response: 404

```json
{ "error": "Paper not found: 0956797614557867" }
```

---

## GET /api/papers/:paper_id/groups/:study_group/download

Streams ZIP of a single study group directory.

**Method**: GET  
**Path**: `/api/papers/{paper_id}/groups/{study_group}/download`

**Response**: Same structure as full paper download but scoped to one `<study_dir>/`.

```
Content-Disposition: attachment; filename="psychds-0956797614557867-shared.zip"
```

---

## GET /api/variables/search/download/size

Pre-flight size estimate for variable search download.

**Method**: GET  
**Path**: `/api/variables/search/download/size`

### Query Parameters

Same as `GET /api/variables/search` (q required, col_type, has_description).

### Response: 200 OK

```json
{
  "query": "age",
  "n_matching_variables": 34,
  "n_source_files": 18,
  "n_papers": 12,
  "total_bytes_uncompressed": 8340291
}
```

Implementation: join `variables` → `study_groups` → `papers`, find distinct `source-*_data.csv` paths on disk, sum `os.path.getsize()`. Must respond within 300ms.

### Response: 400

```json
{ "error": "q parameter is required" }
```

---

## GET /api/variables/search/download

Streams ZIP of all normalized CSVs matching the search query.

**Method**: GET  
**Path**: `/api/variables/search/download`

### Query Parameters

Same as `GET /api/variables/search` plus:

| Param | Type | Default | Description |
|---|---|---|---|
| `deduplicate_files` | boolean | `true` | When multiple variables from same source file match, include that CSV only once |

### Response: 200 OK (streaming)

```
Content-Type: application/zip
Content-Disposition: attachment; filename="variable-search-age.zip"
Transfer-Encoding: chunked
```

**ZIP structure**:
```
variable-search-age.zip
  MANIFEST.csv                          ← generated at request time
  0956797614524581/
    study-ex1/
      source-graphsforcorrigendum_data.csv
  0956797614557867/
    study-shared/
      source-countyoutcomes_data.csv
      source-countyfreqstopics_data.csv
```

**MANIFEST.csv columns** (one row per included CSV file):

| Column | Description |
|---|---|
| `paper_id` | Paper identifier |
| `study_group` | Study group label |
| `paper_title` | Full paper title |
| `doi` | Paper DOI |
| `zip_path` | Path of this CSV within the ZIP |
| `original_rel_path` | Original path in OSF download tree |
| `original_format` | Original file format |
| `pipeline_data_granularity` | `individual` or `combined` |
| `n_rows` | Rows in this CSV (`metacheck:conversion.rows_written` from sidecar) |
| `n_columns` | Columns in this CSV |
| `matching_variables` | Pipe-separated variable names in this file that matched |
| `matching_variable_descriptions` | Pipe-separated codebook descriptions (empty if unlabelled) |
| `ground_truth_validated` | Whether this file was manually reviewed |
| `conversion_method` | R read function used |
| `encoding_normalized` | Whether latin1 re-encoding was applied |

**Important**: Downloads include only `source-*_data.csv` files (normalized CSVs) — NOT raw files.

**q slugification for filename**: lowercase, replace non-alphanumeric with `-`, collapse consecutive `-`.

---

## GET /api/variables/:variable_id/download

Downloads the source-*_data.csv for the specific variable.

**Method**: GET  
**Path**: `/api/variables/{variable_id}/download`

**Response**: Same streaming ZIP format as `/api/variables/search/download` but scoped to the single source file for that variable.

```
Content-Disposition: attachment; filename="variable-age.zip"
```

Equivalent to a variable search download with `q=<exact_variable_name>` scoped to that variable's source file.

### Response: 404

```json
{ "error": "Variable not found: 18421" }
```

---

## POST /api/admin/reindex

Triggers a full rebuild of the search index.

**Method**: POST  
**Path**: `/api/admin/reindex`

### Response: 200 OK

```json
{ "status": "started" }
```

After this call, `GET /health` returns 503 `{"status": "indexing"}` until the rebuild completes.

---

## Error Response Format

All endpoints return errors in this format:

```json
{ "error": "<human-readable message>" }
```

| HTTP Status | When |
|---|---|
| 400 Bad Request | Missing required query param (e.g. `q` for search) |
| 404 Not Found | Paper/variable/study_group not found |
| 503 Service Unavailable | Index not ready (only for /health) |
| 500 Internal Server Error | Unexpected server error |

## Performance Requirements (spec §7.1)

| Endpoint | Target |
|---|---|
| `GET /api/papers` | < 100ms |
| `GET /api/variables/search` | < 200ms |
| `GET /api/papers/:id/download/size` | < 300ms |
| `GET /api/variables/search/download/size` | < 300ms |
| All download streams | First byte within 2s |
