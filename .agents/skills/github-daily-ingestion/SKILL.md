---
name: github-daily-ingestion
description: Run and maintain daily GitHub raw ingestion from data/sources/github-watchlist.json.
---

# GitHub Daily Ingestion

Use this to refresh raw GitHub evidence for watched repositories and organizations.

## Files

- Watchlist: `data/sources/github-watchlist.json`
- Script: `tools/ingestion/github-daily-ingest.js`
- Raw output: `data/raw/github/`

## Process

1. Review `data/sources/github-watchlist.json`.
2. Smoke-test:

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
```

3. Run ingestion:

```bash
node tools/ingestion/github-daily-ingest.js --since-hours 24
```

4. Inspect `data/raw/github/daily/<YYYY-MM-DD>/run.json`.
5. Synthesize only the meaningful changes into `wiki/`.
6. Cite the raw run path in page history sections.
7. Open a PR.

## Watchlist source types

- `github_org` — resolve public repositories from an organization.
- `github_repos` — observe explicit `owner/name` repositories.

Ingestion writes raw evidence only; wiki synthesis is a separate step.
