---
name: github-org-discovery
description: Discover all projects, members, and active contributors of a GitHub organization and ingest them into the wiki. Use this skill whenever a user asks to map, enumerate, bootstrap, or ingest the projects and team of a GitHub org (e.g. "discover all projects from the whitenoise team", "map the cashubtc org", "list the projects under marmot-protocol and who works on them"). Also use when starting a fresh investigation into an unknown GitHub organization's footprint, when you need a snapshot of which repos are active vs. dormant, or when identifying who the regular contributors are across an org.
---

# GitHub Org Discovery

How to map a GitHub organization — repositories, members, active contributors — and turn that map into interlinked wiki pages.

## When to use this

Triggers:
- "Discover all projects from the <X> team/org."
- "Map the <X> GitHub organization."
- "Who contributes to <X> and what are they working on?"
- Bootstrapping a team we haven't ingested yet.

## Why it exists

Foundry projects aren't uniform. Some live under a single GitHub org (`cashubtc`, `parres-hq`, `marmot-protocol`), others are scattered across maintainers. When a user points at an org, we want:

1. A machine-readable snapshot (for provenance and later diffs).
2. Project pages in the wiki for each non-trivial repository.
3. People pages for active contributors, linked to the projects they work on.
4. A team page grouping it all — explicit if the org is the team, inferred otherwise.

The tool [`tools/ingestion/github-org-discover.js`](../../../tools/ingestion/github-org-discover.js) handles step 1. This skill describes steps 2–4 and the conventions that keep the result consistent with the rest of the wiki.

## Process

### 1. Snapshot the org

```bash
node tools/ingestion/github-org-discover.js <org> \
  --contributors-top 10 \
  --recent-days 180 \
  > data/raw/github/org-discovery/<YYYY-MM-DD>/<org>/github-org-discover.json
```

Useful flags:

- `--include-archived` — include archived repos (off by default; archived repos are usually not project-worthy).
- `--exclude <names>` — drop repos the user explicitly tells you to skip (e.g. archive mirrors, vendor dumps).
- `--contributors-top N` — controls how deep per-repo contributor sampling goes.
- `GITHUB_TOKEN` env var — strongly recommended; without it you're limited to 60 API req/h.

Output is a single JSON document. Keep it. It's the provenance record for the wiki pages you're about to create.

### 2. Review the snapshot before writing

Read the JSON. Don't generate pages blindly. Look for:

- **Archived-but-notable repos** (e.g. `whitenoise-archive`). The user often wants these excluded — ask or honor an explicit exclusion.
- **Trivial repos** — dotfiles, `.github`, `homepage`, test fixtures. These rarely deserve their own project page. List them in the team page instead.
- **Forks masquerading as projects** — even with `--include-forks` off, check for "soft forks" with different names.
- **Bot accounts in contributors** — `renovate[bot]`, `dependabot[bot]`, `github-actions[bot]`. Drop them.
- **Identity collisions** — a handle might already exist elsewhere in the wiki under a different org. Resolve via `directory/identities/` first, then reuse the existing person page.

### 3. Create project pages

One page per non-trivial repository, under `wiki/projects/<slug>.md`. The slug is the repo name, lowercased, hyphenated.

Required sections (use the [llm-wiki](../llm-wiki/SKILL.md) skill's conventions):

- Title, status, hub, organization links.
- Summary (one paragraph, drawn from repo description and README when possible).
- Website (homepage field, if set).
- Repository (full `<host> · <org>/<slug>` link).
- Tags / concepts (from the repo's GitHub topics, plus obvious inferences).
- Owners & contributors (link to team page + the top contributors as `[[people/*]]`).
- Organizational relevance (how it ties to the hub/team/larger project).
- History (always start with a dated "Page created from discovery of …" line).
- Open questions (what you couldn't determine from the snapshot).

If a repo is tiny/specialized and doesn't warrant a full page, skip it — mention it on the team page as "Also: `org/repo-name` — <one-liner>".

### 4. Create people pages

One page per **active contributor** — defined as appearing in `active_contributors` in the snapshot output (i.e., commits to a recently-pushed repo within the window).

Follow the [llm-wiki](../llm-wiki/SKILL.md) conventions:

- Role, scope, responsibilities.
- Only things you can evidence from the snapshot: which repos, how many contributions, GitHub URL.
- **No performance/ranking language** (see the llm-wiki anti-patterns).
- Accounts section: GitHub always, Nostr / Telegram / email only when known.
- Open questions section with "Full name?" "Formal org affiliation?" "Communication channels?"

If a person already has a page from another org (e.g., `callebtc` appears in both `cashubtc` and the new org), **do not create a duplicate** — append to the existing page with a new "Projects" and "Repositories" entry.

### 5. Create / update the team page

The team page groups the people and projects:

- `wiki/teams/<team-slug>.md`.
- Link to the GitHub org, a one-line mission (from the org description or inferred).
- Group members by role/focus area if known, else flat-list.
- List all project pages you created, plus any "also" repos that got a line but not a page.
- Platform-coverage observations are welcome (descriptive only, no judgment).
- Open questions — governance, funding, communication channels.

### 6. Update upstream indexes

- Add each new project to `wiki/projects/index.md`.
- Add each new person to `wiki/people/index.md` under the right team.
- If the team is under [[teams/foundry]] or a new hub, update that hub's page too.

### 7. Open a PR, not a direct push

Always branch and open a PR. Suggested branch name: `discovery/<org-slug>`. PR body should include:

- What was discovered (counts).
- What was excluded and why.
- Any identity collisions you resolved.
- A link to the raw snapshot JSON in `data/raw/github/`.

## Conventions and gotchas

- **Snapshot first, always.** The JSON is cheap, regenerable, and proves what you saw at a given moment. Future diffs between snapshots are how we detect org changes.
- **Contributor sampling is best-effort.** The `/contributors` endpoint is sorted by contribution count and capped; it undercounts recent activity. Treat "active contributors" as a starting point, not a truth.
- **Archived repos are signal, not noise.** A repo named `<name>-archive` typically means the project moved or was rebranded. Note it on the team page even if you skip the project page.
- **Don't ingest what the user excluded.** If they say "except whitenoise-archive", that's binding. Log it in the PR body.
- **Respect skill boundaries.** This skill creates the skeleton. Deeper enrichment — pulling README content, resolving Nostr keys, inferring skills from commit patterns — happens in follow-up passes or other skills.

## Evolution

This skill is young. Expect to revise it as:

- More orgs are ingested (`parres-hq`, `soapbox-pub`, `coracle-social`, …).
- Identity-resolution patterns emerge that belong in a sibling skill.
- The tool grows additional outputs (commit graphs, language breakdowns, release cadence).

Patch it when a convention changes. Keep it lean.
