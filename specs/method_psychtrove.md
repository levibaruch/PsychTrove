# PsychTrove: Database Design and Development

## Introduction

PsychTrove is a web-based database interface for browsing and searching repositories processed by DataCheck. The two tools form a sequential system: DataCheck classifies, indexes and reconstructs raw repositories into PsychDS-compliant outputs; PsychTrove ingests those outputs, indexes them into a relational database and exposes them through a searchable interface. The scope of PsychTrove follows that of DataCheck: repositories from psychology and the social sciences with a quantitative nature.

PsychTrove supports two modes of interaction. The first is cross-repository variable search: a researcher can query for a specific construct across the entire indexed corpus and retrieve every matching variable alongside its label, data type, descriptive statistics, and originating repository. The second is individual repository inspection: a researcher can select a paper, view its experiment groups, browse extracted variables by type, inspect DataCheck's file-level classification and labelling decisions for every file in the repository, and download the structured archive.

PsychTrove is a local deployment tool, designed to run on a machine with direct access to a directory of processed repositories. Authentication, user management, and public hosting are outside the present scope.

## Technology

PsychTrove was implemented as a two-tier web application consisting of a REST API backend and a single-page frontend. The backend was developed using Python 3.11 and the FastAPI framework. Data is stored in a PostgreSQL relational database. The frontend was built using React 18 with Vite 5 as the build toolchain. Both services are packaged and deployed via Docker and orchestrated with docker-compose, with the backend exposed on port 8000 and the frontend on port 3000.

---

## System Overview

PsychTrove operates as a read-only viewer over a mounted directory of PsychDS-formatted repositories produced by DataCheck. The mounted directory is never written to during operation.

On startup, the backend launches a background indexing thread that traverses the PsychDS directory tree and populates the database. During indexing, the `/health` endpoint returns HTTP 503. The frontend polls this endpoint every two seconds and renders a loading screen until the response indicates `indexed: true`. Once indexing completes the interface becomes available.

---

## Indexing Pipeline

### Directory Discovery

The indexer traverses the PsychDS root directory looking for valid study directories. Each repository occupies a top-level folder named by its `paper_id`. Within a repository, the indexer recognises two layouts: a flat layout where `dataset_description.json` lives directly in the repository folder, and a nested layout where each experiment group occupies a `study-{group}` subdirectory containing its own `dataset_description.json`. Hidden files and macOS metadata artefacts (entries beginning with `.` or `._`) are skipped.

### Parsing

For each discovered study directory, the indexer reads two files: `dataset_description.json`, which carries paper-level metadata, study-group metadata, and the `variableMeasured` array of variable records; and `provenance.json`, which records the original file path, DataCheck classification type, experimental group, data granularity, and file-level processing flags for every file in the repository. The `paper_id` is treated as a string throughout the entire stack.

### Parallelism

Parsing is parallelised across study directories using a `ThreadPoolExecutor`. The number of worker threads is configurable via an environment variable and defaults to four. Each worker reads and parses the JSON files for a single study directory independently; database insertion is performed sequentially after all workers complete.

### Database Insertion

Records are inserted using an upsert pattern: `INSERT ... ON CONFLICT DO UPDATE`. The index can be rebuilt against an updated corpus without first clearing the database. After all records are inserted, a post-pass updates aggregate counts on the `papers` table: the number of study groups per paper and whether any study group in the paper has ground-truth validation. A `_meta` key–value table records the timestamp of the last completed index and the DataCheck pipeline version detected from the indexed files.

---

## Data Model

The database contains five tables.

### `papers`

One row per repository. Stores paper-level metadata extracted from `dataset_description.json`: title, authors, DOI, keywords, description, DataCheck pipeline version, and conversion date. Two aggregate columns are maintained: `n_study_groups` and `has_ground_truth`.

### `study_groups`

One row per experiment group within a repository. Stores study-level metadata: counts of total files, data files, columns, and labelled columns; the label coverage status (`label_status`); and processing success flags for the indexing and codebook stages of DataCheck. The `has_ground_truth` flag is set at this level and rolled up to `papers`.

### `variables`

One row per column extracted from a combined tabular data file. The core content fields are `name`, `description`, `col_type`, `source_file`, and `sample_values`. For continuous-type variables, eleven descriptive statistics are stored directly: N, N missing, mean, standard deviation, standard error, median, first quartile, third quartile, interquartile range, skewness, and kurtosis.

A `search_vector` column of type `tsvector` is defined as a `GENERATED ALWAYS` computed column:

```sql
setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
setweight(to_tsvector('english', coalesce(sample_values, '')), 'C')
```

Variable name matches are weighted highest (A), description matches next (B), and sample value matches lowest (C). A GIN index over this column enables full-text search across the variable corpus.

### `provenance`

One row per file in a repository's PsychDS conversion. Records the PsychDS path, original relative path before conversion, original file format, DataCheck classification type, experimental group, data granularity, and whether the file has been ground-truth validated.

### `_meta`

A key–value store for system-level metadata: `last_indexed` (UTC timestamp of the last completed index build) and `pipeline_version` (DataCheck version used to produce the corpus).

---

## Search and Retrieval

PsychTrove exposes two distinct search endpoints: a paper-level search for locating repositories by metadata, and a variable-level full-text search for locating specific constructs across the entire corpus.

### Paper-Level Search

The `/papers` endpoint supports substring search across paper metadata. A query parameter `q` is matched case-insensitively (`ILIKE`) against four fields simultaneously: `title`, `description`, `keywords`, and `authors`. A match against any one field includes the paper in the result set. Two boolean filters compose with the query: `has_labels` restricts results to papers with at least one labelled variable (evaluated as an `EXISTS` subquery over the `variables` table), and `has_ground_truth` restricts to papers flagged as manually validated.

Each result row is enriched with three aggregate fields computed inline: the total number of variables across the paper, the number of labelled variables, and the maximum participant N observed across the paper's variables. Results are ordered by paper title and paginated with `limit`/`offset` (default 50, maximum 500). The total match count is returned alongside the page.

### Variable-Level Full-Text Search

Variable search is performed using PostgreSQL's `websearch_to_tsquery` function, which accepts natural-language queries including quoted phrases, negations, and implicit AND between terms. Search results are ranked by `ts_rank` over the weighted `search_vector`. The search endpoint accepts a required query parameter `q` and returns paginated results with a total count.

### Composable Filters

The search endpoint supports the following filters, all composable with the full-text query:

| Filter | Description |
|---|---|
| `col_type` | One or more variable types (comma-separated) |
| `has_description` | Restrict to variables that have / do not have a label |
| `paper_id` | Restrict to variables from one repository |
| `paper_q` | Substring filter on the paper title |
| `min_n` | Minimum non-missing observation count |

Filters are applied as additional `WHERE` clauses on the same query. Results are sortable by variable name, description, type, paper title, N, mean, or standard deviation, with configurable direction and `NULLS LAST` behaviour.

### Pagination

Results are returned in pages using `limit`/`offset`. Default page size is 50 results; the endpoint accepts values between 1 and 500. The frontend resets to page 1 whenever the query, filters, sort column, sort direction, or page size changes.

---

## Variable Detail and Sidecar Resolution

Each variable record links to its source file within the PsychDS directory. When a researcher opens the detail view for a variable, the backend resolves the JSON sidecar file for the source data file. Sidecar files follow the PsychDS convention of a JSON file with the same stem as the data file, located in the `data/` subdirectory of the study group. The sidecar contains original file metadata (relative path before conversion, format, size in bytes, data granularity) and conversion metadata (encoding normalisation flag, rows and columns written, read method). It also carries the full `variableMeasured` array for that source file, which PsychTrove uses to display all sibling variables that co-occur in the same data file.

The sidecar lookup follows a three-step resolution strategy: an exact slug-based filename match is tried first; if that fails, a single-candidate fallback is used if only one sidecar exists in the data directory; finally, a scan of all sidecars comparing the `rel_path` field is performed.

---

## Download System

PsychTrove supports downloading one or more study-group archives as streaming ZIP files. Downloads are implemented using `zipstream-ng`, which generates ZIP archives incrementally as a byte stream; the full archive is never buffered in memory on the server.

Each archive includes a `MANIFEST.csv` generated at request time, listing every file in the archive with its original relative path, DataCheck classification type, and data granularity. Before confirming a download, the frontend calls a pre-flight endpoint that returns the estimated file count and total size in bytes, which is displayed to the researcher in a confirmation popover.

---

## Frontend Design

### Application Structure

The frontend is a single-page application with two primary views, toggled via a tab bar:

- **Papers view**: a scrollable list of all indexed repositories with key metadata (authors, variable count, estimated participant N). Selecting a paper opens a detail panel showing study groups, variable tables filtered by type, a provenance table, and a download button.
- **Variables view**: a corpus-wide full-text search interface for discovering variables across all repositories simultaneously. Results are shown in a sortable, paginated table. Clicking a variable opens a detail modal.

### Startup Loading Screen

On initial load, the frontend polls the `/health` endpoint every two seconds. While the backend is indexing, a loading screen is shown with an explanation of the indexing process. Once `indexed: true` is returned, the application renders.

### Pipeline Transparency Panel

A collapsible panel in the interface exposes DataCheck's decision provenance for every file in the selected study group. This includes the classification type, classification source (`llm`, `aggregate_llm`, `rule_folder`, `rmd_pair_rule`), experimental group, data granularity, and granularity source. The panel is derived directly from the `provenance` table and surfaces the same fields recorded in DataCheck's `structure.csv`.

### Variable Detail Modal

Clicking any variable opens a modal containing: the full label, column type badge, sample values, descriptive statistics in a grid layout (mean, SD, SE, median, quartiles, IQR, skewness, kurtosis), and a list of sibling variables that appear in the same source file. A provenance entry links back to the DataCheck sidecar metadata for the source file.

### Interaction Features

The search interface includes a 300 ms debounce on the query input. Filters for variable type, minimum observation count, and label presence are composable and update results without a page reload. A light/dark theme toggle is provided, with the preference persisted via a custom React hook.

---

## Design Constraints and Non-Goals

PsychTrove is a local deployment tool rather than a public web service. No authentication, user management, or multi-tenancy is implemented. The backend accepts cross-origin requests from any origin, appropriate for a local-network tool but not for public deployment without additional hardening.

The mounted PsychDS directory is never written to by any component of PsychTrove. All indexing reads source files and writes exclusively to the PostgreSQL database.
