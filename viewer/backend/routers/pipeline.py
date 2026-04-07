from fastapi import APIRouter

router = APIRouter()

PIPELINE_STAGES = [
    {
        "id": "osf_download",
        "name": "OSF Download",
        "description": "Files are downloaded from the Open Science Framework (OSF) repository associated with the paper's DOI. The download is limited to 10 GB. All file types are downloaded regardless of content.",
        "outputs": ["data/<paper_id>/"],
    },
    {
        "id": "archive_unpack",
        "name": "Archive Unpacking",
        "description": "ZIP, TAR, TGZ, GZ, BZ2, and XZ archives are unpacked recursively. Standalone compressed files (.gz, .bz2, .xz) are treated as single compressed files, not tar archives.",
        "outputs": ["data/<paper_id>/"],
    },
    {
        "id": "file_classification",
        "name": "LLM File Classification",
        "description": "Each file path is classified into a type (data/codebook/code/software/output/supplemental/readme/asset/other) and assigned to an experiment group (ex1, ex2, shared, etc.) by a local LLM (batches of 20 paths). Folders with more than 50 files are treated as aggregate folders and classified via a second-pass sentinel prompt.",
        "outputs": ["outputs/<paper_id>/structure.csv"],
    },
    {
        "id": "ground_truth_override",
        "name": "Manual Ground Truth Override",
        "description": "After LLM classification, a human annotator may review file types and groups using the validation GUI. Ground truth entries override LLM classifications. The 'ground_truth_validated' flag in provenance.json indicates which files received manual review.",
        "outputs": ["ground_truth/<paper_id>.csv"],
    },
    {
        "id": "column_extraction",
        "name": "Column Extraction and Statistics",
        "description": "Files classified as type=data with data_format=tabular are read (up to 500 MB). Each column is extracted and classified by type using a rule-based system first, then an LLM for ambiguous cases. Descriptive statistics (mean, SD, median, IQR, skewness, kurtosis) are computed for numeric columns.",
        "outputs": ["outputs/<paper_id>/columns.csv"],
    },
    {
        "id": "codebook_labelling",
        "name": "Codebook Labelling",
        "description": "Codebook and README files are parsed to extract variable descriptions. These descriptions are matched to data columns using rule-based string normalization, with an LLM fallback for fuzzy matches. The 'description' field on each variable (when present) came from this stage.",
        "outputs": ["outputs/<paper_id>/labels.csv", "outputs/<paper_id>/codebook_coverage.csv"],
    },
    {
        "id": "psychds_conversion",
        "name": "PsychDS Conversion",
        "description": "The pipeline outputs are reorganized into the Psych-DS 0.1.0 directory structure. Files are assigned to subdirectories (data/, analysis/, documentation/, materials/) by their pipeline type. Tabular data files are normalized to UTF-8 CSV. Variable statistics are written to JSON sidecars. The provenance.json records the original path of every file.",
        "outputs": ["psychds/<paper_id>/"],
    },
]

COL_TYPES = [
    {"value": "continuous", "assigned_by": "Rule or LLM", "description": "Numeric measurement (float or integer with >20 unique values)"},
    {"value": "ordinal", "assigned_by": "LLM", "description": "Ordered integer scale (Likert, rating) with few levels"},
    {"value": "binary", "assigned_by": "Rule", "description": "Exactly two unique non-NA values"},
    {"value": "constant", "assigned_by": "Rule", "description": "Exactly one unique non-NA value"},
    {"value": "categorical", "assigned_by": "LLM", "description": "Unordered group label (condition names, gender codes)"},
    {"value": "date", "assigned_by": "Rule", "description": "Date-parseable values"},
    {"value": "id", "assigned_by": "Rule", "description": "Participant or row identifier (matched by column name pattern)"},
    {"value": "text", "assigned_by": "Rule or LLM", "description": "Free-text or long string values"},
    {"value": "continuous_comma_decimal", "assigned_by": "Rule", "description": "Numeric with comma as decimal separator (≥95% convertible)"},
    {"value": "continuous_outliers_excluded", "assigned_by": "Rule", "description": "Numeric with comma separator but 80–95% convertible"},
    {"value": "empty", "assigned_by": "Rule", "description": "All values are NA"},
    {"value": "unknown", "assigned_by": "LLM", "description": "Genuinely uninformative — cannot be classified"},
    {"value": "llm_error", "assigned_by": "Pipeline", "description": "LLM batch failed on all retries"},
]

FILE_TYPES = [
    {"value": "data", "description": "Research measurements — tabular (CSV, XLSX, SAV, DTA, etc.) or non-tabular (EEG .edf, MATLAB .mat, media)"},
    {"value": "codebook", "description": "Variable dictionary / data dictionary whose primary purpose is describing what variables mean"},
    {"value": "code", "description": "Executable source file: R, Python, MATLAB, SQL, shell scripts, .Rmd, .qmd, .ipynb"},
    {"value": "software", "description": "Experiment software: stimulus delivery tools, compiled binaries, installers, configuration files"},
    {"value": "output", "description": "File produced by executing a script: rendered notebooks, script-generated figures, log files"},
    {"value": "supplemental", "description": "Human-authored research material: manuscripts, preregistrations, survey instruments, consent forms"},
    {"value": "readme", "description": "Files named README.*, LICENSE.*, or CONTRIBUTING.* only"},
    {"value": "asset", "description": "Participant-facing stimuli: images, audio clips, video shown to participants"},
    {"value": "other", "description": "No research content: OS metadata (.DS_Store), environment config"},
    {"value": "llm_error", "description": "LLM classification failed on all retries — type could not be determined"},
]


@router.get("/pipeline/stages")
async def pipeline_stages():
    return {"stages": PIPELINE_STAGES}


@router.get("/pipeline/col_types")
async def pipeline_col_types():
    return {"col_types": COL_TYPES}


@router.get("/pipeline/file_types")
async def pipeline_file_types():
    return {"file_types": FILE_TYPES}
