import threading
from fastapi import APIRouter
from config import PSYCHDS_DIR
from indexer.index_builder import build_index, is_indexing

router = APIRouter()


@router.post("/admin/reindex")
async def reindex():
    if is_indexing():
        return {"status": "already_running"}
    thread = threading.Thread(target=build_index, args=(PSYCHDS_DIR,), daemon=True)
    thread.start()
    return {"status": "started"}
