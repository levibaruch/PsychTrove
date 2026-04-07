import sqlite3
from config import DB_PATH


CREATE_TABLES = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS papers (
    paper_id          TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    description       TEXT,
    authors           TEXT,
    doi               TEXT,
    keywords          TEXT,
    n_study_groups    INTEGER NOT NULL DEFAULT 0,
    has_ground_truth  INTEGER NOT NULL DEFAULT 0,
    conversion_date   TEXT,
    pipeline_version  TEXT
);

CREATE TABLE IF NOT EXISTS study_groups (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id           TEXT NOT NULL REFERENCES papers(paper_id),
    study_group        TEXT NOT NULL,
    study_dir          TEXT NOT NULL,
    title              TEXT,
    description        TEXT,
    index_success      INTEGER NOT NULL DEFAULT 0,
    codebook_success   INTEGER NOT NULL DEFAULT 0,
    n_files_total      INTEGER,
    n_data_files       INTEGER,
    n_columns          INTEGER,
    n_labelled_columns INTEGER NOT NULL DEFAULT 0,
    label_status       TEXT,
    has_ground_truth   INTEGER NOT NULL DEFAULT 0,
    n_variables        INTEGER NOT NULL DEFAULT 0,
    n_labelled_csv     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(paper_id, study_group)
);

CREATE TABLE IF NOT EXISTS variables (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id         TEXT NOT NULL REFERENCES papers(paper_id),
    study_group_id   INTEGER NOT NULL REFERENCES study_groups(id),
    name             TEXT NOT NULL,
    description      TEXT,
    col_type         TEXT NOT NULL,
    source_file      TEXT NOT NULL,
    sample_values    TEXT,
    value_pattern    TEXT,
    min_value        REAL,
    max_value        REAL,
    stat_n           INTEGER,
    stat_n_missing   INTEGER,
    stat_mean        REAL,
    stat_sd          REAL,
    stat_se          REAL,
    stat_median      REAL,
    stat_p25         REAL,
    stat_p75         REAL,
    stat_iqr         REAL,
    stat_skewness    REAL,
    stat_kurtosis    REAL
);

CREATE TABLE IF NOT EXISTS provenance (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    study_group_id             INTEGER NOT NULL REFERENCES study_groups(id),
    psychds_path               TEXT NOT NULL,
    original_rel_path          TEXT,
    original_format            TEXT,
    pipeline_type              TEXT,
    pipeline_group             TEXT,
    pipeline_data_granularity  TEXT,
    ground_truth_validated     INTEGER NOT NULL DEFAULT 0,
    txt_extraction_attempted   INTEGER,
    txt_extraction_skipped     INTEGER,
    txt_skip_reason            TEXT,
    txt_psychds_path           TEXT
);

CREATE TABLE IF NOT EXISTS _meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS variables_fts USING fts5(
    variable_id UNINDEXED,
    name,
    description,
    sample_values,
    content='variables',
    content_rowid='id'
);

CREATE INDEX IF NOT EXISTS idx_papers_has_ground_truth ON papers(has_ground_truth);
CREATE INDEX IF NOT EXISTS idx_study_groups_paper_id ON study_groups(paper_id);
CREATE INDEX IF NOT EXISTS idx_variables_paper_id ON variables(paper_id);
CREATE INDEX IF NOT EXISTS idx_variables_study_group_id ON variables(study_group_id);
CREATE INDEX IF NOT EXISTS idx_variables_col_type ON variables(col_type);
CREATE INDEX IF NOT EXISTS idx_variables_name ON variables(name);
CREATE INDEX IF NOT EXISTS idx_provenance_study_group_id ON provenance(study_group_id);
CREATE INDEX IF NOT EXISTS idx_provenance_pipeline_type ON provenance(pipeline_type);
"""


def init_db(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    for statement in CREATE_TABLES.split(";"):
        stmt = statement.strip()
        if stmt:
            conn.execute(stmt)
    conn.commit()
    return conn


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
