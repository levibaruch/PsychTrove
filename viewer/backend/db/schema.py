import psycopg2
import psycopg2.extras
from config import DATABASE_URL


CREATE_TABLES = """
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
    id                 SERIAL PRIMARY KEY,
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
    id               SERIAL PRIMARY KEY,
    paper_id         TEXT NOT NULL REFERENCES papers(paper_id),
    study_group_id   INTEGER NOT NULL REFERENCES study_groups(id),
    name             TEXT NOT NULL,
    description      TEXT,
    col_type         TEXT NOT NULL,
    source_file      TEXT NOT NULL,
    sample_values    TEXT,
    value_pattern    TEXT,
    min_value        DOUBLE PRECISION,
    max_value        DOUBLE PRECISION,
    stat_n           INTEGER,
    stat_n_missing   INTEGER,
    stat_mean        DOUBLE PRECISION,
    stat_sd          DOUBLE PRECISION,
    stat_se          DOUBLE PRECISION,
    stat_median      DOUBLE PRECISION,
    stat_p25         DOUBLE PRECISION,
    stat_p75         DOUBLE PRECISION,
    stat_iqr         DOUBLE PRECISION,
    stat_skewness    DOUBLE PRECISION,
    stat_kurtosis    DOUBLE PRECISION,
    search_vector    tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(sample_values, '')), 'C')
    ) STORED
);

CREATE TABLE IF NOT EXISTS provenance (
    id                         SERIAL PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_papers_has_ground_truth ON papers(has_ground_truth);
CREATE INDEX IF NOT EXISTS idx_study_groups_paper_id ON study_groups(paper_id);
CREATE INDEX IF NOT EXISTS idx_variables_paper_id ON variables(paper_id);
CREATE INDEX IF NOT EXISTS idx_variables_study_group_id ON variables(study_group_id);
CREATE INDEX IF NOT EXISTS idx_variables_col_type ON variables(col_type);
CREATE INDEX IF NOT EXISTS idx_variables_name ON variables(md5(name));
CREATE INDEX IF NOT EXISTS idx_variables_search_vector ON variables USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_provenance_study_group_id ON provenance(study_group_id);
CREATE INDEX IF NOT EXISTS idx_provenance_pipeline_type ON provenance(pipeline_type);
"""


def init_db(database_url: str = DATABASE_URL) -> psycopg2.extensions.connection:
    conn = psycopg2.connect(database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    with conn.cursor() as cur:
        for statement in CREATE_TABLES.split(";"):
            stmt = statement.strip()
            if stmt:
                cur.execute(stmt)
    conn.commit()
    return conn


def get_connection(database_url: str = DATABASE_URL) -> psycopg2.extensions.connection:
    conn = psycopg2.connect(database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    return conn
