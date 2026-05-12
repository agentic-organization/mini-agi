#!/usr/bin/env python3
"""
embed.py — generate sentence-transformer embeddings for the wiki chunks.

Two modes:

  Corpus mode (produce the index used by search.js):
    python3 tools/search/embed.py corpus \\
        --chunks data/search/chunks.jsonl \\
        --out    data/search/embeddings.bin \\
        --meta   data/search/embeddings.meta.json \\
        --model  sentence-transformers/all-MiniLM-L6-v2 \\
        [--batch 64] [--normalize]

  Query mode (called by search.js to embed a single query):
    python3 tools/search/embed.py --query "your search text" --model <model-id>

Corpus output shape:
  embeddings.bin         raw float32[num_chunks][dim], row-major, no header
  embeddings.meta.json   { model_id, dim, num_chunks, built_at, ids: [...] }

Query-mode prints JSON to stdout:
  { "model_id": "...", "dim": D, "vector": [..D floats..] }

Design notes:
  * We do NOT hardcode a model. The user selects on their big-machine run.
  * `all-MiniLM-L6-v2` is a reasonable default (384 dim, 90MB, fast). For
    bigger machines consider `BAAI/bge-large-en-v1.5` (1024 dim) or
    `mixedbread-ai/mxbai-embed-large-v1` (1024 dim) for better recall.
  * Query embeddings MUST use the same model_id the corpus was built with.
    search.js reads embeddings.meta.json and passes that model_id back here.
  * --normalize L2-normalizes each corpus vector at write time, which makes
    cosine scoring slightly cheaper on the Node side. (search.js handles
    either case — it always L2-normalizes internally.)

Dependencies:
  pip install sentence-transformers numpy

This script is committed to the repo but is **not run in CI or in routine
wiki maintenance** — embedding belongs on a machine with a GPU or enough
RAM for the chosen model. See .agents/skills/wiki-search/SKILL.md.
"""

import argparse
import json
import os
import sys
from pathlib import Path


def die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def load_chunks(path):
    chunks = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            chunks.append(json.loads(line))
    return chunks


def chunk_to_text(c):
    """Build the text that gets embedded. Mirrors what build-bm25 indexes so
    BM25 and vector agree on what a 'chunk' means."""
    parts = [c.get("title", ""), c.get("heading", "")]
    bc = c.get("breadcrumbs") or []
    if bc:
        parts.append(" / ".join(bc))
    parts.append(c.get("text", ""))
    return "\n".join(p for p in parts if p)


def run_corpus(args):
    try:
        import numpy as np
        from sentence_transformers import SentenceTransformer
    except ImportError:
        die(
            "missing dependency. Run:\n  pip install sentence-transformers numpy\n"
            "then re-run this script."
        )

    chunks = load_chunks(args.chunks)
    if not chunks:
        die(f"no chunks found in {args.chunks}")

    texts = [chunk_to_text(c) for c in chunks]
    print(f"[embed] loading model: {args.model}", file=sys.stderr)
    model = SentenceTransformer(args.model)
    dim = model.get_sentence_embedding_dimension()
    print(f"[embed] model dim = {dim}", file=sys.stderr)

    print(f"[embed] encoding {len(texts)} chunks...", file=sys.stderr)
    vectors = model.encode(
        texts,
        batch_size=args.batch,
        show_progress_bar=True,
        normalize_embeddings=args.normalize,
        convert_to_numpy=True,
    ).astype(np.float32)

    if vectors.shape != (len(texts), dim):
        die(f"unexpected vector shape: {vectors.shape}")

    # Write raw float32 bytes, row-major
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    vectors.tofile(args.out)
    print(f"[embed] wrote {args.out} ({vectors.nbytes} bytes)", file=sys.stderr)

    meta = {
        "version": 1,
        "model_id": args.model,
        "dim": dim,
        "num_chunks": len(texts),
        "normalized": bool(args.normalize),
        "built_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "ids": [c["id"] for c in chunks],
    }
    with open(args.meta, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"[embed] wrote {args.meta}", file=sys.stderr)


def run_query(args):
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        die("missing dependency. Run: pip install sentence-transformers")
    model = SentenceTransformer(args.model)
    vec = model.encode([args.query], normalize_embeddings=False, convert_to_numpy=True)[0]
    print(json.dumps({
        "model_id": args.model,
        "dim": len(vec),
        "vector": [float(x) for x in vec],
    }))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")

    c = sub.add_parser("corpus", help="embed the whole chunks.jsonl")
    c.add_argument("--chunks", default="data/search/chunks.jsonl")
    c.add_argument("--out",    default="data/search/embeddings.bin")
    c.add_argument("--meta",   default="data/search/embeddings.meta.json")
    c.add_argument("--model",  default="sentence-transformers/all-MiniLM-L6-v2")
    c.add_argument("--batch",  type=int, default=64)
    c.add_argument("--normalize", action="store_true",
                   help="L2-normalize corpus vectors at write time")

    # Query mode uses top-level flags (matches the way search.js calls us).
    p.add_argument("--query", help="embed a single query string and print JSON to stdout")
    p.add_argument("--model", dest="qmodel", default="sentence-transformers/all-MiniLM-L6-v2",
                   help="model id to use for --query")

    args = p.parse_args()

    if args.query:
        # Re-route to query mode with the top-level --model.
        class A: pass
        a = A()
        a.query = args.query
        a.model = args.qmodel
        run_query(a)
        return

    if args.cmd == "corpus":
        run_corpus(args)
        return

    p.print_help()
    sys.exit(2)


if __name__ == "__main__":
    main()
