"""
Build the SQLite index from the psychds/ directory tree.

Walks all discovered study directories, parses JSON files,
inserts rows into all tables, then populates the FTS5 virtual table.
"""

import json
import logging
import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from config import INDEX_MAX_WORKERS, PSYCHDS_DIR
from db.schema import init_db
from indexer.discovery import discover_study_dirs
from indexer.parsers import parse_dataset_description, parse_provenance

logger = logging.getLogger(__name__)

# Shared index state
_indexed = False
_indexing = False


def is_indexed() -> bool:
    return _indexed


def is_indexing() -> bool:
    return _indexing


def _insert_or_update_paper(conn: sqlite3.Connection, paper_meta: dict) -> None:
    conn.execute(
        """
        INSERT INTO papers (paper_id, title, description, authors, doi, keywords,
                            conversion_date, pipeline_version)
        VALUES (:paper_id, :title, :description, :authors, :doi, :keywords,
                :conversion_date, :pipeline_version)
        ON CONFLICT(paper_id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            authors = excluded.authors,
            doi = excluded.doi,
            keywords = excluded.keywords,
            conversion_date = coalesce(excluded.conversion_date, papers.conversion_date),
            pipeline_version = coalesce(excluded.pipeline_version, papers.pipeline_version)
        """,
        paper_meta,
    )


def _insert_study_group(
    conn: sqlite3.Connection, paper_id: str, study_group: str,
    study_dir_name: str, study_meta: dict, has_gt: int,
    n_variables: int, n_labelled_csv: int,
) -> int:
    cur = conn.execute(
        """
        INSERT INTO study_groups (
            paper_id, study_group, study_dir, title, description,
            index_success, codebook_success, n_files_total, n_data_files,
            n_columns, n_labelled_columns, label_status,
            has_ground_truth, n_variables, n_labelled_csv
        ) VALUES (
            :paper_id, :study_group, :study_dir, :title, :description,
            :index_success, :codebook_success, :n_files_total, :n_data_files,
            :n_columns, :n_labelled_columns, :label_status,
            :has_ground_truth, :n_variables, :n_labelled_csv
        )
        ON CONFLICT(paper_id, study_group) DO UPDATE SET
            study_dir = excluded.study_dir,
            title = excluded.title,
            description = excluded.description,
            index_success = excluded.index_success,
            codebook_success = excluded.codebook_success,
            n_files_total = excluded.n_files_total,
            n_data_files = excluded.n_data_files,
            n_columns = excluded.n_columns,
            n_labelled_columns = excluded.n_labelled_columns,
            label_status = excluded.label_status,
            has_ground_truth = excluded.has_ground_truth,
            n_variables = excluded.n_variables,
            n_labelled_csv = excluded.n_labelled_csv
        """,
        {
            "paper_id": paper_id,
            "study_group": study_group,
            "study_dir": study_dir_name,
            "title": study_meta.get("title"),
            "description": study_meta.get("description"),
            "index_success": study_meta.get("index_success", 0),
            "codebook_success": study_meta.get("codebook_success", 0),
            "n_files_total": study_meta.get("n_files_total"),
            "n_data_files": study_meta.get("n_data_files"),
            "n_columns": study_meta.get("n_columns"),
            "n_labelled_columns": study_meta.get("n_labelled_columns", 0),
            "label_status": study_meta.get("label_status"),
            "has_ground_truth": has_gt,
            "n_variables": n_variables,
            "n_labelled_csv": n_labelled_csv,
        },
    )
    # Fetch the actual row id (INSERT OR UPDATE doesn't return lastrowid on conflict)
    row = conn.execute(
        "SELECT id FROM study_groups WHERE paper_id=? AND study_group=?",
        (paper_id, study_group),
    ).fetchone()
    return row["id"]


def _process_study_dir(
    paper_id: str, study_group: str, study_path: Path
) -> dict | None:
    """Parse one study directory. Returns parsed data or None on failure."""
    desc_file = study_path / "dataset_description.json"
    if not desc_file.exists():
        return None

    parsed = parse_dataset_description(desc_file)
    if not parsed:
        return None

    prov_file = study_path / "provenance.json"
    provenance = parse_provenance(prov_file) if prov_file.exists() else []

    has_gt = 1 if any(p.get("ground_truth_validated") for p in provenance) else 0

    return {
        "paper_id": paper_id,
        "study_group": study_group,
        "study_dir_name": study_path.name,
        "paper_meta": parsed["paper_meta"],
        "study_meta": parsed["study_meta"],
        "variables": parsed["variables"],
        "provenance": provenance,
        "has_gt": has_gt,
    }


def build_index(psychds_dir: str = PSYCHDS_DIR) -> None:
    """
    Full index rebuild. Blocks until complete.
    Updates _indexed/_indexing global state.
    """
    global _indexed, _indexing

    _indexing = True
    _indexed = False

    try:
        logger.info("Starting index build from %s", psychds_dir)
        conn = init_db()

        # Clear existing data
        # FTS5 content tables require the special delete-all command
        try:
            conn.execute("INSERT INTO variables_fts(variables_fts) VALUES('delete-all')")
        except Exception:
            # Table may not exist yet on first run — safe to ignore
            pass
        conn.execute("DELETE FROM provenance")
        conn.execute("DELETE FROM variables")
        conn.execute("DELETE FROM study_groups")
        conn.execute("DELETE FROM papers")
        conn.execute("DELETE FROM _meta")
        conn.commit()

        study_dirs = discover_study_dirs(psychds_dir)
        logger.info("Processing %d study directories", len(study_dirs))

        # Parse files in parallel (I/O bound)
        parsed_results = []
        with ThreadPoolExecutor(max_workers=INDEX_MAX_WORKERS) as executor:
            futures = {
                executor.submit(_process_study_dir, pid, sg, sp): (pid, sg)
                for pid, sg, sp in study_dirs
            }
            for future in as_completed(futures):
                pid, sg = futures[future]
                try:
                    result = future.result()
                    if result:
                        parsed_results.append(result)
                except Exception as e:
                    logger.error("Error processing %s/%s: %s", pid, sg, e)

        # Single-threaded SQLite writes
        pipeline_version = None
        for result in parsed_results:
            paper_id = result["paper_id"]
            study_group = result["study_group"]
            paper_meta = result["paper_meta"]

            # paper_id must stay as string
            paper_meta["paper_id"] = str(paper_meta["paper_id"])

            _insert_or_update_paper(conn, paper_meta)

            n_vars = len(result["variables"])
            n_labelled = sum(
                1 for v in result["variables"] if v.get("description")
            )
            sg_id = _insert_study_group(
                conn,
                paper_id=paper_id,
                study_group=study_group,
                study_dir_name=result["study_dir_name"],
                study_meta=result["study_meta"],
                has_gt=result["has_gt"],
                n_variables=n_vars,
                n_labelled_csv=n_labelled,
            )

            # Insert variables (skip entries with null/empty name)
            for var in result["variables"]:
                if not var.get("name"):
                    continue
                conn.execute(
                    """
                    INSERT INTO variables (
                        paper_id, study_group_id, name, description, col_type,
                        source_file, sample_values, value_pattern,
                        min_value, max_value,
                        stat_n, stat_n_missing, stat_mean, stat_sd, stat_se,
                        stat_median, stat_p25, stat_p75, stat_iqr,
                        stat_skewness, stat_kurtosis
                    ) VALUES (
                        :paper_id, :study_group_id, :name, :description, :col_type,
                        :source_file, :sample_values, :value_pattern,
                        :min_value, :max_value,
                        :stat_n, :stat_n_missing, :stat_mean, :stat_sd, :stat_se,
                        :stat_median, :stat_p25, :stat_p75, :stat_iqr,
                        :stat_skewness, :stat_kurtosis
                    )
                    """,
                    {**var, "paper_id": paper_id, "study_group_id": sg_id},
                )

            # Insert provenance
            for prov in result["provenance"]:
                conn.execute(
                    """
                    INSERT INTO provenance (
                        study_group_id, psychds_path, original_rel_path,
                        original_format, pipeline_type, pipeline_group,
                        pipeline_data_granularity, ground_truth_validated,
                        txt_extraction_attempted, txt_extraction_skipped,
                        txt_skip_reason, txt_psychds_path
                    ) VALUES (
                        :study_group_id, :psychds_path, :original_rel_path,
                        :original_format, :pipeline_type, :pipeline_group,
                        :pipeline_data_granularity, :ground_truth_validated,
                        :txt_extraction_attempted, :txt_extraction_skipped,
                        :txt_skip_reason, :txt_psychds_path
                    )
                    """,
                    {**prov, "study_group_id": sg_id},
                )

            if paper_meta.get("pipeline_version") and not pipeline_version:
                pipeline_version = paper_meta["pipeline_version"]

        conn.commit()

        # Update paper n_study_groups
        conn.execute(
            """
            UPDATE papers SET n_study_groups = (
                SELECT COUNT(*) FROM study_groups WHERE study_groups.paper_id = papers.paper_id
            )
            """
        )

        # Update paper has_ground_truth
        conn.execute(
            """
            UPDATE papers SET has_ground_truth = (
                SELECT MAX(has_ground_truth) FROM study_groups
                WHERE study_groups.paper_id = papers.paper_id
            )
            """
        )

        # Populate FTS5
        conn.execute(
            """
            INSERT INTO variables_fts (variable_id, name, description, sample_values)
            SELECT id, name, description, sample_values FROM variables
            """
        )

        # Update _meta
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_indexed', ?)", (now,)
        )
        if pipeline_version:
            conn.execute(
                "INSERT OR REPLACE INTO _meta (key, value) VALUES ('pipeline_version', ?)",
                (pipeline_version,),
            )

        conn.commit()
        conn.close()

        n_papers = len({r["paper_id"] for r in parsed_results})
        n_study_groups = len(parsed_results)
        n_variables = sum(len(r["variables"]) for r in parsed_results)
        logger.info(
            "Index complete: %d papers, %d study groups, %d variables",
            n_papers, n_study_groups, n_variables,
        )

        _indexed = True

    except Exception as e:
        logger.error("Index build failed: %s", e, exc_info=True)
        raise
    finally:
        _indexing = False
