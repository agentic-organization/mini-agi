#!/usr/bin/env bash
# wiki-reindex.sh — fast BM25 rebuild after wiki changes.
#
# Use this when the wiki has been updated and you only need the BM25 index
# refreshed (no ingestion, no embeddings).
#
# Typical triggers:
#   - after a git pull that touched wiki/
#   - after locally editing wiki pages
#   - as a pre-commit hook (optional)
#
# Usage:
#   tools/cron/wiki-reindex.sh
#
# This script is safe to run on any machine with Node.js; it needs no Python,
# no GPU, and no embedding model.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

echo "[reindex] rebuilding BM25 search index..."
"$HERE/../search/build.sh"

CHUNKS=$(wc -l < data/search/chunks.jsonl | tr -d ' ')
echo "[reindex] done — ${CHUNKS} chunks indexed."
