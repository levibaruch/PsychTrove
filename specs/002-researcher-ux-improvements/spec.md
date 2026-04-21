# Feature Specification: Researcher UX Improvements

**Feature Branch**: `002-researcher-ux-improvements`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "Researcher UX improvements for PsychTrove: better sample size visibility on paper cards, within-paper variable search/filter, prominent study descriptions, N column prominence in variable search, multi-select batch download, group-by-paper variable results, min/max N filter for meta-analysis workflows"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sample Size Visible Without Clicking (Priority: P1)

A psychological researcher scanning the corpus for meta-analysis needs to quickly identify studies with sufficient sample sizes. Currently they must click into each paper, navigate to a study group, and find the N column in a variable table. This story surfaces approximate participant counts directly on paper cards.

**Why this priority**: Sample size is the single most critical inclusion criterion for meta-analysis. Without it, the paper list is nearly useless for screening purposes.

**Independent Test**: Open the paper list. Each paper card visibly shows an approximate participant count without any additional clicks. Delivers value immediately as a standalone improvement.

**Acceptance Scenarios**:

1. **Given** a paper list is loaded, **When** a researcher views any paper card, **Then** an approximate participant count (derived from the maximum `stat_n` across that paper's variables) is displayed on the card
2. **Given** a paper has no variables with `stat_n` data, **When** the card is rendered, **Then** the N field is omitted or shown as "N unknown" rather than crashing or showing 0
3. **Given** a researcher wants to sort papers, **When** they sort by participant count, **Then** papers reorder correctly from highest to lowest (or vice versa)

---

### User Story 2 — Search Variables Within a Paper (Priority: P1)

A researcher has selected a paper with 200+ variables and wants to find all depression-related measures. The current "All Variables" tab dumps every variable with no filter, making it unusable for large datasets.

**Why this priority**: Papers with many variables are inaccessible without this. Directly affects core use case of finding specific constructs within a dataset.

**Independent Test**: Open a paper with >50 variables. Type "age" into a filter box. Only age-related variables remain visible. Works fully standalone.

**Acceptance Scenarios**:

1. **Given** a paper's All Variables tab is open, **When** a researcher types text into a filter input, **Then** the variable table immediately shows only rows where name or description matches the text
2. **Given** a filter is active, **When** the researcher clears the input, **Then** all variables are restored
3. **Given** a filter is active with no matches, **When** the table updates, **Then** a "no matching variables" message is shown rather than an empty table
4. **Given** a filter is active, **When** the researcher also selects a column type filter, **Then** both filters apply simultaneously (AND logic)

---

### User Story 3 — Study Descriptions Visible at a Glance (Priority: P2)

A researcher viewing a paper's Studies tab sees "Study EX1", "Study EX2", "Study EX3" with no indication of what distinguishes them. They must expand each row to find the description. This story surfaces study descriptions as visible subtitles under each study name.

**Why this priority**: Understanding what each study measured or how it differed is essential before deciding which studies to include in a meta-analysis.

**Independent Test**: Open any multi-study paper's Studies tab. Each study row shows its description as a subtitle without needing to expand. Standalone value delivered.

**Acceptance Scenarios**:

1. **Given** a study group has a non-null description, **When** the Studies tab renders, **Then** the description appears as a subtitle beneath the study group name, truncated to 2 lines with tooltip showing full text
2. **Given** a study group has no description, **When** the Studies tab renders, **Then** no subtitle area is shown (graceful absence, not empty space)

---

### User Story 4 — Filter Variable Search by Minimum Sample Size (Priority: P2)

A researcher doing meta-analysis only wants to find variables from studies with N ≥ 100. Currently there is no way to filter by sample size in the variable search view.

**Why this priority**: Meta-analysis always requires minimum N thresholds. Without this filter, researchers must manually inspect every result.

**Independent Test**: In variable search, set min N = 100 and search "anxiety". Only variables where `stat_n >= 100` are returned. Works as a standalone filter addition.

**Acceptance Scenarios**:

1. **Given** the variable search view is open, **When** a researcher enters a minimum N value, **Then** only variables with `stat_n` at or above that threshold are returned
2. **Given** a min N filter is set, **When** a variable has no `stat_n` data (NULL), **Then** it is excluded from results (unknown N treated as not meeting threshold)
3. **Given** both a min N and a search query are active, **When** results load, **Then** both constraints apply simultaneously

---

### User Story 5 — Multi-Select Papers for Batch Download (Priority: P3)

A researcher who has identified 15 relevant papers needs to download all of them. Currently this requires 15 separate download actions. This story adds a multi-select system and single "Download Selected" action.

**Why this priority**: Workflow-critical for meta-analysis but requires more UI complexity than other stories, hence P3.

**Independent Test**: Select 3 paper checkboxes. Click "Download Selected (3)". A single ZIP containing all three papers' data is downloaded. Standalone workflow improvement.

**Acceptance Scenarios**:

1. **Given** the paper list is loaded, **When** a researcher checks a paper's checkbox, **Then** the paper is added to a selection and a "Download Selected (N)" button appears in the header
2. **Given** multiple papers are selected, **When** the researcher clicks "Download Selected", **Then** a size confirmation popover appears showing total files and bytes, then proceeds to download all selected papers
3. **Given** papers are selected, **When** the researcher clears selection or clicks "Deselect All", **Then** the selection is cleared and the Download Selected button disappears
4. **Given** a researcher clicks "Select All", **When** visible papers are highlighted, **Then** all currently loaded papers are selected

---

### Edge Cases

- What if `stat_n` varies wildly across variables in a paper (e.g., 10 for some, 800 for others)? Show the maximum as "up to N participants" with a tooltip explaining it is the largest observed N across variables.
- What if a researcher sets min N = 0 or leaves it blank? Treat as no filter applied (show all results).
- What if a batch download includes papers totalling several GB? Show the size estimate prominently with a warning if over 500MB.
- What if a study has no description and no title beyond "Study EX1"? Render the study group name only, no empty subtitle space.
- What if a within-paper filter matches 0 variables? Show a clear "No variables match your filter" message, not a blank table.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Paper cards MUST display an approximate participant count derived from the maximum `stat_n` value across all variables belonging to that paper
- **FR-002**: Paper list MUST support sorting by participant count (ascending and descending)
- **FR-003**: The All Variables tab within a paper detail view MUST include a text filter input that filters variables by name and description in real time (client-side, no additional server requests)
- **FR-004**: The All Variables tab filter MUST support simultaneous application with column-type filtering (AND logic)
- **FR-005**: Study group rows in the Studies tab MUST display the study description as a visible subtitle (truncated at 2 lines) without requiring row expansion
- **FR-006**: Variable search MUST accept an optional minimum sample size (N) parameter that excludes variables with `stat_n` below the threshold or with NULL `stat_n`
- **FR-007**: Paper cards MUST include a checkbox for multi-select
- **FR-008**: When one or more papers are selected, a "Download Selected (N)" button MUST appear in the paper list header area
- **FR-009**: The batch download flow MUST show a size confirmation (total files and bytes) before initiating
- **FR-010**: The backend variable search endpoint MUST accept `min_n` as an optional query parameter

### Key Entities

- **Paper card**: The list-item component for a paper; gains participant count display and selection checkbox
- **Variable filter state**: Client-side filter for the All Variables tab; holds text query and col_type, applied together
- **Selection set**: Client-side collection of selected paper IDs; drives batch download button visibility and action
- **Participant count**: Approximate value derived from MAX(stat_n) across a paper's variables, surfaced via the papers API response

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A researcher can identify whether a paper meets a minimum N threshold without clicking into it — verifiable by confirming participant count is visible on the paper card
- **SC-002**: A researcher can locate a specific variable within a 200-variable paper in under 10 seconds using the within-paper filter
- **SC-003**: A researcher can initiate download of 10 selected papers in a single action rather than 10 separate actions
- **SC-004**: Variable search with a minimum N of 100 returns zero results where any returned variable has `stat_n < 100`
- **SC-005**: Study descriptions are visible on the Studies tab without any expand or click interaction

## Assumptions

- Participant count approximation uses MAX(stat_n) across a paper's variables; this is a known approximation and will be labelled accordingly in the UI (e.g. "up to N participants")
- Papers with no `stat_n` data show "N unknown" rather than 0
- Batch download triggers sequential individual paper downloads client-side; no new backend batch endpoint is required for this iteration
- Within-paper variable filtering is client-side only; no backend pagination change is required since variable counts per paper are manageable in memory
- Mobile layout for checkbox and batch download interaction is out of scope for this iteration (desktop-first)
- The backend already returns all variables for a paper in the detail response; no new endpoint is needed to support within-paper filtering
- The papers list API response will be extended to include a `max_participant_n` field computed server-side
