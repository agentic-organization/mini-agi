---
name: cron-setup
description: Set up automated cronjobs for recurring mini-agi tasks (daily ingestion, BM25 reindex, vector embedding). Use this when onboarding a new machine or agent runtime.
---

# Cron Setup

Set up recurring automation for the mini-agi repository.

## What to automate

| Cadence | Task | Tool | Host |
|---|---|---|---|
| Every wiki change | BM25 reindex | `tools/cron/wiki-reindex.sh` | Local agent machine |
| Daily | Ingest + BM25 + optional embed | `tools/cron/daily-ingest-and-index.sh` | Local agent machine |

BM25 indexing is cheap (seconds, Node-only). Vector embedding is heavier and
should run on the machine with enough RAM/GPU.

## Hermes cronjob setup

### 1. Daily ingestion + indexing + embedding

Create a daily job that runs at 04:00 UTC:

```
cronjob action=create
  name: mini-agi-daily
  schedule: "0 4 * * *"
  prompt: |
    Run the daily mini-agi pipeline in /path/to/mini-agi:
    1. cd to the repo
    2. Run: tools/cron/daily-ingest-and-index.sh --ingest --embed
    3. Report chunk count and embedding status.
    If the repo has uncommitted changes, do NOT commit them automatically;
    just report them. Use the terminal tool for shell commands.
  workdir: /path/to/mini-agi
  toolsets: ["terminal"]
```

For a 2 GB RAM machine, use `--model sentence-transformers/all-MiniLM-L6-v2`
and `--batch 16` to stay safe:

```
cronjob action=create
  name: mini-agi-daily-small
  schedule: "0 4 * * *"
  prompt: |
    Run the daily mini-agi pipeline in /path/to/mini-agi:
    1. cd to the repo
    2. Run: tools/cron/daily-ingest-and-index.sh --ingest --embed --model sentence-transformers/all-MiniLM-L6-v2 --batch 16
    3. Report chunk count, embedding dim, and any errors.
    Do not auto-commit. Use terminal tool.
  workdir: /path/to/mini-agi
  toolsets: ["terminal"]
```

### 2. BM25 reindex on wiki changes (file-system watcher)

Hermes cronjobs do not natively watch the filesystem, but you can poll every
15 minutes and diff `wiki/`:

```
cronjob action=create
  name: mini-agi-wiki-watch
  schedule: "*/15 * * * *"
  prompt: |
    In /path/to/mini-agi, check if wiki/ or tools/search/ have changed since
    the last run (compare git HEAD or a timestamp file). If they have, run
    tools/cron/wiki-reindex.sh and report the new chunk count. If nothing
    changed, stay silent. Use terminal tool.
  workdir: /path/to/mini-agi
  toolsets: ["terminal"]
```

### 3. BM25 reindex via GitHub Action (template repo CI)

The template repo already includes `.github/workflows/wiki-index.yml`. This
validates that the wiki still indexes cleanly after every PR that touches
`wiki/**`. It uploads the built index as an artifact for inspection.

No Hermes setup needed for this — it is repo-native.

## Generic crontab setup (non-Hermes)

Add to your system crontab:

```cron
# Daily at 04:00: ingest, BM25, and embeddings
0 4 * * * cd /path/to/mini-agi && tools/cron/daily-ingest-and-index.sh --ingest --embed >> data/cron.log 2>&1

# Every 15 min: reindex BM25 if wiki changed (uses a stamp file)
*/15 * * * * cd /path/to/mini-agi && bash -c 'if [[ wiki/ -nt data/search/.last_reindex ]]; then tools/cron/wiki-reindex.sh && touch data/search/.last_reindex; fi' >> data/cron.log 2>&1
```

## RAM safety

- Default embedding model: `sentence-transformers/all-MiniLM-L6-v2` (~90 MB,
  works on 2 GB RAM).
- Larger models (`bge-large`, `mxbai-embed-large`, Gemma-based) need 4+ GB.
- If embedding OOMs, the script exits with code 4 and BM25 is still usable.

## Verification

After creating a cronjob, force a test run:

```bash
cronjob action=run job_id=<id>
```

Or run the scripts manually first:

```bash
tools/cron/wiki-reindex.sh
tools/cron/daily-ingest-and-index.sh --dry-run --ingest --embed
```
