#!/usr/bin/env node
'use strict';

const path = require('path');
const { validateManifest, readJson } = require('./manifest');

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const valFlag = (name, def) => {
  const i = argv.indexOf(name);
  if (i === -1 || i === argv.length - 1) return def;
  return argv[i + 1];
};

if (hasFlag('--help') || hasFlag('-h') || argv.length === 0) {
  console.log(`Usage: node tools/pipeline/validate-run.js <manifest.json> [flags]

Flags:
  --require-files   Verify every outputs[].path exists relative to --base-dir.
  --base-dir <dir>  Base directory for output path checks. Default: repository root.
  --json            Print machine-readable validation result.
  --help            Show this help.
`);
  process.exit(argv.length === 0 ? 1 : 0);
}

const manifestPath = argv.find((arg) => !arg.startsWith('--') && !['--base-dir'].includes(arg));
const jsonOut = hasFlag('--json');
const requireFiles = hasFlag('--require-files');
const baseDir = valFlag('--base-dir', process.cwd());

try {
  const manifest = readJson(manifestPath);
  const result = validateManifest(manifest, { requireFiles, baseDir: path.resolve(baseDir) });
  if (jsonOut) {
    console.log(JSON.stringify({ file: manifestPath, ...result }, null, 2));
  } else {
    for (const warning of result.warnings) console.warn(`warning: ${warning}`);
    if (!result.ok) {
      for (const error of result.errors) console.error(`error: ${error}`);
    } else {
      console.log(`ok: ${manifestPath}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
} catch (err) {
  if (jsonOut) console.log(JSON.stringify({ file: manifestPath, ok: false, errors: [err.message], warnings: [] }, null, 2));
  else console.error(`error: ${err.message}`);
  process.exit(1);
}
