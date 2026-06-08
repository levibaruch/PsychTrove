"""
Parsers for PsychDS JSON files.

- parse_dataset_description: reads dataset_description.json
- parse_provenance: reads provenance.json
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _safe_str(val) -> str | None:
    if val is None:
        return None
    return str(val)


def _clean_title(title: str) -> str:
    """Fix known upstream pipeline title artifacts."""
    import re
    # Strip journal-metadata prefix: e.g. '723377P SSXXX10.1177/0956797617723377Walco, RisenActual Title'
    title = re.sub(
        r'^\d+\w*\s*\w*10\.\d+/\d+[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*',
        '', title
    ).strip()
    # Strip leading dots
    title = title.lstrip('.').strip()
    # Strip ' — Study XXX' suffix
    title = re.sub(r'\s*[—–-]+\s*Study\s+\S+\s*$', '', title, flags=re.IGNORECASE).strip()
    return title


def _clean_doi(val) -> str | None:
    """Normalise the identifier to a clean DOI URL.

    Upstream SAGE identifiers glue journal cruft onto the DOI, e.g.
    'https://doi.org/10.1177/0956797614542274pss.sagepub.' — strip it.
    """
    if not val:
        return None
    import re
    s = str(val).strip()
    # Extract the DOI core (10.xxxx/...) if a URL/prefix wraps it.
    m = re.search(r'10\.\d{4,9}/[^\s"<>]+', s)
    doi = m.group(0) if m else s
    # Drop trailing publisher slug glued onto the suffix (pss.sagepub., sagepub…).
    doi = re.sub(r'(?i)(pss)?\.?sagepub.*$', '', doi)
    doi = doi.rstrip('.,;/ ')
    if not doi:
        return None
    return f'https://doi.org/{doi}'


def _extract_authors(author_field) -> str | None:
    """Convert author array to JSON string of names."""
    if not author_field:
        return None
    if isinstance(author_field, list):
        names = []
        for a in author_field:
            if isinstance(a, dict):
                name = a.get("name")
                if name:
                    names.append(str(name))
        return json.dumps(names)
    return None


def _extract_keywords(kw_field) -> str | None:
    """Convert keywords array to JSON string."""
    if not kw_field:
        return None
    if isinstance(kw_field, list):
        return json.dumps([str(k) for k in kw_field])
    if isinstance(kw_field, str):
        return json.dumps([kw_field])
    return None


def parse_dataset_description(path: Path) -> dict:
    """
    Parse dataset_description.json.

    Returns a dict with keys:
        paper_meta: dict for papers table
        study_meta: dict for study_groups table
        variables: list of dicts for variables table
    """
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logger.error("Failed to parse %s: %s", path, e)
        return {}

    raw_name = _safe_str(data.get("name", "")) or ""

    # Journal / citation metadata lives under isPartOf + datacheck:* keys.
    journal = data.get("isPartOf") or {}
    publication_year = (
        _safe_str(data.get("datacheck:publication_year"))
        or _safe_str(data.get("datePublished"))
    )

    # Paper-level metadata
    paper_meta = {
        "paper_id": str(data.get("datacheck:paper_id", path.parent.parent.name)),
        "title": _clean_title(raw_name),
        "description": _safe_str(data.get("description")),
        "authors": _extract_authors(data.get("author")),
        "doi": _clean_doi(data.get("identifier")),
        "keywords": _extract_keywords(data.get("keywords")),
        "journal": _safe_str(journal.get("name")) if isinstance(journal, dict) else None,
        "publication_year": publication_year,
        "volume": _safe_str(data.get("datacheck:volume")),
        "issue": _safe_str(data.get("datacheck:issue")),
        "pagination": _safe_str(data.get("datacheck:pagination")),
        "pipeline_version": _safe_str(
            data.get("datacheck:pipeline_version")
        ),
        "conversion_date": _safe_str(data.get("datacheck:conversion_date")),
    }

    # Study-level metadata
    pipeline_status = data.get("datacheck:pipeline_status", {}) or {}
    source_repo = data.get("datacheck:source_repository", {}) or {}

    study_meta = {
        "study_group": _safe_str(data.get("datacheck:study_group", "")),
        "title": raw_name.lstrip('.').strip(),
        "description": _safe_str(data.get("description")),
        "index_success": 1 if pipeline_status.get("index_success") else 0,
        "codebook_success": 1 if pipeline_status.get("codebook_success") else 0,
        "n_files_total": pipeline_status.get("n_files_total"),
        "n_data_files": pipeline_status.get("n_data_files"),
        "n_columns": pipeline_status.get("n_columns"),
        "n_labelled_columns": int(pipeline_status.get("n_labelled_columns", 0) or 0),
        "label_status": _safe_str(pipeline_status.get("label_status")),
        "shared_resources": _safe_str(data.get("datacheck:shared_resources")),
        "shared_files": data.get("datacheck:shared_files"),
        "source_platform": _safe_str(source_repo.get("platform")),
        "source_download_path": _safe_str(source_repo.get("download_path")),
        "schema_version": _safe_str(data.get("schemaVersion")),
    }

    # Variables
    variables = []
    for var in data.get("variableMeasured", []) or []:
        if not isinstance(var, dict):
            continue

        stats = var.get("datacheck:statistics") or {}
        variables.append({
            "name": _safe_str(var.get("name", "")),
            "description": _safe_str(var.get("description")),
            "col_type": _safe_str(var.get("datacheck:col_type", "unknown")),
            "source_file": _safe_str(var.get("datacheck:source_file", "")),
            "sample_values": _safe_str(var.get("datacheck:sample_values")),
            "value_pattern": _safe_str(var.get("valuePattern")),
            "min_value": var.get("minValue"),
            "max_value": var.get("maxValue"),
            "stat_n": stats.get("n"),
            "stat_n_missing": stats.get("n_missing"),
            "stat_mean": stats.get("mean"),
            "stat_sd": stats.get("sd"),
            "stat_se": stats.get("se"),
            "stat_median": stats.get("median"),
            "stat_p25": stats.get("p25"),
            "stat_p75": stats.get("p75"),
            "stat_iqr": stats.get("iqr"),
            "stat_skewness": stats.get("skewness"),
            "stat_kurtosis": stats.get("kurtosis"),
        })

    return {
        "paper_meta": paper_meta,
        "study_meta": study_meta,
        "variables": variables,
    }


def parse_provenance(path: Path) -> list[dict]:
    """
    Parse provenance.json.

    Returns list of dicts for the provenance table.
    """
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logger.error("Failed to parse %s: %s", path, e)
        return []

    results = []
    for entry in data.get("file_provenance", []) or []:
        if not isinstance(entry, dict):
            continue
        results.append({
            "psychds_path": _safe_str(entry.get("psychds_path", "")),
            "original_rel_path": _safe_str(entry.get("original_rel_path")),
            "original_format": _safe_str(entry.get("original_format")),
            "pipeline_type": _safe_str(entry.get("pipeline_type")),
            "pipeline_group": _safe_str(entry.get("pipeline_group")),
            "pipeline_data_granularity": _safe_str(
                entry.get("pipeline_data_granularity")
            ),
            "ground_truth_validated": 1 if entry.get("ground_truth_validated") else 0,
            "txt_extraction_attempted": (
                1 if entry.get("txt_extraction_attempted") else
                (0 if "txt_extraction_attempted" in entry else None)
            ),
            "txt_extraction_skipped": (
                1 if entry.get("txt_extraction_skipped") else
                (0 if "txt_extraction_skipped" in entry else None)
            ),
            "txt_skip_reason": _safe_str(entry.get("txt_skip_reason")),
            "txt_psychds_path": _safe_str(entry.get("txt_psychds_path")),
        })

    return results
