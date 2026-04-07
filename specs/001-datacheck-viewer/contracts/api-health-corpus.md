# Contract: Health & Corpus Endpoints

**Base path**: `/api`  
**Source**: spec.md §4.2.1

---

## GET /health

Returns backend readiness. Frontend polls this every 2s on startup; main UI is shown only when `indexed: true`.

**Auth**: None  
**Method**: GET  
**Path**: `/health`

### Response: 200 OK (ready)

```json
{
  "status": "ok",
  "indexed": true
}
```

### Response: 503 Service Unavailable (indexing in progress)

```json
{
  "status": "indexing"
}
```

**Healthcheck usage** (docker-compose): `curl -f http://localhost:8000/health` passes only when 200 OK.

---

## GET /api/corpus/stats

Returns corpus-level summary shown in the header.

**Auth**: None  
**Method**: GET  
**Path**: `/api/corpus/stats`

### Response: 200 OK

```json
{
  "n_papers": 312,
  "n_study_groups": 487,
  "n_variables": 94821,
  "n_labelled_variables": 12034,
  "n_ground_truth_validated_files": 1240,
  "pipeline_version": "021",
  "last_indexed": "2026-04-07T14:23:00Z"
}
```

| Field | Type | Source |
|---|---|---|
| `n_papers` | integer | `COUNT(*) FROM papers` |
| `n_study_groups` | integer | `COUNT(*) FROM study_groups` |
| `n_variables` | integer | `COUNT(*) FROM variables` |
| `n_labelled_variables` | integer | `COUNT(*) FROM variables WHERE description IS NOT NULL` |
| `n_ground_truth_validated_files` | integer | `COUNT(*) FROM provenance WHERE ground_truth_validated=1` |
| `pipeline_version` | string | `_meta.value WHERE key='pipeline_version'` |
| `last_indexed` | ISO 8601 string | `_meta.value WHERE key='last_indexed'` |

### Response: 503 (not yet indexed)

```json
{ "error": "Index not ready" }
```
