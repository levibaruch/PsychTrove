# PsychTrove

A read-only web viewer for dataset outputs generated with [DataCheck](https://github.com/levibaruch/metacheck-datacheck/tree/dev). Browse psychology papers, search variables across the corpus, and download data — all from a single Docker command.

## Quick Start

```bash
cd viewer
PSYCHDS_DIR=/path/to/psychds docker-compose up --build
```

Open **http://localhost:3000**.

## What it does

- **Browse papers** — metadata, study groups, file manifests, and pipeline status
- **Search variables** — full-text search by column name or codebook description across all papers
- **Download** — stream ZIP archives of a full paper, a single study group, or a cross-paper variable collection
- **Provenance** — every data point traces back to its source file and pipeline stage

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLite FTS5 |
| Frontend | React 18, Vite 5 |
| Infra | Docker, docker-compose |

## Docs

- [`viewer/README.md`](viewer/README.md) — environment variables, dev setup, architecture
- [`specs/001-datacheck-viewer/`](specs/001-datacheck-viewer/) — full spec and design docs
