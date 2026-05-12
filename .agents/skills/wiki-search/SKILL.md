---
name: wiki-search
description: How to build and query the wiki search layer. Use this whenever you need to search the wiki, rebuild the search index after wiki changes, or explain the search architecture to a collaborator. Embedding is the optional vector half that runs on a bigger machine — BM25 works everywhere.
---

# Wiki Search

The `mini-agi` wiki has a two-layer search system: pure-JS **BM25** (always available) and optional **sentence-transformer vectors** (built on a bigger machine). `tools/search/search.js` blends them or falls back to BM25 when vectors are absent.

## When to use this skill

- Searching the wiki from the CLI or a script.
- After any merged PR that touches `wiki/**` — rebuild the index.
- Onboarding a machine with GPU to produce/refresh embeddings.
- Diagnosing why search returns stale or missing results.

## Architecture (one line each)

1. `tools/search/walk-wiki.js` → walks `wiki/`, emits `data/search/chunks.jsonl` (one chunk per H1/H2 section; max 1500 chars).
2. `tools/search/build-bm25.js` → reads `chunks.jsonl`, writes `data/search/bm25-index.json` (Okapi BM25, k1=1.5, b=0.75).
3. `tools/search/embed.py corpus` → reads `chunks.jsonl`, writes `data/search/embeddings.{bin,meta.json}` using a user-selected sentence-transformer model.
4. `tools/search/search.js` → CLI. Loads BM25; loads vectors if present; returns top-K hits with breadcrumbs + snippets.

None of the artifacts under `data/search/` are committed. They are rebuilt on demand — the tools are authoritative, the indexes are disposable.

## Step 1 — rebuild BM25 (always)

From the repo root:

```bash
tools/search/build.sh
```

Expected output: a line like `built BM25 index: 1498 chunks, 2958 unique terms`. You can now search immediately with:

```bash
node tools/search/search.js "your query"
```

If the build count drops dramatically after a wiki change, something is wrong — inspect `data/search/chunks.jsonl` directly.

## Step 2 — embed on a bigger machine (optional)

Run this on a host with a GPU **or** at least 2 GB of free RAM for a small model:

```bash
pip install sentence-transformers numpy

python3 tools/search/embed.py corpus \
    --chunks data/search/chunks.jsonl \
    --out    data/search/embeddings.bin \
    --meta   data/search/embeddings.meta.json \
    --model  <model-id> \
    [--batch 64] [--normalize]
```

### Model choices

- `sentence-transformers/all-MiniLM-L6-v2` — 384 dim, ~90 MB, fast. Good default on a laptop.
- `BAAI/bge-large-en-v1.5` — 1024 dim, ~1.3 GB. Much better recall; ideal for a workstation or cloud GPU.
- `mixedbread-ai/mxbai-embed-large-v1` — 1024 dim, strong general-purpose.
- Any HuggingFace sentence-transformer works — `embed.py` passes the string through to `SentenceTransformer(...)`.

### Output contract

The binary is raw `float32[num_chunks][dim]`, row-major, **no header**. The meta JSON records `model_id`, `dim`, `num_chunks`, and the ordered list of `ids`. `search.js` validates file size and chunk count on load; mismatches fall back to BM25 with a stderr warning.

### Copy the embeddings back

The embedding artifacts are gitignored on purpose. To use them on the target host, copy `embeddings.bin` and `embeddings.meta.json` into `data/search/` — `search.js` picks them up automatically.

## Step 3 — query

```bash
# Auto mode: hybrid if embeddings are present, else BM25
node tools/search/search.js --k 8 "your query"

# Force one mode
node tools/search/search.js --bm25-only "callebtc cashu"
node tools/search/search.js --vector-only "who works on end-to-end encryption"

# Tune the hybrid blend (BM25 weight; default 0.5)
node tools/search/search.js --alpha 0.3 "nostr video"

# Machine-readable
node tools/search/search.js --json "cdk python"
```

Results print one hit per entry: path + chunk index, score, breadcrumb trail (`Page › Section`), and a 200-char snippet. This is enough to navigate directly to the source file for the full context.

## Pitfalls

- **Query vs corpus model mismatch.** When vectors are present, `search.js` shells out to `tools/search/embed.py --query ... --model <id>` using the `model_id` recorded in the meta JSON. If Python isn't available on the query host, use `--bm25-only`.
- **Tokenizer must match on both sides.** The BM25 side and the "text passed to the embedder" both use `title + heading + breadcrumbs + text`. If you change one, change the other — the two sides are asked to agree on what a "chunk" means.
- **Don't commit the build artifacts.** `.gitignore` already handles this. Never `git add data/search/*.jsonl` or `data/search/*.json` / `*.bin` — they regenerate from `wiki/` deterministically.
- **Stale embeddings.** If `num_chunks` in the meta doesn't match the current `chunks.jsonl`, `search.js` will warn and fall back. Rebuild corpus embeddings after material wiki changes.
- **Line-ending drift on the data side.** `chunks.jsonl` is produced from `wiki/*.md` — if any wiki file is committed with CRLF line endings, chunk splitting may degrade. The walker handles both, but keep an eye on it.

## Integration with the daily ingestion pipeline

`tools/ingestion/github-daily-ingest.js` is the obvious trigger point for a rebuild. At the end of a daily run, it is sufficient to append a call to `tools/search/build.sh`. Re-embedding is separate — only run `embed.py corpus` when the corpus has changed enough to matter, or on a schedule on the bigger machine.

## Related

- `docs/LLM_WIKI.md` §"Optional: CLI tools" — motivates building a real search engine once the index-driven approach starts to strain.
- `wiki/tools/wiki-search.md` — user-facing page for the tool.
- `data/search/README.md` — on-disk layout and embedding contract.
