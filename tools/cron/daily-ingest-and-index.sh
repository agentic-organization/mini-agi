#!/usr/bin/env bash
# daily-ingest-and-index.sh — daily automation for ingestion, BM25 indexing,
# and optional vector embedding.
#
# Designed to run from cron, systemd timer, or an agent cronjob.
# Safe for small machines: BM25 is always cheap; embedding is opt-in and
# defaults to a 90 MB model that runs in < 1 GB RAM.
#
# Usage:
#   tools/cron/daily-ingest-and-index.sh
#   tools/cron/daily-ingest-and-index.sh --ingest
#   tools/cron/daily-ingest-and-index.sh --ingest --embed
#   tools/cron/daily-ingest-and-index.sh --embed --model sentence-transformers/all-MiniLM-L6-v2
#   MINI_AGI_EMBED_MODEL=BAAI/bge-small-en-v1.5 tools/cron/daily-ingest-and-index.sh --embed
#
# Flags:
#   --ingest         Run tools/ingestion/github-daily-ingest.js before indexing.
#   --embed          Run tools/search/embed.py corpus after BM25 build.
#   --model <id>     Override the embedding model (env: MINI_AGI_EMBED_MODEL).
#   --batch <n>      Embedding batch size (default: 32; lower on small RAM).
#   --dry-run        Print what would run without executing.
#   --verbose        Print every command before execution.
#
# Exit codes:
#   0 — success (or dry-run)
#   1 — invalid argument
#   2 — ingestion failed
#   3 — BM25 build failed
#   4 — embedding failed

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

INGEST=false
EMBED=false
MODEL="${MINI_AGI_EMBED_MODEL:-sentence-transformers/all-MiniLM-L6-v2}"
BATCH="${MINI_AGI_EMBED_BATCH:-32}"
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ingest)   INGEST=true; shift ;;
    --embed)    EMBED=true;  shift ;;
    --model)
      [[ -n "${2:-}" ]] || { echo "error: --model requires an argument" >&2; exit 1; }
      MODEL="$2"; shift 2 ;;
    --batch)
      [[ -n "${2:-}" ]] || { echo "error: --batch requires an argument" >&2; exit 1; }
      BATCH="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    --verbose)  VERBOSE=true; shift ;;
    -*)
      echo "error: unknown flag $1" >&2
      echo "usage: $0 [--ingest] [--embed] [--model <id>] [--batch <n>] [--dry-run] [--verbose]" >&2
      exit 1 ;;
    *)
      echo "error: unexpected positional argument $1" >&2
      exit 1 ;;
  esac
done

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    $VERBOSE && echo "[run] $*" >&2
    "$@"
  fi
}

echo "[cron] mini-agi daily ingest + index"
echo "[cron] repo:  $ROOT"
echo "[cron] ingest: $INGEST"
echo "[cron] embed:  $EMBED (model=$MODEL, batch=$BATCH)"
echo ""

# ── 1. Ingest ───────────────────────────────────────────────────────────────
if $INGEST; then
  echo "[cron] running daily GitHub ingestion..."
  run node "$HERE/../ingestion/github-daily-ingest.js" --since-hours 24 || {
    echo "[cron] ingestion failed with exit code $?" >&2
    exit 2
  }
  echo "[cron] ingestion complete."
  echo ""
fi

# ── 2. BM25 index ───────────────────────────────────────────────────────────
echo "[cron] rebuilding BM25 search index..."
run "$HERE/../search/build.sh" || {
  echo "[cron] BM25 build failed with exit code $?" >&2
  exit 3
}
echo "[cron] BM25 index ready."
echo ""

# ── 3. Vector embedding (optional) ─────────────────────────────────────────
if $EMBED; then
  echo "[cron] generating vector embeddings..."
  echo "[cron] model: $MODEL  batch: $BATCH"

  # Warn if the model looks large relative to small machines.
  case "$MODEL" in
    *large*|*bge*|*mxbai*|*e5*|*Gemma*|*gemma*)
      echo "[cron] WARNING: '$MODEL' may need > 2 GB RAM."
      echo "[cron] If this machine has limited memory, interrupt now (Ctrl-C) or use a smaller model."
      echo "[cron] Safe defaults for 2 GB RAM:  sentence-transformers/all-MiniLM-L6-v2"
      echo "[cron] Continuing in 5 seconds..."
      $DRY_RUN || sleep 5
      ;;
  esac

  run python3 "$HERE/../search/embed.py" corpus \
    --chunks data/search/chunks.jsonl \
    --out    data/search/embeddings.bin \
    --meta   data/search/embeddings.meta.json \
    --model  "$MODEL" \
    --batch  "$BATCH" \
    --normalize || {
    echo "[cron] embedding failed with exit code $?" >&2
    exit 4
  }
  echo "[cron] embeddings ready."
  echo ""
fi

# ── 4. Summary ──────────────────────────────────────────────────────────────
echo "[cron] done."
if ! $DRY_RUN; then
  CHUNKS=$(wc -l < data/search/chunks.jsonl | tr -d ' ') || true
  echo "[cron] $CHUNKS chunks in BM25 index."
  if $EMBED && [[ -f data/search/embeddings.meta.json ]]; then
    EMB_DIM=$(python3 -c 'import json; print(json.load(open("data/search/embeddings.meta.json"))["dim"])' 2>/dev/null || true)
    EMB_COUNT=$(python3 -c 'import json; print(json.load(open("data/search/embeddings.meta.json"))["num_chunks"])' 2>/dev/null || true)
    echo "[cron] $EMB_COUNT chunks embedded (dim=$EMB_DIM)."
  fi
fi
