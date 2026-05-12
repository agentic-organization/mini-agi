# tools/search

Local search over `wiki/`.

```bash
tools/search/build.sh
node tools/search/search.js "your query"
```

BM25 is dependency-free. Vector search is optional and uses `embed.py` with sentence-transformers.
