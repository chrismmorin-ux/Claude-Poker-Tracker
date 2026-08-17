#!/usr/bin/env node
/**
 * harvestLabelConstructs.mjs — the label-shaped-input harvester (WS-445).
 *
 * A "label-shaped input" is any DISCRETE KEY standing between raw game data and a numeric
 * engine parameter: a position label, a style label, a hand-strength bucket, a board-texture
 * category, an SPR zone, a stack tier, a line tag, a size bucket. POKER_THEORY §7.1 and
 * `exploitEngine/CLAUDE.md` forbid them as decision inputs; 49 families exist anyway, which is
 * why this is a harvester and not another paragraph.
 *
 * WHY A HARVEST AND NOT A GREP — the same argument `check-additive.mjs:11-16` makes, inverted.
 * That gate diffs because DELETING a line leaves no token to search for. This one diffs because
 * ADDING a table leaves no distinctive token either: `IMPACT_MAP`, `REALIZATION_TABLE` and
 * `BUCKET_MIDPOINT` share no lexical marker. The construct has an AST shape and no name.
 *
 * WHY NOT A PROVENANCE TAG ON EVERY EXPORT. Measured at HEAD 2026-08-16: 42 of 128 keyed
 * numeric tables (33%) are MODULE-PRIVATE, including `preflopAdvisor.js` PREFLOP_RAISE_SIZES.
 * A gate keyed on exports misses a third of the surface by construction, and hands every author
 * a one-keystroke exemption — delete the word `export` and it reads as a cleanup in review.
 *
 * MEASURED AT HEAD 2026-08-16 (`node scripts/standardOfRecord/harvestLabelConstructs.mjs`):
 * 505 files, 0 parse failures, 145 constructs — 128 keyed tables, 6 label-switches,
 * 11 label-ternaries. Recall against the WS-445 survey's named families: 16 of 17, the one
 * miss being `STYLE_DESCRIPTIONS`, a label→string DISPLAY map, rejected by design. Precision is
 * ~94%: the known false positives are module-level Result Card builders in
 * `scripts/backtest/emit-*-result-card.mjs`, which carry an exclusion reason rather than a row.
 *
 * THIS MODULE IS PURE AND EXPORTED. The gate imports it; so do the drift tests. It owns no
 * baseline, prints no verdict, and exits nothing — that is `check-label-ledger.mjs`'s job. The
 * split is the one `scripts/backtest/holeMapFreshness.mjs:26-32` states: a detector you can
 * test against string fixtures is a detector you can trust.
 *
 * Standalone:
 *   node scripts/standardOfRecord/harvestLabelConstructs.mjs            # per-root counts
 *   node scripts/standardOfRecord/harvestLabelConstructs.mjs --json     # the full roster
 *   node scripts/standardOfRecord/harvestLabelConstructs.mjs --proposed # incl. unratified roots
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

import fg from 'fast-glob';
import * as parser from '@babel/parser';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..');

/**
 * Roots ratified by the founder (WS-445 Phase 0). Widening the engine widens the ledger: a new
 * directory feeding an engine parameter joins this list in the change that creates it, or its
 * tables are invisible — a scope hole to be recorded, never an exemption to be taken.
 */
export const ROOTS = Object.freeze([
  'src/utils',
  'src/constants',
  'scripts/backtest',
]);

/**
 * WHY THE ROOT LIST IS BROAD, ratified by the founder 2026-08-16 (WS-445 Phase 0).
 *
 * The plan proposed seven named engine directories plus four candidates. Measured, those four
 * added exactly ONE construct — while six directories nobody had listed added about forty,
 * including four label families the WS-445 survey had already documented by name:
 * `STYLE_MULTIPLIERS` (emotionalState), `GROUP_CALL_RATES` and `ARCHETYPE_BUCKET_MULTIPLIERS`
 * (postflopDrillContent), `ACTION_CONSERVATISM_RANK` (heroState), plus 14 constructs in
 * skillAssessment and 5 in assumptionEngine.
 *
 * A named-directory list would therefore have shipped a ledger claiming exhaustiveness over a
 * scope that provably excluded the surface with the WORST provenance. The cost of going wide is
 * ~20 constructs in `shapeLanguage`, `playerMatching`, `claimAdjudication` and
 * `standardOfRecord` that are not engine-parameter paths; they become exclusions carrying a
 * stated reason, which is a recorded and reviewable judgment. A glob that never looked is not.
 */

/**
 * Vacuity floors by path PREFIX, so a broken walk is caught per AREA and not only per root.
 * With three broad roots a per-root floor is far too coarse — losing all 43 exploitEngine
 * constructs still leaves 102 of 145 and would sail past any corpus check.
 *
 * Measured at HEAD 2026-08-16 in brackets; floors set at ~80% to leave headroom for legitimate
 * deletion. A directory measuring 0 is NOT listed: an absent floor is "nothing here yet", a
 * floor of 0 would be indistinguishable from a dead detector.
 */
export const PATH_FLOORS = Object.freeze({
  'src/utils/exploitEngine': 34, //        [43]
  'src/utils/postflopDrillContent': 12, // [16]
  'src/utils/skillAssessment': 11, //      [14]
  'src/utils/rangeEngine': 8, //           [10]
  'src/utils/pokerCore': 4, //             [5]
  'src/utils/assumptionEngine': 4, //      [5]
  'src/utils/emotionalState': 2, //        [3]
  'src/constants': 4, //                   [6]
  'scripts/backtest': 16, //               [21]
});

export const CORPUS_FLOOR = 116; // measured 145 — ~80%, headroom for legitimate deletion
export const FILE_FLOOR = 400; //  measured 505 — the globs themselves going vacuous

const SKIP_DIR = /(^|[\\/])(__tests__|__fixtures__|__dev__|__sim__|__backtest__|__mocks__|node_modules)([\\/]|$)/;
const SKIP_FILE = /\.(test|spec)\./;

/** Minimum numeric leaves for an object to count as a keyed numeric TABLE rather than a config. */
const MIN_LEAVES = 2;

// ─── AST helpers ──────────────────────────────────────────────────────────────

/**
 * A generic recursive walk. @babel/traverse is not a dependency here (coherence-scan.cjs walks
 * by hand for the same reason), so this visits every own-property node and calls `visit(node,
 * ancestors)`. Returning `false` from `visit` prunes the subtree.
 */
const walk = (node, visit, ancestors = []) => {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node, ancestors) === false) return;
  const next = ancestors.concat(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const v = node[key];
    if (Array.isArray(v)) {
      for (const c of v) if (c && typeof c.type === 'string') walk(c, visit, next);
    } else if (v && typeof v.type === 'string') {
      walk(v, visit, next);
    }
  }
};

/** `deepFreeze({...})` / `Object.freeze({...})` — unwrap single-argument wrappers to the object. */
const unwrapCall = (node) => {
  let n = node;
  let guard = 0;
  while (n && n.type === 'CallExpression' && n.arguments.length === 1 && guard++ < 8) {
    n = n.arguments[0];
  }
  return n;
};

/** A key that reads as a LABEL: a string literal or a bare identifier, never a computed one. */
const labelKeyName = (prop) => {
  if (!prop || prop.computed) return null;
  if (prop.type !== 'ObjectProperty' && prop.type !== 'Property') return null;
  const k = prop.key;
  if (!k) return null;
  if (k.type === 'StringLiteral') return k.value;
  if (k.type === 'Identifier') return k.name;
  if (k.type === 'NumericLiteral') return null; // a numeric key is an index, not a label
  return null;
};

const isNumericLeaf = (n) => {
  if (!n) return false;
  if (n.type === 'NumericLiteral') return true;
  // `-0.15` parses as UnaryExpression over a NumericLiteral.
  if (n.type === 'UnaryExpression' && (n.operator === '-' || n.operator === '+')) {
    return isNumericLeaf(n.argument);
  }
  return false;
};

/**
 * Classify a leaf value. The three accepting kinds each exist because a real table was MISSED
 * without them, and a missed table is a ledger row nobody writes:
 *
 *  - `numeric-array` — `PREFLOP_RAISE_SIZES` (`preflopAdvisor.js:83`) maps ten labels to
 *    `[3.0, 3.5]` sizing pairs. A label→numeric-VECTOR table is still a label-shaped input.
 *  - `ref` — `ACTION_TAU_FRACTION` (`postflopNarrower.js:545`) is `{check: 1.0, bet:
 *    TAU_FRACTION, ...}`: three of its four values are an identifier. Requiring two numeric
 *    LITERALS rejected the single best-measured table in the engine.
 *  - `numeric` — the ordinary case.
 *
 * `string` is rejected on purpose and is not a near-miss: a label→string map is a DISPLAY map
 * (`STYLE_DESCRIPTIONS`), and display labels are outside what POKER_THEORY §7.1 governs.
 */
const leafKind = (n) => {
  if (!n) return 'other';
  if (isNumericLeaf(n)) return 'numeric';
  if (n.type === 'ArrayExpression') {
    const els = n.elements.filter(Boolean);
    return els.length > 0 && els.every(isNumericLeaf) ? 'numeric-array' : 'other';
  }
  if (n.type === 'Identifier' || n.type === 'MemberExpression') return 'ref';
  if (n.type === 'StringLiteral' || n.type === 'TemplateLiteral') return 'string';
  // `BASE * 0.5` — a value computed from numerics is still a parameter cell.
  if (n.type === 'BinaryExpression' || n.type === 'ConditionalExpression') return 'computed';
  return 'other';
};

/**
 * Analyse an ObjectExpression as a candidate keyed numeric table.
 *
 * Recurses through nested ObjectExpressions so a depth-3 table (REALIZATION_TABLE is
 * street → ip/oop → sprZone) is one construct, not thirty. Returns the per-depth key
 * vocabulary, the numeric leaf count, and whether any leaf is NOT a numeric literal.
 */
const analyzeObject = (node) => {
  const keysByDepth = [];
  const counts = {
    numeric: 0, 'numeric-array': 0, ref: 0, computed: 0, string: 0, other: 0,
  };
  let cellCount = 0;
  let labelKeys = 0;
  let totalKeys = 0;

  const visit = (obj, depth) => {
    if (!keysByDepth[depth]) keysByDepth[depth] = new Set();
    for (const prop of obj.properties || []) {
      if (prop.type === 'SpreadElement' || prop.type === 'ObjectMethod') {
        counts.other += 1;
        continue;
      }
      totalKeys += 1;
      const name = labelKeyName(prop);
      if (name === null) continue;
      labelKeys += 1;
      keysByDepth[depth].add(name);

      const value = unwrapCall(prop.value);
      if (value && value.type === 'ObjectExpression') {
        visit(value, depth + 1);
        continue;
      }
      const kind = leafKind(value);
      counts[kind] += 1;
      if (kind === 'numeric') cellCount += 1;
      else if (kind === 'numeric-array') cellCount += value.elements.filter(Boolean).length;
      else if (kind === 'ref') cellCount += 1;
    }
  };

  visit(node, 0);

  const numericish = counts.numeric + counts['numeric-array'] + counts.ref + counts.computed;
  const anchored = counts.numeric + counts['numeric-array'];

  /**
   * A construct qualifies as a label-shaped input when:
   *   - it is keyed by ≥2 labels (a one-key object is not a table), AND
   *   - ≥1 value is an ACTUAL number or numeric vector. This single clause is what excludes
   *     pure display maps (`STYLE_DESCRIPTIONS`) and pure re-export maps (`{a: fnA, b: fnB}`),
   *     AND
   *   - ≥2 values are numeric-ish overall (number, numeric vector, reference, or computed).
   *
   * DELIBERATELY NOT REJECTED: a table carrying string fields alongside its numbers.
   * `M_RATIO_ZONES` is `{GREEN: {min: 20, color: …, label: 'Comfortable'}}` — a genuine
   * label→threshold table wearing two cosmetic fields, and an earlier `string === 0` clause
   * made it invisible. A false POSITIVE lands in the exclusions ledger with a stated reason,
   * which is a designed and cheap path; a false NEGATIVE is a row nobody ever writes, which is
   * the failure this whole ledger exists to prevent. Recall is bought at precision's expense on
   * purpose, and the exclusions ledger is where the bill is paid.
   */
  const qualifies = labelKeys >= MIN_LEAVES
    && anchored >= 1
    && numericish >= MIN_LEAVES;

  return {
    keyPaths: keysByDepth.map((s) => [...s].sort()),
    cellCount,
    counts,
    numericish,
    anchored,
    labelKeys,
    totalKeys,
    qualifies,
  };
};

const digest = (obj) => createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 12);

/**
 * Is this VariableDeclarator declared at module scope?
 * Shapes: `Program > VariableDeclaration > VariableDeclarator`, or with an
 * `ExportNamedDeclaration` in between.
 */
const isModuleLevel = (ancestors) => {
  const n = ancestors.length;
  const decl = ancestors[n - 1];
  if (!decl || decl.type !== 'VariableDeclaration') return false;
  const parent = ancestors[n - 2];
  if (!parent) return false;
  if (parent.type === 'Program') return true;
  return parent.type === 'ExportNamedDeclaration' && ancestors[n - 3]?.type === 'Program';
};

/** The enclosing named function/variable, for anonymous switch and ternary sites. */
const enclosingName = (ancestors) => {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const a = ancestors[i];
    if (a.type === 'FunctionDeclaration' && a.id) return a.id.name;
    if (a.type === 'ObjectMethod' && a.key && a.key.name) return a.key.name;
    if (a.type === 'ClassMethod' && a.key && a.key.name) return a.key.name;
    if (a.type === 'VariableDeclarator' && a.id && a.id.type === 'Identifier') return a.id.name;
  }
  return '<module>';
};

// ─── the three harvest classes ────────────────────────────────────────────────

const harvestFile = (absPath, relPath) => {
  const src = readFileSync(absPath, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      plugins: ['jsx'],
    });
  } catch (err) {
    // A parse error is NOT a skip. `coherence-scan.cjs` records the error and carries on;
    // here that would be a hole — a file could hide from the ledger by failing to parse.
    const e = new Error(`parse failed: ${relPath}: ${err.message}`);
    e.harvestParseFailure = relPath;
    throw e;
  }

  const rows = [];
  const ordinals = new Map();
  const nextOrdinal = (scope) => {
    const n = (ordinals.get(scope) ?? 0) + 1;
    ordinals.set(scope, n);
    return n;
  };

  walk(ast.program, (node, ancestors) => {
    // ── Class 1: a keyed numeric table bound to a MODULE-LEVEL name ────────
    //
    // Module scope is the discriminator, and it is structural rather than tuned. A
    // label-shaped INPUT is a table that code READS. An object assembled inside a function —
    // `const card = {...}`, `const artifact = {...}`, `const out = {...}` — is a value under
    // construction, and 27 of them were swept in before this restriction. Every genuine table
    // the survey named is module-level, so this costs no recall.
    if (node.type === 'VariableDeclarator'
        && node.id?.type === 'Identifier'
        && node.init
        && isModuleLevel(ancestors)) {
      const init = unwrapCall(node.init);
      if (init && init.type === 'ObjectExpression') {
        const a = analyzeObject(init);
        if (a.qualifies) {
          const exported = ancestors.some((x) => x.type === 'ExportNamedDeclaration');
          rows.push({
            key: `${relPath}::${node.id.name}`,
            file: relPath,
            symbol: node.id.name,
            kind: 'keyed-numeric-table',
            keyPaths: a.keyPaths,
            cellCount: a.cellCount,
            refLeaves: a.counts.ref,
            exported,
            shapeDigest: digest(a.keyPaths),
            line: node.loc?.start?.line ?? null,
          });
        }
      }
    }

    // ── Class 2: switch on a label discriminant, yielding numbers ──────────
    if (node.type === 'SwitchStatement') {
      const caseLabels = [];
      let numerics = 0;
      for (const c of node.cases) {
        if (c.test && c.test.type === 'StringLiteral') caseLabels.push(c.test.value);
        for (const stmt of c.consequent || []) {
          walk(stmt, (inner) => {
            if (isNumericLeaf(inner)) numerics += 1;
            return true;
          });
        }
      }
      if (caseLabels.length >= 2 && numerics >= 2) {
        const scope = `${relPath}::${enclosingName(ancestors)}`;
        const keyPaths = [caseLabels.slice().sort()];
        rows.push({
          key: `${scope}#switch${nextOrdinal(`${scope}#switch`)}`,
          file: relPath,
          symbol: enclosingName(ancestors),
          kind: 'label-switch',
          keyPaths,
          cellCount: numerics,
          exported: false,
          shapeDigest: digest(keyPaths),
          line: node.loc?.start?.line ?? null,
        });
      }
    }

    // ── Class 3: a ternary chain testing a label and returning numbers ─────
    // Only fires on the OUTERMOST ConditionalExpression of a chain, so a 4-arm chain is one
    // construct rather than three overlapping ones.
    if (node.type === 'ConditionalExpression') {
      const parent = ancestors[ancestors.length - 1];
      const isNestedArm = parent
        && parent.type === 'ConditionalExpression'
        && (parent.alternate === node || parent.consequent === node);
      if (!isNestedArm) {
        const labels = [];
        let numerics = 0;
        walk(node, (inner) => {
          if (inner.type === 'BinaryExpression'
              && (inner.operator === '===' || inner.operator === '!==')) {
            for (const side of [inner.left, inner.right]) {
              if (side && side.type === 'StringLiteral') labels.push(side.value);
            }
          }
          if (isNumericLeaf(inner)) numerics += 1;
          return true;
        });
        if (labels.length >= 2 && numerics >= 2) {
          const scope = `${relPath}::${enclosingName(ancestors)}`;
          const keyPaths = [[...new Set(labels)].sort()];
          rows.push({
            key: `${scope}#ternary${nextOrdinal(`${scope}#ternary`)}`,
            file: relPath,
            symbol: enclosingName(ancestors),
            kind: 'label-ternary',
            keyPaths,
            cellCount: numerics,
            exported: false,
            shapeDigest: digest(keyPaths),
            line: node.loc?.start?.line ?? null,
          });
        }
      }
    }

    return true;
  });

  return rows;
};

// ─── the public harvest ───────────────────────────────────────────────────────

/**
 * Harvest every label-shaped construct under `roots`.
 *
 * @param {string[]} [roots] - repo-relative directories. Defaults to the ratified ROOTS.
 * @returns {{rows: object[], perRoot: Record<string, number>, files: number, parseFailures: string[]}}
 */
export const harvest = (roots = ROOTS) => {
  const rows = [];
  const perRoot = {};
  const parseFailures = [];
  let files = 0;

  for (const root of roots) {
    perRoot[root] = 0;
    const abs = join(REPO_ROOT, root);
    const found = fg.sync('**/*.{js,jsx,mjs,cjs}', {
      cwd: abs,
      absolute: true,
      onlyFiles: true,
      dot: false,
    });
    for (const file of found) {
      const rel = relative(REPO_ROOT, file).split(sep).join('/');
      if (SKIP_DIR.test(rel) || SKIP_FILE.test(rel)) continue;
      files += 1;
      let fileRows;
      try {
        fileRows = harvestFile(file, rel);
      } catch (err) {
        if (err.harvestParseFailure) { parseFailures.push(err.harvestParseFailure); continue; }
        throw err;
      }
      rows.push(...fileRows);
      perRoot[root] += fileRows.length;
    }
  }

  rows.sort((a, b) => a.key.localeCompare(b.key));
  return { rows, perRoot, files, parseFailures };
};

/**
 * Vacuity check. Returns the violations rather than throwing, so the gate owns the verdict.
 * The message MUST name which root died — "the sweep went vacuous" routes to nobody.
 */
export const vacuityProblems = ({ rows, files }) => {
  const problems = [];
  if (files < FILE_FLOOR) {
    problems.push(`HARVEST VACUOUS: only ${files} files scanned, floor is ${FILE_FLOOR}. `
      + 'The scope globs broke, or a root was quietly narrowed.');
  }
  if (rows.length < CORPUS_FLOOR) {
    problems.push(`HARVEST VACUOUS: ${rows.length} constructs harvested, floor is ${CORPUS_FLOOR}. `
      + 'An AST visitor or the walk broke.');
  }
  for (const [prefix, floor] of Object.entries(PATH_FLOORS)) {
    const n = rows.filter((r) => r.file.startsWith(`${prefix}/`)).length;
    if (n < floor) {
      problems.push(`HARVEST VACUOUS in ${prefix}: ${n} constructs, floor is ${floor}. `
        + 'That area stopped producing — its walk or glob broke. Narrowing scope is how a '
        + 'ledger goes green without anyone deciding it should.');
    }
  }
  const kinds = new Set(rows.map((r) => r.kind));
  for (const kind of ['keyed-numeric-table', 'label-switch', 'label-ternary']) {
    if (!kinds.has(kind)) {
      problems.push(`HARVEST VACUOUS: the "${kind}" detector produced ZERO hits. `
        + 'All three forms exist at HEAD, so silence means the visitor broke, not that the '
        + 'form is gone. One detector can die behind a healthy total.');
    }
  }
  return problems;
};

// ─── standalone ───────────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = harvest(ROOTS);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const byKind = {};
  for (const r of result.rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;

  console.log('Label-construct harvest — WS-445');
  console.log(`  files scanned      ${result.files}`);
  console.log(`  parse failures     ${result.parseFailures.length}`);
  console.log(`  constructs         ${result.rows.length}`);
  console.log('');
  console.log('  by kind');
  for (const [k, n] of Object.entries(byKind).sort()) console.log(`    ${k.padEnd(22)} ${n}`);
  console.log('');
  console.log('  by area                                found   floor');
  const areas = new Set([
    ...Object.keys(PATH_FLOORS),
    ...result.rows.map((r) => r.file.split('/').slice(0, 3).join('/')),
  ]);
  for (const area of [...areas].sort()) {
    const n = result.rows.filter((r) => r.file.startsWith(`${area}/`)).length;
    if (n === 0 && PATH_FLOORS[area] === undefined) continue;
    const floor = PATH_FLOORS[area];
    console.log(`    ${area.padEnd(36)} ${String(n).padStart(5)}`
      + `   ${floor === undefined ? '  —' : String(floor).padStart(3)}`);
  }
  const problems = vacuityProblems(result);
  console.log('');
  console.log(problems.length
    ? `  ⚠ ${problems.length} vacuity problem(s):\n${problems.map((p) => `    - ${p}`).join('\n')}`
    : '  ✓ vacuity guards clear');
  const priv = result.rows.filter((r) => r.kind === 'keyed-numeric-table' && !r.exported).length;
  const tables = byKind['keyed-numeric-table'] ?? 0;
  console.log('');
  console.log(`  module-private tables ${priv} of ${tables}`
    + `${tables ? ` (${Math.round((priv / tables) * 100)}%)` : ''}`
    + ' — the share an export-keyed gate would miss');
  if (result.parseFailures.length) {
    console.log('');
    console.log('  PARSE FAILURES (a file that cannot be parsed is a file that hides):');
    for (const f of result.parseFailures) console.log(`    ${f}`);
  }
}
