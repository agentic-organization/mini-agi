# Getting Started

This guide turns a fresh repository created from the mini-agi template into a working organizational memory repo.

## 1. Create your repository

Use GitHub's **Use this template** button, or the GitHub CLI:

```bash
gh repo create <owner>/<repo> --template agentic-organization/mini-agi-template --private --clone
cd <repo>
```

Private is the safer default because organizational memory can contain sensitive raw evidence and internal synthesis.

## 2. Configure the organization

Edit `mini-agi.yaml`:

```yaml
organization:
  name: "Example Organization"
  slug: "example-org"
  description: "A short description of the organization."
```

Keep this file high-level. Source-specific machine inputs live in `data/sources/`.

## 3. Configure GitHub sources

Edit `data/sources/github-watchlist.json`.

Start from the example:

```bash
cp data/sources/github-watchlist.example.json /tmp/watchlist.example.json
```

Then add either:

- `github_org` entries when you want all public non-archived repos in an org.
- `github_repos` entries when you want a curated set of individual repos.

## 4. Authenticate tools

The GitHub ingestion tools use the GitHub CLI:

```bash
gh auth login
gh auth status
```

For unauthenticated public-only org discovery, `github-org-discover.js` can run with rate limits, but `GITHUB_TOKEN=$(gh auth token)` is recommended.

## 5. Smoke test ingestion

```bash
node tools/ingestion/github-daily-ingest.js --dry-run --limit 3
```

Expected result: JSON showing resolved repositories and commands. An empty repository list is fine if your watchlist is still empty.

## 6. Build search

```bash
tools/search/build.sh
node tools/search/search.js "github ingestion"
```

BM25 search requires no dependencies beyond Node.js.

## 7. Run the first evidence capture

For an initial GitHub org bootstrap:

```bash
mkdir -p data/raw/github/org-discovery/$(date -u +%F)/<org>
GITHUB_TOKEN=$(gh auth token) \
  node tools/ingestion/github-org-discover.js <org> \
  --contributors-top 10 --recent-days 180 \
  > data/raw/github/org-discovery/$(date -u +%F)/<org>/github-org-discover.json
```

For ongoing watched repositories:

```bash
node tools/ingestion/github-daily-ingest.js --since-hours 24
```

## 8. Synthesize, do not dump

Raw evidence belongs under `data/raw/`. The wiki should contain compact conclusions, relationships, uncertainty, and links back to evidence.

Good first pages:

- `wiki/teams/<team>.md`
- `wiki/projects/<project>.md`
- `wiki/people/<person-or-handle>.md`
- `wiki/tools/<tool>.md`

## 9. Open a PR

```bash
git checkout -b discovery/<org-or-team>
git add data/raw wiki data/sources
git commit -m "docs: bootstrap organization memory"
git push -u origin HEAD
gh pr create --title "Bootstrap organization memory" --body-file /tmp/pr-body.md
```

Use PRs even when working alone; the PR history becomes the memory evolution log.
