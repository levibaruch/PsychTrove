import logging
import threading

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import INDEX_ON_START, LOG_LEVEL, PSYCHDS_DIR
from indexer.index_builder import build_index
from routers import health, corpus, papers, variables, downloads, pipeline, admin

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="PsychDS Viewer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"error": str(exc)})


app.include_router(health.router)
app.include_router(corpus.router, prefix="/api")
app.include_router(papers.router, prefix="/api")
app.include_router(variables.router, prefix="/api")
app.include_router(downloads.router, prefix="/api")
app.include_router(pipeline.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    if INDEX_ON_START:
        logger.info("Starting background indexer for %s", PSYCHDS_DIR)
        thread = threading.Thread(
            target=build_index, args=(PSYCHDS_DIR,), daemon=True
        )
        thread.start()
    else:
        logger.info("INDEX_ON_START=false — skipping automatic indexing")
