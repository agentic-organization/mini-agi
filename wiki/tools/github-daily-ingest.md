# github-daily-ingest

**Type:** ingestion script · **Status:** template-ready

## Summary

`tools/ingestion/github-daily-ingest.js` reads `data/sources/github-watchlist.json`, resolves watched GitHub orgs/repos, and stores raw GitHub API responses under `data/raw/github/`.

## Usage

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
node tools/ingestion/github-daily-ingest.js --since-hours 24
```

## History

- Template baseline: generic GitHub daily ingestion tool included for new organization memory repositories.
