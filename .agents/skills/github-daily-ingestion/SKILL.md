---
name: github-daily-ingestion
description: Run and maintain the daily GitHub raw ingestion pipeline for this org-memory repo. Use this skill whenever the user asks to scrape, ingest, refresh, observe, index, or synthesize GitHub repository activity across the watched projects, especially for daily runs using tools/ingestion/github-daily-ingest.js and the LLM Wiki update loop.
---

# GitHub Daily Ingestion

This skill runs the daily GitHub evidence pipeline and turns the new raw evidence into focused wiki updates. It is the recurring operational path after projects have been added to the wiki and need ongoing observation.

The conceptual model comes from [`docs/LLM_WIKI.md`](../../../docs/LLM_WIKI.md): preserve raw sources first, then incrementally update the wiki as compressed, interlinked organizational memory.

## When to use this

Use this when the user asks for any of these:

- Run the daily GitHub scraper.
- Refresh repository activity for watched projects.
- Ingest new GitHub activity into `data/raw/github/`.
- Update the wiki from recent GitHub evidence.
- Add or remove repositories from the GitHub watchlist.
- Diagnose a daily ingestion run.

For one-time bootstrapping of a new GitHub organization into people/team/project pages, use [`github-org-discovery`](../github-org-discovery/SKILL.md) first. For ongoing daily runs after the org is known, use this skill.

## Core files

- Watchlist: [`data/sources/github-watchlist.json`](../../../data/sources/github-watchlist.json)
- Raw GitHub README: [`data/raw/github/README.md`](../../../data/raw/github/README.md)
- Ingestion script: [`tools/ingestion/github-daily-ingest.js`](../../../tools/ingestion/github-daily-ingest.js)
- Tool page: [`wiki/tools/github-daily-ingest.md`](../../../wiki/tools/github-daily-ingest.md)
- Wiki method reference: [`docs/LLM_WIKI.md`](../../../docs/LLM_WIKI.md)

## Pipeline

Follow this sequence.

1. **Check the worktree and branch.** This repo uses PRs for changes. Load [`pr-workflow`](../pr-workflow/SKILL.md) if you are going to edit files, commit, push, or open a PR.
2. **Review the watchlist.** Read `data/sources/github-watchlist.json`. Confirm the relevant orgs/repos are enabled. Do not infer new watched sources from raw GitHub data alone; add them only when the wiki or user intent supports watching them.
3. **Dry run.** Use `node tools/ingestion/github-daily-ingest.js --dry-run --limit 3` to confirm `gh` auth, repo resolution, and output paths.
4. **Run ingestion.** Use `node tools/ingestion/github-daily-ingest.js --since-hours 24`. If rerunning the same date intentionally, add `--force`.
5. **Inspect run metadata.** Read `data/raw/github/daily/<YYYY-MM-DD>/run.json`. Check `repos_attempted`, `repos_with_errors`, `watchlist_errors`, and endpoint counts.
6. **Handle failures conservatively.** Expected empty-repo or disabled-feature cases may be recorded as empty arrays by the tool. Real endpoint errors should stay visible in `run.json` and be summarized in the final response or PR body.
7. **Synthesize wiki updates.** Apply the LLM Wiki pattern: identify affected projects, tools, teams, and people; read existing pages before editing; make small incremental updates with provenance in `## History`.
8. **Update tool/source documentation when behavior changes.** Keep `data/raw/github/README.md`, `tools/ingestion/README.md`, and `wiki/tools/github-daily-ingest.md` consistent with actual outputs.
9. **Verify.** Run a dry-run smoke test and a lightweight grep for stale raw paths or broken assumptions. Do not run a cron job unless the user explicitly asks.

## Watchlist rules

The watchlist is the source of truth for daily ingestion. It lives in `data/sources/` instead of `wiki/` because the script needs stable machine-readable input.

Supported source types:

- `github_org` — resolve all public repos from a GitHub organization using `gh api /orgs/<owner>/repos`.
- `github_repos` — list individual `owner/name` repositories.

Use org mode when the wiki treats a GitHub organization as an engineering team, such as `marmot-protocol`, `divinevideo`, `soapbox-pub`, or `cashubtc`.

Use individual repo mode when the project is a single repo under an owner that is broader than the project, such as `zapstore/zapstore` or `DanConwayDev/ngit-cli`.

## Raw data layout

The daily tool writes raw evidence only:

```text
data/raw/github/org-discovery/<YYYY-MM-DD>/<org>/snapshot.json
data/raw/github/daily/<YYYY-MM-DD>/run.json
data/raw/github/daily/<YYYY-MM-DD>/commands.sh
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/repo.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/events.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/issues-updated.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/pulls-updated.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/commits-since.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/releases.json
data/raw/github/daily/<YYYY-MM-DD>/<owner>/<repo>/meta.json
```

Do not write directly from ingestion into `wiki/`. Synthesis is a separate step.

## Synthesis guidance

After ingestion, use the wiki as cognitive compression, not as a dump of run statistics.

Good updates:

- Add a tool history entry when the ingestion surface changes.
- Update a team page when observation coverage expands or contracts.
- Update a project page when the canonical repo, watched repos, or activity evidence changes.
- Add open questions when raw evidence reveals ambiguity.

Avoid:

- Creating pages for every repo automatically.
- Copying raw event counts into many pages without interpretation.
- Silently overwriting previous claims. Append or sharpen with dated provenance.

Always cite the run path, for example `data/raw/github/daily/2026-05-07/`, in the page's `## History` section when a page is updated from a daily run.

## Useful commands

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
node tools/ingestion/github-daily-ingest.js --since-hours 24
node tools/ingestion/github-daily-ingest.js --since-hours 24 --force
node tools/ingestion/github-daily-ingest.js --only cashubtc/cdk --since-hours 24
```

Summarize a run:

```bash
node -e "const fs=require('fs'); const run=JSON.parse(fs.readFileSync('data/raw/github/daily/2026-05-07/run.json','utf8')); console.log({repos:run.repos_attempted, errors:run.repos_with_errors})"
```

## Current known behavior

- The tool uses `gh api`, not `curl`, and does not require `GITHUB_TOKEN`.
- The `pulls` endpoint does not accept a `since` parameter, so `pulls-updated.json` is a raw recent page that should be filtered during normalization or synthesis.
- Empty repositories may return HTTP 409 for commits; the tool records these as empty `commits-since.json` arrays with a note in `meta.json`.
- Repositories with issues disabled may return HTTP 404 for pulls/issues endpoints; expected disabled-feature cases should be treated as no data, not fatal ingestion failure.

## PR expectations

When opening a PR for a daily ingestion run, include:

- Run date and `run.json` path.
- Number of repositories attempted and endpoint errors.
- Watchlist changes, if any.
- Wiki pages updated from the run.
- Open questions or follow-up synthesis needed.
