# tools/pipeline

Generic utilities for pipeline run manifests.

## Validate a run

```bash
node tools/pipeline/validate-run.js data/raw/github/daily/<date>/manifest.json
node tools/pipeline/validate-run.js data/raw/github/daily/<date>/manifest.json --require-files
```

## List runs

```bash
node tools/pipeline/list-runs.js
node tools/pipeline/list-runs.js --stage raw --source github --json
node tools/pipeline/list-runs.js --validate
```

See `docs/INGESTION_PIPELINE.md` for the full stage contract.
