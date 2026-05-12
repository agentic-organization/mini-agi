# tools/cron

Automation scripts for recurring mini-agi tasks.

These scripts are meant to be wired into **any** cron system:

- Linux `crontab`
- `systemd` timers
- Hermes `cronjob` tool
- GitHub Actions `schedule`
- Any other agent runtime that supports recurring tasks

The scripts are self-contained: they discover the repo root from their own
path, `cd` there, and run the relevant tools. No environment setup beyond
Node.js (and optionally Python for embeddings) is required.

## Scripts

### `wiki-reindex.sh`

Fast BM25 rebuild after wiki changes. Safe on any machine.

```bash
tools/cron/wiki-reindex.sh
```

**When to run:** after any change to `wiki/**` or `tools/search/**`.

### `daily-ingest-and-index.sh`

Daily pipeline: optionally ingest new evidence, rebuild BM25, and optionally
produce vector embeddings.

```bash
# Just rebuild BM25
tools/cron/daily-ingest-and-index.sh

# Ingest + BM25
tools/cron/daily-ingest-and-index.sh --ingest

# Ingest + BM25 + embeddings (needs Python + sentence-transformers)
tools/cron/daily-ingest-and-index.sh --ingest --embed

# Force a specific embedding model
tools/cron/daily-ingest-and-index.sh --embed --model sentence-transformers/all-MiniLM-L6-v2
```

**Recommended daily cron:**

```cron
# At 04:00 every day: ingest + BM25 + embeddings
0 4 * * * cd /path/to/mini-agi && tools/cron/daily-ingest-and-index.sh --ingest --embed >> data/cron.log 2>&1
```

**Recommended wiki-change trigger (Hermes cronjob):**

Use a Hermes `cronjob` that polls `git diff` or watches the filesystem, then
runs `tools/cron/wiki-reindex.sh` when `wiki/` changes.

See `.agents/skills/cron-setup/SKILL.md` for the exact Hermes setup.

## RAM considerations

| Model | Size | Min RAM | Notes |
|---|---|---|---|
| `sentence-transformers/all-MiniLM-L6-v2` | ~90 MB | ~1 GB | Default. Works on a 2 GB VM. |
| `BAAI/bge-small-en-v1.5` | ~130 MB | ~1 GB | Slightly better recall. |
| `BAAI/bge-large-en-v1.5` | ~1.3 GB | ~4 GB | Workstation / GPU only. |
| `mixedbread-ai/mxbai-embed-large-v1` | ~1.3 GB | ~4 GB | Workstation / GPU only. |
| Gemma-based models (e.g. `google/gemma-2b-it`) | ~2-8 GB | > 8 GB | **Not recommended** on small machines. Even 4-bit quant needs > 2 GB. Stick to MiniLM on 2 GB hosts. |

If your machine has only 2 GB RAM total, stay with the default MiniLM model and
lower the batch size if needed (`--batch 16` or `--batch 8`).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (or dry-run) |
| 1 | Invalid argument |
| 2 | Ingestion failed |
| 3 | BM25 build failed |
| 4 | Embedding failed |
