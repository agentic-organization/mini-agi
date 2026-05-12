---
name: llm-wiki
description: Maintain and evolve the living Markdown knowledge base in wiki/.
---

# LLM Wiki

Use this whenever editing `wiki/`, creating pages, or synthesizing evidence into organization memory.

## Principles

- The wiki is synthesized memory, not a dump of raw evidence.
- Keep pages small, focused, and densely linked.
- Prefer incremental updates over rewrites.
- Preserve uncertainty as open questions.
- Cite compact evidence for non-obvious claims.
- Use wikilinks like `[[people/alice]]`, `[[teams/platform]]`, and `[[projects/example-project]]`.

## Update loop

1. Identify affected people, teams, projects, repositories, tools, systems, and decisions.
2. Read existing pages before editing.
3. Create a stub when an entity is important but under-specified.
4. Append or sharpen claims with evidence.
5. Update reciprocal links when a new relationship emerges.
6. Add a `## History` entry for meaningful changes.
7. Open a PR for review.

## Page skeleton

```markdown
# <Title>

**Type:** <person/team/project/tool/etc.> · **Status:** <active/stub/unknown>

## Summary
n/a yet.

## Relationships
- Related to [[...]].

## Evidence
- Source: `data/raw/<source>/...`

## History
- YYYY-MM-DD: Page created from <source>.

## Open questions
- What still needs confirmation?
```

## Anti-patterns

- Copying raw event logs into the wiki.
- Creating pages for every trivial mention.
- Presenting speculation as fact.
- Keeping orphan pages with no links.
- Maintaining a separate graph that contradicts the wiki.
