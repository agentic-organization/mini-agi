#!/usr/bin/env node
/**
 * search.js — hybrid BM25 + (optional) vector search over the wiki.
 *
 * Usage:
 *   node tools/search/search.js "your query here"
 *   node tools/search/search.js --k 10 --bm25-only "nutshell python mint"
 *   node tools/search/search.js --json "callebtc cashu"
 *
 * Flags:
 *   --k <N>                Number of results. Default: 8.
 *   --bm25-only            Force BM25 only, even if embeddings are present.
 *   --vector-only          Force vector only (fails if embeddings missing).
 *   --alpha <0..1>         Hybrid blend weight on BM25 (1-alpha on vectors). Default: 0.5.
 *   --index <path>         BM25 index path. Default: data/search/bm25-index.json.
 *   --embeddings <path>    Embeddings binary. Default: data/search/embeddings.bin.
 *   --emb-meta <path>      Embeddings meta JSON. Default: data/search/embeddings.meta.json.
 *   --json                 Machine-readable JSON output.
 *
 * Query embedding: when vectors are enabled, this CLI shells out to
 * `tools/search/embed.py --query "<q>"` to get the query vector. The
 * embedding model used must match the one that built the corpus vectors;
 * the meta file records this so mismatches are detected early.
 *
 * BM25-only mode works immediately after building the index and requires no
 * Python, no model, no network. This is the default fallback.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf(name);
  return i === -1 ? def : argv[i + 1];
}
function hasFlag(name) { return argv.includes(name); }

const K           = parseInt(flag('--k', '8'), 10);
const BM25_ONLY   = hasFlag('--bm25-only');
const VECTOR_ONLY = hasFlag('--vector-only');
const ALPHA       = parseFloat(flag('--alpha', '0.5'));
const INDEX_PATH  = flag('--index',      'data/search/bm25-index.json');
const EMB_PATH    = flag('--embeddings', 'data/search/embeddings.bin');
const EMB_META    = flag('--emb-meta',   'data/search/embeddings.meta.json');
const JSON_OUT    = hasFlag('--json');

// The positional argument is the query. Strip our named flags.
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (['--k','--alpha','--index','--embeddings','--emb-meta'].includes(a)) { i++; continue; }
  if (['--bm25-only','--vector-only','--json'].includes(a)) continue;
  positional.push(a);
}
const QUERY = positional.join(' ').trim();
if (!QUERY) {
  console.error('usage: search.js [flags] "query text"');
  process.exit(2);
}

// ---------------------- Load BM25 ----------------------

if (!fs.existsSync(INDEX_PATH)) {
  console.error(`BM25 index not found: ${INDEX_PATH}. Run tools/search/build.sh first.`);
  process.exit(1);
}
const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

// Share tokenization with the indexer.
const STOPWORDS = new Set([
  'a','an','and','the','is','are','was','were','be','been','being',
  'of','in','on','at','to','for','from','by','with','as','that','this',
  'these','those','it','its','or','but','if','then','so','not','no','can',
  'do','does','did','has','have','had','i','you','we','they','them',
]);
const TOKEN_RE = /[a-z0-9][a-z0-9_\-\.]*/gi;
function tokenize(text) {
  const out = [];
  let m;
  const lower = text.toLowerCase();
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(lower)) !== null) {
    const t = m[0];
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

// ---------------------- BM25 scoring ----------------------

function bm25Scores(query) {
  const { k1, b } = index.params;
  const qTokens = Array.from(new Set(tokenize(query))); // unique terms
  const scores = new Float64Array(index.num_docs);
  const N = index.num_docs;
  const avgDL = index.avg_doc_length;

  for (const t of qTokens) {
    const row = index.tokens[t];
    if (!row) continue;
    const idf = Math.log(1 + (N - row.df + 0.5) / (row.df + 0.5));
    for (const [docIx, tf] of row.postings) {
      const dl = index.chunks[docIx].doc_length;
      const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / (avgDL || 1)));
      scores[docIx] += idf * norm;
    }
  }
  return scores;
}

// ---------------------- Vector scoring (optional) ----------------------

function loadEmbeddings() {
  if (!fs.existsSync(EMB_PATH) || !fs.existsSync(EMB_META)) return null;
  const meta = JSON.parse(fs.readFileSync(EMB_META, 'utf8'));
  const buf = fs.readFileSync(EMB_PATH);
  const expected = meta.num_chunks * meta.dim * 4;
  if (buf.length !== expected) {
    console.error(`embeddings.bin size mismatch: expected ${expected} bytes (${meta.num_chunks} * ${meta.dim} * 4), got ${buf.length}`);
    return null;
  }
  if (meta.num_chunks !== index.num_docs) {
    console.error(`embeddings count (${meta.num_chunks}) does not match BM25 index (${index.num_docs}). Rebuild with tools/search/build.sh then re-embed.`);
    return null;
  }
  // Interpret as float32 array
  const vectors = new Float32Array(buf.buffer, buf.byteOffset, meta.num_chunks * meta.dim);
  return { meta, vectors };
}

function embedQuery(queryText, modelId) {
  // Prefer a local venv python (e.g. repo-root/.venv/bin/python) so that
  // sentence-transformers and numpy are found even when the system python3
  // does not have them (common on CI / container / Hermes hosts).
  const root = path.resolve(path.join(__dirname, '../..'));
  const candidates = [
    path.join(root, '.venv', 'bin', 'python'),
    path.join(root, 'venv', 'bin', 'python'),
    'python3',
    'python',
  ];
  let python = candidates.find(p => {
    try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
  });
  if (!python) python = 'python3';

  const out = execFileSync(python, [
    path.join(__dirname, 'embed.py'),
    '--query', queryText,
    '--model', modelId,
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PYTHONPATH: '' }
  });
  const meta = JSON.parse(out);
  return Float32Array.from(meta.vector);
}

function cosineScores(q, vectors, dim, numDocs) {
  const scores = new Float64Array(numDocs);
  // Normalize query
  let qnorm = 0;
  for (let i = 0; i < dim; i++) qnorm += q[i] * q[i];
  qnorm = Math.sqrt(qnorm) || 1;
  for (let d = 0; d < numDocs; d++) {
    const base = d * dim;
    let dot = 0, dnorm = 0;
    for (let i = 0; i < dim; i++) {
      const v = vectors[base + i];
      dot   += q[i] * v;
      dnorm += v * v;
    }
    dnorm = Math.sqrt(dnorm) || 1;
    scores[d] = dot / (qnorm * dnorm);
  }
  return scores;
}

// ---------------------- Combine + output ----------------------

function normalize(scores) {
  const out = new Float64Array(scores.length);
  let max = 0;
  for (const s of scores) if (s > max) max = s;
  if (max <= 0) return out;
  for (let i = 0; i < scores.length; i++) out[i] = scores[i] / max;
  return out;
}

function topK(scores, k) {
  // Partial sort
  const pairs = [];
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > 0) pairs.push([i, scores[i]]);
  }
  pairs.sort((a, b) => b[1] - a[1]);
  return pairs.slice(0, k);
}

function renderHits(hits, mode) {
  if (JSON_OUT) {
    const out = hits.map(([ix, s]) => ({
      score: s,
      ...index.chunks[ix],
    }));
    process.stdout.write(JSON.stringify({ query: QUERY, mode, results: out }, null, 2) + '\n');
    return;
  }
  if (hits.length === 0) {
    process.stdout.write(`No hits for: ${QUERY}\n`);
    return;
  }
  process.stdout.write(`# Search: "${QUERY}"  (mode: ${mode}, k=${K})\n\n`);
  hits.forEach(([ix, s], rank) => {
    const c = index.chunks[ix];
    const bc = (c.breadcrumbs || []).join(' › ');
    process.stdout.write(`${rank + 1}. ${c.path}#${c.chunk_ix}  (score ${s.toFixed(3)})\n`);
    process.stdout.write(`   ${bc}\n`);
    process.stdout.write(`   ${c.snippet}\n\n`);
  });
}

// ---------------------- Main ----------------------

(function main() {
  const emb = (BM25_ONLY ? null : loadEmbeddings());

  if (VECTOR_ONLY && !emb) {
    console.error('--vector-only requested but embeddings are missing or invalid.');
    process.exit(1);
  }

  const bm25 = BM25_ONLY || !emb ? bm25Scores(QUERY) : bm25Scores(QUERY);
  let mode = 'bm25';
  let combined = bm25;

  if (emb && !BM25_ONLY) {
    let qvec;
    try {
      qvec = embedQuery(QUERY, emb.meta.model_id);
    } catch (e) {
      console.error(`query embedding failed (${e.message}); falling back to BM25 only.`);
      renderHits(topK(bm25, K), 'bm25 (vector fallback)');
      return;
    }
    if (qvec.length !== emb.meta.dim) {
      console.error(`query vector dim (${qvec.length}) != corpus dim (${emb.meta.dim}); falling back to BM25.`);
      renderHits(topK(bm25, K), 'bm25 (dim-mismatch fallback)');
      return;
    }
    const vec = cosineScores(qvec, emb.vectors, emb.meta.dim, emb.meta.num_chunks);

    if (VECTOR_ONLY) {
      renderHits(topK(vec, K), 'vector');
      return;
    }

    // Hybrid: normalize each, combine with alpha.
    const b = normalize(bm25);
    const v = normalize(vec);
    combined = new Float64Array(index.num_docs);
    for (let i = 0; i < index.num_docs; i++) {
      combined[i] = ALPHA * b[i] + (1 - ALPHA) * v[i];
    }
    mode = `hybrid(alpha=${ALPHA}, model=${emb.meta.model_id})`;
  }

  renderHits(topK(combined, K), mode);
})();
