---
name: template-release-audit
description: Audit this template repository before release or after major changes to ensure it remains generic, usable, and safe.
---

# Template Release Audit

Use this before tagging, announcing, or materially updating the public mini-agi template.

## Audit steps

1. Fresh clone the repository.
2. Scan for organization-specific remnants.
3. Build search.
4. Run ingestion dry-run with the empty watchlist.
5. Validate JSON config files.
6. Check GitHub template flag.
7. Review README and docs links.

## Commands

```bash
python3 -m json.tool data/sources/github-watchlist.json >/tmp/watchlist.json
python3 -m json.tool data/sources/github-watchlist.example.json >/tmp/watchlist.example.json
tools/search/build.sh
node tools/search/search.js "github ingestion"
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
gh repo view <owner>/<repo> --json isTemplate,visibility,url
```

## Genericity scan

Customize the term list for the source organization before public release.

```bash
python3 - <<'PY'
from pathlib import Path
terms = ['TODO_ORG_SPECIFIC_TERM']
for p in Path('.').rglob('*'):
    if '.git' in p.parts or not p.is_file():
        continue
    text = p.read_text(errors='ignore').lower()
    for term in terms:
        if term.lower() in text:
            print(f'{p}: {term}')
PY
```

## Release criteria

- No source-organization content remains.
- Empty watchlist works.
- Example watchlist is disabled by default.
- Search builds from starter wiki.
- Docs explain setup, privacy, config, and the operating loop.
- Skills cover onboarding, source management, synthesis, privacy review, and PR workflow.
