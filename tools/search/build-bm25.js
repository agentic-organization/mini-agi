#!/usr/bin/env node
/**
 * build-bm25.js
 *
 * Builds a BM25 index from chunks.jsonl. Pure-JS, no dependencies.
 *
 * Usage:
 *   node tools/search/build-bm25.js < data/search/chunks.jsonl > data/search/bm25-index.json
 *
 * Or:
 *   node tools/search/build-bm25.js --in data/search/chunks.jsonl --out data/search/bm25-index.json
 *
 * Algorithm: Okapi BM25 with k1=1.5, b=0.75. English-only stopword list and a
 * simple regex tokenizer. Lowercased. No stemming — this keeps the index stable
 * and fast to rebuild, and works well for a technical wiki where exact
 * tokens matter (e.g. "api-gateway", "RFC-123", "alice").
 *
 * Output shape:
 *   {
 *     version:         1,
 *     built_at:        iso timestamp,
 *     params:          { k1, b },
 *     num_docs:        N,
 *     avg_doc_length:  number,
 *     chunks: [                         // parallel to chunks.jsonl, with token counts
 *       { id, path, chunk_ix, title, heading, breadcrumbs, doc_length, snippet }
 *     ],
 *     tokens: {                         // inverted index
 *       "<term>": { df: N, postings: [[doc_ix, tf], ...] }
 *     }
 *   }
 *
 * Note: we store an excerpt snippet on each chunk so search can render hits
 * without needing to re-open the source file for every result.
 */

'use strict';

const fs = require('fs');

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf(name);
  return i === -1 ? def : argv[i + 1];
}
const IN_PATH  = flag('--in', '');
const OUT_PATH = flag('--out', '');

// Minimal English stopword list. Kept short on purpose — over-stopping hurts
// a technical wiki.
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
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

function snippet(text, maxLen = 200) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen).trimEnd() + '…';
}

async function readLines(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
}

async function main() {
  const inStream = IN_PATH ? fs.createReadStream(IN_PATH) : process.stdin;
  const lines = await readLines(inStream);

  const chunks = [];   // parallel array (compact metadata)
  const tokens = {};   // term -> { df, postings: [[doc_ix, tf], ...] }
  let totalLen = 0;

  lines.forEach((line, doc_ix) => {
    const rec = JSON.parse(line);
    // Build the "searchable text" for this chunk: title + breadcrumbs + heading + body.
    // We weight context by including it in the stream; BM25 tf-weighting handles the rest.
    const searchable = [
      rec.title,
      rec.heading,
      (rec.breadcrumbs || []).join(' / '),
      rec.text,
    ].filter(Boolean).join('\n');

    const tokenList = tokenize(searchable);
    const tf = {};
    for (const t of tokenList) tf[t] = (tf[t] || 0) + 1;

    const doc_length = tokenList.length;
    totalLen += doc_length;

    chunks.push({
      id: rec.id,
      path: rec.path,
      chunk_ix: rec.chunk_ix,
      title: rec.title,
      heading: rec.heading,
      breadcrumbs: rec.breadcrumbs,
      doc_length,
      snippet: snippet(rec.text),
    });

    for (const [t, count] of Object.entries(tf)) {
      if (!tokens[t]) tokens[t] = { df: 0, postings: [] };
      tokens[t].df++;
      tokens[t].postings.push([doc_ix, count]);
    }
  });

  const index = {
    version: 1,
    built_at: new Date().toISOString(),
    params: { k1: 1.5, b: 0.75 },
    num_docs: chunks.length,
    avg_doc_length: chunks.length ? totalLen / chunks.length : 0,
    chunks,
    tokens,
  };

  const out = JSON.stringify(index);
  if (OUT_PATH) {
    fs.writeFileSync(OUT_PATH, out);
    process.stderr.write(`built BM25 index: ${chunks.length} chunks, ${Object.keys(tokens).length} unique terms -> ${OUT_PATH}\n`);
  } else {
    process.stdout.write(out + '\n');
    process.stderr.write(`built BM25 index: ${chunks.length} chunks, ${Object.keys(tokens).length} unique terms\n`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
