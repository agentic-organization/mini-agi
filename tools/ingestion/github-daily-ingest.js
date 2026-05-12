#!/usr/bin/env node
/**
 * github-daily-ingest.js
 *
 * Daily raw GitHub ingestion using the `gh` CLI. The script reads a watchlist,
 * resolves GitHub organizations into repositories, captures org discovery
 * snapshots, then stores raw per-repo API responses for downstream synthesis.
 *
 * Usage:
 *   node tools/ingestion/github-daily-ingest.js [flags]
 *
 * Flags:
 *   --watchlist <path>   Default: data/sources/github-watchlist.json
 *   --out <path>         Default: data/raw/github
 *   --date <YYYY-MM-DD>  Default: current UTC date
 *   --since-hours <N>    Default: 24
 *   --limit <N>          Limit resolved repos for smoke tests
 *   --only <owner/repo>  Fetch one resolved repo
 *   --dry-run            Print resolved repos and commands; write nothing
 *   --force              Allow overwriting an existing daily run directory
 *   --run-id <id>        Default: <YYYYMMDDTHHMMSSZ>-github-daily
 *   --help               Print help
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const valFlag = (name, def) => {
  const i = argv.indexOf(name);
  if (i === -1 || i === argv.length - 1) return def;
  return argv[i + 1];
};

if (flag('--help') || flag('-h')) {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 28).join('\n'));
  process.exit(0);
}

const WATCHLIST_PATH = valFlag('--watchlist', 'data/sources/github-watchlist.json');
const OUT_ROOT = valFlag('--out', 'data/raw/github');
const DATE = valFlag('--date', new Date().toISOString().slice(0, 10));
const SINCE_HOURS = Number(valFlag('--since-hours', '24'));
const LIMIT = valFlag('--limit', '') ? Number(valFlag('--limit', '')) : null;
const ONLY = valFlag('--only', '');
const DRY_RUN = flag('--dry-run');
const FORCE = flag('--force');

const startedAt = new Date().toISOString();
const since = new Date(Date.now() - SINCE_HOURS * 3600 * 1000).toISOString();
const defaultRunId = `${startedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-github-daily`;
const RUN_ID = valFlag('--run-id', defaultRunId);
const dailyRoot = path.join(OUT_ROOT, 'daily', DATE);
const orgRoot = path.join(OUT_ROOT, 'org-discovery', DATE);

function ghApi(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ['api'];
    if (options.paginate) args.push('--paginate');
    args.push(endpoint);
    execFile('gh', args, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const message = stderr.trim() || err.message;
        reject(new Error(`gh ${args.join(' ')}: ${message}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout || 'null');
        if (options.paginate && Array.isArray(parsed)) {
          resolve(parsed.flatMap((page) => Array.isArray(page) ? page : [page]));
          return;
        }
        resolve(parsed);
      } catch (e) {
        reject(new Error(`gh ${args.join(' ')}: invalid JSON: ${e.message}`));
      }
    });
  });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function commandFor(endpoint, file, options = {}) {
  const paginate = options.paginate ? ' --paginate' : '';
  return `gh api${paginate} ${shellQuote(endpoint)} > ${shellQuote(file)}`;
}

function uniqRepos(repos) {
  const byName = new Map();
  for (const repo of repos) {
    const key = `${repo.owner}/${repo.name}`;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...repo, sources: repo.sources || [] });
      continue;
    }
    existing.sources.push(...(repo.sources || []));
    existing.projects = [...new Set([...(existing.projects || []), ...(repo.projects || [])])];
  }
  return [...byName.values()].sort((a, b) => `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`));
}

function normalizeRepoFromApi(repo, source, inheritedProjects) {
  return {
    owner: repo.owner.login,
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    archived: repo.archived,
    fork: repo.fork,
    private: repo.private,
    pushed_at: repo.pushed_at,
    projects: inheritedProjects || [],
    sources: [source.id]
  };
}

async function resolveOrg(source, commands) {
  const includeArchived = source.include_archived === true;
  const includeForks = source.include_forks === true;
  const orgEndpoint = `/orgs/${source.owner}`;
  const reposEndpoint = `/orgs/${source.owner}/repos?type=all&sort=pushed&direction=desc&per_page=100`;
  commands.push(commandFor(orgEndpoint, path.join(orgRoot, source.owner, 'org.json')));
  commands.push(commandFor(reposEndpoint, path.join(orgRoot, source.owner, 'repositories.json'), { paginate: true }));

  const [org, reposRaw] = await Promise.all([ghApi(orgEndpoint), ghApi(reposEndpoint, { paginate: true })]);
  const repositories = reposRaw
    .filter((repo) => includeArchived || !repo.archived)
    .filter((repo) => includeForks || !repo.fork)
    .map((repo) => normalizeRepoFromApi(repo, source, source.projects || []));

  return {
    snapshot: {
      source_id: source.id,
      source_type: source.type,
      discovered_at: new Date().toISOString(),
      parameters: {
        owner: source.owner,
        mode: source.mode,
        include_archived: includeArchived,
        include_forks: includeForks
      },
      org,
      repositories: reposRaw
    },
    repositories
  };
}

function resolveListedRepos(source) {
  return (source.repos || []).map((repo) => ({
    owner: repo.owner,
    name: repo.name,
    full_name: `${repo.owner}/${repo.name}`,
    html_url: `https://github.com/${repo.owner}/${repo.name}`,
    projects: repo.project ? [repo.project] : (repo.projects || []),
    reason: repo.reason || null,
    sources: [source.id]
  }));
}

async function resolveWatchlist(watchlist, commands) {
  const repos = [];
  const orgSnapshots = [];
  const errors = [];

  for (const source of watchlist.sources || []) {
    if (source.enabled === false) continue;
    if (source.type === 'github_org') {
      try {
        const resolved = await resolveOrg(source, commands);
        orgSnapshots.push({ owner: source.owner, snapshot: resolved.snapshot });
        repos.push(...resolved.repositories);
      } catch (e) {
        errors.push({ source: source.id, owner: source.owner, error: e.message });
      }
      continue;
    }
    if (source.type === 'github_repos') {
      repos.push(...resolveListedRepos(source));
      continue;
    }
    errors.push({ source: source.id, error: `unknown source type: ${source.type}` });
  }

  let unique = uniqRepos(repos);
  if (ONLY) unique = unique.filter((repo) => `${repo.owner}/${repo.name}` === ONLY);
  if (LIMIT !== null) unique = unique.slice(0, LIMIT);
  return { repositories: unique, orgSnapshots, errors };
}

function repoEndpoints(repo) {
  const base = `/repos/${repo.owner}/${repo.name}`;
  return [
    { key: 'repo', file: 'repo.json', endpoint: base },
    { key: 'events', file: 'events.json', endpoint: `${base}/events?per_page=100` },
    { key: 'issues_updated', file: 'issues-updated.json', endpoint: `${base}/issues?state=all&sort=updated&direction=desc&since=${encodeURIComponent(since)}&per_page=100` },
    { key: 'pulls_updated', file: 'pulls-updated.json', endpoint: `${base}/pulls?state=all&sort=updated&direction=desc&per_page=100` },
    { key: 'commits_since', file: 'commits-since.json', endpoint: `${base}/commits?since=${encodeURIComponent(since)}&per_page=100` },
    { key: 'releases', file: 'releases.json', endpoint: `${base}/releases?per_page=100` }
  ];
}

async function fetchRepo(repo, commands) {
  const repoDir = path.join(dailyRoot, repo.owner, repo.name);
  const endpointResults = [];
  for (const item of repoEndpoints(repo)) {
    const outFile = path.join(repoDir, item.file);
    commands.push(commandFor(item.endpoint, outFile));
    try {
      const body = await ghApi(item.endpoint);
      if (!DRY_RUN) writeJson(outFile, body);
      endpointResults.push({ key: item.key, file: item.file, ok: true, count: Array.isArray(body) ? body.length : null });
    } catch (e) {
      const expectedEmpty =
        (item.key === 'commits_since' && e.message.includes('HTTP 409')) ||
        (item.key === 'pulls_updated' && e.message.includes('HTTP 404'));
      if (expectedEmpty) {
        if (!DRY_RUN) writeJson(outFile, []);
        endpointResults.push({ key: item.key, file: item.file, ok: true, count: 0, note: e.message });
        continue;
      }
      const error = { key: item.key, file: item.file, ok: false, error: e.message };
      if (!DRY_RUN) writeJson(path.join(repoDir, `${item.key}-error.json`), error);
      endpointResults.push(error);
    }
  }

  const meta = {
    owner: repo.owner,
    repo: repo.name,
    full_name: `${repo.owner}/${repo.name}`,
    projects: repo.projects || [],
    sources: repo.sources || [],
    reason: repo.reason || null,
    fetched_at: new Date().toISOString(),
    since,
    endpoints: endpointResults
  };
  if (!DRY_RUN) writeJson(path.join(repoDir, 'meta.json'), meta);
  return meta;
}

function appendRepoCommands(repo, commands) {
  const repoDir = path.join(dailyRoot, repo.owner, repo.name);
  for (const item of repoEndpoints(repo)) {
    commands.push(commandFor(item.endpoint, path.join(repoDir, item.file)));
  }
}

async function main() {
  const watchlist = JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
  const commands = [];
  const resolved = await resolveWatchlist(watchlist, commands);

  if (DRY_RUN) {
    for (const repo of resolved.repositories) appendRepoCommands(repo, commands);
  }

  if (!DRY_RUN && fs.existsSync(dailyRoot)) {
    if (!FORCE) {
      throw new Error(`${dailyRoot} already exists; pass --force to overwrite or choose --date`);
    }
    fs.rmSync(dailyRoot, { recursive: true, force: true });
  }

  if (DRY_RUN) {
    console.log(JSON.stringify({ run_id: RUN_ID, date: DATE, since, repositories: resolved.repositories.map((r) => `${r.owner}/${r.name}`), errors: resolved.errors, commands }, null, 2));
    return;
  }

  fs.mkdirSync(dailyRoot, { recursive: true });
  fs.mkdirSync(orgRoot, { recursive: true });

  for (const { owner, snapshot } of resolved.orgSnapshots) {
    writeJson(path.join(orgRoot, owner, 'snapshot.json'), snapshot);
  }

  const repoResults = [];
  for (const repo of resolved.repositories) {
    repoResults.push(await fetchRepo(repo, commands));
  }

  const finishedAt = new Date().toISOString();
  const reposSucceeded = repoResults.filter((repo) => repo.endpoints.every((endpoint) => endpoint.ok)).length;
  const reposWithErrors = repoResults.filter((repo) => repo.endpoints.some((endpoint) => !endpoint.ok)).length;
  const status = resolved.errors.length || reposWithErrors ? 'partial' : 'success';
  const run = {
    source: 'github-daily-ingest',
    run_id: RUN_ID,
    started_at: startedAt,
    finished_at: finishedAt,
    date: DATE,
    since,
    since_hours: SINCE_HOURS,
    watchlist: WATCHLIST_PATH,
    out_root: OUT_ROOT,
    repos_attempted: repoResults.length,
    repos_succeeded: reposSucceeded,
    repos_with_errors: reposWithErrors,
    watchlist_errors: resolved.errors,
    repositories: repoResults.map((repo) => ({
      full_name: repo.full_name,
      projects: repo.projects,
      sources: repo.sources,
      endpoints: repo.endpoints
    }))
  };

  const outputEntries = [
    { path: path.join(dailyRoot, 'run.json'), kind: 'legacy_run_summary', count: 1 },
    { path: path.join(dailyRoot, 'commands.sh'), kind: 'command_log', count: commands.length }
  ];
  for (const repo of repoResults) {
    outputEntries.push({ path: path.join(dailyRoot, repo.owner, repo.repo, 'meta.json'), kind: 'repo_meta', count: 1 });
    for (const endpoint of repo.endpoints) {
      outputEntries.push({
        path: path.join(dailyRoot, repo.owner, repo.repo, endpoint.file),
        kind: `github_${endpoint.key}`,
        count: endpoint.count ?? null
      });
    }
  }
  for (const { owner } of resolved.orgSnapshots) {
    outputEntries.push({ path: path.join(orgRoot, owner, 'snapshot.json'), kind: 'org_snapshot', count: 1 });
  }

  const manifest = {
    schema_version: 1,
    run_id: RUN_ID,
    source: 'github',
    stage: 'raw',
    status,
    source_config: WATCHLIST_PATH,
    collector: 'tools/ingestion/github-daily-ingest.js',
    started_at: startedAt,
    finished_at: finishedAt,
    inputs: {
      date: DATE,
      since,
      since_hours: SINCE_HOURS,
      only: ONLY || null,
      limit: LIMIT,
      watchlist: WATCHLIST_PATH,
      out_root: OUT_ROOT
    },
    outputs: outputEntries,
    errors: [
      ...resolved.errors.map((error) => ({ source: error.source || null, message: error.error || error.message || String(error), detail: error })),
      ...repoResults.flatMap((repo) => repo.endpoints
        .filter((endpoint) => !endpoint.ok)
        .map((endpoint) => ({ source: `${repo.owner}/${repo.repo}`, message: endpoint.error, detail: endpoint })))
    ],
    stats: {
      repos_attempted: repoResults.length,
      repos_succeeded: reposSucceeded,
      repos_with_errors: reposWithErrors,
      org_snapshots: resolved.orgSnapshots.length,
      commands: commands.length
    }
  };

  writeJson(path.join(dailyRoot, 'run.json'), run);
  writeJson(path.join(dailyRoot, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(dailyRoot, 'commands.sh'), ['#!/usr/bin/env bash', 'set -euo pipefail', ...commands].join('\n') + '\n');
  console.log(JSON.stringify({ run_id: RUN_ID, manifest: path.join(dailyRoot, 'manifest.json'), daily_root: dailyRoot, org_root: orgRoot, repos_attempted: run.repos_attempted, repos_with_errors: run.repos_with_errors, status }, null, 2));
}

main().catch((err) => {
  console.error(`github-daily-ingest failed: ${err.message}`);
  process.exit(1);
});
