# Ingestion Pipeline

mini-agi uses a staged pipeline so multiple source-specific cron jobs can feed a shared organization-memory system without coupling collection to interpretation.

## Stage diagram

```text
             cron / manual trigger / webhook
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│ 1. Ingest                                        │
│ Source-specific collectors write raw evidence.   │
│ tools/ingestion/<source>.js                      │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ data/raw/<source>/<family>/<date>/               │
│ - manifest.json                                  │
│ - source payloads                                │
│ - source-specific run summaries                  │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ 2. Normalize                                     │
│ Source-specific payloads become common records.  │
│ data/normalized/<source>/<date>/<run-id>/        │
│ people.jsonl, repositories.jsonl, events.jsonl   │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ 3. Derive                                        │
│ Cross-source facts, links, diffs, summaries.     │
│ data/derived/<date>/<run-id>/                    │
│ entity-links.jsonl, ownership-hints.jsonl        │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ 4. Synthesize                                    │
│ Agent-reviewed wiki updates through PRs.         │
│ wiki/people, teams, projects, tools, decisions   │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│ 5. Index                                         │
│ Disposable retrieval artifacts.                  │
│ data/search/chunks.jsonl, bm25-index.json        │
└──────────────────────────────────────────────────┘
```

## Core rule

Cron jobs should normally stop at raw ingestion.

They should write evidence plus a `manifest.json`, then exit. Normalization, derivation, and wiki synthesis are separate steps so collection stays reliable and interpretation stays reviewable.

## Standard manifest

Every pipeline run writes a manifest with this shape:

```json
{
  "schema_version": 1,
  "run_id": "20260101T000000Z-github-daily",
  "source": "github",
  "stage": "raw",
  "status": "success",
  "source_config": "data/sources/github-watchlist.json",
  "collector": "tools/ingestion/github-daily-ingest.js",
  "started_at": "2026-01-01T00:00:00.000Z",
  "finished_at": "2026-01-01T00:00:02.000Z",
  "inputs": {
    "since_hours": 24
  },
  "outputs": [
    {
      "path": "data/raw/github/daily/2026-01-01/run.json",
      "kind": "legacy_run_summary",
      "count": 1
    }
  ],
  "errors": [],
  "stats": {
    "repos_attempted": 0
  }
}
```

Required fields:

- `schema_version`: currently `1`.
- `run_id`: stable identifier for the run.
- `source`: source family such as `github`, `slack`, `linear`, `email`.
- `stage`: `raw`, `normalized`, `derived`, or `snapshot`.
- `status`: `success`, `partial`, `failed`, or `running`.
- `source_config`: source config path, or `null`.
- `collector`: script/tool that produced the run.
- `started_at`, `finished_at`: ISO timestamps; `finished_at` may be `null` while running.
- `inputs`: object describing input parameters.
- `outputs`: array of produced files.
- `errors`: array of structured errors.
- `stats`: object with stage-specific metrics.

## Tooling

List manifests:

```bash
node tools/pipeline/list-runs.js
node tools/pipeline/list-runs.js --stage raw --source github --json
node tools/pipeline/list-runs.js --validate
```

Validate one manifest:

```bash
node tools/pipeline/validate-run.js data/raw/github/daily/<date>/manifest.json
node tools/pipeline/validate-run.js data/raw/github/daily/<date>/manifest.json --require-files
```

## GitHub pipeline status

`tools/ingestion/github-daily-ingest.js` now writes both:

- `run.json` — legacy/source-specific summary for humans and existing automation.
- `manifest.json` — standard pipeline contract consumed by generic pipeline tools.

It also accepts:

```bash
node tools/ingestion/github-daily-ingest.js --run-id <stable-id>
```

## Adding a new source

A new source collector should:

1. Read source config from `data/sources/<source>.json` or equivalent.
2. Write raw payloads under `data/raw/<source>/...`.
3. Write `manifest.json` with `stage: "raw"`.
4. Avoid writing directly to `wiki/`.
5. Be safe to run from cron.
6. Make partial failures visible in `errors` and `status: "partial"`.
7. Include enough `outputs` entries for downstream processors to discover files.

## Normalization contract

A normalizer should read raw manifests and write a new normalized-stage manifest. Suggested files:

```text
data/normalized/<source>/<date>/<run-id>/manifest.json
data/normalized/<source>/<date>/<run-id>/people.jsonl
data/normalized/<source>/<date>/<run-id>/repositories.jsonl
data/normalized/<source>/<date>/<run-id>/events.jsonl
data/normalized/<source>/<date>/<run-id>/messages.jsonl
data/normalized/<source>/<date>/<run-id>/projects.jsonl
```

Use JSONL so later processors can stream large sources.

## Derivation contract

A derivation step should combine normalized records into cross-source hints:

```text
data/derived/<date>/<run-id>/manifest.json
data/derived/<date>/<run-id>/entity-links.jsonl
data/derived/<date>/<run-id>/ownership-hints.jsonl
data/derived/<date>/<run-id>/activity-summary.md
data/derived/<date>/<run-id>/open-questions.jsonl
```

Derived artifacts should support wiki synthesis, not replace it.

## Wiki synthesis remains reviewable

The wiki is the final human- and agent-readable memory layer. Keep it PR-based unless an operator explicitly enables automatic wiki-writing automation.
