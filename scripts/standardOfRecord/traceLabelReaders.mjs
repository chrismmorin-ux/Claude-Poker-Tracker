#!/usr/bin/env node
/**
 * traceLabelReaders.mjs — who READS a harvested label construct (WS-445).
 *
 * `buildUnmeasuredReach` demands `readSites`, and until this existed the only way to produce
 * that number was to count by hand. The ledger's own §8 step 2 says a foundation *invented*
 * rather than read is `FAULT-constants-by-taste` wearing a new hat; a reach figure invented
 * rather than traced is the same fault one column over, and it is the column the entire
 * unmeasured ranking sorts on.
 *
 * WHY THE READER SCOPE IS WIDER THAN THE HARVEST SCOPE. `harvestLabelConstructs.mjs` scans
 * three ratified roots because that is where label-shaped constructs are DEFINED. A reader can
 * live anywhere — a view, a hook, a one-off script — and a trace confined to the harvest roots
 * would report `vestigial` for a table a component reads on every render. So the roots below
 * are deliberately broader, and in-scope and out-of-scope readers are reported SEPARATELY:
 * `vestigial` then means "no reader anywhere this tool can see", which is the only version of
 * that claim worth making.
 *
 * WHAT IT STILL CANNOT SEE, stated rather than papered over:
 *   - A re-export chain. `export { X } from './y.js'` counts as a reader of X, because at the
 *     AST level it is one; a row that cares must look.
 *   - A dynamic read, `TABLE[key]` where the table arrived as a parameter. The identifier at
 *     the read site is the parameter's name, not the table's.
 *   - Anonymous constructs (`fn#switch1`, `fn#ternary1`) have no exported symbol. What is
 *     traced for those is the ENCLOSING BINDING, so the count answers "how often is this
 *     function referenced", which is a different and weaker question. Flagged `indirect: true`.
 *
 * CALIBRATED, not asserted: `--verify` re-derives EVERY unmeasured row's `readSites` from
 * LABEL_LEDGER and fails if the trace disagrees, and it is wired into `check-label-ledger.sh`
 * so it runs rather than being available. The first three rows had been counted by hand before
 * this tool existed, so agreement was evidence for both — and the disagreement it found on run
 * one (`LBL-realization-table` said 2, the truth is 4) is why the counting rule now lives in
 * `reachOf` instead of in whoever happened to be counting.
 *
 * That generality is the point, not a convenience: it closes the REACH EXCEEDED hole
 * MEASUREMENT_OVERSIGHTS MO-1 records — *nothing fails when a NEW READER of an already-ledgered
 * table appears* — by making reach a derived quantity rather than a row's own assertion.
 *
 * Usage:
 *   node scripts/standardOfRecord/traceLabelReaders.mjs --verify        # calibration gate
 *   node scripts/standardOfRecord/traceLabelReaders.mjs --key '<k>'     # one construct
 *   node scripts/standardOfRecord/traceLabelReaders.mjs --untriaged     # the WS-445 backlog
 *   node scripts/standardOfRecord/traceLabelReaders.mjs --json          # everything, as data
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

import fg from 'fast-glob';
import * as parser from '@babel/parser';

import { harvest, ROOTS, REPO_ROOT } from './harvestLabelConstructs.mjs';

/**
 * Where a reader may live. Broader than the harvest roots on purpose (see header). `scripts`
 * is included whole rather than only `scripts/backtest`, because a reporting or emit script
 * reading an engine table is exactly the kind of reach a ledger row should count.
 */
export const READER_ROOTS = Object.freeze(['src', 'scripts', 'tests']);

const SKIP_DIR = /(^|[\\/])(node_modules|__snapshots__)([\\/]|$)/;
const TEST_FILE = /(^|[\\/])(__tests__|__mocks__|__fixtures__|tests)[\\/]|\.(test|spec)\./;

const PARSE_OPTS = {
  sourceType: 'unambiguous',
  allowReturnOutsideFunction: true,
  errorRecovery: true,
  plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining',
    'nullishCoalescingOperator', 'topLevelAwait', 'importAssertions'],
};

const walk = (node, visit, parent = null) => {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node, parent) === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit, node));
    else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v, visit, node);
  }
};

/**
 * Is this identifier a READ of the name, or one of the many places the same characters appear
 * without anybody reading anything? Declarations, non-computed property keys and member
 * accesses (`x.FOO`) all fail here — counting them is how a reach figure inflates.
 */
const isRead = (node, parent) => {
  if (!parent) return true;
  if (parent.type === 'VariableDeclarator' && parent.id === node) return false;
  if (parent.type === 'ObjectProperty' && parent.key === node && !parent.computed) return false;
  if (parent.type === 'ObjectMethod' && parent.key === node) return false;
  if (parent.type === 'ClassProperty' && parent.key === node) return false;
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
  if (parent.type === 'FunctionDeclaration' && parent.id === node) return false;
  if (/^(Import|Export)(Default|Namespace)?Specifier$/.test(parent.type)) return false;
  if (parent.type === 'ExportSpecifier') return false;
  return true;
};

const listFiles = () => {
  const pats = READER_ROOTS.map((r) => `${r}/**/*.{js,jsx,mjs,cjs}`);
  return fg
    .sync(pats, { cwd: REPO_ROOT, absolute: false, dot: false })
    .filter((f) => !SKIP_DIR.test(f))
    .map((f) => f.split('/').join(sep));
};

/** In-harvest-scope means: a reader that itself sits under a ratified harvest root. */
const inHarvestScope = (rel) => ROOTS.some((r) => rel.split(sep).join('/').startsWith(`${r}/`));

const EXTS = ['', '.js', '.jsx', '.mjs', '.cjs', '/index.js', '/index.jsx', '/index.mjs'];

/** Resolve a relative import specifier to a repo-relative path, or null for a bare package. */
const resolveSpec = (fromRel, spec) => {
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(fromRel), spec);
  for (const ext of EXTS) {
    const cand = `${base}${ext}`;
    try {
      readFileSync(join(REPO_ROOT, cand), 'utf8');
      return cand.split(sep).join('/');
    } catch { /* keep trying */ }
  }
  return null;
};

/**
 * A glob pattern as a RegExp source. Written as an explicit token walk rather than a chain of
 * `.replace()` calls with a sentinel character standing in for `**` — the sentinel version of
 * this function shipped a literal NUL byte into the source file, which made git classify a
 * plain ES module as binary. Clever placeholder, invisible failure.
 */
const globToRegExpSource = (pattern) => {
  let out = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') { out += '.*'; i += 1; } else { out += '[^/]*'; }
    } else if (ch === '?') {
      out += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return `${out}$`;
};

/**
 * GLOB READERS — the registry pattern, and the reason `vestigial` needs this.
 *
 * `heroLeakDetector.js:19` loads every rule with
 * `import.meta.glob('./leakRules/*.js', { eager: true })`. There is no `ImportDeclaration` and
 * no symbol written anywhere, so a static importer scan reports all ten production leak rules
 * as having ZERO readers. On its first run this tool did exactly that.
 *
 * That is not a cosmetic miscount. `vestigial` is the liveness value that licenses DELETING a
 * table, so a false vestigial is the one error here that can destroy working code. A registry
 * load is real reach and is recorded as one read site at the glob call.
 *
 * What it cannot then do is attribute reads *through* the namespace object — the consumer says
 * `mod.rule`, never the construct's name — so a glob-reached construct carries `viaGlob: true`
 * and its count is a floor, not a total.
 */
const collectGlobLoads = (rel, ast, out) => {
  walk(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const c = node.callee;
    const isGlob = c && c.type === 'MemberExpression' && c.property
      && (c.property.name === 'glob' || c.property.name === 'globEager');
    if (!isGlob) return;
    const arg = node.arguments && node.arguments[0];
    const patterns = [];
    if (arg && arg.type === 'StringLiteral') patterns.push(arg.value);
    if (arg && arg.type === 'ArrayExpression') {
      arg.elements.forEach((e) => { if (e && e.type === 'StringLiteral') patterns.push(e.value); });
    }
    for (const p of patterns) {
      if (!p.startsWith('.')) continue;
      const abs = join(dirname(rel), p).split(sep).join('/');
      const re = new RegExp(globToRegExpSource(abs));
      out.push({ file: rel.split(sep).join('/'), line: node.loc ? node.loc.start.line : 0, re });
    }
  });
};

/**
 * WHY THE TRACE IS PER-DEFINITION AND NOT PER-NAME — a bug this tool shipped with for exactly
 * one run, caught by looking at its own output.
 *
 * Keying reads by the bare symbol reported **392 read sites** for
 * `emit-ws436-result-card.mjs::card` and **66** for each of the ten `leakRules/*.js::rule`
 * constructs. Those are not reach. They are every unrelated local called `card` or `rule`
 * anywhere in the repo, summed. A reach figure that counts name collisions ranks the most
 * generically-named constructs highest, which is precisely backwards.
 *
 * So a read counts only where the name can actually refer to THIS definition:
 *   - inside the defining file, always;
 *   - inside a file that imports the defining module and binds this export — counted under
 *     that file's LOCAL alias, since `import { X as Y }` reads as `Y`.
 * A module-private construct is therefore confined to its own file by construction, which is
 * the correct answer and not a limitation.
 *
 * @returns {Map<string, Array<{file:string,line:number,test:boolean,inScope:boolean}>>}
 *   harvest KEY (`file::symbol`) -> read sites.
 */
export const traceReaders = (constructs) => {
  const files = listFiles();

  // Pass 1 — parse once, keep the ASTs, and record who imports what under which local name.
  const parsed = new Map();
  /** defFile -> Array<{file, localName, importedName}> */
  const importers = new Map();
  /** Array<{file, line, re}> — registry-style glob loads, see GLOB READERS below. */
  const globLoads = [];
  for (const rel of files) {
    let ast;
    try {
      ast = parser.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'), PARSE_OPTS);
    } catch { continue; }
    parsed.set(rel, ast);
    for (const node of ast.program.body) {
      if (node.type !== 'ImportDeclaration' || !node.source) continue;
      const target = resolveSpec(rel, node.source.value);
      if (!target) continue;
      for (const spec of node.specifiers) {
        if (spec.type !== 'ImportSpecifier') continue;
        const importedName = spec.imported.name || spec.imported.value;
        if (!importers.has(target)) importers.set(target, []);
        importers.get(target).push({
          file: rel, localName: spec.local.name, importedName,
        });
      }
    }
    collectGlobLoads(rel, ast, globLoads);
  }

  const readsIn = (rel, names) => {
    const ast = parsed.get(rel);
    if (!ast) return [];
    const want = new Set(names);
    const hits = [];
    walk(ast, (node, parent) => {
      if (node.type !== 'Identifier' || !want.has(node.name)) return;
      if (!isRead(node, parent)) return;
      hits.push({
        file: rel.split(sep).join('/'),
        line: node.loc ? node.loc.start.line : 0,
        test: TEST_FILE.test(rel),
        inScope: inHarvestScope(rel),
      });
    });
    return hits;
  };

  const out = new Map();
  for (const c of constructs) {
    const defRel = c.file.split('/').join(sep);
    const defPosix = c.file.split(sep).join('/');
    const sites = readsIn(defRel, [c.symbol]);
    if (c.exported) {
      for (const imp of importers.get(defPosix) || []) {
        if (imp.importedName !== c.symbol) continue;
        sites.push(...readsIn(imp.file, [imp.localName]));
      }
      for (const g of globLoads) {
        if (!g.re.test(defPosix)) continue;
        sites.push({
          file: g.file,
          line: g.line,
          test: TEST_FILE.test(g.file),
          inScope: inHarvestScope(g.file.split('/').join(sep)),
          viaGlob: true,
        });
      }
    }
    out.set(c.key, sites);
  }
  return out;
};

/**
 * THE COUNTING RULE, and it did not exist before this function.
 *
 * `readSites` feeds `reachScore` at ×10 (labelLedger.js:610), so the entire unmeasured ranking
 * sorts on it — and the three figures authored by hand before this tool turned out to have been
 * counted three different ways. A quantity a ranking depends on cannot be left to intuition.
 *
 * **One read site = one distinct (file, line) at which the symbol is read.**
 *
 * Not identifier occurrences: `pctOf(T.pooled.fold, T.pooled.n)` is ONE place the code touches
 * the table, and counting it twice rewards verbose destructuring with a higher reach rank. Not
 * distinct files either: that flattens a table read at eight points in one hot module down to
 * the same 1 as a table read once, and reach is meant to express how much stands on it.
 *
 * NON-TEST reads only — a test asserting a table's contents is not reach, it is coverage.
 *
 * The definition line itself is excluded; every other line in the defining file counts like any
 * other reader. `BUCKET_MIDPOINT` is defined and read inside `deviationMap.mjs` and that read is
 * the entire reason its row exists, so a rule that skipped the home file would erase it.
 */
export const reachOf = (row, sites) => {
  const defFile = row.file.split(sep).join('/');
  const live = sites.filter((s) => !s.test);
  const defLine = row.line;
  const seen = new Set();
  const reads = live
    .filter((s) => !(s.file === defFile && Math.abs(s.line - defLine) <= 1))
    .filter((s) => {
      const at = `${s.file}:${s.line}`;
      if (seen.has(at)) return false;
      seen.add(at);
      return true;
    });
  return {
    readSites: reads.length,
    readerFiles: [...new Set(reads.map((s) => s.file))].length,
    outOfHarvestScope: reads.filter((s) => !s.inScope).length,
    testOnly: reads.length === 0 && live.length === 0 && sites.some((s) => s.test),
    // `vestigial` is the value that licenses DELETING a construct, so it is only ever claimed
    // where the trace can support it. For an anonymous switch/ternary the traced name is the
    // enclosing binding, not the construct — zero references there means the expression is
    // consumed inline, which is the opposite of dead. Reporting `null` says the tool does not
    // know, which is a true statement; `true` would be a false one.
    vestigial: /#(switch|ternary)\d+$/.test(row.key || '') ? null : reads.length === 0,
    viaGlob: reads.some((s) => s.viaGlob),
    indirect: /#(switch|ternary)\d+$/.test(row.key || ''),
    sample: reads.slice(0, 8).map((s) => `${s.file}:${s.line}`),
  };
};

// ─── CLI ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i === -1 ? null : argv[i + 1];
};

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === join(dirname(process.argv[1]), 'traceLabelReaders.mjs');

if (isMain || has('--verify') || has('--json') || has('--untriaged') || has('--key')) {
  // The harvest already mints the key (`file::symbol`, plus `#switch1`/`#ternary1` for the
  // anonymous forms). Reconstructing it here dropped that suffix and silently lost all 17
  // control-flow constructs from the output — use the harvest's own key, always.
  const { rows } = harvest();
  const keyed = rows;

  const traced = traceReaders(keyed);
  const reach = new Map(keyed.map((r) => [r.key, reachOf(r, traced.get(r.key) || [])]));

  if (has('--verify')) {
    /**
     * REACH EXCEEDED — the residue MEASUREMENT_OVERSIGHTS MO-1 records as "specified and not
     * yet shipped": *nothing fails when a NEW READER of an already-ledgered table appears.*
     *
     * It does now. Every UNMEASURED row's `readSites` is re-derived here and compared against
     * what the row asserts, which turns reach from a claim into a derived quantity. Wire a
     * table into a fresh module tomorrow and this goes red — that new reader is exactly when
     * a row's rank is most likely to be stale and least likely to be re-read.
     *
     * It checks unmeasured rows only, because reach is what unmeasured rows are RANKED on
     * (`reachScore`, labelLedger.js:610). A measured row is ranked by its Result Card and
     * carries no reach figure to drift.
     */
    const { LABEL_LEDGER } = await import('../../src/utils/standardOfRecord/labelLedger.js');
    const unmeasured = LABEL_LEDGER.filter((e) => e.impact.tier === 'unmeasured');
    if (!unmeasured.length) {
      console.error('❌ No unmeasured rows to verify. A ledger with nothing left to instrument '
        + 'fails its own self-check (ledgerSelfCheck) — this gate agrees with it.');
      process.exit(1);
    }
    let bad = 0;
    for (const row of unmeasured) {
      const k = row.sites[0];
      const got = reach.get(k);
      if (!got) {
        console.error(`❌ ${row.labelId}: ${k} is not in the harvest at all.`);
        bad++;
        continue;
      }
      const want = row.impact.readSites;
      const ok = got.readSites === want;
      if (!ok) bad++;
      console.log(`${ok ? '✅' : '❌'} ${row.labelId}: row says ${want}, traced ${got.readSites}`
        + `${got.viaGlob ? ' (reached via a registry glob — count is a floor)' : ''}`
        + `${ok ? '' : `\n      ${got.sample.join(', ')}`}`);
    }
    if (bad) {
      console.error(`\n❌ ${bad} row(s) disagree with the trace. One of them is wrong and the ROW `
        + 'IS NOT AUTOMATICALLY THE ONE TO TRUST — read both before editing either. A row whose '
        + 'reach grew usually means a new consumer appeared, which is a reason to re-rank it, '
        + 'not a number to paste over.');
      process.exit(1);
    }
    console.log(`\n✅ Reach verified: ${unmeasured.length} unmeasured row(s) match the trace.`);
    process.exit(0);
  }

  const one = valueOf('--key');
  const selected = one
    ? keyed.filter((r) => r.key === one)
    : keyed;

  if (has('--json')) {
    console.log(JSON.stringify(
      Object.fromEntries(selected.map((r) => [r.key, reach.get(r.key)])), null, 2
    ));
  } else {
    const sorted = selected.slice().sort(
      (a, b) => reach.get(b.key).readSites - reach.get(a.key).readSites
    );
    for (const r of sorted) {
      const x = reach.get(r.key);
      const flags = [
        x.vestigial ? 'VESTIGIAL-in-scope' : null,
        x.indirect ? 'indirect' : null,
        x.outOfHarvestScope ? `${x.outOfHarvestScope} outside harvest roots` : null,
      ].filter(Boolean).join(', ');
      console.log(`${String(x.readSites).padStart(3)} reads  ${r.key}`
        + `${flags ? `  (${flags})` : ''}`);
      if (x.sample.length) console.log(`         ${x.sample.join(', ')}`);
    }
  }
}
