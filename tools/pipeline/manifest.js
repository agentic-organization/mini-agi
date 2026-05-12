#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VALID_STAGES = new Set(['raw', 'normalized', 'derived', 'snapshot']);
const VALID_STATUS = new Set(['success', 'partial', 'failed', 'running']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validateManifest(manifest, options = {}) {
  const errors = [];
  const warnings = [];
  const requireFiles = options.requireFiles === true;
  const baseDir = options.baseDir || process.cwd();

  if (!isObject(manifest)) {
    return { ok: false, errors: ['manifest must be a JSON object'], warnings };
  }

  if (manifest.schema_version !== 1) errors.push('schema_version must be 1');
  if (!manifest.run_id || typeof manifest.run_id !== 'string') errors.push('run_id is required');
  if (!manifest.source || typeof manifest.source !== 'string') errors.push('source is required');
  if (!manifest.stage || typeof manifest.stage !== 'string') errors.push('stage is required');
  if (manifest.stage && !VALID_STAGES.has(manifest.stage)) errors.push(`stage must be one of: ${[...VALID_STAGES].join(', ')}`);
  if (!manifest.status || typeof manifest.status !== 'string') errors.push('status is required');
  if (manifest.status && !VALID_STATUS.has(manifest.status)) errors.push(`status must be one of: ${[...VALID_STATUS].join(', ')}`);
  if (!isIsoDate(manifest.started_at)) errors.push('started_at must be an ISO timestamp');
  if (manifest.finished_at !== null && manifest.finished_at !== undefined && !isIsoDate(manifest.finished_at)) errors.push('finished_at must be null or an ISO timestamp');
  if (manifest.finished_at && manifest.started_at && Date.parse(manifest.finished_at) < Date.parse(manifest.started_at)) errors.push('finished_at must be after started_at');
  if (!manifest.collector || typeof manifest.collector !== 'string') errors.push('collector is required');
  if (manifest.source_config !== null && manifest.source_config !== undefined && typeof manifest.source_config !== 'string') errors.push('source_config must be a string or null');
  if (!isObject(manifest.inputs)) errors.push('inputs must be an object');
  if (!Array.isArray(manifest.outputs)) errors.push('outputs must be an array');
  if (!Array.isArray(manifest.errors)) errors.push('errors must be an array');
  if (!isObject(manifest.stats)) errors.push('stats must be an object');

  for (const [i, output] of asArray(manifest.outputs).entries()) {
    if (!isObject(output)) {
      errors.push(`outputs[${i}] must be an object`);
      continue;
    }
    if (!output.path || typeof output.path !== 'string') errors.push(`outputs[${i}].path is required`);
    if (!output.kind || typeof output.kind !== 'string') errors.push(`outputs[${i}].kind is required`);
    if (output.count !== undefined && output.count !== null && typeof output.count !== 'number') errors.push(`outputs[${i}].count must be a number or null`);
    if (requireFiles && output.path) {
      const outputPath = path.resolve(baseDir, output.path);
      if (!fs.existsSync(outputPath)) errors.push(`outputs[${i}].path does not exist: ${output.path}`);
    }
  }

  for (const [i, error] of asArray(manifest.errors).entries()) {
    if (!isObject(error)) {
      errors.push(`errors[${i}] must be an object`);
      continue;
    }
    if (!error.message || typeof error.message !== 'string') errors.push(`errors[${i}].message is required`);
  }

  if (manifest.status === 'success' && asArray(manifest.errors).length > 0) warnings.push('status is success but errors are present');
  if (manifest.status === 'failed' && asArray(manifest.errors).length === 0) warnings.push('status is failed but errors are empty');

  return { ok: errors.length === 0, errors, warnings };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findManifests(root) {
  const results = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.isFile() && entry.name === 'manifest.json') {
        results.push(full);
      }
    }
  }
  walk(root);
  return results.sort();
}

function summarizeManifest(file, manifest) {
  return {
    file,
    run_id: manifest.run_id || null,
    source: manifest.source || null,
    stage: manifest.stage || null,
    status: manifest.status || null,
    started_at: manifest.started_at || null,
    finished_at: manifest.finished_at || null,
    collector: manifest.collector || null,
    outputs: Array.isArray(manifest.outputs) ? manifest.outputs.length : 0,
    errors: Array.isArray(manifest.errors) ? manifest.errors.length : 0,
    stats: manifest.stats || {}
  };
}

module.exports = {
  VALID_STAGES,
  VALID_STATUS,
  validateManifest,
  readJson,
  findManifests,
  summarizeManifest
};
