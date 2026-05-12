---
name: github-org-discovery
description: Discover repositories, public members, and active contributors for a GitHub organization, then synthesize wiki pages.
---

# GitHub Org Discovery

Use this to bootstrap a new GitHub organization into the wiki.

## Snapshot first

```bash
mkdir -p data/raw/github/org-discovery/<YYYY-MM-DD>/<org>
GITHUB_TOKEN=$(gh auth token) \
  node tools/ingestion/github-org-discover.js <org> \
  --contributors-top 10 --recent-days 180 \
  > data/raw/github/org-discovery/<YYYY-MM-DD>/<org>/github-org-discover.json
```

## Review before synthesis

Look for:

- Archived repositories.
- Forks and mirrors.
- Trivial repositories that do not need pages.
- Bot accounts.
- Identity collisions with existing people pages.

## Synthesize

- Create or update `wiki/teams/<org-or-team>.md`.
- Create project pages for meaningful repositories.
- Create people stubs for active contributors when useful.
- Add history entries citing the raw snapshot path.
- Add open questions instead of guessing.

Open a PR with counts, exclusions, created/updated pages, and the raw snapshot path.
