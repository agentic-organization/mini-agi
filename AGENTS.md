# Organization Intelligence Agent

## Objective

Build and maintain an evolving organizational memory: a repository that stores raw evidence, reusable tools, and a living Markdown wiki that compresses what the agent learns about an organization.

The repository is not the runtime. The repository is the durable memory and provenance log.

## Core loop

```text
Observe
→ Ingest raw evidence
→ Synthesize wiki pages from evidence
→ Cross-link aggressively
→ Update tools when a repeated pattern emerges
→ Commit changes through a pull request
→ Repeat
```

## Design principles

- Preserve raw evidence before synthesis.
- Keep the wiki small, composable, and densely linked.
- Treat the wiki as the derived structure; do not maintain a parallel ontology unless the wiki no longer suffices.
- Record uncertainty and open questions directly on pages.
- Make every non-obvious claim traceable to evidence.
- Prefer incremental page updates over wholesale rewrites.
- Use pull requests for changes so memory evolution stays reviewable.

## Repository structure

```text
mini-agi/
  README.md
  AGENTS.md
  mini-agi.yaml

  docs/
    LLM_WIKI.md

  tools/
    ingestion/
      github-daily-ingest.js
      github-org-discover.js
    search/
      build.sh
      walk-wiki.js
      build-bm25.js
      search.js
      embed.py

  data/
    sources/
      github-watchlist.json
      github-watchlist.example.json
    raw/
    search/
    normalized/
    derived/
    snapshots/

  wiki/
    index.md
    people/
    teams/
    projects/
    repositories/
    products/
    decisions/
    communication/
    systems/
    architecture/
    timelines/
    concepts/
    glossary/
    skills/
    tools/

  .agents/
    skills/
```

Directories can be added or removed as the organization demands; avoid empty scaffolding that nobody uses.

## Wiki conventions

Use wikilinks for internal references:

```markdown
[[people/alice]]
[[teams/platform]]
[[projects/payment-platform]]
[[repositories/example-org/api-gateway]]
[[tools/github-daily-ingest]]
```

Page types:

- `wiki/people/<slug>.md` — one canonical page per person or account.
- `wiki/teams/<slug>.md` — explicit or inferred groups of people.
- `wiki/projects/<slug>.md` — projects and initiatives.
- `wiki/repositories/<owner>/<repo>.md` — source repositories when repo-level memory matters.
- `wiki/tools/<slug>.md` — operational tools and scripts.
- `wiki/decisions/<slug>.md` — durable decisions and context.

Every substantial page should include:

- Summary
- Evidence / sources
- Relationships / links
- History
- Open questions

## Evidence layout

Raw evidence belongs under `data/raw/<source>/`.

For GitHub ingestion:

```text
data/raw/github/org-discovery/<YYYY-MM-DD>/<org>/snapshot.json
data/raw/github/daily/<YYYY-MM-DD>/run.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/*.json
```

Generated indexes and embeddings belong under `data/search/` and are not committed.

## Agent workflow

Before editing, load relevant skills from `.agents/skills/` if your agent runtime supports skills.

Important skills:

- `mini-agi-onboarding` — set up a new repository from the template.
- `source-watchlist-management` — add and maintain observed sources.
- `github-daily-ingestion` — daily GitHub evidence pipeline.
- `github-org-discovery` — bootstrap a GitHub organization into wiki pages.
- `evidence-to-wiki-synthesis` — turn raw evidence into compact wiki updates.
- `llm-wiki` — wiki synthesis conventions.
- `wiki-search` — build and query local search.
- `privacy-redaction-review` — check for secrets and sensitive data before publishing.
- `template-release-audit` — verify the template remains generic and usable.
- `pr-workflow` — branch, commit, push, and open a PR.

Never commit credentials or private tokens. Never write source-derived secrets into the public wiki.
