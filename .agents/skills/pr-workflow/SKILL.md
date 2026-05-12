---
name: pr-workflow
description: Make repository changes through a feature branch and pull request instead of direct pushes to the default branch.
---

# PR Workflow

Use this whenever editing files, committing, pushing, or publishing changes.

## Steps

1. Start clean from the default branch.

```bash
git checkout main
git pull --ff-only
```

2. Create a focused branch.

```bash
git checkout -b <type>/<short-description>
```

3. Make the change.
4. Verify it with the smallest useful command.
5. Commit with a clear message.
6. Push and open a PR.

```bash
git push -u origin HEAD
gh pr create --title "<title>" --body-file /tmp/pr-body.md
```

## PR body

Include:

- Summary
- What changed
- Verification
- Sources/evidence, when data was ingested
- Open questions

## Pitfall

For multi-line commit messages or PR bodies, write the body to a temporary file and use `git commit -F` or `gh pr create --body-file` to avoid shell quoting issues.
