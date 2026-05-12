# Configuration

mini-agi separates human-readable organization settings from source-specific machine inputs.

## `mini-agi.yaml`

This is the top-level configuration file for agents and humans.

```yaml
organization:
  name: "Example Organization"
  slug: "example-org"
  description: "Replace with a one-sentence description."

workflow:
  default_branch: "main"
  require_pull_requests: true
  raw_evidence_first: true

sources:
  github_watchlist: "data/sources/github-watchlist.json"

wiki:
  root: "wiki"
  link_style: "wikilink"
  preserve_history_sections: true
```

Keep this file stable and small. Do not put secrets in it.

## GitHub watchlist

Path: `data/sources/github-watchlist.json`

The daily ingestion script reads this file directly.

### Empty default

A fresh template has an empty `sources` array:

```json
{
  "version": 1,
  "defaults": {
    "include_archived": false,
    "include_forks": false,
    "repo_endpoints": ["repo", "events", "issues_updated", "pulls_updated", "commits_since", "releases"]
  },
  "sources": []
}
```

### GitHub organization source

Use this when an organization maps reasonably well to a team or product area.

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

### Explicit repository source

Use this when repositories are scattered across owners or when an org contains too much unrelated work.

```json
{
  "id": "curated-platform-repos",
  "type": "github_repos",
  "repos": [
    {
      "owner": "example-org",
      "name": "api-gateway",
      "project": "[[projects/platform]]"
    }
  ],
  "enabled": true
}
```

## Data directories

- `data/raw/` — immutable-ish source snapshots and API responses.
- `data/normalized/` — optional normalized records if you introduce a normalization step.
- `data/derived/` — optional generated analysis artifacts.
- `data/search/` — disposable search indexes and embeddings.
- `data/snapshots/` — optional higher-level snapshots.

The template gitignores generated and raw-heavy paths by default; adjust if your team intentionally version-controls raw evidence.

## Secrets

Use environment variables, GitHub Actions secrets, or local secret stores. Never commit:

- API tokens.
- private keys.
- internal chat exports with credentials.
- customer or employee private data unless your policy explicitly allows it.

## Recommended repository settings

For a team-owned memory repo:

- Private visibility by default.
- Pull requests required for `main`.
- Squash merge enabled.
- GitHub Actions enabled for smoke tests.
- Dependabot or security alerts enabled if you add dependencies.
