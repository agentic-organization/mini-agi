# Operating Loop

The mini-agi loop is simple and repeatable:

```text
Observe → Ingest → Synthesize → Cross-link → Review → Repeat
```

## 1. Observe

Decide what changed or what you need to understand.

Examples:

- A new GitHub organization should be mapped.
- Watched repositories need daily activity refresh.
- A project changed maintainers.
- A tool or system appeared repeatedly in evidence.

## 2. Ingest

Capture raw evidence before writing conclusions.

For GitHub daily ingestion:

```bash
node tools/ingestion/github-daily-ingest.js --since-hours 24
```

For GitHub organization discovery:

```bash
GITHUB_TOKEN=$(gh auth token) node tools/ingestion/github-org-discover.js <org> --contributors-top 10 --recent-days 180
```

Raw evidence should be inspectable and reproducible enough that future agents can audit the synthesis.

## 3. Synthesize

Read the raw evidence and update the wiki with compact claims.

A synthesis pass should answer:

- Which people, teams, projects, repositories, tools, or systems changed?
- Which relationships became clearer?
- Which claims are still uncertain?
- Which pages need history entries?

Do not create a page for every event. Create or update pages when the information improves the organization model.

## 4. Cross-link

Links are the structure.

When adding a relationship, usually update both sides:

- person ↔ project.
- project ↔ repository.
- team ↔ project.
- tool ↔ workflow.
- decision ↔ affected system.

Use wikilinks:

```markdown
[[people/alice]]
[[teams/platform]]
[[projects/api-platform]]
[[repositories/example-org/api-gateway]]
```

## 5. Review through PR

A pull request should include:

- raw evidence paths.
- wiki pages changed.
- interpretation summary.
- uncertainty and follow-up questions.
- verification commands.

## 6. Repeat

A healthy memory repo evolves in small, frequent passes.

Avoid:

- giant once-a-quarter rewrites.
- raw-data dumping without synthesis.
- unreviewed main-branch edits.
- deleting old uncertainty without explaining what resolved it.

## Cadence ideas

- Daily: run source ingestion for high-activity sources.
- Weekly: synthesize important changes into wiki pages.
- Monthly: review stale pages and open questions.
- Quarterly: prune unused tools and update skills.
