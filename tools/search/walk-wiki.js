#!/usr/bin/env node
/**
 * walk-wiki.js
 *
 * Walks wiki/ and emits one JSONL record per chunk to stdout, suitable
 * for piping to data/search/chunks.jsonl. Chunks are splits of each
 * markdown page at H1/H2 boundaries, with heading context preserved.
 *
 * Usage:
 *   node tools/search/walk-wiki.js [--wiki wiki/] [--max-chars N] > data/search/chunks.jsonl
 *
 * Flags:
 *   --wiki <dir>         Path to the wiki root. Default: wiki/
 *   --max-chars <N>      Soft cap on chunk size in characters; large chunks are
 *                        split on paragraph boundaries below H2. Default: 1500.
 *
 * Output record shape (stable — downstream tools depend on it):
 *   {
 *     id:         string,   // <path>#<chunk-index>
 *     path:       string,   // relative to repo root, e.g. "wiki/projects/example-project.md"
 *     chunk_ix:   number,   // 0-based index within the page
 *     title:      string,   // the page title (first H1, or filename)
 *     heading:    string,   // the most-specific heading for this chunk
 *     breadcrumbs: string[], // [title, section, subsection, ...]
 *     text:       string,   // the chunk text (already stripped of the wiki H1/H2 line)
 *     char_count: number
 *   }
 *
 * Part of mini-agi's search layer. Read-only — this script never modifies wiki/.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------- CLI ----------------------

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf(name);
  return i === -1 ? def : argv[i + 1];
}

const WIKI_DIR   = flag('--wiki', 'wiki');
const MAX_CHARS  = parseInt(flag('--max-chars', '1500'), 10);

// ---------------------- Walk ----------------------

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield full;
    }
  }
}

// ---------------------- Chunker ----------------------

/**
 * Split markdown into chunks by H1/H2 boundaries, keeping a breadcrumb
 * trail of enclosing headings. H3+ stay inside their parent H2 chunk.
 */
function chunkMarkdown(md, pageTitle) {
  const lines = md.split(/\r?\n/);
  const chunks = [];
  let currentBreadcrumbs = [pageTitle];
  let currentHeading = pageTitle;
  let buffer = [];

  function flush() {
    const text = buffer.join('\n').trim();
    if (!text) return;
    chunks.push({
      heading: currentHeading,
      breadcrumbs: [...currentBreadcrumbs],
      text,
    });
    buffer = [];
  }

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h1) {
      flush();
      currentHeading = h1[1].trim();
      currentBreadcrumbs = [currentHeading];
      continue; // don't embed the H1 line itself
    }
    if (h2) {
      flush();
      currentHeading = h2[1].trim();
      currentBreadcrumbs = [pageTitle, currentHeading];
      continue; // don't embed the H2 line itself
    }
    buffer.push(line);
  }
  flush();

  // Soft split any chunk that exceeds MAX_CHARS, on blank lines
  const out = [];
  for (const c of chunks) {
    if (c.text.length <= MAX_CHARS) {
      out.push(c);
      continue;
    }
    const paragraphs = c.text.split(/\n\s*\n/);
    let acc = '';
    for (const p of paragraphs) {
      if (acc && (acc.length + p.length + 2) > MAX_CHARS) {
        out.push({ ...c, text: acc });
        acc = p;
      } else {
        acc = acc ? acc + '\n\n' + p : p;
      }
    }
    if (acc) out.push({ ...c, text: acc });
  }
  return out;
}

function extractTitle(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// ---------------------- Main ----------------------

function main() {
  const repoRoot = process.cwd();
  let total = 0;
  for (const filepath of walk(WIKI_DIR)) {
    const rel = path.relative(repoRoot, filepath);
    const md = fs.readFileSync(filepath, 'utf8');
    const basename = path.basename(filepath, '.md');
    const title = extractTitle(md, basename);
    const chunks = chunkMarkdown(md, title);
    chunks.forEach((c, ix) => {
      const record = {
        id: `${rel}#${ix}`,
        path: rel,
        chunk_ix: ix,
        title,
        heading: c.heading,
        breadcrumbs: c.breadcrumbs,
        text: c.text,
        char_count: c.text.length,
      };
      process.stdout.write(JSON.stringify(record) + '\n');
      total++;
    });
  }
  process.stderr.write(`wrote ${total} chunks\n`);
}

main();
