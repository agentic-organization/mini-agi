#!/usr/bin/env bash
# build.sh — rebuild the wiki search index.
#
# Runs the parts that don't need a GPU/embedding model:
#   1) walk wiki/ into data/search/chunks.jsonl
#   2) build data/search/bm25-index.json from the chunks
#
# The embedding step is intentionally NOT run here — it is meant to be
# executed on a bigger machine with a model. After running this script,
# you have a fully functional BM25 search. To add vector search, run:
#
#   python3 tools/search/embed.py corpus \
#       --chunks data/search/chunks.jsonl \
#       --out    data/search/embeddings.bin \
#       --meta   data/search/embeddings.meta.json \
#       --model  <your-sentence-transformer-model-id>
#
# See .agents/skills/wiki-search/SKILL.md for the full workflow.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

mkdir -p data/search

echo "[build] walking wiki/ -> data/search/chunks.jsonl"
node "$HERE/walk-wiki.js" > data/search/chunks.jsonl

echo "[build] building BM25 -> data/search/bm25-index.json"
node "$HERE/build-bm25.js" \
    --in  data/search/chunks.jsonl \
    --out data/search/bm25-index.json

CHUNKS=$(wc -l < data/search/chunks.jsonl | tr -d ' ')
echo ""
echo "[build] done — ${CHUNKS} chunks indexed."
echo "[build] BM25-only search is ready:"
echo "          node tools/search/search.js \"your query\""
echo ""
if [[ ! -f data/search/embeddings.bin ]]; then
  echo "[build] embeddings.bin not present. To add vector search, on a bigger machine run:"
  echo "          python3 tools/search/embed.py corpus --model <model-id>"
  echo ""
  echo "[build] see .agents/skills/wiki-search/SKILL.md for the recommended models."
else
  EMB_COUNT=$(python3 -c 'import json; print(json.load(open("data/search/embeddings.meta.json"))["num_chunks"])' 2>/dev/null || echo "?")
  if [[ "$EMB_COUNT" != "$CHUNKS" ]]; then
    echo "[build] WARNING: existing embeddings were built for ${EMB_COUNT} chunks but corpus now has ${CHUNKS}."
    echo "                  re-run tools/search/embed.py corpus to refresh."
  else
    echo "[build] existing embeddings appear consistent with the new corpus."
  fi
fi
