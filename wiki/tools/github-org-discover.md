# github-org-discover

**Type:** ingestion script · **Status:** template-ready

## Summary

`tools/ingestion/github-org-discover.js` discovers repositories, public members, and recently active contributors for a GitHub organization, then emits a JSON snapshot for later wiki synthesis.

## Usage

```bash
GITHUB_TOKEN=$(gh auth token) node tools/ingestion/github-org-discover.js <org> --contributors-top 10 --recent-days 180
```

## History

- Template baseline: generic GitHub organization discovery tool included for bootstrapping teams and projects.
