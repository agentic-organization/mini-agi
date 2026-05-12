---
name: evidence-to-wiki-synthesis
description: Turn raw source evidence into compact, linked wiki updates without dumping raw data.
---

# Evidence to Wiki Synthesis

Use this after an ingestion run or source snapshot has produced raw evidence under `data/raw/`.

## Inputs

- Raw evidence path, for example `data/raw/github/daily/<date>/`.
- Existing wiki pages under `wiki/`.
- Source configuration under `data/sources/`.

## Process

1. Inspect run metadata first (`run.json`, snapshot summary, or source manifest).
2. Identify affected entities:
   - people
   - teams
   - projects
   - repositories
   - tools
   - systems
   - decisions
3. Read existing pages before editing.
4. Update only pages where evidence changes understanding.
5. Add stubs for important new entities.
6. Cite compact evidence paths in `## History` or `## Evidence`.
7. Add open questions instead of guessing.
8. Rebuild search after wiki changes.

## Good synthesis

```markdown
- YYYY-MM-DD: Daily GitHub run at `data/raw/github/daily/YYYY-MM-DD/` showed renewed activity on `example-org/api-gateway`; [[people/alice]] reviewed multiple changes, so ownership remains likely with [[teams/platform]].
```

## Bad synthesis

- Pasting raw JSON into wiki pages.
- Adding every repository event as a bullet.
- Creating people pages for one-off bot activity.
- Replacing old claims without explaining what changed.

## Verification

```bash
tools/search/build.sh
node tools/search/search.js "<entity or project>"
```

PR body should list raw paths, pages updated, and remaining uncertainty.
