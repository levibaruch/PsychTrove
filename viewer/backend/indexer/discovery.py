"""
Paper discovery from the psychds/ directory tree.

Walks paper_id directories, finds study-* subdirs (or flat dataset_description.json).
No dependency on conversion_summary.csv.
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def discover_study_dirs(psychds_dir: str) -> list[tuple[str, str, Path]]:
    """
    Return list of (paper_id: str, study_group: str, study_dir: Path)
    by scanning psychds_dir folder-by-folder.

    paper_id is always a string — never cast to int/float.
    """
    root = Path(psychds_dir)
    results: list[tuple[str, str, Path]] = []

    if not root.is_dir():
        logger.error("psychds_dir does not exist: %s", root)
        return results

    for paper_dir in sorted(root.iterdir()):
        if paper_dir.name.startswith(".") or paper_dir.name.startswith("._"):
            continue
        try:
            if not paper_dir.is_dir():
                continue
        except OSError:
            continue

        paper_id = str(paper_dir.name)

        # Nested: paper_dir/study-{group}/dataset_description.json
        study_dirs = []
        for d in paper_dir.iterdir():
            if d.name.startswith(".") or d.name.startswith("._"):
                continue
            try:
                if d.is_dir() and d.name.startswith("study-") and (d / "dataset_description.json").exists():
                    study_dirs.append(d)
            except OSError:
                continue

        if study_dirs:
            for study_dir in sorted(study_dirs):
                study_group = study_dir.name[len("study-"):]
                results.append((paper_id, study_group, study_dir))
        elif (paper_dir / "dataset_description.json").exists():
            # Flat: dataset_description.json lives directly in paper_dir
            results.append((paper_id, "single", paper_dir))
        else:
            logger.debug("No dataset_description.json found under %s — skipping", paper_dir)

    logger.info("Discovered %d study dirs across %s", len(results), psychds_dir)
    return results
