"""
Paper discovery from the psychds/ directory tree.

Reads conversion_summary.csv to find successful (paper_id, study_group) pairs,
then maps them to study directory paths. Falls back to globbing for
dataset_description.json if the CSV is absent.
"""

import csv
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def _study_dir_for_group(paper_dir: Path, study_group: str) -> Path | None:
    """
    Map a study_group label to its directory path under paper_dir.

    study_group=single → find the only study dir or study-ex1
    Otherwise → study-{study_group}
    """
    if study_group == "single":
        # Find the only study directory present
        candidates = [
            d for d in paper_dir.iterdir()
            if d.is_dir() and d.name.startswith("study-")
            and (d / "dataset_description.json").exists()
        ]
        if len(candidates) == 1:
            return candidates[0]
        ex1 = paper_dir / "study-ex1"
        if ex1.exists() and (ex1 / "dataset_description.json").exists():
            return ex1
        return candidates[0] if candidates else None

    study_dir = paper_dir / f"study-{study_group}"
    if study_dir.exists() and (study_dir / "dataset_description.json").exists():
        return study_dir

    # Some papers store data flat at the paper root (no study subdirectory)
    if (paper_dir / "dataset_description.json").exists():
        return paper_dir

    return None


def discover_study_dirs(psychds_dir: str) -> list[tuple[str, str, Path]]:
    """
    Return list of (paper_id: str, study_group: str, study_dir: Path)
    for all successfully converted study groups.

    paper_id is always treated as a string (never cast to int/float).
    """
    root = Path(psychds_dir)
    results: list[tuple[str, str, Path]] = []

    summary_csv = root / "conversion_summary.csv"
    if summary_csv.exists():
        try:
            with open(summary_csv, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # paper_id MUST stay as string
                    paper_id = str(row.get("paper_id", "")).strip()
                    study_group = str(row.get("study_group", "")).strip()
                    success = str(row.get("success", "")).strip().upper()

                    if not paper_id or not study_group:
                        continue
                    if success not in ("TRUE", "1", "T", "YES"):
                        continue

                    paper_dir = root / paper_id
                    if not paper_dir.is_dir():
                        logger.warning("Paper dir not found: %s", paper_dir)
                        continue

                    study_path = _study_dir_for_group(paper_dir, study_group)
                    if study_path is None:
                        logger.warning(
                            "No study dir for paper=%s group=%s", paper_id, study_group
                        )
                        continue

                    results.append((paper_id, study_group, study_path))

            logger.info("Discovered %d study groups from conversion_summary.csv", len(results))
            return results

        except Exception as e:
            logger.error("Failed to read conversion_summary.csv: %s", e)
            # Fall through to glob fallback

    # Fallback: glob for dataset_description.json
    logger.warning("Falling back to directory glob for study discovery")
    for desc_file in root.rglob("dataset_description.json"):
        study_path = desc_file.parent
        paper_dir = study_path.parent
        paper_id = str(paper_dir.name)

        # study_group derived from directory name: study-ex1 → ex1
        dir_name = study_path.name
        if dir_name.startswith("study-"):
            study_group = dir_name[len("study-"):]
        else:
            study_group = dir_name

        results.append((paper_id, study_group, study_path))

    logger.info("Discovered %d study groups via glob fallback", len(results))
    return results
