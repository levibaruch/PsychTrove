# Quickstart: PsychDS Dataset Viewer

**Purpose**: Manual validation scenarios to confirm each user story works end-to-end after implementation.

**Prerequisites**:
- Docker and docker-compose installed
- A `psychds/` output directory from the data_check pipeline (or a minimal mock — see §Mock Data below)
- Ports 3000 and 8000 available

---

## 0. Start the Stack

```bash
cd viewer/
PSYCHDS_DIR=/path/to/your/psychds docker-compose up --build
```

Expected startup sequence:
1. Backend starts, begins indexing
2. `GET http://localhost:8000/health` returns `503 {"status":"indexing"}` during build
3. After indexing completes, health returns `200 {"ok":true,"indexed":true}`
4. Frontend starts, polls `/health`, transitions from loading screen to main UI

**Verify health endpoint**:
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","indexed":true}
```

**Verify corpus stats**:
```bash
curl http://localhost:8000/api/corpus/stats
# Expected: JSON with n_papers, n_variables, etc.
```

---

## Scenario 1: Browse Papers (User Story 1)

### 1a. Paper list appears

1. Open `http://localhost:3000`
2. Confirm header shows "PsychDS Viewer" with corpus stats (N papers · N variables)
3. Confirm paper list shows at least one paper card with title, authors, N variables

### 1b. Search papers

1. Type a partial paper title into the search box
2. Verify card list filters to matching papers
3. Clear search — verify full list restores

### 1c. Paper detail — Overview tab

1. Click a paper card
2. Verify right panel shows: full title, abstract, DOI link, authors, keywords chips
3. Verify pipeline version and conversion date are shown
4. If paper has `has_ground_truth = true`, verify green "Reviewed" badge appears on card

### 1d. Paper detail — Studies tab

1. Click "Studies" tab
2. Verify each study group row shows: label, index/codebook status icons, N variables, label_status badge
3. Click a study group row to expand it
4. Verify variable table appears with correct columns
5. Verify provenance table appears below variables
6. Verify each variable row shows TypeBadge for col_type
7. Verify provenance rows show TypeBadge for pipeline_type

### 1e. Variable detail modal from Papers view

1. Click any variable row in the variable table
2. Verify modal opens with variable name and col_type badge in header
3. For a continuous variable: verify statistics grid shows N, mean, SD, etc. with "—" for any null stat
4. Click "Provenance" tab in modal
5. Verify source file context block shows original file path, size, conversion method
6. Verify "Sibling variables" shows other columns from the same source file
7. Verify "How was this produced?" shows collapsible pipeline stage cards
8. Press Escape — verify modal closes
9. Click outside modal — verify modal closes

### 1f. All Variables tab

1. Click "All Variables" tab in paper detail
2. Verify merged variable table shows variables from all study groups with a study_group column

---

## Scenario 2: Variable Search (User Story 2)

### 2a. Basic search

1. Click "Variables" tab in the top navigation
2. Verify empty state shows "Search for a variable name or codebook description…"
3. Type `age` in the search bar
4. Verify results appear showing variables named "age" or with "age" in their description
5. Verify matched term is **highlighted** in the Name and Description columns
6. Verify result count shown (e.g. "34 results for 'age'")

### 2b. Filters

1. With `age` results shown, open the col_type dropdown
2. Select `continuous`
3. Verify results are filtered to continuous variables only
4. Check "Has description" checkbox
5. Verify results narrow further to only variables with a codebook label
6. Uncheck "Has description" — verify results expand again

### 2c. Variable detail from Variables view

1. Click any result row
2. Verify variable detail modal opens with the same behavior as Scenario 1e
3. Verify "Paper" column in results table links to the correct paper in the Papers view

### 2d. Zero results state

1. Search for `xxxxxxnotareal` (something with no matches)
2. Verify "No variables found for 'xxxxxxnotareal'. Try a shorter term or remove filters." message appears

---

## Scenario 3: Downloads (User Story 3)

### 3a. Paper download — size confirmation

1. In the paper list, click the ⬇ icon on a paper card (not the card body)
2. Verify a popover appears anchored to the button (not a full modal)
3. Verify popover shows: filename, N files, ~size in MB
4. Verify loading spinner shows while size API is in flight
5. Click Cancel — popover closes with no download

### 3b. Paper download — confirm and receive

1. Click the ⬇ icon on the same paper card
2. Click "Download" in the popover
3. Verify browser begins downloading a `.zip` file
4. Verify the filename is `psychds-<paper_id>.zip`
5. Open the ZIP and verify:
   - `DOWNLOAD_MANIFEST.csv` exists at the root
   - Study group subdirectories are present (not nested ZIPs)
   - `data/raw/` files are included

### 3c. Study group download

1. In the Studies tab of a paper detail, click the per-study-group download button
2. Verify size popover appears for just that study group
3. Confirm download — verify filename is `psychds-<paper_id>-<study_group>.zip`
4. Verify ZIP contains only that study group's files

### 3d. Variable search download

1. Search for `age` in the Variables view
2. Verify "Download all matching data files" button appears (and is enabled because query is non-empty)
3. Click the button
4. Verify confirmation popover shows: N matching variables, N source files, N papers, ~size
5. Verify "Deduplicate files" checkbox is pre-checked
6. Click "Download"
7. Verify browser downloads `variable-search-age.zip`
8. Open ZIP and verify:
   - `MANIFEST.csv` at root
   - CSVs organized as `<paper_id>/<study_dir>/<csv_filename>`
   - Only `source-*_data.csv` files (not raw files)

### 3e. Variable-level download from modal

1. Open variable detail modal for a specific variable
2. Click "Download this data file" in the modal footer
3. Verify download proceeds (with size confirmation)
4. Click "Download all files with this variable" — verify size confirmation step appears for corpus-wide search

---

## Scenario 4: Visual Design & Edge Cases

### 4a. Dark mode

1. Click the light/dark toggle in the header
2. Verify UI switches to dark theme with the specified dark-mode colors
3. Reload the page — verify dark mode preference is preserved

### 4b. Null statistics handled correctly

1. Find a variable with `col_type = "text"` or `"categorical"`
2. Open its variable detail modal
3. Verify statistics section does NOT appear (or shows "—" for all numeric cells)
4. Verify no "null" text or JavaScript errors in the console

### 4c. paper_id leading zeros preserved

1. Find a paper with a `paper_id` starting with `09…` (e.g. `0956797614557867`)
2. Verify it appears correctly in the URL and in all API responses
3. Verify it has not been truncated or converted to a number

### 4d. LLM error rows

1. If any variable has `col_type = "llm_error"`, verify it shows a red error badge
2. If any provenance row has `pipeline_type = "llm_error"`, verify it is highlighted
3. Hover over an LLM error badge — verify tooltip explains the failure

### 4e. Pipeline transparency panel

1. Click the "?" or "About the Pipeline" link in the footer
2. Verify the transparency panel opens
3. Verify the data flow diagram is shown
4. Verify stage cards are present (one per pipeline stage)
5. Verify file types and column types vocabulary tables are expandable

### 4f. Keyboard navigation

1. Tab to the variable table
2. Use arrow keys to navigate rows
3. Press Enter on a row — verify variable detail modal opens
4. Press Escape — verify modal closes and focus returns to the table row

---

## Mock Data Structure (for isolated testing)

If no real `psychds/` directory is available, create a minimal mock:

```
mock-psychds/
  conversion_summary.csv
  0000000000000001/
    study-ex1/
      dataset_description.json
      provenance.json
      data/
        source-testdata_data.csv
        source-testdata_data.json
```

**`conversion_summary.csv`** (minimal, 2 rows):
```csv
paper_id,study_group,success,error,n_data_files,n_raw_files,n_variables,n_labelled,has_paper_metadata,has_ground_truth,output_path
0000000000000001,ex1,TRUE,,1,0,3,1,FALSE,FALSE,/data/psychds/0000000000000001
```

**`dataset_description.json`** (minimal):
```json
{
  "@context": "https://schema.org/",
  "schema:name": "Test Paper: Age and Score Study",
  "schema:description": "A minimal test dataset for viewer validation.",
  "schema:author": [{"schema:name": "Smith A"}, {"schema:name": "Jones B"}],
  "schema:identifier": "https://doi.org/10.0000/test",
  "schema:keywords": ["test", "validation"],
  "metacheck:paper_id": "0000000000000001",
  "metacheck:study_group": "ex1",
  "metacheck:pipeline_version": "021",
  "metacheck:conversion_date": "2026-04-07",
  "metacheck:source_repository": {"platform": "osf", "download_path": "data/0000000000000001/"},
  "metacheck:pipeline_status": {
    "index_success": true,
    "codebook_success": true,
    "n_files_total": 1,
    "n_data_files": 1,
    "n_columns": 3,
    "n_labelled_columns": 1,
    "label_status": "ok"
  },
  "schema:variableMeasured": [
    {
      "@type": "PropertyValue",
      "name": "participant_id",
      "metacheck:col_type": "id",
      "metacheck:source_file": "test_data.csv",
      "metacheck:sample_values": "1 | 2 | 3 | 4 | 5"
    },
    {
      "@type": "PropertyValue",
      "name": "age",
      "description": "Participant age in years",
      "minValue": 18,
      "maxValue": 35,
      "metacheck:col_type": "continuous",
      "metacheck:source_file": "test_data.csv",
      "metacheck:sample_values": "19 | 22 | 21 | 20 | 23",
      "metacheck:statistics": {
        "n": 30, "n_missing": 0, "mean": 23.1, "sd": 4.2,
        "se": 0.77, "median": 23, "p25": 20, "p75": 26,
        "iqr": 6, "skewness": 0.2, "kurtosis": -0.5
      }
    },
    {
      "@type": "PropertyValue",
      "name": "condition",
      "metacheck:col_type": "categorical",
      "metacheck:source_file": "test_data.csv",
      "metacheck:sample_values": "control | treatment"
    }
  ]
}
```

**`provenance.json`** (minimal):
```json
{
  "file_provenance": [
    {
      "psychds_path": "data/source-testdata_data.csv",
      "original_rel_path": "Study_1/test_data.csv",
      "original_format": "csv",
      "pipeline_type": "data",
      "pipeline_group": "ex1",
      "pipeline_data_granularity": "individual",
      "ground_truth_validated": false
    }
  ]
}
```
