"""
Download endpoints — streaming ZIP responses.

All archives are streamed via zipstream-ng; no full-archive buffering.
MANIFEST.csv / DOWNLOAD_MANIFEST.csv are generated at request time.
"""

import asyncio
import csv
import io
import os
import re
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse

from config import PSYCHDS_DIR
from db.schema import get_connection

import zipstream

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "download"


def _csv_bytes(rows: list[dict], fieldnames: list[str]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def _sum_dir_sizes(path: Path) -> tuple[int, int]:
    """Return (n_files, total_bytes) for all files under path."""
    n = 0
    total = 0
    for f in path.rglob("*"):
        if f.is_file():
            n += 1
            try:
                total += f.stat().st_size
            except OSError:
                pass
    return n, total


def _get_study_dir(paper_id: str, study_group: str) -> str | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT study_dir FROM study_groups WHERE paper_id=? AND study_group=?",
            (paper_id, study_group),
        ).fetchone()
        return row["study_dir"] if row else None
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────────────────────
# Paper download size
# ──────────────────────────────────────────────────────────────────────────────

def _paper_download_size(paper_id: str) -> dict | None:
    root = Path(PSYCHDS_DIR)
    paper_dir = root / paper_id
    if not paper_dir.is_dir():
        return None

    conn = get_connection()
    try:
        sgs = conn.execute(
            "SELECT study_group, study_dir FROM study_groups WHERE paper_id=?",
            (paper_id,),
        ).fetchall()
    finally:
        conn.close()

    total_n = 0
    total_bytes = 0
    sg_summaries = []
    for sg in sgs:
        sg_path = paper_dir / sg["study_dir"]
        n, b = _sum_dir_sizes(sg_path)
        total_n += n
        total_bytes += b
        sg_summaries.append({
            "study_group": sg["study_group"],
            "n_files": n,
            "total_bytes_uncompressed": b,
        })

    return {
        "paper_id": str(paper_id),
        "n_files": total_n,
        "total_bytes_uncompressed": total_bytes,
        "study_groups": sg_summaries,
    }


@router.get("/papers/{paper_id}/download/size")
async def paper_download_size(paper_id: str):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _paper_download_size, paper_id)
    if result is None:
        return JSONResponse(
            status_code=404, content={"error": f"Paper not found: {paper_id}"}
        )
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Paper download stream
# ──────────────────────────────────────────────────────────────────────────────

def _build_paper_manifest(paper_id: str, study_group: str | None) -> bytes:
    conn = get_connection()
    try:
        if study_group:
            prov_rows = conn.execute(
                """
                SELECT prov.*, sg.study_group FROM provenance prov
                JOIN study_groups sg ON prov.study_group_id = sg.id
                WHERE sg.paper_id=? AND sg.study_group=?
                ORDER BY prov.psychds_path
                """,
                (paper_id, study_group),
            ).fetchall()
        else:
            prov_rows = conn.execute(
                """
                SELECT prov.*, sg.study_group FROM provenance prov
                JOIN study_groups sg ON prov.study_group_id = sg.id
                WHERE sg.paper_id=?
                ORDER BY sg.study_group, prov.psychds_path
                """,
                (paper_id,),
            ).fetchall()
    finally:
        conn.close()

    rows = [
        {
            "psychds_path": r["psychds_path"],
            "original_rel_path": r["original_rel_path"] or "",
            "original_format": r["original_format"] or "",
            "pipeline_type": r["pipeline_type"] or "",
            "pipeline_group": r["pipeline_group"] or "",
            "ground_truth_validated": "true" if r["ground_truth_validated"] else "false",
            "study_group": r["study_group"],
        }
        for r in prov_rows
    ]
    return _csv_bytes(
        rows,
        ["psychds_path", "original_rel_path", "original_format",
         "pipeline_type", "pipeline_group", "ground_truth_validated", "study_group"],
    )


def _stream_paper_zip(paper_id: str, study_group: str | None):
    root = Path(PSYCHDS_DIR)
    paper_dir = root / paper_id
    if not paper_dir.is_dir():
        return None

    z = zipstream.ZipStream(compress_type=zipstream.ZIP_DEFLATED)

    # Inject manifest
    manifest_bytes = _build_paper_manifest(paper_id, study_group)
    z.add(manifest_bytes, arcname="DOWNLOAD_MANIFEST.csv")

    if study_group:
        study_dir_name = _get_study_dir(paper_id, study_group)
        dirs_to_add = [(paper_dir / study_dir_name,)] if study_dir_name else []
        zip_prefix = ""
    else:
        dirs_to_add = [
            (d,)
            for d in paper_dir.iterdir()
            if d.is_dir() and d.name.startswith("study-")
        ]
        zip_prefix = ""

    for (d,) in dirs_to_add:
        for f in d.rglob("*"):
            if f.is_file():
                arcname = str(f.relative_to(paper_dir))
                z.add(str(f), arcname=arcname)

    return z


@router.get("/papers/{paper_id}/download")
async def download_paper(paper_id: str):
    loop = asyncio.get_event_loop()
    z = await loop.run_in_executor(None, _stream_paper_zip, paper_id, None)
    if z is None:
        return JSONResponse(
            status_code=404, content={"error": f"Paper not found: {paper_id}"}
        )
    filename = f"psychds-{paper_id}.zip"
    return StreamingResponse(
        iter(z),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/papers/{paper_id}/groups/{study_group}/download")
async def download_study_group(paper_id: str, study_group: str):
    loop = asyncio.get_event_loop()
    z = await loop.run_in_executor(None, _stream_paper_zip, paper_id, study_group)
    if z is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"Study group not found: {study_group} for paper {paper_id}"},
        )
    filename = f"psychds-{paper_id}-{study_group}.zip"
    return StreamingResponse(
        iter(z),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ──────────────────────────────────────────────────────────────────────────────
# Variable search download size
# ──────────────────────────────────────────────────────────────────────────────

def _resolve_variable_csv_files(
    q: str,
    col_types: list[str] | None,
    has_description: bool | None,
    deduplicate: bool,
) -> list[dict]:
    """
    Return list of dicts describing matching source CSV files.
    Each dict: paper_id, study_group, study_dir, csv_path (Path),
               matching_variable_names, matching_variable_descriptions,
               n_rows, n_columns, original_rel_path, original_format,
               data_granularity, ground_truth_validated, conversion_method,
               encoding_normalized, paper_title, doi
    """
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
        extra_sql = (" AND " + " AND ".join(extra_where)) if extra_where else ""

        try:
            fts_query = f'name:"{q}"* OR description:"{q}"*'
            sql = f"""
                SELECT v.name, v.description, v.source_file,
                       v.paper_id, sg.study_group, sg.study_dir,
                       p.title as paper_title, p.doi
                FROM variables_fts fts
                JOIN variables v ON fts.variable_id = v.id
                JOIN study_groups sg ON v.study_group_id = sg.id
                JOIN papers p ON v.paper_id = p.paper_id
                WHERE variables_fts MATCH ?{extra_sql}
            """
            rows = conn.execute(sql, [fts_query] + extra_params).fetchall()
        except sqlite3.OperationalError:
            like = f"%{q}%"
            sql = f"""
                SELECT v.name, v.description, v.source_file,
                       v.paper_id, sg.study_group, sg.study_dir,
                       p.title as paper_title, p.doi
                FROM variables v
                JOIN study_groups sg ON v.study_group_id = sg.id
                JOIN papers p ON v.paper_id = p.paper_id
                WHERE (v.name LIKE ? OR v.description LIKE ?){extra_sql}
            """
            rows = conn.execute(sql, [like, like] + extra_params).fetchall()
    finally:
        conn.close()

    # Group by (paper_id, study_dir, source_file)
    groups: dict[tuple, dict] = {}
    for r in rows:
        key = (str(r["paper_id"]), r["study_dir"], r["source_file"])
        if key not in groups:
            groups[key] = {
                "paper_id": str(r["paper_id"]),
                "study_group": r["study_group"],
                "study_dir": r["study_dir"],
                "source_file": r["source_file"],
                "paper_title": r["paper_title"],
                "doi": r["doi"],
                "matching_variables": [],
                "matching_descriptions": [],
            }
        groups[key]["matching_variables"].append(r["name"])
        groups[key]["matching_descriptions"].append(r["description"] or "")

    root = Path(PSYCHDS_DIR)
    result = []
    seen_csv_paths = set()

    for (paper_id, study_dir, source_file), grp in groups.items():
        # Find the source-*_data.csv
        data_dir = root / paper_id / study_dir / "data"
        stem = re.sub(r"[^a-z0-9]", "", Path(source_file).stem.lower())
        csv_path = data_dir / f"source-{stem}_data.csv"

        # Try glob if exact path not found
        if not csv_path.exists():
            candidates = list(data_dir.glob("source-*_data.csv"))
            csv_path = candidates[0] if len(candidates) == 1 else None

        if csv_path is None or not csv_path.exists():
            continue

        if deduplicate and str(csv_path) in seen_csv_paths:
            # Still add variables info to existing entry
            continue
        seen_csv_paths.add(str(csv_path))

        # Get sidecar info
        sidecar_path = csv_path.with_suffix("").with_suffix("").parent / (csv_path.stem.replace("_data", "_data") + ".json")
        sidecar_json_path = data_dir / (csv_path.stem.replace("_data", "_data") + ".json")
        # Actually: source-slug_data.json
        sidecar_json_path = data_dir / (csv_path.name.replace(".csv", ".json"))

        n_rows = None
        n_columns = None
        original_rel_path = source_file
        original_format = Path(source_file).suffix.lstrip(".")
        data_granularity = None
        gt_validated = False
        conversion_method = None
        encoding_normalized = False

        if sidecar_json_path.exists():
            try:
                import json
                with open(sidecar_json_path, encoding="utf-8") as f:
                    sidecar = json.load(f)
                conv = sidecar.get("metacheck:conversion", {}) or {}
                orig = sidecar.get("metacheck:original_file", {}) or {}
                n_rows = conv.get("rows_written")
                n_columns = conv.get("columns_written")
                original_rel_path = orig.get("rel_path", source_file)
                original_format = orig.get("format", original_format)
                data_granularity = orig.get("data_granularity")
                conversion_method = conv.get("method")
                encoding_normalized = bool(conv.get("encoding_normalized"))
            except Exception:
                pass

        zip_path = f"{paper_id}/{study_dir}/{csv_path.name}"

        result.append({
            "paper_id": grp["paper_id"],
            "study_group": grp["study_group"],
            "study_dir": grp["study_dir"],
            "csv_path": csv_path,
            "zip_path": zip_path,
            "paper_title": grp["paper_title"],
            "doi": grp["doi"],
            "original_rel_path": original_rel_path,
            "original_format": original_format,
            "pipeline_data_granularity": data_granularity,
            "n_rows": n_rows,
            "n_columns": n_columns,
            "matching_variables": " | ".join(grp["matching_variables"]),
            "matching_variable_descriptions": " | ".join(grp["matching_descriptions"]),
            "ground_truth_validated": gt_validated,
            "conversion_method": conversion_method or "",
            "encoding_normalized": encoding_normalized,
        })

    return result


@router.get("/variables/search/download/size")
async def variable_search_download_size(
    q: str = Query(...),
    col_type: Optional[str] = Query(None),
    has_description: Optional[bool] = Query(None),
    deduplicate_files: bool = Query(True),
):
    col_types = [c.strip() for c in col_type.split(",")] if col_type else None
    loop = asyncio.get_event_loop()
    files = await loop.run_in_executor(
        None, _resolve_variable_csv_files, q, col_types, has_description, deduplicate_files
    )
    total_bytes = sum(
        f["csv_path"].stat().st_size for f in files if f["csv_path"].exists()
    )
    papers = {f["paper_id"] for f in files}
    return {
        "query": q,
        "n_matching_variables": sum(
            len(f["matching_variables"].split(" | ")) for f in files
        ),
        "n_source_files": len(files),
        "n_papers": len(papers),
        "total_bytes_uncompressed": total_bytes,
    }


@router.get("/variables/search/download")
async def variable_search_download(
    q: str = Query(...),
    col_type: Optional[str] = Query(None),
    has_description: Optional[bool] = Query(None),
    deduplicate_files: bool = Query(True),
):
    col_types = [c.strip() for c in col_type.split(",")] if col_type else None
    loop = asyncio.get_event_loop()
    files = await loop.run_in_executor(
        None, _resolve_variable_csv_files, q, col_types, has_description, deduplicate_files
    )

    manifest_rows = [
        {
            "paper_id": f["paper_id"],
            "study_group": f["study_group"],
            "paper_title": f["paper_title"],
            "doi": f["doi"] or "",
            "zip_path": f["zip_path"],
            "original_rel_path": f["original_rel_path"],
            "original_format": f["original_format"],
            "pipeline_data_granularity": f["pipeline_data_granularity"] or "",
            "n_rows": f["n_rows"] or "",
            "n_columns": f["n_columns"] or "",
            "matching_variables": f["matching_variables"],
            "matching_variable_descriptions": f["matching_variable_descriptions"],
            "ground_truth_validated": "true" if f["ground_truth_validated"] else "false",
            "conversion_method": f["conversion_method"],
            "encoding_normalized": "true" if f["encoding_normalized"] else "false",
        }
        for f in files
    ]
    manifest_bytes = _csv_bytes(
        manifest_rows,
        ["paper_id", "study_group", "paper_title", "doi", "zip_path",
         "original_rel_path", "original_format", "pipeline_data_granularity",
         "n_rows", "n_columns", "matching_variables", "matching_variable_descriptions",
         "ground_truth_validated", "conversion_method", "encoding_normalized"],
    )

    z = zipstream.ZipStream(compress_type=zipstream.ZIP_DEFLATED)
    z.add(manifest_bytes, arcname="MANIFEST.csv")
    for f in files:
        if f["csv_path"].exists():
            z.add(str(f["csv_path"]), arcname=f["zip_path"])

    slug = _slugify(q)
    filename = f"variable-search-{slug}.zip"
    return StreamingResponse(
        iter(z),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/variables/{variable_id}/download")
async def variable_download(variable_id: int):
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT v.name, v.source_file, v.paper_id,
                   sg.study_dir, sg.study_group
            FROM variables v
            JOIN study_groups sg ON v.study_group_id = sg.id
            WHERE v.id = ?
            """,
            (variable_id,),
        ).fetchone()
    finally:
        conn.close()

    if not row:
        return JSONResponse(
            status_code=404, content={"error": f"Variable not found: {variable_id}"}
        )

    paper_id = str(row["paper_id"])
    loop = asyncio.get_event_loop()
    files = await loop.run_in_executor(
        None,
        _resolve_variable_csv_files,
        row["name"],
        None,
        None,
        True,
    )
    # Filter to just this variable's paper+study
    files = [
        f for f in files
        if f["paper_id"] == paper_id and f["study_group"] == row["study_group"]
    ]

    if not files:
        return JSONResponse(
            status_code=404,
            content={"error": "Source CSV not found for this variable"},
        )

    manifest_rows = [
        {
            "paper_id": f["paper_id"],
            "study_group": f["study_group"],
            "paper_title": f["paper_title"],
            "doi": f["doi"] or "",
            "zip_path": f["zip_path"],
            "original_rel_path": f["original_rel_path"],
            "original_format": f["original_format"],
            "pipeline_data_granularity": f["pipeline_data_granularity"] or "",
            "n_rows": f["n_rows"] or "",
            "n_columns": f["n_columns"] or "",
            "matching_variables": f["matching_variables"],
            "matching_variable_descriptions": f["matching_variable_descriptions"],
            "ground_truth_validated": "true" if f["ground_truth_validated"] else "false",
            "conversion_method": f["conversion_method"],
            "encoding_normalized": "true" if f["encoding_normalized"] else "false",
        }
        for f in files
    ]
    manifest_bytes = _csv_bytes(
        manifest_rows,
        ["paper_id", "study_group", "paper_title", "doi", "zip_path",
         "original_rel_path", "original_format", "pipeline_data_granularity",
         "n_rows", "n_columns", "matching_variables", "matching_variable_descriptions",
         "ground_truth_validated", "conversion_method", "encoding_normalized"],
    )

    z = zipstream.ZipStream(compress_type=zipstream.ZIP_DEFLATED)
    z.add(manifest_bytes, arcname="MANIFEST.csv")
    for f in files:
        if f["csv_path"].exists():
            z.add(str(f["csv_path"]), arcname=f["zip_path"])

    slug = _slugify(row["name"])
    filename = f"variable-{slug}.zip"
    return StreamingResponse(
        iter(z),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
