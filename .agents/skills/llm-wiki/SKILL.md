---
name: llm-wiki
description: Maintain and evolve the living Markdown knowledge base in wiki/. Use this skill whenever editing any file under wiki/, creating a new wiki page, integrating a newly-ingested source into organizational memory, resolving contradictions between existing pages and new evidence, or synthesizing people/team/project/skill/tool understanding into human- and agent-readable pages. Also use when deciding whether an observation deserves a new page, a stub, or an update to an existing page.
---

# LLM Wiki

The wiki in `wiki/` is the cognitive substrate of the Organization Intelligence Agent. It is **not documentation**. It is persistent, compounding memory — a dense, interlinked Markdown graph that the agent writes, reads, and rewrites continuously.

The canonical reference for this pattern is [`docs/LLM_WIKI.md`](../../../docs/LLM_WIKI.md) (Karpathy's LLM Wiki gist, copied verbatim). Read it if you haven't — the rest of this skill assumes the core idea: **compile knowledge once, then keep it current**.

---

## Why the wiki exists

Retrieval-at-query-time (plain RAG) forces rediscovery of the same relationships every time a question is asked. That's wasteful and lossy. The wiki instead is:

- **Agent-readable memory** — future agents load wiki pages as context instead of re-deriving.
- **Human-readable memory** — collaborators can browse in Obsidian or on GitHub.
- **A synthesis layer** — contradictions are surfaced in the pages, not hidden in source dumps.
- **A compression system** — a well-maintained page replaces hundreds of raw messages.

Every wiki edit either adds a new fact, sharpens an existing one, or flags a contradiction. If an edit doesn't do one of those three things, it probably shouldn't be made.

---

## Page types

These live under `wiki/<type>/<slug>.md`. Each has its own section README explaining the full field set.

| Type | Path | Primary purpose |
|---|---|---|
| people | `wiki/people/` | One canonical page per person |
| teams | `wiki/teams/` | Explicit and implicit teams |
| projects | `wiki/projects/` | Projects and their lifecycle |
| repositories | `wiki/repositories/` | One per repo — owners, related projects |
| products | `wiki/products/` | Products composed of projects/repos |
| decisions | `wiki/decisions/` | Decision records |
| communication | `wiki/communication/` | Channels, threads, recurring forums |
| systems | `wiki/systems/` | Running services — owners, dependencies |
| architecture | `wiki/architecture/` | Overviews spanning multiple systems |
| timelines | `wiki/timelines/` | Temporal views (org history, project lifecycles) |
| concepts | `wiki/concepts/` | Cross-cutting concepts, recurring patterns |
| glossary | `wiki/glossary/` | Short definitional entries |
| skills | `wiki/skills/` | One per skill — experts, tools, importance |
| tools | `wiki/tools/` | One per tool — skill mappings, users |

If an observation doesn't fit any of these, either it maps to a page type you haven't noticed yet, or you need to propose a new page type. Don't force it.

---

## Core design principles

### 1. Dense interlinking

Pages exist to be navigated. Link aggressively, using the wikilink form:

```markdown
[[people/alice-smith]]
[[teams/infrastructure]]
[[projects/payment-platform]]
[[skills/kubernetes]]
[[tools/kubectl]]
```

A page with no outbound links is a red flag — either the entity is genuinely isolated (worth noting) or you haven't done the work yet. Every person page should link to teams, projects, repositories, skills, and frequent collaborators. Every skill page should link to experts, tools, teams, repos.

**Why:** graph density is what makes the wiki more useful than its raw sources. The links *are* the synthesis.

### 2. Small composable pages

Target: one screen of content per page. A person page should rarely exceed 100 lines. If a page balloons, split sub-topics into linked pages (e.g., move a long project history into `wiki/timelines/payment-platform-history.md` and link from the project page).

**Why:** small pages are cheaper to load into an LLM context, easier to keep current, and more readily interlinkable.

### 3. Incremental evolution

Pages are written once, then updated incrementally. Don't rewrite a page from scratch when new evidence arrives — integrate the new information, update what changed, preserve what's still true.

Three useful moves:

- **Append** an observation (with date or evidence ref) when it's new context.
- **Sharpen** an existing statement when new evidence makes it more specific.
- **Flag a contradiction** when new evidence conflicts with old. Don't silently overwrite — leave a visible note. Example:

  ```markdown
  ## Role
  - Infrastructure lead (current, per team page and recent commits)
  - ~~Data engineer (2024, per old Slack bio)~~ — conflicts with current role; transitioned mid-2025.
  ```

**Why:** preserving the history of understanding is itself valuable. It tells future agents which facts are stable and which are in flux.

### 4. Evidence at the edge

When you assert something non-obvious on a page, leave a trace — the source, the graph edge, or a confidence hint. Keep it compact:

```markdown
- Owns `infra/k8s-config` (commit activity 2025-Q4, CODEOWNERS)
- Likely skill: [[skills/kubernetes]] — confidence high (deployment authorship + incident response)
```

**Why:** claims without evidence rot. Agents reading the wiki later need to know what to trust.

### 5. Stub-and-grow

When a new entity is mentioned but you don't have enough to write a full page, create a **stub** — a minimal page with the name, type, one or two known facts, and a TODO marker:

```markdown
# Bob Li

**Status:** stub — mentioned in [[teams/data-platform]] and 3 commits to `data/etl-pipeline`; identity not yet resolved.

## Known
- GitHub account: `bobli`
- Active in: `data-platform` channel (Slack)

<!-- TODO: confirm identity, team membership, skills -->
```

Stubs are valid. They make the link graph work and let future passes fill in detail.

**Why:** waiting until you have a "complete" page means wikilinks break and context is lost. A stub is strictly better than a broken link.

---

## The update loop

When integrating new evidence (a fresh ingestion run, a ticket, a set of commits), follow roughly this loop. The agent should adapt, not follow rigidly.

1. **Identify affected entities.** Which people, teams, repos, skills, tools does this evidence touch?
2. **For each, find or create the page.** If the page exists, read it in full. If not, create a stub.
3. **Integrate.** Append, sharpen, or flag contradictions per the principles above. Keep edits minimal and focused.
4. **Update links.** If a new relationship emerged (e.g., person X now contributes to project Y), both endpoint pages should reflect it.
5. **Check the section index.** If you created a new page, make sure `wiki/index.md` or the relevant section README still accurately reflects top-level entry points. (The section README rarely needs updates; the index almost never does.)
6. **Update the graph.** The materialized graph in `graph/entities.json` and `graph/relationships.json` should reflect new entities/edges. If you're only touching the wiki in a given pass, leave a note for the graph-sync tool.

---

## Anti-patterns

Avoid these. They degrade the wiki's usefulness as memory:

- **Monolithic pages.** If a page tries to be the single source of truth for a whole team's history, split it.
- **Silent overwrites.** Don't delete an old statement when new evidence arrives — show the transition.
- **Unsourced claims.** "Alice is the lead" with no backing evidence is just a rumor.
- **Orphan pages.** A page with no incoming links isn't discoverable; fix the link graph.
- **Duplicates.** Before creating a new page, search for existing ones (the same person may appear under multiple handles — resolve via `directory/identities/` before writing a second page).
- **Speculation presented as fact.** If you infer something, mark it: "likely", "inferred", plus the evidence.
- **Editorial commentary.** The wiki is a model of the organization, not an opinion of it. "Bob seems disengaged" doesn't belong; "Bob's commit frequency dropped 80% since Q3" does.

---

## Relationship to other parts of the repo

- [`docs/LLM_WIKI.md`](../../../docs/LLM_WIKI.md) — the pattern. Read it first.
- [`wiki/index.md`](../../../wiki/index.md) — master entry point; linked from every section.
- [`graph/`](../../../graph/) — the machine-queryable mirror of the wiki's relationships. Wiki is prose; graph is structure. They should agree.
- [`directory/identities/`](../../../directory/identities/) — identity resolution. Always resolve an account to a canonical person before creating a wiki/people/ page.
- [`tools/synthesis/`](../../../tools/synthesis/) — the builders that generate and update wiki pages programmatically. When a manual pattern stabilizes, promote it to a script here.

---

## This skill evolves

Everything above is the current best understanding. As the organization is observed, ingestion stabilizes, and the wiki accumulates, this skill should change:

- New page types get added (and bad ones retired).
- Patterns that work well get promoted from anti-patterns to principles, or vice versa.
- Section READMEs may absorb specifics this skill only sketches.
- Scripts in `tools/synthesis/` may make some manual steps obsolete.

When you notice a gap, patch it. When you notice a rule isn't helping, remove it. Commit the change with a message explaining what shifted.
