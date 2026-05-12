---
name: pr-workflow
description: Make any change to this repository through a feature branch and a pull request — never push directly to main. Use this skill whenever you're about to commit changes to mini-agi (wiki edits, tool additions, skill updates, etc.). Also use when asked to "submit" / "open" / "ship" a change and when deciding the branch-name and PR-body structure. The user has explicitly set this as the default workflow for this repo.
---

# PR Workflow

This repo uses pull requests for every change. No exceptions. The user set this expectation in session #bootstrap and it applies to every subsequent change.

## Why

- Every change becomes reviewable.
- The commit on `main` is always the merged, approved state.
- The wiki's history reads as deliberate synthesis, not stream-of-consciousness edits.

## Steps

1. **Branch off `main`.** Name it by intent: `people/cashu-team`, `tools/cashu-daily-report`, `discovery/<org>`, `fix/<slug>`, etc.

   ```bash
   git checkout main && git pull --ff-only
   git checkout -b <branch-name>
   ```

2. **Make changes.** Commit incrementally if helpful; one commit is fine for small, coherent changes.

3. **Commit message** — use `-F /tmp/commitmsg.txt` when the body contains `&`, `*`, backticks, or other shell-sensitive characters. Inline `-m` with heavy special characters has burned this workflow before.

4. **Push the branch.**

   ```bash
   git push -u origin <branch-name>
   ```

5. **Open the PR with `gh pr create --body-file`** — same reasoning as commit messages. Include:
   - A **Summary** (what and why).
   - A **What's added** section listing new files and edits.
   - An **Observations / open questions** section for anything the reviewer should notice.
   - A **Sources** section when data came from outside the repo.

   ```bash
   gh pr create --base main --head <branch-name> \
     --title "<title>" --body-file /tmp/prbody.md
   ```

6. **Report the PR URL** to the user. Do not merge on their behalf unless explicitly asked.

## Do not

- `git push origin main` — ever.
- `git push --force` on `main` — ever.
- Inline `-m` with special characters — it fails silently or truncates.
- Merge a PR without the user's green light.

## Gotchas seen

- **`&` in commit/PR body via `-m`**: the Hermes shell wrapper treats trailing `&` as backgrounding. Always use `-F` / `--body-file` when the text contains `&`, `*`, or backticks.
- **Stale local `main`**: pull with `--ff-only` before branching; otherwise new branches fork off an old tip and PRs look huge.
- **Pushing a second commit to the same branch**: fine — the existing PR updates automatically. Don't close and reopen.

## Related

- Storage location of tools and skills: `tools/` (executable), `.agents/skills/` (guidance). The user reiterated this in session #marmot. All new scripts go to `tools/`; all new skills to `.agents/skills/`.
