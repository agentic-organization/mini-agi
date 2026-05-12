# Example Walkthrough

This walkthrough uses a fictional organization and repository set.

## Scenario

You want to start organizational memory for `example-org`, which has a platform team and one important repository: `example-org/api-gateway`.

## 1. Configure the watchlist

Edit `data/sources/github-watchlist.json`:

```json
{
  "version": 1,
  "description": "GitHub repositories and organizations to observe.",
  "defaults": {
    "include_archived": false,
    "include_forks": false,
    "repo_endpoints": ["repo", "events", "issues_updated", "pulls_updated", "commits_since", "releases"]
  },
  "sources": [
    {
      "id": "platform-team",
      "type": "github_repos",
      "repos": [
        {
          "owner": "example-org",
          "name": "api-gateway",
          "project": "[[projects/api-platform]]"
        }
      ],
      "enabled": true
    }
  ]
}
```

## 2. Dry run

```bash
node tools/ingestion/github-daily-ingest.js --dry-run
```

Inspect the resolved repository list before writing raw data.

## 3. Capture evidence

```bash
node tools/ingestion/github-daily-ingest.js --since-hours 72
```

Expected output path:

```text
data/raw/github/daily/<YYYY-MM-DD>/example-org/api-gateway/
```

## 4. Create a project page

Create `wiki/projects/api-platform.md`:

```markdown
# API Platform

**Type:** project · **Status:** active

## Summary

API Platform is the project represented by `example-org/api-gateway`.

## Repositories

- `example-org/api-gateway` — raw activity captured in `data/raw/github/daily/<YYYY-MM-DD>/`.

## People and teams

- [[teams/platform]] — likely owning team; confirm from CODEOWNERS or repeated review activity.

## History

- YYYY-MM-DD: Page created from GitHub daily ingestion at `data/raw/github/daily/<YYYY-MM-DD>/`.

## Open questions

- Who is the explicit project owner?
- Are there related services or deployment repositories?
```

## 5. Create a team page

Create `wiki/teams/platform.md`:

```markdown
# Platform

**Type:** team · **Status:** inferred

## Summary

Platform is an inferred team around [[projects/api-platform]].

## Projects

- [[projects/api-platform]]

## Evidence

- Inferred from watchlist configuration and GitHub activity under `example-org/api-gateway`.

## History

- YYYY-MM-DD: Stub created during initial GitHub ingestion synthesis.

## Open questions

- Is “Platform” the team's formal name?
- Which people are members versus occasional contributors?
```

## 6. Rebuild search

```bash
tools/search/build.sh
node tools/search/search.js "api platform"
```

## 7. Open a PR

The PR body should include:

- Watchlist entry added.
- Raw evidence path.
- Wiki pages created.
- Open questions that need human confirmation.
