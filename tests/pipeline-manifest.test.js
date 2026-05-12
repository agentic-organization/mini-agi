#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { validateManifest } = require('../tools/pipeline/manifest');

function fixture(overrides = {}) {
  return {
    schema_version: 1,
    run_id: '2026-01-01T000000Z-github-daily',
    source: 'github',
    stage: 'raw',
    status: 'success',
    source_config: 'data/sources/github-watchlist.json',
    collector: 'tools/ingestion/github-daily-ingest.js',
    started_at: '2026-01-01T00:00:00.000Z',
    finished_at: '2026-01-01T00:00:02.000Z',
    inputs: { since_hours: 24 },
    outputs: [
      { path: 'data/raw/github/daily/2026-01-01/run.json', kind: 'legacy_run_summary', count: 1 }
    ],
    errors: [],
    stats: { repos_attempted: 0 },
    ...overrides
  };
}

function testValidManifest() {
  const result = validateManifest(fixture());
  assert.equal(result.ok, true, result.errors.join('\n'));
}

function testMissingRequiredFieldsFails() {
  const manifest = fixture();
  delete manifest.run_id;
  delete manifest.outputs;
  const result = validateManifest(manifest);
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.includes('run_id')));
  assert(result.errors.some((error) => error.includes('outputs')));
}

function testRequireFilesChecksOutputs() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
  const result = validateManifest(fixture(), { requireFiles: true, baseDir: tmp });
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.includes('does not exist')));
}

function testValidateRunCli() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-cli-'));
  const file = path.join(tmp, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(fixture(), null, 2));
  const out = execFileSync('node', ['tools/pipeline/validate-run.js', file], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert(out.includes('ok:'));
}

function run() {
  testValidManifest();
  testMissingRequiredFieldsFails();
  testRequireFilesChecksOutputs();
  testValidateRunCli();
  console.log('pipeline manifest tests passed');
}

run();
