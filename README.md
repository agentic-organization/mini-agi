# mini-agi template

A template repository for building persistent organizational memory with an agent-maintained Markdown wiki.

The repository is **not** the agent runtime. It is the agent's durable memory: source configurations, raw evidence, reusable ingestion tools, and a living wiki inspired by Karpathy's [LLM Wiki](docs/LLM_WIKI.md) pattern.

## What this gives you

- A wiki-centric structure for people, teams, projects, repositories, systems, decisions, and tools.
- GitHub ingestion scripts that preserve raw evidence before synthesis.
- A local BM25 search layer with optional sentence-transformer embeddings.
- Agent skills for the Observe → Ingest → Synthesize → PR loop.
- A clean starting point with no organization-specific data.

## Quick start

See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for the full onboarding flow.

1. Create a repo from this template.
2. Edit `mini-agi.yaml` with your organization name and operating preferences.
3. Edit `data/sources/github-watchlist.json` with the GitHub orgs/repos you want to observe.
4. Authenticate GitHub CLI:

```bash
gh auth login
```

5. Smoke-test ingestion:

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
```

6. Start writing/synthesizing the wiki from evidence:

```text
Observe → Ingest raw evidence → Synthesize wiki pages → Cross-link → Open PR → Repeat
```

## Layout

```text
.agents/       reusable agent skills
 data/         source configs, raw evidence, generated search artifacts
 docs/         reference docs, including the LLM Wiki pattern
 tools/        ingestion and search tools
 wiki/         living Markdown knowledge base
 AGENTS.md     operating instructions for agents working in this repo
 mini-agi.yaml organization-level configuration
```

## Documentation

- [Getting started](docs/GETTING_STARTED.md)
- [Configuration](docs/CONFIGURATION.md)
- [Operating loop](docs/OPERATING_LOOP.md)
- [Ingestion pipeline](docs/INGESTION_PIPELINE.md)
- [Privacy and data handling](docs/PRIVACY_AND_DATA.md)
- [Example walkthrough](docs/EXAMPLE_WALKTHROUGH.md)

## Search

BM25 works immediately and has no npm dependencies:

```bash
tools/search/build.sh
node tools/search/search.js "your query"
```

Optional vector search:

```bash
pip install sentence-transformers numpy
python3 tools/search/embed.py corpus --model sentence-transformers/all-MiniLM-L6-v2 --normalize
node tools/search/search.js "your semantic query"
```

## Publishing your memory safely

This template is public-safe, but your generated repository may not be. Treat `data/raw/`, private wiki pages, and source credentials as sensitive unless you intentionally publish them.
