from fastapi import APIRouter
from fastapi.responses import JSONResponse
from indexer.index_builder import is_indexed, is_indexing

router = APIRouter()


@router.get("/health")
async def health():
    if is_indexed():
        return {"status": "ok", "indexed": True}
    if is_indexing():
        return JSONResponse(status_code=503, content={"status": "indexing"})
    # Not started yet (should not happen in normal operation)
    return JSONResponse(status_code=503, content={"status": "indexing"})
