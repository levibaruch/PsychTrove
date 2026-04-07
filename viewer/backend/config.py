import os

PSYCHDS_DIR = os.environ.get("PSYCHDS_DIR", "/data/psychds")
INDEX_ON_START = os.environ.get("INDEX_ON_START", "true").lower() == "true"
INDEX_MAX_WORKERS = int(os.environ.get("INDEX_MAX_WORKERS", "4"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "info")
DB_PATH = os.environ.get("DB_PATH", "/tmp/viewer_index.db")
