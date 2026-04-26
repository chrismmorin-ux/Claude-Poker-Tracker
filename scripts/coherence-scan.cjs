#!/usr/bin/env node
/**
 * coherence-scan.cjs — Model Coherence scanner (Phase 1).
 *
 * Walks designated paths, parses each file's AST, evaluates the `__coherence__`
 * named export as a static literal, validates against the schema, builds the
 * integration graph, computes drift signals, and emits both a JSON report and
 * three regenerated manifests under docs/engine/.
 *
 * Owner: .claude/programs/model-coherence.md
 * Schema: docs/engine/COHERENCE_SCHEMA.md
 * Rollout: docs/engine/COHERENCE_ROLLOUT.md
 *
 * Modes:
 *   node scripts/coherence-scan.cjs              full run (regenerates docs)
 *   node scripts/coherence-scan.cjs --check      validate only, no doc regen
 *   node scripts/coherence-scan.cjs --staged     only files in `git diff --cached`
 *   node scripts/coherence-scan.cjs --json       emit only the JSON report
 *
 * Exit codes:
 *   0 — no schema violations, no expired deadlines (Phase 1: also clean)
 *   1 — schema violations or expired deadlines (Phase 1: advisory only — script
 *       still exits 0 unless --strict)
 *   2 — internal scanner error (parse failure, bad invocation)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fg = require('fast-glob');
const parser = require('@babel/parser');

const REPO_ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(REPO_ROOT, '.claude', 'coherence-report.json');
const CACHE_DIR = path.join(REPO_ROOT, '.claude', '.coherence-cache');
const DOCS_DIR = path.join(REPO_ROOT, 'docs', 'engine');

const DESIGNATED_GLOBS = [
  'src/utils/exploitEngine/**/*.{js,jsx}',
  'src/utils/rangeEngine/**/*.{js,jsx}',
  'src/utils/handAnalysis/**/*.{js,jsx}',
  'src/utils/anchorLibrary/**/*.{js,jsx}',
  'src/utils/skillAssessment/**/*.{js,jsx}',
  'src/utils/assumptionEngine/**/*.{js,jsx}',
  'src/utils/drillContent/shapes.js',
  'src/utils/analysisPipeline.js',
  'src/utils/citedDecision/**/*.{js,jsx}',
  'src/utils/emotionalState/**/*.{js,jsx}',
  'src/hooks/usePlayer*.{js,jsx}',
  'src/hooks/use*Advisor.{js,jsx}',
  'src/hooks/use*Analysis.{js,jsx}',
  'src/hooks/useCitedDecisions.{js,jsx}',
  'src/components/views/**/*.{jsx,tsx}',
  'src/components/extension/**/*.{jsx,tsx}',
  // shape-based catch-all
  'src/**/*Engine.{js,jsx}',
  'src/**/*Builder.{js,jsx}',
  'src/**/*Detector.{js,jsx}',
  'src/**/*Inference.{js,jsx}',
  'src/**/*Profile.{js,jsx}',
];

const EXCLUDE_GLOBS = [
  '**/__tests__/**',
  '**/*.test.{js,jsx}',
  '**/*.spec.{js,jsx}',
  'src/__dev__/**',
  'node_modules/**',
  'dist/**',
  '.vite/**',
];

const VALID_KINDS = new Set(['primitive', 'aggregator', 'surface', 'infrastructure', 'research']);
const VALID_STATUSES = new Set(['integrated', 'pending-absorption', 'research-only', 'deprecated']);
const VALID_TARGET_LAYERS = new Set(['aggregator', 'surface', 'pipeline']);

const SEED_VOCABULARY = new Set([
  'ev', 'fold-rate', 'fold-equity', 'range-profile', 'narrowed-range', 'villain-model',
  'villain-profile', 'villain-observation', 'weakness', 'exploit', 'thought', 'briefing',
  'equity', 'recommendation', 'action-class', 'hero-action', 'bucket-segment',
  'tendency-stats', 'risk', 'confidence', 'assumption', 'cited-decision', 'anchor-score',
  'skill-score', 'shape', 'frame', 'intermediate-state',
]);

const EXEMPT_PRAGMA_RE = /\/\/\s*@coherence-exempt:\s*(.+)$/m;

// ---------------------------------------------------------------------------
// argv

function parseArgs(argv) {
  const args = {
    check: false,
    staged: false,
    json: false,
    strict: false,
  };
  for (const a of argv.slice(2)) {
    if (a === '--check') args.check = true;
    else if (a === '--staged') args.staged = true;
    else if (a === '--json') args.json = true;
    else if (a === '--strict') args.strict = true;
    else {
      console.error(`coherence-scan: unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// file walk

function walkDesignatedFiles({ stagedOnly }) {
  if (stagedOnly) {
    let stagedRaw;
    try {
      stagedRaw = execSync('git diff --cached --name-only --diff-filter=ACMR', {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
    } catch (err) {
      console.error('coherence-scan: git diff failed:', err.message);
      process.exit(2);
    }
    const stagedRel = stagedRaw.split('\n').filter(Boolean);
    const designated = new Set(
      fg.sync(DESIGNATED_GLOBS, { cwd: REPO_ROOT, ignore: EXCLUDE_GLOBS, dot: false })
    );
    return stagedRel.filter((rel) => designated.has(rel));
  }
  return fg.sync(DESIGNATED_GLOBS, { cwd: REPO_ROOT, ignore: EXCLUDE_GLOBS, dot: false });
}

function newlyAddedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=A', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return new Set(out.split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// parse + extract

function readWithCache(absPath) {
  const stat = fs.statSync(absPath);
  const cacheKey = crypto
    .createHash('sha1')
    .update(absPath + ':' + stat.mtimeMs + ':' + stat.size)
    .digest('hex');
  const cachePath = path.join(CACHE_DIR, cacheKey + '.json');
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {
      // fall through to fresh parse
    }
  }
  const source = fs.readFileSync(absPath, 'utf8');
  const result = extractCoherence(source, absPath);
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(result));
  } catch {
    // cache write failures are non-fatal
  }
  return result;
}

function extractCoherence(source, filePath) {
  // Cheap pragma check first — avoids the parse cost for exempt files.
  const pragmaMatch = source.match(EXEMPT_PRAGMA_RE);
  if (pragmaMatch) {
    return { exempt: true, exemptReason: pragmaMatch[1].trim() };
  }

  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'module',
      plugins: ['jsx'],
      errorRecovery: false,
    });
  } catch (err) {
    return { parseError: `${filePath}: ${err.message}` };
  }

  let foundNode = null;
  for (const node of ast.program.body) {
    // export const __coherence__ = { ... }
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration &&
      node.declaration.type === 'VariableDeclaration'
    ) {
      for (const d of node.declaration.declarations) {
        if (d.id && d.id.name === '__coherence__' && d.init) {
          foundNode = d.init;
          break;
        }
      }
    }
    // const __coherence__ = { ... }; export { __coherence__ };
    if (
      !foundNode &&
      node.type === 'VariableDeclaration'
    ) {
      for (const d of node.declarations) {
        if (d.id && d.id.name === '__coherence__' && d.init) {
          foundNode = d.init;
          break;
        }
      }
    }
    if (foundNode) break;
  }

  if (!foundNode) {
    return { undeclared: true };
  }

  try {
    const value = evaluateLiteral(foundNode);
    return { coherence: value };
  } catch (err) {
    return { evalError: err.message };
  }
}

function evaluateLiteral(node) {
  switch (node.type) {
    case 'ObjectExpression': {
      const obj = {};
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty') {
          throw new Error(`disallowed property kind '${prop.type}' in __coherence__ literal`);
        }
        if (prop.computed) {
          throw new Error('computed keys not allowed in __coherence__ literal');
        }
        let key;
        if (prop.key.type === 'Identifier') key = prop.key.name;
        else if (prop.key.type === 'StringLiteral') key = prop.key.value;
        else throw new Error(`unsupported key type '${prop.key.type}' in __coherence__ literal`);
        obj[key] = evaluateLiteral(prop.value);
      }
      return obj;
    }
    case 'ArrayExpression': {
      const arr = [];
      for (const el of node.elements) {
        if (el === null) throw new Error('sparse arrays not allowed in __coherence__ literal');
        arr.push(evaluateLiteral(el));
      }
      return arr;
    }
    case 'StringLiteral':
      return node.value;
    case 'NumericLiteral':
      return node.value;
    case 'BooleanLiteral':
      return node.value;
    case 'NullLiteral':
      return null;
    case 'UnaryExpression':
      // Allow `-1` etc. but not arbitrary unary expressions.
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return -node.argument.value;
      }
      throw new Error(`unsupported unary expression '${node.operator}' in __coherence__ literal`);
    default:
      throw new Error(
        `unsupported expression type '${node.type}' in __coherence__ literal — only object/array/string/number/boolean/null allowed`
      );
  }
}

// ---------------------------------------------------------------------------
// schema validation

function validateCoherence(c, filePath) {
  const errors = [];
  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    errors.push('top-level must be an object literal');
    return errors;
  }

  // id
  if (typeof c.id !== 'string' || !c.id.length) {
    errors.push("'id' is required and must be a non-empty string");
  } else if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(c.id)) {
    errors.push(`'id' must be kebab-case with at least one '.' separator, got '${c.id}'`);
  }

  // kind
  if (!c.kind || !VALID_KINDS.has(c.kind)) {
    errors.push(`'kind' must be one of: ${[...VALID_KINDS].join(', ')}`);
  }

  // status
  if (!c.status || !VALID_STATUSES.has(c.status)) {
    errors.push(`'status' must be one of: ${[...VALID_STATUSES].join(', ')}`);
  }

  // produces / consumes per kind
  const requiresProduces = c.kind === 'primitive' || c.kind === 'aggregator' || c.kind === 'research';
  const requiresConsumes = c.kind === 'aggregator' || c.kind === 'surface';

  if (requiresProduces) {
    if (!Array.isArray(c.produces) || c.produces.length === 0) {
      errors.push(`'produces' is required for kind '${c.kind}' and must be a non-empty array of strings`);
    } else if (c.produces.some((t) => typeof t !== 'string' || !t.length)) {
      errors.push("'produces' must contain only non-empty strings");
    }
  }
  if (requiresConsumes) {
    if (!Array.isArray(c.consumes) || c.consumes.length === 0) {
      errors.push(`'consumes' is required for kind '${c.kind}' and must be a non-empty array of strings`);
    } else if (c.consumes.some((t) => typeof t !== 'string' || !t.length)) {
      errors.push("'consumes' must contain only non-empty strings");
    }
  }

  // targetIntegration
  const requiresTarget = c.kind === 'research' || c.status === 'pending-absorption';
  if (requiresTarget) {
    if (!c.targetIntegration || typeof c.targetIntegration !== 'object') {
      errors.push(`'targetIntegration' is required when kind='research' or status='pending-absorption'`);
    } else {
      const ti = c.targetIntegration;
      if (!ti.layer || !VALID_TARGET_LAYERS.has(ti.layer)) {
        errors.push(`'targetIntegration.layer' must be one of: ${[...VALID_TARGET_LAYERS].join(', ')}`);
      }
      if (typeof ti.deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ti.deadline)) {
        errors.push(`'targetIntegration.deadline' must be an ISO date YYYY-MM-DD`);
      } else {
        const d = new Date(ti.deadline);
        if (Number.isNaN(d.getTime())) {
          errors.push(`'targetIntegration.deadline' is not a valid date: ${ti.deadline}`);
        }
      }
      if (ti.expectedConsumers !== undefined) {
        if (!Array.isArray(ti.expectedConsumers) || ti.expectedConsumers.some((s) => typeof s !== 'string')) {
          errors.push(`'targetIntegration.expectedConsumers' must be an array of strings`);
        }
      }
      if (ti.predicate !== undefined && typeof ti.predicate !== 'string') {
        errors.push(`'targetIntegration.predicate' must be a string when present`);
      }
    }
  }

  // pipelineStep
  if (c.pipelineStep !== undefined) {
    if (
      typeof c.pipelineStep !== 'number' ||
      !Number.isInteger(c.pipelineStep) ||
      c.pipelineStep < 1 ||
      c.pipelineStep > 8
    ) {
      errors.push(`'pipelineStep' must be an integer in 1..8`);
    }
    if (c.kind && c.kind !== 'primitive') {
      errors.push(`'pipelineStep' is only valid for kind='primitive'`);
    }
  }

  // owners
  if (c.owners !== undefined) {
    if (typeof c.owners !== 'object' || c.owners === null || Array.isArray(c.owners)) {
      errors.push(`'owners' must be an object when present`);
    } else {
      if (c.owners.introducedBy !== undefined && typeof c.owners.introducedBy !== 'string') {
        errors.push(`'owners.introducedBy' must be a string when present`);
      }
      if (c.owners.persona !== undefined && typeof c.owners.persona !== 'string') {
        errors.push(`'owners.persona' must be a string when present`);
      }
    }
  }

  if (c.notes !== undefined && typeof c.notes !== 'string') {
    errors.push(`'notes' must be a string when present`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// graph + drift

function buildGraph(modules) {
  const idToModule = new Map();
  const idCollisions = [];
  const producersByTag = new Map();
  const consumersByTag = new Map();

  for (const m of modules) {
    if (!m.coherence) continue;
    const id = m.coherence.id;
    if (idToModule.has(id)) {
      idCollisions.push({ id, files: [idToModule.get(id).relPath, m.relPath] });
    } else {
      idToModule.set(id, m);
    }
    for (const tag of m.coherence.produces || []) {
      if (!producersByTag.has(tag)) producersByTag.set(tag, []);
      producersByTag.get(tag).push(id);
    }
    for (const tag of m.coherence.consumes || []) {
      if (!consumersByTag.has(tag)) consumersByTag.set(tag, []);
      consumersByTag.get(tag).push(id);
    }
  }
  return { idToModule, idCollisions, producersByTag, consumersByTag };
}

function computeDrift({ modules, graph, today }) {
  const orphans = [];
  const danglingConsumers = [];
  const expiredDeadlines = [];
  const unfulfilledExpectations = [];
  const newTags = [];

  // Orphans: produces tag with zero consumers in the graph (skip surface-only tags
  // and tags only produced by research modules which are by definition pending).
  const seenTags = new Set();
  for (const [tag, producers] of graph.producersByTag) {
    seenTags.add(tag);
    const consumers = graph.consumersByTag.get(tag) || [];
    if (consumers.length === 0) {
      // A research module's produces tag is expected to be orphan until absorbed —
      // tracked separately via expired-deadline check, so don't double-report.
      const onlyResearch = producers.every((id) => {
        const m = graph.idToModule.get(id);
        return m && m.coherence && m.coherence.kind === 'research';
      });
      if (!onlyResearch) {
        orphans.push({ tag, producers });
      }
    }
  }
  for (const [tag] of graph.consumersByTag) {
    seenTags.add(tag);
  }

  // Dangling consumers: consumes tag with zero producers anywhere
  for (const [tag, consumers] of graph.consumersByTag) {
    const producers = graph.producersByTag.get(tag) || [];
    if (producers.length === 0) {
      danglingConsumers.push({ tag, consumers });
    }
  }

  // Expired deadlines + unfulfilled expectedConsumers
  for (const m of modules) {
    if (!m.coherence) continue;
    const c = m.coherence;
    const ti = c.targetIntegration;
    if (!ti) continue;
    if (ti.deadline && c.status !== 'integrated') {
      const dl = new Date(ti.deadline);
      if (!Number.isNaN(dl.getTime()) && dl < today) {
        expiredDeadlines.push({
          id: c.id,
          deadline: ti.deadline,
          status: c.status,
          layer: ti.layer || null,
          owners: c.owners || null,
          relPath: m.relPath,
        });
      }
    }
    if (Array.isArray(ti.expectedConsumers) && Array.isArray(c.produces)) {
      for (const expectedId of ti.expectedConsumers) {
        const target = graph.idToModule.get(expectedId);
        if (!target) {
          unfulfilledExpectations.push({
            id: c.id,
            expected: expectedId,
            reason: 'expected consumer id not declared anywhere',
          });
          continue;
        }
        const targetConsumes = (target.coherence && target.coherence.consumes) || [];
        const overlap = c.produces.some((t) => targetConsumes.includes(t));
        if (!overlap) {
          unfulfilledExpectations.push({
            id: c.id,
            expected: expectedId,
            reason: `target does not consume any of: ${c.produces.join(', ')}`,
          });
        }
      }
    }
  }

  // New tags (not in seed vocabulary)
  for (const tag of seenTags) {
    if (!SEED_VOCABULARY.has(tag)) {
      newTags.push(tag);
    }
  }

  return { orphans, danglingConsumers, expiredDeadlines, unfulfilledExpectations, newTags };
}

// ---------------------------------------------------------------------------
// manifest generation

const GENERATED_HEADER =
  '<!-- GENERATED — do not edit. Source: __coherence__ blocks. Run `node scripts/coherence-scan.cjs` to regenerate. -->';

function generateCanonicalPipeline({ modules, graph }) {
  const lines = [
    GENERATED_HEADER,
    '',
    '# Canonical Pipeline',
    '',
    'Mechanically-derived view of the decision pipeline. Each row is a primitive that',
    'declared a `pipelineStep`. Steps without declared primitives are listed as `(none yet)`.',
    '',
  ];
  const STEPS = [
    'Build raw stats',
    'Derive percentages, classify style, build position stats',
    'Build range profile',
    'Accumulate decisions, build villain decision model, detect weaknesses',
    'Build villain profile, infer thoughts',
    'Generate exploits, compute observations',
    'Build briefings',
    'Game tree evaluation (aggregator hooks)',
  ];

  const byStep = new Map();
  for (const m of modules) {
    if (!m.coherence) continue;
    if (m.coherence.kind !== 'primitive') continue;
    const s = m.coherence.pipelineStep;
    if (!Number.isInteger(s)) continue;
    if (!byStep.has(s)) byStep.set(s, []);
    byStep.get(s).push(m);
  }

  for (let i = 1; i <= STEPS.length; i++) {
    lines.push(`## Step ${i}. ${STEPS[i - 1]}`);
    lines.push('');
    const list = byStep.get(i) || [];
    if (list.length === 0) {
      lines.push('_(no declared primitives yet)_');
    } else {
      list.sort((a, b) => a.coherence.id.localeCompare(b.coherence.id));
      for (const m of list) {
        const c = m.coherence;
        const produces = (c.produces || []).map((t) => `\`${t}\``).join(', ');
        lines.push(`- **${c.id}** — \`${m.relPath}\``);
        lines.push(`  - produces: ${produces || '_none_'}`);
        if (c.consumes && c.consumes.length) {
          lines.push(`  - consumes: ${c.consumes.map((t) => `\`${t}\``).join(', ')}`);
        }
      }
    }
    lines.push('');
  }

  // Aggregators (always after numbered steps, no pipelineStep)
  const aggs = modules.filter((m) => m.coherence && m.coherence.kind === 'aggregator');
  lines.push('## Aggregators');
  lines.push('');
  if (aggs.length === 0) {
    lines.push('_(no declared aggregators yet)_');
  } else {
    aggs.sort((a, b) => a.coherence.id.localeCompare(b.coherence.id));
    for (const m of aggs) {
      const c = m.coherence;
      lines.push(`- **${c.id}** — \`${m.relPath}\``);
      lines.push(`  - produces: ${(c.produces || []).map((t) => `\`${t}\``).join(', ') || '_none_'}`);
      lines.push(`  - consumes: ${(c.consumes || []).map((t) => `\`${t}\``).join(', ') || '_none_'}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function generateSurfaceSubscribers({ modules, graph }) {
  const lines = [
    GENERATED_HEADER,
    '',
    '# Surface Subscribers',
    '',
    'Mechanically-derived view of which UI surfaces consume which decision tags.',
    '',
  ];
  const surfaces = modules.filter((m) => m.coherence && m.coherence.kind === 'surface');
  if (surfaces.length === 0) {
    lines.push('_(no declared surfaces yet)_');
    lines.push('');
    return lines.join('\n');
  }
  surfaces.sort((a, b) => a.coherence.id.localeCompare(b.coherence.id));
  lines.push('| Surface | File | Consumes |');
  lines.push('|---------|------|----------|');
  for (const m of surfaces) {
    const c = m.coherence;
    const consumes = (c.consumes || []).map((t) => `\`${t}\``).join(', ');
    lines.push(`| ${c.id} | \`${m.relPath}\` | ${consumes || '_none_'} |`);
  }
  lines.push('');

  // Reverse index: tag → surfaces consuming it
  lines.push('## By tag');
  lines.push('');
  const tagToSurfaces = new Map();
  for (const m of surfaces) {
    for (const tag of m.coherence.consumes || []) {
      if (!tagToSurfaces.has(tag)) tagToSurfaces.set(tag, []);
      tagToSurfaces.get(tag).push(m.coherence.id);
    }
  }
  const tags = [...tagToSurfaces.keys()].sort();
  if (tags.length === 0) {
    lines.push('_(no consumed tags)_');
  } else {
    for (const tag of tags) {
      lines.push(`- \`${tag}\` → ${tagToSurfaces.get(tag).map((id) => `\`${id}\``).join(', ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function generateIntegrationDebt({ modules, drift, today }) {
  const lines = [
    GENERATED_HEADER,
    '',
    '# Integration Debt Ledger',
    '',
    `Generated: ${today.toISOString().slice(0, 10)}`,
    '',
    'Modules that have declared a `targetIntegration.deadline` and are not yet `integrated`,',
    'plus orphan primitives detected by the scanner.',
    '',
  ];

  const pending = modules.filter(
    (m) =>
      m.coherence &&
      m.coherence.targetIntegration &&
      m.coherence.targetIntegration.deadline &&
      m.coherence.status !== 'integrated'
  );
  pending.sort((a, b) =>
    a.coherence.targetIntegration.deadline.localeCompare(b.coherence.targetIntegration.deadline)
  );

  lines.push('## Pending absorption');
  lines.push('');
  if (pending.length === 0) {
    lines.push('_(none)_');
  } else {
    lines.push('| ID | File | Deadline | Status | Layer | State |');
    lines.push('|----|------|----------|--------|-------|-------|');
    for (const m of pending) {
      const c = m.coherence;
      const dl = c.targetIntegration.deadline;
      const expired = new Date(dl) < today;
      const state = expired ? '🔴 EXPIRED' : '🟡 PENDING';
      lines.push(
        `| ${c.id} | \`${m.relPath}\` | ${dl} | ${c.status} | ${c.targetIntegration.layer || '—'} | ${state} |`
      );
    }
  }
  lines.push('');

  lines.push('## Orphan primitives');
  lines.push('');
  if (drift.orphans.length === 0) {
    lines.push('_(none)_');
  } else {
    lines.push('| Tag | Producers |');
    lines.push('|-----|-----------|');
    for (const o of drift.orphans) {
      lines.push(`| \`${o.tag}\` | ${o.producers.map((p) => `\`${p}\``).join(', ')} |`);
    }
  }
  lines.push('');

  lines.push('## Dangling consumers');
  lines.push('');
  if (drift.danglingConsumers.length === 0) {
    lines.push('_(none)_');
  } else {
    lines.push('| Tag | Consumers (no producer exists) |');
    lines.push('|-----|--------------------------------|');
    for (const d of drift.danglingConsumers) {
      lines.push(`| \`${d.tag}\` | ${d.consumers.map((c) => `\`${c}\``).join(', ')} |`);
    }
  }
  lines.push('');

  if (drift.unfulfilledExpectations.length) {
    lines.push('## Unfulfilled expectedConsumers');
    lines.push('');
    lines.push('| ID | Expected consumer | Reason |');
    lines.push('|----|-------------------|--------|');
    for (const u of drift.unfulfilledExpectations) {
      lines.push(`| ${u.id} | ${u.expected} | ${u.reason} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main

function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();

  const relPaths = walkDesignatedFiles({ stagedOnly: args.staged });
  const newlyAdded = args.staged ? newlyAddedFiles() : new Set();

  const modules = [];
  const undeclared = [];
  const exempt = [];
  const parseErrors = [];
  const evalErrors = [];

  for (const rel of relPaths) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue; // staged-but-deleted etc.
    const result = readWithCache(abs);
    if (result.exempt) {
      exempt.push({ relPath: rel, reason: result.exemptReason });
      continue;
    }
    if (result.parseError) {
      parseErrors.push(result.parseError);
      continue;
    }
    if (result.evalError) {
      evalErrors.push({ relPath: rel, error: result.evalError });
      continue;
    }
    if (result.undeclared) {
      undeclared.push(rel);
      continue;
    }
    modules.push({ relPath: rel, coherence: result.coherence });
  }

  // Schema validation
  const schemaViolations = [];
  for (const m of modules) {
    const errs = validateCoherence(m.coherence, m.relPath);
    if (errs.length) {
      schemaViolations.push({ relPath: m.relPath, id: m.coherence.id || null, errors: errs });
    }
  }

  // Build graph from VALID modules only — collisions and bad blocks would skew the graph.
  const validModules = modules.filter(
    (m) => !schemaViolations.some((v) => v.relPath === m.relPath)
  );
  const graph = buildGraph(validModules);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const drift = computeDrift({ modules: validModules, graph, today });

  const elapsedMs = Date.now() - startedAt;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.staged ? 'staged' : args.check ? 'check' : args.json ? 'json' : 'full',
    elapsedMs,
    stats: {
      filesScanned: relPaths.length,
      declared: modules.length,
      undeclared: undeclared.length,
      exempt: exempt.length,
    },
    schemaViolations,
    idCollisions: graph.idCollisions,
    parseErrors,
    evalErrors,
    drift,
    declared: validModules.map((m) => ({
      id: m.coherence.id,
      kind: m.coherence.kind,
      status: m.coherence.status,
      relPath: m.relPath,
      produces: m.coherence.produces || [],
      consumes: m.coherence.consumes || [],
      pipelineStep: m.coherence.pipelineStep || null,
    })),
    undeclaredFiles: undeclared,
    exemptFiles: exempt,
    newlyAddedUndeclared: undeclared.filter((rel) => newlyAdded.has(rel)),
  };

  // Emit JSON report
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');

  // Regenerate manifests unless --check or --json or --staged
  if (!args.check && !args.json && !args.staged) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(DOCS_DIR, 'CANONICAL_PIPELINE.md'),
      generateCanonicalPipeline({ modules: validModules, graph })
    );
    fs.writeFileSync(
      path.join(DOCS_DIR, 'SURFACE_SUBSCRIBERS.md'),
      generateSurfaceSubscribers({ modules: validModules, graph })
    );
    fs.writeFileSync(
      path.join(DOCS_DIR, 'INTEGRATION_DEBT.md'),
      generateIntegrationDebt({ modules: validModules, drift, today })
    );
  }

  // Console summary (suppressed in --json mode)
  if (!args.json) {
    const tag = args.staged ? '[staged]' : args.check ? '[check]' : '[full]';
    console.log(`coherence-scan ${tag} ${elapsedMs}ms`);
    console.log(`  scanned: ${relPaths.length}  declared: ${modules.length}  undeclared: ${undeclared.length}  exempt: ${exempt.length}`);
    if (schemaViolations.length) {
      console.log(`  schema violations: ${schemaViolations.length}`);
      for (const v of schemaViolations) {
        console.log(`    ${v.relPath}${v.id ? ` (${v.id})` : ''}: ${v.errors.join('; ')}`);
      }
    }
    if (graph.idCollisions.length) {
      console.log(`  id collisions: ${graph.idCollisions.length}`);
      for (const c of graph.idCollisions) {
        console.log(`    ${c.id}: ${c.files.join(' <-> ')}`);
      }
    }
    if (drift.expiredDeadlines.length) {
      console.log(`  expired deadlines: ${drift.expiredDeadlines.length}`);
      for (const e of drift.expiredDeadlines) {
        console.log(`    ${e.id} (${e.deadline}, status=${e.status})`);
      }
    }
    if (drift.orphans.length) {
      console.log(`  orphan tags: ${drift.orphans.length}`);
    }
    if (drift.danglingConsumers.length) {
      console.log(`  dangling consumers: ${drift.danglingConsumers.length}`);
    }
    if (drift.unfulfilledExpectations.length) {
      console.log(`  unfulfilled expectedConsumers: ${drift.unfulfilledExpectations.length}`);
    }
    if (drift.newTags.length) {
      console.log(`  new tags (vocabulary triage): ${drift.newTags.length} — ${drift.newTags.join(', ')}`);
    }
    if (parseErrors.length) {
      console.log(`  parse errors: ${parseErrors.length}`);
      for (const e of parseErrors) console.log(`    ${e}`);
    }
    if (evalErrors.length) {
      console.log(`  literal-eval errors: ${evalErrors.length}`);
      for (const e of evalErrors) console.log(`    ${e.relPath}: ${e.error}`);
    }
    if (args.staged && report.newlyAddedUndeclared.length) {
      console.log(`  newly-added undeclared (Phase 1 advisory): ${report.newlyAddedUndeclared.length}`);
      for (const rel of report.newlyAddedUndeclared) console.log(`    ${rel}`);
    }
  }

  // Exit code policy: Phase 1 is advisory by default — only exit non-zero with --strict.
  const hardFailure =
    schemaViolations.length > 0 ||
    drift.expiredDeadlines.length > 0 ||
    graph.idCollisions.length > 0 ||
    parseErrors.length > 0 ||
    evalErrors.length > 0;

  if (args.strict && hardFailure) {
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  // exported for unit testing
  evaluateLiteral,
  validateCoherence,
  extractCoherence,
  buildGraph,
  computeDrift,
};
