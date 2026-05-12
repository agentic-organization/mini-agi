#!/usr/bin/env node
/**
 * github-org-discover.js
 *
 * Discover repositories, members, and recently-active contributors for a
 * GitHub organization. The output is a single JSON document on stdout,
 * suitable for piping to jq, saving under data/raw/github/, or feeding
 * downstream synthesis scripts.
 *
 * Usage:
 *   node tools/ingestion/github-org-discover.js <org-name> [flags]
 *
 * Flags:
 *   --include-archived          Include archived repositories (default: excluded).
 *   --include-forks             Include forks (default: excluded).
 *   --exclude <names>           Comma-separated repo names to drop.
 *   --contributors-top <N>      Top-N contributors per repo (default: 5, 0 to disable).
 *   --recent-days <N>           Window for "recently active" (default: 90).
 *   --no-members                Skip public org member listing.
 *
 * Output shape (stable):
 *   {
 *     org: { login, description, url, html_url, public_repos, ... },
 *     discovered_at: ISO timestamp,
 *     parameters: { include_archived, include_forks, exclude, recent_days, ... },
 *     repositories: [ { name, full_name, description, html_url, language, stars, archived,
 *                        fork, pushed_at, topics, license, top_contributors: [...] } ],
 *     members:      [ { login, html_url, avatar_url } ],
 *     active_contributors: [ { login, repos: [repo_name, ...], total_contributions } ]
 *   }
 *
 * Environment:
 *   GITHUB_TOKEN    Optional; enables higher rate limits and access to private
 *                   member lists. The tool works without it but may be limited
 *                   to 60 req/hr.
 *
 * Part of mini-agi's ingestion layer. Read-only — this script never writes
 * into wiki/. Synthesis is a separate step.
 */

const https = require('https');

// ----- CLI parsing --------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0].startsWith('-')) {
  console.error('Usage: github-org-discover.js <org-name> [flags]');
  console.error('       pass --help for the full flag list.');
  process.exit(2);
}

if (argv.includes('--help') || argv.includes('-h')) {
  const header = require('fs').readFileSync(__filename, 'utf8').split('\n').slice(1, 30).join('\n');
  console.log(header);
  process.exit(0);
}

const ORG = argv[0];
const flag = (name) => argv.includes(name);
const valFlag = (name, def) => {
  const i = argv.indexOf(name);
  if (i === -1 || i === argv.length - 1) return def;
  return argv[i + 1];
};

const INCLUDE_ARCHIVED = flag('--include-archived');
const INCLUDE_FORKS    = flag('--include-forks');
const EXCLUDE          = (valFlag('--exclude', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const CONTRIB_TOP      = Number(valFlag('--contributors-top', '5'));
const RECENT_DAYS      = Number(valFlag('--recent-days', '90'));
const SKIP_MEMBERS     = flag('--no-members');
const GITHUB_TOKEN     = process.env.GITHUB_TOKEN || '';

// ----- HTTP helpers -------------------------------------------------------
function apiGet(pathOrUrl) {
  return new Promise((resolve, reject) => {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `https://api.github.com${pathOrUrl}`;
    const opts = new URL(url);
    opts.headers = {
      'User-Agent': 'mini-agi-github-org-discover/1.0',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (GITHUB_TOKEN) opts.headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;

    https.get(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          let msg = '';
          try { msg = JSON.parse(data).message; } catch(_) { msg = data.slice(0, 200); }
          return reject(new Error(`GET ${url} → ${res.statusCode}: ${msg}`));
        }
        try {
          resolve({ body: JSON.parse(data), headers: res.headers, status: res.statusCode });
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Follow GitHub's "Link: <...>; rel=\"next\"" pagination until exhausted.
async function paginate(path) {
  const out = [];
  let url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  while (url) {
    const sep = url.includes('?') ? '&' : '?';
    const { body, headers } = await apiGet(url.includes('per_page=') ? url : `${url}${sep}per_page=100`);
    if (!Array.isArray(body)) {
      throw new Error(`Paginated endpoint returned non-array: ${url}`);
    }
    out.push(...body);
    const link = headers.link || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  return out;
}

// ----- Main ---------------------------------------------------------------
async function main() {
  const discovered_at = new Date().toISOString();
  const parameters = {
    org: ORG,
    include_archived: INCLUDE_ARCHIVED,
    include_forks: INCLUDE_FORKS,
    exclude: EXCLUDE,
    contributors_top: CONTRIB_TOP,
    recent_days: RECENT_DAYS,
    skip_members: SKIP_MEMBERS,
    authenticated: Boolean(GITHUB_TOKEN),
  };

  const orgMetaRes = await apiGet(`/orgs/${ORG}`);
  const orgMeta = orgMetaRes.body;
  const orgSummary = {
    login:        orgMeta.login,
    name:         orgMeta.name || null,
    description:  orgMeta.description || null,
    html_url:     orgMeta.html_url,
    blog:         orgMeta.blog || null,
    location:     orgMeta.location || null,
    email:        orgMeta.email || null,
    twitter:      orgMeta.twitter_username || null,
    public_repos: orgMeta.public_repos,
    created_at:   orgMeta.created_at,
  };

  const rawRepos = await paginate(`/orgs/${ORG}/repos?type=all&sort=pushed&direction=desc`);
  const excludeSet = new Set(EXCLUDE);

  const repos = rawRepos.filter(r => {
    if (!INCLUDE_ARCHIVED && r.archived) return false;
    if (!INCLUDE_FORKS && r.fork) return false;
    if (excludeSet.has(r.name)) return false;
    return true;
  });

  // Collect top contributors per repo (optional).
  const recentSince = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000).toISOString();
  const contributorsByLogin = new Map(); // login -> { login, repos: Set, total_contributions }

  const repoSummaries = [];
  for (const r of repos) {
    let topContribs = [];
    if (CONTRIB_TOP > 0) {
      try {
        const contribsRes = await apiGet(`/repos/${ORG}/${r.name}/contributors?per_page=${CONTRIB_TOP}&anon=false`);
        const contribs = Array.isArray(contribsRes.body) ? contribsRes.body : [];
        topContribs = contribs
          .filter(c => c.type === 'User' && c.login && !c.login.endsWith('[bot]'))
          .map(c => ({ login: c.login, contributions: c.contributions, html_url: c.html_url }));
      } catch (e) {
        topContribs = [];
      }
    }

    // Active-contributor aggregation: only count if repo has been pushed within window.
    if (r.pushed_at && r.pushed_at > recentSince) {
      for (const c of topContribs) {
        let rec = contributorsByLogin.get(c.login);
        if (!rec) {
          rec = { login: c.login, html_url: c.html_url, repos: new Set(), total_contributions: 0 };
          contributorsByLogin.set(c.login, rec);
        }
        rec.repos.add(r.name);
        rec.total_contributions += c.contributions;
      }
    }

    repoSummaries.push({
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      html_url: r.html_url,
      homepage: r.homepage || null,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      archived: r.archived,
      fork: r.fork,
      default_branch: r.default_branch,
      pushed_at: r.pushed_at,
      created_at: r.created_at,
      topics: r.topics || [],
      license: r.license ? r.license.spdx_id : null,
      top_contributors: topContribs,
    });
  }

  let members = [];
  if (!SKIP_MEMBERS) {
    try {
      const raw = await paginate(`/orgs/${ORG}/members`);
      members = raw.map(m => ({ login: m.login, html_url: m.html_url, avatar_url: m.avatar_url }));
    } catch (e) {
      members = []; // private org without auth — fine.
    }
  }

  const activeContributors = [...contributorsByLogin.values()]
    .map(r => ({ login: r.login, html_url: r.html_url, repos: [...r.repos].sort(), total_contributions: r.total_contributions }))
    .sort((a, b) => b.total_contributions - a.total_contributions);

  const output = {
    org: orgSummary,
    discovered_at,
    parameters,
    repositories: repoSummaries,
    members,
    active_contributors: activeContributors,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('Discovery failed:', err.message);
  process.exit(1);
});
