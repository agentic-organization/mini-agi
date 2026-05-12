---
name: mini-agi-onboarding
description: Set up a new organization memory repository from this template and verify the first working loop.
---

# mini-agi Onboarding

Use this when a user creates a fresh repository from the mini-agi template or asks how to start using it for their organization.

## Process

1. Read `README.md`, `docs/GETTING_STARTED.md`, and `mini-agi.yaml`.
2. Update `mini-agi.yaml` with organization name, slug, and description.
3. Review `docs/PRIVACY_AND_DATA.md` before adding private sources.
4. Configure `data/sources/github-watchlist.json`.
5. Verify GitHub CLI auth:

```bash
gh auth status
```

6. Smoke-test ingestion:

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
```

7. Build search:

```bash
tools/search/build.sh
node tools/search/search.js "github ingestion"
```

8. Create the first PR with configuration and initial wiki stubs.

## Good first pages

- `wiki/teams/<team>.md`
- `wiki/projects/<project>.md`
- `wiki/tools/<tool>.md`
- `wiki/decisions/<decision>.md`

## Success criteria

- The repo has a configured source watchlist.
- Ingestion dry-run works.
- Search builds successfully.
- At least one wiki page links to evidence or configuration.
- Changes are proposed through a PR.
