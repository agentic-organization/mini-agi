#!/usr/bin/env node
'use strict';

const path = require('path');
const { findManifests, readJson, validateManifest, summarizeManifest } = require('./manifest');

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const valFlag = (name, def) => {
  const i = argv.indexOf(name);
  if (i === -1 || i === argv.length - 1) return def;
  return argv[i + 1];
};

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`Usage: node tools/pipeline/list-runs.js [flags]

Flags:
  --root <dir>      Root to scan. Default: data
  --stage <stage>   Filter by stage: raw, normalized, derived, snapshot
  --source <name>   Filter by source.
  --status <status> Filter by status.
  --json            Print JSON instead of a text table.
  --validate        Include validation errors and set non-zero exit if invalid.
  --help            Show this help.
`);
  process.exit(0);
}

const root = valFlag('--root', 'data');
const stage = valFlag('--stage', '');
const source = valFlag('--source', '');
const status = valFlag('--status', '');
const jsonOut = hasFlag('--json');
const doValidate = hasFlag('--validate');

const manifests = findManifests(root);
const rows = [];
let invalid = false;

for (const file of manifests) {
  try {
    const manifest = readJson(file);
    if (stage && manifest.stage !== stage) continue;
    if (source && manifest.source !== source) continue;
    if (status && manifest.status !== status) continue;
    const summary = summarizeManifest(path.relative(process.cwd(), file), manifest);
    if (doValidate) {
      const validation = validateManifest(manifest, { requireFiles: false, baseDir: process.cwd() });
      summary.valid = validation.ok;
      summary.validation_errors = validation.errors;
      summary.validation_warnings = validation.warnings;
      if (!validation.ok) invalid = true;
    }
    rows.push(summary);
  } catch (err) {
    invalid = true;
    rows.push({ file: path.relative(process.cwd(), file), valid: false, validation_errors: [err.message] });
  }
}

if (jsonOut) {
  console.log(JSON.stringify(rows, null, 2));
} else if (rows.length === 0) {
  console.log(`No manifests found under ${root}.`);
} else {
  for (const row of rows) {
    const marker = doValidate ? (row.valid ? 'ok' : 'invalid') : row.status;
    console.log(`${marker}\t${row.stage || '-'}\t${row.source || '-'}\t${row.run_id || '-'}\t${row.file}`);
  }
}

process.exit(invalid ? 1 : 0);
