---
name: source-watchlist-management
description: Add, remove, and maintain machine-readable source watchlists, especially data/sources/github-watchlist.json.
---

# Source Watchlist Management

Use this when changing what the organization memory repo observes.

## Files

- `data/sources/github-watchlist.json` — active GitHub source config.
- `data/sources/github-watchlist.example.json` — template examples.
- `docs/CONFIGURATION.md` — schema and examples.

## Rules

- Add a source only when user intent or wiki context supports observing it.
- Prefer `github_org` for coherent org-owned workspaces.
- Prefer `github_repos` for curated repos under broad or unrelated owners.
- Set `enabled: false` for examples, experiments, or proposed sources.
- Keep `projects` / `project` wikilinks aligned with `wiki/projects/` pages.
- Do not put tokens or private URLs with embedded credentials in watchlists.

## Validate JSON

```bash
python3 -m json.tool data/sources/github-watchlist.json >/tmp/watchlist.json
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
```

## Common source entries

GitHub org:

```json
{
  "id": "platform-team",
  "type": "github_org",
  "owner": "example-org",
  "mode": "all_public_non_archived",
  "include_archived": false,
  "include_forks": false,
  "projects": ["[[projects/platform]]"],
  "enabled": true
}
```

Explicit repos:

```json
{
  "id": "curated-repos",
  "type": "github_repos",
  "repos": [
    {"owner": "example-org", "name": "api-gateway", "project": "[[projects/platform]]"}
  ],
  "enabled": true
}
```

## PR notes

Include why the source is watched, what it maps to in the wiki, and whether private or sensitive data may be captured.
