#!/usr/bin/env node
/**
 * cwos-choice-point.js — choice-point router (WS-479 part 1).
 *
 * Engines declare `choice_point: { accepts, size, estimated_time, hook }`
 * in the live registry (.claude/workstream/engines/registry.yaml, ADR-011).
 * Until now nothing read those blocks — routing was hardcoded prose in
 * kit/commands/*.md. This lib answers one question deterministically:
 * "which engines accept artifact type X?" so surfacing points (the
 * plan-surface hook, /next tighten) can offer engines data-driven instead
 * of by name. An engine that retires simply disappears from the answer;
 * a v2 that ships reappears with zero changes here.
 *
 * Lib:  enginesAccepting(artifactType, repoRoot) -> [{engine_id, choice_point}]
 * CLI:  node kit/scripts/core/cwos-choice-point.js <artifact-type> [--repo-root <dir>]
 *       -> JSON array on stdout; [] (exit 0) on missing/unparseable registry.
 *
 * Never throws across the public surface — surfacing must degrade silently.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function loadParser() {
  try {
    const u = require('../lib/cwos-utils');
    return u.parseYaml || u.parseYAML || u.yamlParse || u.parse || null;
  } catch (_) { return null; }
}

function registryPath(repoRoot) {
  return path.join(repoRoot, '.claude', 'workstream', 'engines', 'registry.yaml');
}

/**
 * Return engines whose choice_point.accepts matches artifactType.
 * Empty array on any failure (missing registry, parse error, no matches).
 */
function enginesAccepting(artifactType, repoRoot) {
  if (!artifactType || typeof artifactType !== 'string') return [];
  const root = repoRoot || process.cwd();
  const parse = loadParser();
  if (!parse) return [];

  const file = registryPath(root);
  let doc;
  try {
    if (!fs.existsSync(file)) return [];
    doc = parse(fs.readFileSync(file, 'utf8'));
  } catch (_) { return []; }
  if (!doc || typeof doc !== 'object' || !doc.engines || typeof doc.engines !== 'object') return [];

  const out = [];
  for (const [engineId, entry] of Object.entries(doc.engines)) {
    if (!entry || typeof entry !== 'object') continue;
    const cp = entry.choice_point;
    if (!cp || typeof cp !== 'object') continue;
    if (cp.accepts !== artifactType) continue;
    out.push({
      engine_id: engineId,
      choice_point: {
        accepts: cp.accepts,
        size: cp.size || null,
        estimated_time: cp.estimated_time || null,
        hook: cp.hook || null,
      },
    });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf('--repo-root');
  const repoRoot = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
  const artifactType = args.find((a, i) => !a.startsWith('--') && (rootIdx < 0 || (i !== rootIdx && i !== rootIdx + 1)));
  if (!artifactType) {
    process.stderr.write('usage: cwos-choice-point <artifact-type> [--repo-root <dir>]\n');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(enginesAccepting(artifactType, repoRoot), null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { enginesAccepting, registryPath };
