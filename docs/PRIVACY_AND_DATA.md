# Privacy and Data Handling

mini-agi is designed to preserve raw evidence before synthesis, which is powerful and risky.

## Default stance

Assume a generated organization-memory repository is sensitive unless explicitly reviewed for publication.

The public template is safe; your populated repo may not be.

## Data classes

### Public source metadata

Examples:

- public GitHub repository names.
- public issues, pull requests, releases, and commits.
- public contributor handles.

Usually safe to store, but still review for context leakage.

### Internal operational evidence

Examples:

- private GitHub repositories.
- Slack, Discord, Telegram, email, Linear, Notion, or Google Workspace exports.
- incident notes and internal decisions.

Store only in private repositories with access controls.

### Sensitive personal or customer data

Examples:

- private messages.
- employee personal information.
- customer identifiers.
- credentials or tokens.
- security vulnerabilities before disclosure.

Avoid storing this unless there is a clear policy, access model, and retention plan.

## Raw evidence rules

- Preserve raw evidence only when it is useful for provenance.
- Keep raw evidence under `data/raw/<source>/`.
- Do not paste large raw dumps into wiki pages.
- Do not commit secrets.
- Prefer links to private systems over copying sensitive content.
- If raw evidence contains sensitive data, keep the repository private or store the evidence outside Git.

## Wiki synthesis rules

The wiki should reduce risk by compressing evidence into useful, minimal statements.

Good:

```markdown
- [[people/alice]] appears to maintain `example-org/api-gateway` based on repeated PR review and release activity in `data/raw/github/daily/2026-01-10/`.
```

Bad:

```markdown
- Full private chat transcript pasted here.
```

## Redaction checklist

Before publishing or broadening access:

- Search for tokens: `ghp_`, `github_pat_`, `sk-`, `xoxb-`, `BEGIN PRIVATE KEY`.
- Search for private domains and customer names.
- Search for private chat IDs and email addresses.
- Review `data/raw/` separately from `wiki/`.
- Verify `.gitignore` excludes generated artifacts and raw dumps you do not want in Git.
- Check commit history, not just the current tree, if secrets were ever committed.

## Recommended publication model

- Public: template, generic tools, generic docs, empty wiki structure.
- Private: organization-specific raw data and synthesized memory.
- Selective public export: hand-reviewed wiki pages with sensitive evidence paths removed or generalized.
