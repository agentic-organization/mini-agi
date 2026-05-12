---
name: wiki-search
description: Build and query the local wiki search layer.
---

# Wiki Search

Use this when searching the wiki, rebuilding indexes after wiki changes, or diagnosing missing search results.

## Build BM25

```bash
tools/search/build.sh
```

## Query

```bash
node tools/search/search.js "your query"
node tools/search/search.js --k 10 --bm25-only "alice platform"
node tools/search/search.js --json "deployment ownership"
```

## Optional embeddings

```bash
pip install sentence-transformers numpy
python3 tools/search/embed.py corpus --model sentence-transformers/all-MiniLM-L6-v2 --normalize
```

Do not commit generated `data/search/*` artifacts.
