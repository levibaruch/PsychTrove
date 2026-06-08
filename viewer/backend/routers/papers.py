import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from db.schema import get_connection

router = APIRouter()


def _deserialize_json_field(val) -> list:
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return []


def _paper_list_item(row) -> dict:
    return {
        "paper_id": str(row["paper_id"]),
        "title": row["title"],
        "doi": row["doi"],
        "authors": _deserialize_json_field(row["authors"]),
        "keywords": _deserialize_json_field(row["keywords"]),
        "n_study_groups": row["n_study_groups"],
        "n_variables": row["n_variables"],
        "n_labelled_variables": row["n_labelled"],
        "has_ground_truth": bool(row["has_ground_truth"]),
        "has_code": bool(row.get("has_code")),
        "conversion_date": row["conversion_date"],
        "max_participant_n": row.get("max_participant_n"),
    }


# Correlated subquery expressions reused in SELECT, WHERE and ORDER BY.
_N_VARS_SQL = "(SELECT COUNT(*) FROM variables v2 WHERE v2.paper_id = p.paper_id)"
_N_LABELLED_SQL = "(SELECT COUNT(*) FROM variables v WHERE v.paper_id = p.paper_id AND v.description IS NOT NULL)"
_MAX_N_SQL = "(SELECT MAX(v3.stat_n) FROM variables v3 WHERE v3.paper_id = p.paper_id)"
_HAS_CODE_SQL = (
    "EXISTS (SELECT 1 FROM provenance pv JOIN study_groups sg ON pv.study_group_id = sg.id "
    "WHERE sg.paper_id = p.paper_id AND pv.pipeline_type IN ('code', 'software'))"
)

# Whitelist of sort columns -> SQL expression. Guards against injection.
_PAPER_SORT = {
    "title": "p.title",
    "n_participants": _MAX_N_SQL,
    "n_variables": _N_VARS_SQL,
    "n_labelled": _N_LABELLED_SQL,
}


def _get_papers(
    q: Optional[str], has_labels: Optional[bool],
    has_ground_truth: Optional[bool], has_code: Optional[bool],
    min_n: Optional[int], min_vars: Optional[int],
    sort_by: Optional[str], sort_dir: str,
    limit: int, offset: int,
) -> dict:
    conn = get_connection()
    try:
        cur = conn.cursor()
        where_clauses = []
        params: list = []

        if q:
            like = f"%{q}%"
            where_clauses.append(
                "(p.title ILIKE %s OR p.description ILIKE %s OR p.keywords ILIKE %s OR p.authors ILIKE %s)"
            )
            params.extend([like, like, like, like])

        if has_labels is True:
            where_clauses.append(
                "EXISTS (SELECT 1 FROM variables v WHERE v.paper_id = p.paper_id AND v.description IS NOT NULL)"
            )

        if has_ground_truth is True:
            where_clauses.append("p.has_ground_truth = 1")
        elif has_ground_truth is False:
            where_clauses.append("p.has_ground_truth = 0")

        if has_code is True:
            where_clauses.append(_HAS_CODE_SQL)

        if min_n is not None:
            where_clauses.append(f"COALESCE({_MAX_N_SQL}, 0) >= %s")
            params.append(min_n)

        if min_vars is not None:
            where_clauses.append(f"{_N_VARS_SQL} >= %s")
            params.append(min_vars)

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        # Resolve sort safely from the whitelist; default to title.
        sort_expr = _PAPER_SORT.get(sort_by or "title", "p.title")
        direction = "DESC" if str(sort_dir).lower() == "desc" else "ASC"
        if sort_expr == "p.title":
            order_sql = f"ORDER BY p.title {direction}"
        else:
            # Numeric sorts: push NULLs to the end, tie-break on title.
            order_sql = f"ORDER BY {sort_expr} {direction} NULLS LAST, p.title ASC"

        cur.execute(f"SELECT COUNT(*) FROM papers p {where_sql}", params)
        total = cur.fetchone()["count"]

        cur.execute(
            f"""
            SELECT p.*,
                {_N_LABELLED_SQL} AS n_labelled,
                {_N_VARS_SQL} AS n_variables,
                {_MAX_N_SQL} AS max_participant_n,
                {_HAS_CODE_SQL} AS has_code
            FROM papers p
            {where_sql}
            {order_sql}
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        rows = cur.fetchall()

        return {
            "total": total,
            "papers": [_paper_list_item(r) for r in rows],
        }
    finally:
        conn.close()


def _get_paper_detail(paper_id: str) -> dict | None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM papers WHERE paper_id = %s", (paper_id,))
        paper = cur.fetchone()
        if not paper:
            return None

        cur.execute(
            """
            SELECT * FROM study_groups WHERE paper_id = %s
            ORDER BY
                CASE WHEN study_group = 'shared' THEN 1 ELSE 0 END,
                study_group
            """,
            (paper_id,),
        )
        study_groups_rows = cur.fetchall()

        cur.execute(
            "SELECT MAX(stat_n) as max_participant_n FROM variables WHERE paper_id = %s",
            (paper_id,),
        )
        max_n_row = cur.fetchone()
        max_participant_n = max_n_row["max_participant_n"] if max_n_row else None

        study_groups = []
        for sg in study_groups_rows:
            cur.execute(
                "SELECT COUNT(*) FROM variables WHERE study_group_id=%s AND description IS NOT NULL",
                (sg["id"],),
            )
            n_labelled = cur.fetchone()["count"]
            study_groups.append({
                "study_group": sg["study_group"],
                "study_dir": sg["study_dir"],
                "title": sg["title"],
                "description": sg["description"],
                "pipeline_status": {
                    "index_success": bool(sg["index_success"]),
                    "codebook_success": bool(sg["codebook_success"]),
                    "n_files_total": sg["n_files_total"],
                    "n_data_files": sg["n_data_files"],
                    "n_columns": sg["n_columns"],
                    "n_labelled_columns": sg["n_labelled_columns"],
                    "label_status": sg["label_status"],
                },
                "n_variables": sg["n_variables"],
                "n_labelled": n_labelled,
                "has_ground_truth": bool(sg["has_ground_truth"]),
            })

        return {
            "paper_id": str(paper["paper_id"]),
            "title": paper["title"],
            "description": paper["description"],
            "authors": _deserialize_json_field(paper["authors"]),
            "doi": paper["doi"],
            "keywords": _deserialize_json_field(paper["keywords"]),
            "pipeline_version": paper["pipeline_version"],
            "conversion_date": paper["conversion_date"],
            "has_ground_truth": bool(paper["has_ground_truth"]),
            "max_participant_n": max_participant_n,
            "study_groups": study_groups,
        }
    finally:
        conn.close()


def _get_study_group_detail(paper_id: str, study_group: str) -> dict | None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM study_groups WHERE paper_id=%s AND study_group=%s",
            (paper_id, study_group),
        )
        sg = cur.fetchone()
        if not sg:
            return None

        cur.execute("SELECT * FROM papers WHERE paper_id=%s", (paper_id,))
        paper = cur.fetchone()
        if not paper:
            return None

        cur.execute(
            "SELECT * FROM variables WHERE study_group_id=%s ORDER BY name",
            (sg["id"],),
        )
        variables = cur.fetchall()

        cur.execute(
            "SELECT * FROM provenance WHERE study_group_id=%s ORDER BY psychds_path",
            (sg["id"],),
        )
        provenance_rows = cur.fetchall()

        def var_stats(v) -> dict | None:
            if not v["stat_mean"] and v["stat_n"] is None:
                return None
            return {
                "n": v["stat_n"],
                "n_missing": v["stat_n_missing"],
                "mean": v["stat_mean"],
                "sd": v["stat_sd"],
                "se": v["stat_se"],
                "median": v["stat_median"],
                "p25": v["stat_p25"],
                "p75": v["stat_p75"],
                "iqr": v["stat_iqr"],
                "skewness": v["stat_skewness"],
                "kurtosis": v["stat_kurtosis"],
            }

        return {
            "paper_id": str(paper["paper_id"]),
            "study_group": sg["study_group"],
            "title": sg["title"],
            "description": sg["description"],
            "authors": _deserialize_json_field(paper["authors"]),
            "doi": paper["doi"],
            "keywords": _deserialize_json_field(paper["keywords"]),
            "pipeline_status": {
                "index_success": bool(sg["index_success"]),
                "codebook_success": bool(sg["codebook_success"]),
                "n_files_total": sg["n_files_total"],
                "n_data_files": sg["n_data_files"],
                "n_columns": sg["n_columns"],
                "n_labelled_columns": sg["n_labelled_columns"],
                "label_status": sg["label_status"],
            },
            "source_repository": None,
            "shared_resources": None,
            "shared_files": None,
            "variables": [
                {
                    "id": v["id"],
                    "name": v["name"],
                    "description": v["description"],
                    "col_type": v["col_type"],
                    "source_file": v["source_file"],
                    "sample_values": v["sample_values"],
                    "value_pattern": v["value_pattern"],
                    "min_value": v["min_value"],
                    "max_value": v["max_value"],
                    "statistics": var_stats(v),
                }
                for v in variables
            ],
            "provenance": [
                {
                    "id": p["id"],
                    "psychds_path": p["psychds_path"],
                    "original_rel_path": p["original_rel_path"],
                    "original_format": p["original_format"],
                    "pipeline_type": p["pipeline_type"],
                    "pipeline_group": p["pipeline_group"],
                    "pipeline_data_granularity": p["pipeline_data_granularity"],
                    "ground_truth_validated": bool(p["ground_truth_validated"]),
                    "txt_extraction_attempted": p["txt_extraction_attempted"],
                    "txt_extraction_skipped": p["txt_extraction_skipped"],
                    "txt_skip_reason": p["txt_skip_reason"],
                    "txt_psychds_path": p["txt_psychds_path"],
                }
                for p in provenance_rows
            ],
        }
    finally:
        conn.close()


@router.get("/papers")
async def list_papers(
    q: Optional[str] = Query(None),
    has_labels: Optional[bool] = Query(None),
    has_ground_truth: Optional[bool] = Query(None),
    has_code: Optional[bool] = Query(None),
    min_n: Optional[int] = Query(None, ge=0),
    min_vars: Optional[int] = Query(None, ge=0),
    sort_by: Optional[str] = Query(None),
    sort_dir: str = Query("asc"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, _get_papers, q, has_labels, has_ground_truth, has_code,
        min_n, min_vars, sort_by, sort_dir, limit, offset,
    )
    return result


@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _get_paper_detail, paper_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"Paper not found: {paper_id}"},
        )
    return result


@router.get("/papers/{paper_id}/groups/{study_group}")
async def get_study_group(paper_id: str, study_group: str):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, _get_study_group_detail, paper_id, study_group
    )
    if result is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"Study group not found: {study_group} for paper {paper_id}"},
        )
    return result
