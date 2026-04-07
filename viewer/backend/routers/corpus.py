import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from db.schema import get_connection

router = APIRouter()


def _get_stats():
    conn = get_connection()
    try:
        n_papers = conn.execute("SELECT COUNT(*) FROM papers").fetchone()[0]
        n_study_groups = conn.execute("SELECT COUNT(*) FROM study_groups").fetchone()[0]
        n_variables = conn.execute("SELECT COUNT(*) FROM variables").fetchone()[0]
        n_labelled = conn.execute(
            "SELECT COUNT(*) FROM variables WHERE description IS NOT NULL"
        ).fetchone()[0]
        n_gt = conn.execute(
            "SELECT COUNT(*) FROM provenance WHERE ground_truth_validated=1"
        ).fetchone()[0]
        meta = {
            row["key"]: row["value"]
            for row in conn.execute("SELECT key, value FROM _meta").fetchall()
        }
        return {
            "n_papers": n_papers,
            "n_study_groups": n_study_groups,
            "n_variables": n_variables,
            "n_labelled_variables": n_labelled,
            "n_ground_truth_validated_files": n_gt,
            "pipeline_version": meta.get("pipeline_version"),
            "last_indexed": meta.get("last_indexed"),
        }
    finally:
        conn.close()


@router.get("/corpus/stats")
async def corpus_stats():
    try:
        loop = asyncio.get_event_loop()
        stats = await loop.run_in_executor(None, _get_stats)
        return stats
    except Exception as e:
        return JSONResponse(status_code=503, content={"error": str(e)})
