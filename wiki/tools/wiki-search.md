# wiki-search

**Type:** local search tool · **Status:** template-ready

## Summary

`tools/search/` builds and queries a local search index over the Markdown wiki. BM25 works everywhere; vector embeddings are optional.

## Usage

```bash
tools/search/build.sh
node tools/search/search.js "your query"
```

## History

- Template baseline: dependency-free BM25 and optional vector search included.
