# tools/ingestion

Source-specific data fetchers for the Organization Intelligence Agent. Ingestion scripts save raw evidence; they do **not** write into `wiki/` directly.

## `github-daily-ingest.js`

Reads `data/sources/github-watchlist.json`, resolves watched GitHub orgs through the `gh` CLI, and stores raw per-repository API responses for later wiki synthesis.

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
node tools/ingestion/github-daily-ingest.js --since-hours 24
```

Output:

```text
data/raw/github/org-discovery/<YYYY-MM-DD>/<org>/snapshot.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/*.json
data/raw/github/daily/<YYYY-MM-DD>/manifest.json
data/raw/github/daily/<YYYY-MM-DD>/run.json
data/raw/github/daily/<YYYY-MM-DD>/commands.sh
```

`manifest.json` is the standard pipeline manifest. `run.json` is a GitHub-specific summary kept for compatibility and human inspection.

Flags: `--watchlist <path>`, `--out <path>`, `--date <YYYY-MM-DD>`, `--since-hours N`, `--limit N`, `--only owner/repo`, `--run-id <id>`, `--dry-run`, `--force`.

## `github-org-discover.js`

Maps a GitHub organization — repositories, members, recently-active contributors — into a single JSON document. Use it as the first pass when bootstrapping a team in the wiki.

```bash
GITHUB_TOKEN=$(gh auth token) \
  node tools/ingestion/github-org-discover.js <org> \
  --contributors-top 10 --recent-days 180 \
  > data/raw/github/org-discovery/<YYYY-MM-DD>/<org>/github-org-discover.json
```
