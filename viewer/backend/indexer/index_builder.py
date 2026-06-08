"""
Build the PostgreSQL index from the psychds/ directory tree.

Walks all discovered study directories, parses JSON files,
inserts rows into all tables, then updates FTS tsvector index.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from config import INDEX_MAX_WORKERS, PSYCHDS_DIR
from db.schema import init_db
from indexer.discovery import discover_study_dirs
from indexer.parsers import parse_dataset_description, parse_provenance

logger = logging.getLogger(__name__)

_indexed = False
_indexing = False


def is_indexed() -> bool:
    return _indexed


def is_indexing() -> bool:
    return _indexing


def _insert_or_update_paper(cur, paper_meta: dict) -> None:
    cur.execute(
        """
        INSERT INTO papers (paper_id, title, description, authors, doi, keywords,
                            journal, publication_year, volume, issue, pagination,
                            conversion_date, pipeline_version)
        VALUES (%(paper_id)s, %(title)s, %(description)s, %(authors)s, %(doi)s,
                %(keywords)s, %(journal)s, %(publication_year)s, %(volume)s,
                %(issue)s, %(pagination)s, %(conversion_date)s, %(pipeline_version)s)
        ON CONFLICT(paper_id) DO UPDATE SET
            title             = EXCLUDED.title,
            description       = EXCLUDED.description,
            authors           = COALESCE(EXCLUDED.authors, papers.authors),
            doi               = COALESCE(EXCLUDED.doi, papers.doi),
            keywords          = COALESCE(EXCLUDED.keywords, papers.keywords),
            journal           = COALESCE(EXCLUDED.journal, papers.journal),
            publication_year  = COALESCE(EXCLUDED.publication_year, papers.publication_year),
            volume            = COALESCE(EXCLUDED.volume, papers.volume),
            issue             = COALESCE(EXCLUDED.issue, papers.issue),
            pagination        = COALESCE(EXCLUDED.pagination, papers.pagination),
            conversion_date   = COALESCE(EXCLUDED.conversion_date, papers.conversion_date),
            pipeline_version  = COALESCE(EXCLUDED.pipeline_version, papers.pipeline_version)
        """,
        paper_meta,
    )


def _insert_study_group(
    cur,
    paper_id: str,
    study_group: str,
    study_dir_name: str,
    study_meta: dict,
    has_gt: int,
    n_variables: int,
    n_labelled_csv: int,
) -> int:
    cur.execute(
        """
        INSERT INTO study_groups (
            paper_id, study_group, study_dir, title, description,
            index_success, codebook_success, n_files_total, n_data_files,
            n_columns, n_labelled_columns, label_status,
            has_ground_truth, n_variables, n_labelled_csv
        ) VALUES (
            %(paper_id)s, %(study_group)s, %(study_dir)s, %(title)s, %(description)s,
            %(index_success)s, %(codebook_success)s, %(n_files_total)s, %(n_data_files)s,
            %(n_columns)s, %(n_labelled_columns)s, %(label_status)s,
            %(has_ground_truth)s, %(n_variables)s, %(n_labelled_csv)s
        )
        ON CONFLICT(paper_id, study_group) DO UPDATE SET
            study_dir          = EXCLUDED.study_dir,
            title              = EXCLUDED.title,
            description        = EXCLUDED.description,
            index_success      = EXCLUDED.index_success,
            codebook_success   = EXCLUDED.codebook_success,
            n_files_total      = EXCLUDED.n_files_total,
            n_data_files       = EXCLUDED.n_data_files,
            n_columns          = EXCLUDED.n_columns,
            n_labelled_columns = EXCLUDED.n_labelled_columns,
            label_status       = EXCLUDED.label_status,
            has_ground_truth   = EXCLUDED.has_ground_truth,
            n_variables        = EXCLUDED.n_variables,
            n_labelled_csv     = EXCLUDED.n_labelled_csv
        RETURNING id
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
    row = cur.fetchone()
    if row:
        return row["id"]
    # ON CONFLICT path may not return — fetch explicitly
    cur.execute(
        "SELECT id FROM study_groups WHERE paper_id=%s AND study_group=%s",
        (paper_id, study_group),
    )
    return cur.fetchone()["id"]


def _process_study_dir(
    paper_id: str, study_group: str, study_path: Path
) -> dict | None:
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
    global _indexed, _indexing

    _indexing = True
    _indexed = False

    try:
        logger.info("Starting index build from %s", psychds_dir)
        conn = init_db()
        cur = conn.cursor()

        # Clear existing data
        cur.execute("DELETE FROM provenance")
        cur.execute("DELETE FROM variables")
        cur.execute("DELETE FROM study_groups")
        cur.execute("DELETE FROM papers")
        cur.execute("DELETE FROM _meta")
        conn.commit()

        study_dirs = discover_study_dirs(psychds_dir)
        logger.info("Processing %d study directories", len(study_dirs))

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

        pipeline_version = None
        for result in parsed_results:
            paper_id = str(result["paper_id"])
            study_group = result["study_group"]
            paper_meta = result["paper_meta"]
            paper_meta["paper_id"] = paper_id

            _insert_or_update_paper(cur, paper_meta)

            n_vars = len(result["variables"])
            n_labelled = sum(1 for v in result["variables"] if v.get("description"))
            sg_id = _insert_study_group(
                cur,
                paper_id=paper_id,
                study_group=study_group,
                study_dir_name=result["study_dir_name"],
                study_meta=result["study_meta"],
                has_gt=result["has_gt"],
                n_variables=n_vars,
                n_labelled_csv=n_labelled,
            )

            for var in result["variables"]:
                if not var.get("name"):
                    continue
                cur.execute(
                    """
                    INSERT INTO variables (
                        paper_id, study_group_id, name, description, col_type,
                        source_file, sample_values, value_pattern,
                        min_value, max_value,
                        stat_n, stat_n_missing, stat_mean, stat_sd, stat_se,
                        stat_median, stat_p25, stat_p75, stat_iqr,
                        stat_skewness, stat_kurtosis
                    ) VALUES (
                        %(paper_id)s, %(study_group_id)s, %(name)s, %(description)s,
                        %(col_type)s, %(source_file)s, %(sample_values)s, %(value_pattern)s,
                        %(min_value)s, %(max_value)s,
                        %(stat_n)s, %(stat_n_missing)s, %(stat_mean)s, %(stat_sd)s,
                        %(stat_se)s, %(stat_median)s, %(stat_p25)s, %(stat_p75)s,
                        %(stat_iqr)s, %(stat_skewness)s, %(stat_kurtosis)s
                    )
                    """,
                    {**var, "paper_id": paper_id, "study_group_id": sg_id},
                )

            for prov in result["provenance"]:
                cur.execute(
                    """
                    INSERT INTO provenance (
                        study_group_id, psychds_path, original_rel_path,
                        original_format, pipeline_type, pipeline_group,
                        pipeline_data_granularity, ground_truth_validated,
                        txt_extraction_attempted, txt_extraction_skipped,
                        txt_skip_reason, txt_psychds_path
                    ) VALUES (
                        %(study_group_id)s, %(psychds_path)s, %(original_rel_path)s,
                        %(original_format)s, %(pipeline_type)s, %(pipeline_group)s,
                        %(pipeline_data_granularity)s, %(ground_truth_validated)s,
                        %(txt_extraction_attempted)s, %(txt_extraction_skipped)s,
                        %(txt_skip_reason)s, %(txt_psychds_path)s
                    )
                    """,
                    {**prov, "study_group_id": sg_id},
                )

            if paper_meta.get("pipeline_version") and not pipeline_version:
                pipeline_version = paper_meta["pipeline_version"]

        conn.commit()

        cur.execute(
            """
            UPDATE papers SET n_study_groups = (
                SELECT COUNT(*) FROM study_groups WHERE study_groups.paper_id = papers.paper_id
            )
            """
        )
        cur.execute(
            """
            UPDATE papers SET has_ground_truth = (
                SELECT COALESCE(MAX(has_ground_truth), 0) FROM study_groups
                WHERE study_groups.paper_id = papers.paper_id
            )
            """
        )

        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            "INSERT INTO _meta (key, value) VALUES ('last_indexed', %s) "
            "ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
            (now,),
        )
        if pipeline_version:
            cur.execute(
                "INSERT INTO _meta (key, value) VALUES ('pipeline_version', %s) "
                "ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
                (pipeline_version,),
            )

        conn.commit()
        cur.close()
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
