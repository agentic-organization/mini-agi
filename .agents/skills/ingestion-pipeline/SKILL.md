---
name: ingestion-pipeline
description: Design, run, validate, and extend the staged ingestion pipeline from raw source collection through normalization, derivation, and wiki synthesis.
---

# Ingestion Pipeline

Use this whenever adding a new source, changing ingestion outputs, creating cron jobs, validating runs, or processing raw evidence into later stages.

## Principles

- Cron/source collectors write raw evidence and `manifest.json` only.
- Normalization, derivation, and wiki synthesis are separate stages.
- Every run has a stable `run_id`.
- Every stage emits a standard `manifest.json`.
- Partial failures are visible via `status: "partial"` and `errors`.
- Wiki updates remain PR-reviewed unless explicitly configured otherwise.

## Stage order

```text
ingest → data/raw/<source>/...
normalize → data/normalized/<source>/...
derive → data/derived/...
synthesize → wiki/...
index → data/search/...
```

## Manifest validation

```bash
node tools/pipeline/validate-run.js data/raw/github/daily/<date>/manifest.json
node tools/pipeline/validate-run.js data/raw/github/daily/<date>/manifest.json --require-files
node tools/pipeline/list-runs.js --validate
```

## Adding a source collector

1. Add machine config under `data/sources/<source>.json`.
2. Add `tools/ingestion/<source>-ingest.*`.
3. Make the collector safe for cron:
   - idempotent or force-aware.
   - clear non-zero exit on fatal failure.
   - partial errors preserved in manifest.
4. Write raw payloads under `data/raw/<source>/...`.
5. Write `manifest.json` using schema version 1.
6. Add docs and a skill if the source requires special handling.
7. Add CI smoke coverage if possible without credentials.

## GitHub daily ingestion

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
node tools/ingestion/github-daily-ingest.js --since-hours 24
node tools/ingestion/github-daily-ingest.js --run-id <stable-id> --since-hours 24
```

GitHub daily ingestion writes both `run.json` and the standard `manifest.json`.

## Processing rule

Do not synthesize raw data blindly. Read manifests first, inspect run status and stats, then decide which entities deserve wiki updates.
