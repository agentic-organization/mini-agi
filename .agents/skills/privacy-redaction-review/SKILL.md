---
name: privacy-redaction-review
description: Review organization-memory changes for secrets, private data, and unsafe publication before pushing or publishing.
---

# Privacy Redaction Review

Use this before making a repository public, adding new data sources, broadening access, or committing raw evidence from private systems.

## Checklist

1. Read `docs/PRIVACY_AND_DATA.md`.
2. Check current tree for common secret patterns.
3. Review `data/raw/` separately from `wiki/`.
4. Review source configs for private endpoints or embedded credentials.
5. Confirm whether the repository should remain private.
6. If a secret was committed, treat git history as contaminated and rotate the secret.

## Local scan

```bash
python3 - <<'PY'
from pathlib import Path
patterns = ['ghp_', 'github_pat_', 'sk-', 'xoxb-', 'BEGIN PRIVATE KEY', 'nsec', 'AKIA']
for p in Path('.').rglob('*'):
    if '.git' in p.parts or not p.is_file():
        continue
    text = p.read_text(errors='ignore')
    for pattern in patterns:
        if pattern in text:
            print(f'{p}: {pattern}')
PY
```

## Publication model

- Public: generic template, empty wiki structure, generic tools.
- Private: raw organizational evidence and synthesized internal memory.
- Selective export: reviewed pages with sensitive evidence removed.

## PR notes

When privacy is relevant, state:

- what sources were added.
- whether data is public or private.
- whether raw evidence is committed.
- what redaction checks were run.
