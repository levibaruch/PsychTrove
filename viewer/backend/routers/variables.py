import asyncio
import json
import re
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from config import PSYCHDS_DIR
from db.schema import get_connection

router = APIRouter()


def _var_stats(v) -> dict | None:
    if v["stat_n"] is None and v["stat_mean"] is None:
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


def _search_variables(
    q: str,
    col_types: Optional[list[str]],
    has_description: Optional[bool],
    paper_id: Optional[str],
    limit: int,
    offset: int,
) -> dict:
    conn = get_connection()
    try:
        extra_where = []
        extra_params = []

        if col_types:
            placeholders = ",".join("?" * len(col_types))
            extra_where.append(f"v.col_type IN ({placeholders})")
            extra_params.extend(col_types)

        if has_description is True:
            extra_where.append("v.description IS NOT NULL")
        elif has_description is False:
            extra_where.append("v.description IS NULL")

        if paper_id:
            extra_where.append("v.paper_id = ?")
            extra_params.append(paper_id)

        extra_sql = (" AND " + " AND ".join(extra_where)) if extra_where else ""

        # Try FTS5 first
        try:
            fts_query = f'name:"{q}"* OR description:"{q}"*'
            fts_sql = f"""
                SELECT v.id as variable_id, v.name, v.description, v.col_type,
                       v.source_file, v.sample_values, v.min_value, v.max_value,
                       v.stat_n, v.stat_n_missing, v.stat_mean, v.stat_sd, v.stat_se,
                       v.stat_median, v.stat_p25, v.stat_p75, v.stat_iqr,
                       v.stat_skewness, v.stat_kurtosis,
                       p.paper_id, p.title as paper_title, p.doi,
                       sg.study_group
                FROM variables_fts fts
                JOIN variables v ON fts.variable_id = v.id
                JOIN study_groups sg ON v.study_group_id = sg.id
                JOIN papers p ON v.paper_id = p.paper_id
                WHERE variables_fts MATCH ?{extra_sql}
                ORDER BY rank
            """
            count_sql = f"""
                SELECT COUNT(*) FROM variables_fts fts
                JOIN variables v ON fts.variable_id = v.id
                JOIN study_groups sg ON v.study_group_id = sg.id
                JOIN papers p ON v.paper_id = p.paper_id
                WHERE variables_fts MATCH ?{extra_sql}
            """
            total = conn.execute(count_sql, [fts_query] + extra_params).fetchone()[0]
            rows = conn.execute(
                fts_sql + f" LIMIT ? OFFSET ?",
                [fts_query] + extra_params + [limit, offset],
            ).fetchall()

        except sqlite3.OperationalError:
            # Fallback to LIKE
            like = f"%{q}%"
            like_sql = f"""
                SELECT v.id as variable_id, v.name, v.description, v.col_type,
                       v.source_file, v.sample_values, v.min_value, v.max_value,
                       v.stat_n, v.stat_n_missing, v.stat_mean, v.stat_sd, v.stat_se,
                       v.stat_median, v.stat_p25, v.stat_p75, v.stat_iqr,
                       v.stat_skewness, v.stat_kurtosis,
                       p.paper_id, p.title as paper_title, p.doi,
                       sg.study_group
                FROM variables v
                JOIN study_groups sg ON v.study_group_id = sg.id
                JOIN papers p ON v.paper_id = p.paper_id
                WHERE (v.name LIKE ? OR v.description LIKE ?){extra_sql}
                ORDER BY v.name
            """
            count_sql = f"""
                SELECT COUNT(*) FROM variables v
                JOIN study_groups sg ON v.study_group_id = sg.id
                JOIN papers p ON v.paper_id = p.paper_id
                WHERE (v.name LIKE ? OR v.description LIKE ?){extra_sql}
            """
            total = conn.execute(count_sql, [like, like] + extra_params).fetchone()[0]
            rows = conn.execute(
                like_sql + f" LIMIT ? OFFSET ?",
                [like, like] + extra_params + [limit, offset],
            ).fetchall()

        results = []
        for r in rows:
            results.append({
                "variable_id": r["variable_id"],
                "paper_id": str(r["paper_id"]),
                "paper_title": r["paper_title"],
                "doi": r["doi"],
                "study_group": r["study_group"],
                "name": r["name"],
                "description": r["description"],
                "col_type": r["col_type"],
                "source_file": r["source_file"],
                "sample_values": r["sample_values"],
                "min_value": r["min_value"],
                "max_value": r["max_value"],
                "statistics": _var_stats(r),
            })

        return {"total": total, "query": q, "results": results}
    finally:
        conn.close()


def _resolve_sidecar(
    paper_id: str, study_dir: str, source_file: str
) -> dict | None:
    """
    Resolve source-*_data.json sidecar for a variable.
    spec §6.5: strip non-alphanumeric from basename, lowercase.
    """
    root = Path(PSYCHDS_DIR)
    data_dir = root / paper_id / study_dir / "data"
    if not data_dir.exists():
        return None

    # Derive slug from source_file basename
    basename = Path(source_file).stem
    slug = re.sub(r"[^a-z0-9]", "", basename.lower())
    if not slug:
        return None

    # Try exact slug match first
    exact = data_dir / f"source-{slug}_data.json"
    candidates = list(data_dir.glob("source-*_data.json"))

    if exact.exists():
        target = exact
    elif len(candidates) == 1:
        target = candidates[0]
    else:
        # Match by metacheck:original_file.rel_path
        target = None
        for c in candidates:
            try:
                with open(c, encoding="utf-8") as f:
                    sidecar = json.load(f)
                rel_path = sidecar.get("metacheck:original_file", {}).get("rel_path", "")
                if rel_path and Path(rel_path).name == Path(source_file).name:
                    target = c
                    break
            except Exception:
                continue

    if target is None or not target.exists():
        return None

    try:
        with open(target, encoding="utf-8") as f:
            sidecar = json.load(f)
    except Exception:
        return None

    orig = sidecar.get("metacheck:original_file", {}) or {}
    conv = sidecar.get("metacheck:conversion", {}) or {}
    all_vars = sidecar.get("schema:variableMeasured", []) or []

    return {
        "original_file": {
            "rel_path": orig.get("rel_path"),
            "format": orig.get("format"),
            "size_bytes": orig.get("size_bytes"),
            "data_granularity": orig.get("data_granularity"),
        },
        "conversion": {
            "method": conv.get("method"),
            "encoding_normalized": bool(conv.get("encoding_normalized")),
            "haven_labels_extracted": bool(conv.get("haven_labels_extracted")),
            "rows_written": conv.get("rows_written"),
            "columns_written": conv.get("columns_written"),
        },
        "sibling_variables": [
            {
                "name": v.get("name"),
                "col_type": v.get("metacheck:col_type"),
                "description": v.get("description"),
            }
            for v in all_vars
            if isinstance(v, dict)
        ],
    }


def _get_variable_detail(variable_id: int) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT v.*, sg.study_group, sg.study_dir, p.paper_id as pid
            FROM variables v
            JOIN study_groups sg ON v.study_group_id = sg.id
            JOIN papers p ON v.paper_id = p.paper_id
            WHERE v.id = ?
            """,
            (variable_id,),
        ).fetchone()
        if not row:
            return None

        source_file_context = _resolve_sidecar(
            str(row["pid"]), row["study_dir"], row["source_file"]
        )

        # Remove the current variable from sibling list
        if source_file_context and source_file_context.get("sibling_variables"):
            source_file_context["sibling_variables"] = [
                sv for sv in source_file_context["sibling_variables"]
                if sv.get("name") != row["name"]
            ]

        return {
            "variable_id": row["id"],
            "paper_id": str(row["pid"]),
            "study_group": row["study_group"],
            "name": row["name"],
            "description": row["description"],
            "col_type": row["col_type"],
            "source_file": row["source_file"],
            "sample_values": row["sample_values"],
            "value_pattern": row["value_pattern"],
            "min_value": row["min_value"],
            "max_value": row["max_value"],
            "statistics": _var_stats(row),
            "source_file_context": source_file_context,
        }
    finally:
        conn.close()


@router.get("/variables/search")
async def search_variables(
    q: str = Query(...),
    col_type: Optional[str] = Query(None),
    has_description: Optional[bool] = Query(None),
    paper_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    col_types = [c.strip() for c in col_type.split(",")] if col_type else None
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, _search_variables, q, col_types, has_description, paper_id, limit, offset
    )
    return result


@router.get("/variables/{variable_id}")
async def get_variable(variable_id: int):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _get_variable_detail, variable_id)
    if result is None:
        return JSONResponse(
            status_code=404, content={"error": f"Variable not found: {variable_id}"}
        )
    return result
