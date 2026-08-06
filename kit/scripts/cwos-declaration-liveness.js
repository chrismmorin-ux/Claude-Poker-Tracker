#!/usr/bin/env node
/**
 * cwos-declaration-liveness — publish-time gate asserting that what the kit
 * DECLARES, something actually READS (WS-562).
 *
 * SPR-193 was filed as three bugs and is one class: a declared mechanism with
 * no live consumer, failing open. WS-561 declared closure fields whose write
 * guard tested text presence and no-opped. WS-559 declared `merge_strategy` on
 * 394 manifest rows and reads it 32x on the adopt path, 0x on the upgrade path.
 * WS-558 materialized registry entries for engines never installed. WS-560's
 * queue index omitted the fields its consumers filtered on. In every case the
 * absence of a consumer produced no error — it produced silence, and silence
 * reads identically to success.
 *
 * INV-064 (cwos-manifest-deps-validate.js) closed the mirror-image class: a
 * consumer whose dependency does not ship. This closes the other direction — a
 * declaration nothing consumes — and runs from the same two entry points.
 *
 * TWO KINDS OF DECLARATION, BECAUSE THERE ARE TWO WAYS TO CONSUME ONE
 *
 *   kind: enum        consumers BRANCH on the value — `if (e.k === 'alpha')`.
 *                     Each value must have a reader; a value nothing branches
 *                     on silently falls through to the default. This is
 *                     `merge_strategy`.
 *
 *   kind: membership  consumers test the value against a set computed
 *                     elsewhere — `enabledCapabilities.has(entry.capability)`
 *                     at cwos-adopt-install.js:143. No value literal appears
 *                     at the call site AND NONE SHOULD; adding one would be
 *                     the bug. Here the liveness question is only whether the
 *                     key is read at all, and per-value findings are reported
 *                     rather than failed.
 *
 * Getting this distinction wrong is not a rounding error. The first probe run
 * of the expanded registry produced 33 violations, of which the `capability`,
 * `install_group`, and `category` ones were all this mistake — the gate
 * demanding a branch from code that correctly does not branch. Had they
 * shipped, the gate would have been noisy on arrival and switched off, which
 * is the documented fate of a checker that cries wolf.
 *
 * WHAT IT CHECKS, per declaration in kit/declarations.yaml:
 *
 *   dead-key         (membership) NOTHING in the registered script set mentions
 *                    the key. The field is inert everywhere — the strongest
 *                    form of this bug class.
 *   dead-value       (enum) a value present in the declaring file has zero
 *                    readers anywhere. Nothing branches on it, so rows carrying
 *                    it silently fall through to whatever the default is.
 *   dead-consumer    an OBLIGED consumer reads none of the declaration's
 *                    values. The mechanism is inert on a path that was required
 *                    to honour it — WS-559's exact shape.
 *   obsolete-waiver  a waiver that no longer suppresses anything. This gate's
 *                    own bug class living in its own registry: when WS-559
 *                    landed, two waivers pointing at it went inert while the
 *                    gate still reported "every waiver is current", and they
 *                    had two months of expiry left in which to misdescribe the
 *                    code. Expiry alone does not catch it. Failing rather than
 *                    reporting is deliberate — deleting a stale waiver is a
 *                    ten-second edit, and it is the same forcing function as
 *                    the expiry date, sprung by success instead of by time.
 *   unread-value     (only when `exhaustive: true`) a consumer reads some
 *                    values but not others. For an enum that gates file
 *                    installation this is a real defect: a path that ignores
 *                    `skip-if-exists` overwrites a file the manifest promised
 *                    to preserve. Off by default, because "must every consumer
 *                    handle every value" is a per-declaration judgment.
 *   expired-waiver   a waiver past its `expires` date. Waivers carry a
 *                    mandatory `tracked_by` and `expires` so a declared
 *                    exemption cannot become the very thing this gate exists
 *                    to catch. An expired waiver fails the gate; it does not
 *                    quietly resume suppressing.
 *   absent-consumer  a registered consumer file does not exist on disk.
 *   absent-declarer  `declared_in` does not exist on disk.
 *
 * REPORTED, NEVER FAILING:
 *
 *   uncovered        keys that recur across a declaring file's entries but no
 *                    declaration covers. The registry's own blind spots, made
 *                    visible rather than assumed empty.
 *
 *                    This is the part that keeps the registry honest, and it
 *                    is report-only for a reason: a repo cannot be in
 *                    violation for having a key nobody has decided to govern
 *                    yet. But an unreported blind spot is how the registry
 *                    itself becomes a declared mechanism nobody reads — the
 *                    exact failure it exists to catch. (Shipped one commit
 *                    late: 4271574 documented this section and implemented
 *                    nothing, which is the same bug wearing this gate's own
 *                    clothes.)
 *
 * READERS ARE COMPUTED, OBLIGATIONS ARE DECLARED
 *
 * The registry does NOT list who reads a declaration. Every registered kit
 * script is scanned, and whatever mentions the key is a consumer. Hand-listing
 * was the rot-prone half of this design and it was already wrong once:
 * `category` was declared with a single consumer, reported `dead-key`, while
 * cwos-migrate.js:523 branched on it three files away. A gate whose accuracy
 * depends on the author remembering every reader has the same failure mode as
 * the bug it hunts.
 *
 * What a human still writes is `must_be_read_by` — an OBLIGATION, meaning this
 * path is required to honour the mechanism. That cannot be inferred: "the
 * upgrade path ought to respect merge_strategy" is a design intent, not a fact
 * about the code. It is what caught WS-559, and it is the only curated part.
 *
 * Discovery is a LOWER BOUND. A substring match over-collects on a common key
 * name — `level` appears in 21 scripts meaning adoption level, log level,
 * program level — so it can only make the gate MORE permissive, never produce
 * a false violation. Past WEAK_EVIDENCE_THRESHOLD matches the gate labels its
 * own evidence `weak` rather than presenting incidental hits as proof, and the
 * honest remedy is an explicit `must_be_read_by`.
 *
 * HOW A "READER" IS DETECTED, AND WHY IT IS A PROXIMITY WINDOW
 *
 * A consumer reads value V of key K when a quoted literal 'V' appears within
 * `window` lines (default 8) of a mention of K, comments stripped.
 *
 * Neither cruder option works on real kit sources:
 *
 *   - Whole-file matching says `merge_strategy: skip` is alive, because the
 *     string 'skip' occurs in four unrelated scripts as an action name and a
 *     telemetry verdict. That is a FALSE GREEN, and a false green here is the
 *     disease itself — the gate would certify as consumed a value nothing
 *     branches on.
 *   - Same-line matching says `additive` is dead, because
 *     cwos-adopt-install.js:643 aliases `const strategy = entry.merge_strategy`
 *     and branches on `strategy === 'additive'` two lines later. A gate that
 *     cries wolf gets disabled, which is how INV-064's own docstring puts it.
 *
 * The window is the smallest thing that gets both right. It is a heuristic and
 * is stated as one: every finding carries the evidence lines that produced it,
 * so a human can check the gate's work instead of trusting it.
 *
 * Usage:
 *   node kit/scripts/cwos-declaration-liveness.js            # JSON to stdout
 *   node kit/scripts/cwos-declaration-liveness.js --human
 *   node kit/scripts/cwos-declaration-liveness.js --root <p>
 *
 * Exit codes: 0 = clean | 1 = violation(s) | 2 = invalid arg / registry unreadable.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { cliGate } = require('./lib/cli');
const { readYAMLFile } = require('./lib/cwos-utils');
const { stripComments } = require('./cwos-manifest-deps-validate');

const CLI = {
  name: 'cwos-declaration-liveness',
  summary: 'verify every mechanism kit/declarations.yaml declares has a live consumer',
  flags: {
    human: { type: 'boolean', describe: 'render a readable report instead of JSON' },
    root: { type: 'string', placeholder: 'path', describe: 'HomeBase root (default: walk up from this script)' },
  },
  notes: [
    'Runs at publish time from cwos-hash-manifest.js, so a declaration nothing',
    'reads cannot reach a kit release, and as INV-068 in cwos-verify.js.',
    '',
    'Values AND readers are discovered, never listed: a value added tomorrow is',
    'gated immediately, and a new consumer counts without a registry edit. The',
    'registry declares only judgment — must_be_read_by, meaning this path is',
    'REQUIRED to honour the mechanism.',
    '',
    'Waivers require tracked_by + expires. A waiver fails once it expires, and',
    'also once it stops suppressing anything.',
  ].join('\n'),
};

const DEFAULT_WINDOW = 8;

// Thresholds for the coverage report. A key qualifies as enum-SHAPED — and so
// as something a declaration could plausibly govern — when it recurs across
// entries and takes more than one value. Both bounds matter: `id:` occurs 400
// times with 400 distinct values and governs nothing, while a key appearing
// twice is not yet a pattern. These are deliberately loose; the report is
// advisory, and a blind spot listed and dismissed costs a glance, whereas one
// never listed costs a defect.
const COVERAGE_MIN_OCCURRENCES = 5;
const COVERAGE_MIN_DISTINCT = 2;
const COVERAGE_MAX_DISTINCT_RATIO = 0.5; // distinct/occurrences above this is an id, not an enum

// ─── discovery ──────────────────────────────────────────────────────────────

/**
 * Collect the distinct scalar values a key takes in a YAML file.
 *
 * Text scan rather than parseYAML: the declaring file may nest the key at any
 * depth (kit/MANIFEST.yaml carries it on every row of a sequence), and the
 * question here is only "which literals does this key take", which does not
 * need a document tree. Block scalars and sequence values are ignored — a key
 * whose value is a block is not an enum.
 *
 * The optional `- ` prefix is load-bearing: YAML puts the dash on the FIRST key
 * of a sequence entry, so `- merge_strategy: overwrite` is the same field as
 * an indented `    merge_strategy: overwrite` two rows later. A scanner that
 * only accepts the indented form silently discovers zero values for any key
 * that happens to lead its entry — and reports the declaration as pointing at
 * nothing rather than as unread, which is the wrong alarm entirely.
 *
 * Returns Map<value, lineNumbers[]> so a finding can point at the rows.
 */
function discoverValues(text, key) {
  const esc = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^\\s*(?:-\\s+)?${esc}:\\s*(.+?)\\s*$`);
  const found = new Map();
  text.split('\n').forEach((line, i) => {
    const m = line.match(re);
    if (!m) return;
    let v = m[1];
    // Strip a trailing comment, then surrounding quotes.
    const c = v.match(/\s+#.*$/);
    if (c) v = v.slice(0, c.index).trim();
    v = v.replace(/^["'](.*)["']$/, '$1').trim();
    if (!v || v === '|' || v === '>' || v === '|-' || v === '>-' || v === '[]' || v === '{}') return;
    if (v === 'null' || v === '~') return;
    if (!found.has(v)) found.set(v, []);
    found.get(v).push(i + 1);
  });
  return found;
}

/**
 * Every enum-shaped key in a declaring file, whether or not a declaration
 * covers it — the input to the coverage report.
 *
 * Deliberately shallow: it reads `key: scalar` lines (optionally dash-led) and
 * counts values, exactly as discoverValues does for a known key. It does not
 * try to understand document structure, so a key reused at two nesting levels
 * is counted once. That is a known imprecision in an advisory report, and the
 * alternative — a full parse to disambiguate — would buy accuracy nobody acts
 * on differently.
 *
 * Returns [{ key, occurrences, distinct, sample }] for keys clearing the
 * COVERAGE_* thresholds, most-occurring first.
 */
function discoverEnumShapedKeys(text) {
  const byKey = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:-\s+)?([A-Za-z_][A-Za-z0-9_]*):\s*(.+?)\s*$/);
    if (!m) continue;
    let v = m[2];
    const c = v.match(/\s+#.*$/);
    if (c) v = v.slice(0, c.index).trim();
    v = v.replace(/^["'](.*)["']$/, '$1').trim();
    if (!v || v === '|' || v === '>' || v === '|-' || v === '>-' || v === '[]' || v === '{}') continue;
    if (v === 'null' || v === '~') continue;
    if (!byKey.has(m[1])) byKey.set(m[1], new Map());
    const vals = byKey.get(m[1]);
    vals.set(v, (vals.get(v) || 0) + 1);
  }

  const out = [];
  for (const [key, vals] of byKey) {
    const occurrences = [...vals.values()].reduce((a, b) => a + b, 0);
    const distinct = vals.size;
    if (occurrences < COVERAGE_MIN_OCCURRENCES) continue;
    if (distinct < COVERAGE_MIN_DISTINCT) continue;
    if (distinct / occurrences > COVERAGE_MAX_DISTINCT_RATIO) continue;
    out.push({
      key,
      occurrences,
      distinct,
      sample: [...vals.keys()].slice(0, 6),
    });
  }
  return out.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Line numbers (1-based) where `key` is mentioned in code, comments stripped.
 *
 * Matching is case- and separator-insensitive, because a YAML key and the
 * identifier that reads it are conventionally spelled differently: the manifest
 * says `capability`, `lib/capability-map.js` says `CAPABILITY_ORDER`, and other
 * call sites say `installGroup` for `install_group`. The first probe run of the
 * expanded registry reported `capability-map.js` — which literally defines the
 * five capability values — as reading none of them, purely because the constant
 * is upper-case. A liveness gate that cannot recognize the source of truth for
 * the thing it is checking is worse than no gate.
 *
 * The normalization drops `_`/`-` and lowercases, so `install_group`,
 * `installGroup`, `INSTALL_GROUP`, and `install-group` all match one another.
 */
/**
 * One regex per key, matching every casing and separator convention the same
 * field is spelled with across YAML and JS: `install_group` ≡ `installGroup` ≡
 * `INSTALL_GROUP` ≡ `install-group`.
 *
 * This replaced a normalize-every-line-of-every-file approach, and the win is
 * not only speed. Stripping separators globally before comparing lets unrelated
 * words fuse across a boundary; anchoring the separator between known segments
 * cannot.
 */
function makeKeyMatcher(key) {
  const parts = String(key).split(/[_-]/).filter(Boolean)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(parts.join('[_-]?'), 'i');
}

/**
 * Lazily-computed, memoized per-file analysis.
 *
 * The gate used to call stripComments TWICE per (key, value, consumer) — once
 * inside keyMentionLines and once directly — on files up to 2300 lines. Five
 * declarations cost 236ms, and auto-discovery over 150 registered scripts would
 * have multiplied that by two orders of magnitude. Nothing about the analysis
 * changes between calls, so all of it caches:
 *
 *   raw        read once per path
 *   stripped   comment-blanked lines, computed at most once per path
 *   mentions   line numbers per key, computed at most once per (path, key)
 *
 * The `mentions` path also short-circuits on the RAW text before stripping.
 * Comments can only ADD apparent mentions, never remove one — so a raw miss is
 * a definitive miss, and the expensive character scan is skipped entirely for
 * the ~90% of scripts that never name a given key. That prefilter is what makes
 * scanning every registered script affordable.
 */
function makeSourceCache() {
  const files = new Map();

  function entry(absPath) {
    let e = files.get(absPath);
    if (!e) {
      let raw = '';
      try { raw = fs.readFileSync(absPath, 'utf8'); } catch { raw = ''; }
      e = { raw, stripped: null, mentions: new Map() };
      files.set(absPath, e);
    }
    return e;
  }

  return {
    raw(absPath) { return entry(absPath).raw; },
    stripped(absPath) {
      const e = entry(absPath);
      if (!e.stripped) e.stripped = stripComments(e.raw);
      return e.stripped;
    },
    mentions(absPath, key, keyRe) {
      const e = entry(absPath);
      if (e.mentions.has(key)) return e.mentions.get(key);
      let out;
      if (!keyRe.test(e.raw)) {
        out = []; // definitive: stripping only ever removes matches
      } else {
        out = [];
        this.stripped(absPath).forEach((line, i) => { if (keyRe.test(line)) out.push(i + 1); });
      }
      e.mentions.set(key, out);
      return out;
    },
  };
}

/**
 * Does a file read `value` for `key`? A quoted literal within `window` lines of
 * a mention of the key. Returns the evidence lines, empty when not a reader.
 */
function readerEvidenceCached(cache, absPath, key, keyRe, value, window) {
  const mentions = cache.mentions(absPath, key, keyRe);
  if (!mentions.length) return [];
  const lit = [`'${value}'`, `"${value}"`, '`' + value + '`'];
  const hits = [];
  cache.stripped(absPath).forEach((line, i) => {
    if (!lit.some((l) => line.includes(l))) return;
    const ln = i + 1;
    if (mentions.some((m) => Math.abs(m - ln) <= window)) hits.push(ln);
  });
  return hits;
}

// Text-in, text-out wrappers. Kept because they are the unit-testable shape —
// no filesystem, no cache identity — and the tests exercise the same matching
// logic the cached paths use.
function keyMentionLines(text, key) {
  const keyRe = makeKeyMatcher(key);
  if (!keyRe.test(text)) return [];
  const out = [];
  stripComments(text).forEach((line, i) => { if (keyRe.test(line)) out.push(i + 1); });
  return out;
}

function readerEvidence(text, key, value, window) {
  const mentions = keyMentionLines(text, key);
  if (!mentions.length) return [];
  const lit = [`'${value}'`, `"${value}"`, '`' + value + '`'];
  const hits = [];
  stripComments(text).forEach((line, i) => {
    if (!lit.some((l) => line.includes(l))) return;
    const ln = i + 1;
    if (mentions.some((m) => Math.abs(m - ln) <= window)) hits.push(ln);
  });
  return hits;
}

// ─── consumer discovery ─────────────────────────────────────────────────────

/**
 * Every registered kit script, from kit/MANIFEST.yaml — the candidate reader
 * set for any declaration.
 *
 * Why discovery exists at all: hand-listing consumers is the rot-prone part of
 * this registry, and it is the part that has already been wrong. The first
 * expanded registry declared `category` with one consumer, concluded no
 * consumer mentioned it, and reported a `dead-key` — while cwos-migrate.js:523
 * branches on `entry.category === 'scripts'` three files away. A gate whose
 * accuracy depends on the author remembering every reader has the same failure
 * mode as the bug it hunts.
 *
 * So the reader set is COMPUTED and the registry declares only judgment:
 *
 *   discovered      any registered script that mentions the key. Answers "is
 *                   this read anywhere", which is the question dead-key and
 *                   dead-value actually ask, and answers it without curation.
 *   must_be_read_by an OBLIGATION — this path is required to consume the
 *                   declaration. Cannot be inferred, because "the upgrade path
 *                   ought to honor merge_strategy" is a design intent, not a
 *                   fact about the code. This is what caught WS-559, and it is
 *                   the only part a human maintains.
 */
function registeredScripts(root) {
  const read = readYAMLFile(path.join(root, 'kit', 'MANIFEST.yaml'));
  const entries = read.ok && read.data && Array.isArray(read.data.files) ? read.data.files : [];
  const out = [];
  for (const e of entries) {
    if (!e || !e.source) continue;
    const src = String(e.source).split('\\').join('/');
    if (src.endsWith('.js')) out.push(src);
  }
  return [...new Set(out)];
}

function discoverConsumers(root, cache, key, keyRe, candidates) {
  const out = [];
  for (const rel of candidates) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    if (cache.mentions(abs, key, keyRe).length) out.push(rel);
  }
  return out;
}

/**
 * Discovery is a LOWER BOUND on liveness, and the direction of its error is
 * the whole reason it is safe to use.
 *
 * A substring match on a generic key name over-collects: `level` appears in 30
 * scripts that mean adoption level, log level, or program level, none of them
 * reading a manifest row. That can only make the gate MORE permissive —
 * dead-key fires less often — so discovery never manufactures a false
 * violation. It can only fail to raise a true one.
 *
 * The gate says so out loud rather than presenting 30 incidental matches as if
 * they were evidence. Past this threshold the key name is too common for
 * discovery to mean much, and the honest fix is an explicit `must_be_read_by`
 * naming the paths that actually matter — the judgment a scanner cannot make.
 */
const WEAK_EVIDENCE_THRESHOLD = 8;

function evidenceQuality(discoveredCount, obligatedCount) {
  if (obligatedCount > 0) return 'declared';
  return discoveredCount > WEAK_EVIDENCE_THRESHOLD ? 'weak' : 'discovered';
}

// ─── waivers ────────────────────────────────────────────────────────────────

/**
 * Index a declaration's waivers, and surface the malformed ones as violations
 * rather than dropping them. A waiver missing `expires` that silently did not
 * apply would be confusing; one that silently DID apply forever would be the
 * disease. Neither is acceptable, so both are errors.
 */
function indexWaivers(decl, todayISO) {
  const byScope = { consumer: new Map(), value: new Map() };
  const problems = [];
  for (const w of decl.waivers || []) {
    const where = `${decl.id} waiver ${w && w.scope}/${w && w.target}`;
    if (!w || (w.scope !== 'consumer' && w.scope !== 'value') || !w.target) {
      problems.push({ kind: 'malformed-waiver', declaration: decl.id, detail: `${where} — scope must be consumer|value and target is required` });
      continue;
    }
    if (!w.tracked_by || !w.expires) {
      problems.push({ kind: 'malformed-waiver', declaration: decl.id, target: w.target, detail: `${where} — tracked_by and expires are both mandatory; an undated waiver is the defect this gate exists to catch` });
      continue;
    }
    const expires = String(w.expires).slice(0, 10);
    if (expires < todayISO) {
      problems.push({ kind: 'expired-waiver', declaration: decl.id, target: w.target, scope: w.scope, tracked_by: w.tracked_by, expires, detail: `${where} expired ${expires} — ${w.tracked_by} has not landed; renew the waiver deliberately or fix the declaration` });
      continue;
    }
    byScope[w.scope].set(String(w.target).split('\\').join('/'), w);
  }
  return { byScope, problems };
}

// ─── the check ──────────────────────────────────────────────────────────────

/**
 * Pure check. Returns a plain result object; never exits, never writes.
 * Exported so cwos-verify.js and the test suite can call it directly.
 */
function checkDeclarationLiveness(root, opts = {}) {
  const todayISO = opts.today || new Date().toISOString().slice(0, 10);
  const registryPath = path.join(root, 'kit', 'declarations.yaml');
  if (!fs.existsSync(registryPath)) {
    return { ok: false, exit_code: 2, error: 'kit/declarations.yaml not found', violations: [] };
  }
  const read = readYAMLFile(registryPath);
  if (!read.ok) {
    return { ok: false, exit_code: 2, error: `cannot read kit/declarations.yaml: ${read.error}`, violations: [] };
  }
  const decls = read.data && read.data.declarations;
  if (!Array.isArray(decls)) {
    return { ok: false, exit_code: 2, error: 'kit/declarations.yaml has no declarations array', violations: [] };
  }

  const violations = [];
  const waived = [];
  const report = [];
  // declaring file -> Set of keys some declaration governs, for the coverage
  // report below. Built as we go so it reflects what actually got checked.
  const governed = new Map();
  const cache = makeSourceCache();
  const candidates = registeredScripts(root);

  for (const decl of decls) {
    if (!decl || !decl.id) continue;
    const window = Number(decl.window) > 0 ? Number(decl.window) : DEFAULT_WINDOW;
    const declaredIn = String(decl.declared_in || '').split('\\').join('/');
    const key = String(decl.key || '');
    const keyRe = makeKeyMatcher(key);

    const declAbs = path.join(root, declaredIn);
    if (!declaredIn || !fs.existsSync(declAbs)) {
      violations.push({ kind: 'absent-declarer', declaration: decl.id, declared_in: declaredIn, detail: `${decl.id} declares its source as ${declaredIn || '(unset)'}, which does not exist` });
      continue;
    }

    if (!governed.has(declaredIn)) governed.set(declaredIn, new Set());
    governed.get(declaredIn).add(key);

    const { byScope, problems } = indexWaivers(decl, todayISO);
    violations.push(...problems);

    const values = discoverValues(fs.readFileSync(declAbs, 'utf8'), key);
    if (!values.size) {
      violations.push({ kind: 'absent-declarer', declaration: decl.id, declared_in: declaredIn, key, detail: `${declaredIn} contains no scalar values for key '${key}' — the declaration points at nothing` });
      continue;
    }

    // Obligations are declared; readers are discovered. `consumers:` is the
    // pre-discovery spelling of must_be_read_by and still honored as one.
    const obligated = [...(decl.must_be_read_by || decl.consumers || [])]
      .map((r) => String(r).split('\\').join('/'));

    for (const rel of obligated) {
      if (fs.existsSync(path.join(root, rel))) continue;
      violations.push({ kind: 'absent-consumer', declaration: decl.id, consumer: rel, detail: `${decl.id} obliges ${rel} to consume ${key}, and that file does not exist` });
    }

    const discovered = discoverConsumers(root, cache, key, keyRe, candidates);
    const consumerRels = [...new Set([...obligated, ...discovered])]
      .filter((rel) => fs.existsSync(path.join(root, rel)));
    const consumers = consumerRels.map((rel) => ({ rel, abs: path.join(root, rel) }));

    // value -> [{consumer, lines}]
    const readersByValue = new Map();
    for (const [value] of values) {
      const readers = [];
      for (const c of consumers) {
        const lines = readerEvidenceCached(cache, c.abs, key, keyRe, value, window);
        if (lines.length) readers.push({ consumer: c.rel, lines });
      }
      readersByValue.set(value, readers);
    }

    // ── membership: the only failing question is whether the key is read ────
    // Per-value silence is the CORRECT shape here, so asking for a branch
    // would demand a bug. Values are still reported so the coverage is
    // visible, they simply cannot fail.
    if (decl.kind === 'membership') {
      // Discovery already answered this: a discovered consumer is BY DEFINITION
      // one that mentions the key, so the reader set is the discovered set.
      const keyReaders = consumers
        .map((c) => ({ consumer: c.rel, lines: cache.mentions(c.abs, key, keyRe) }))
        .filter((r) => r.lines.length);

      if (!keyReaders.length) {
        const rec = {
          kind: 'dead-key',
          declaration: decl.id,
          key,
          scanned: candidates.length,
          detail: `nothing in ${candidates.length} registered script(s) mentions ${key} — ${values.size} declared value(s) across ${declaredIn} are inert everywhere`,
        };
        const w = obligated.map((rel) => byScope.consumer.get(rel)).find(Boolean);
        if (w) waived.push({ ...rec, waived_by: w.tracked_by, expires: String(w.expires).slice(0, 10) });
        else violations.push(rec);
      }

      // Only OBLIGATIONS can be dead. A discovered file that happens to mention
      // the key is evidence, not a promise — holding it to one would punish the
      // discovery that makes this registry cheap to maintain.
      for (const rel of obligated) {
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) continue; // already reported as absent-consumer
        if (cache.mentions(abs, key, keyRe).length) continue;
        const rec = {
          kind: 'dead-consumer',
          declaration: decl.id,
          key,
          consumer: rel,
          detail: `${rel} is obliged to consume ${key} and never mentions it — the mechanism is inert on that path`,
        };
        const w = byScope.consumer.get(rel);
        if (w) waived.push({ ...rec, waived_by: w.tracked_by, expires: String(w.expires).slice(0, 10) });
        else if (keyReaders.length) violations.push(rec); // else already reported as dead-key
      }

      report.push({
        declaration: decl.id,
        key,
        kind: 'membership',
        declared_in: declaredIn,
        values_discovered: values.size,
        consumers_checked: consumers.length,
        obligations: obligated.length,
        evidence: evidenceQuality(discovered.length, obligated.length),
        readers: keyReaders.map((r) => ({ value: '(key read)', read_by: [`${r.consumer}:${r.lines.slice(0, 3).join(',')}`] })),
      });
      continue;
    }

    // dead-value: nothing anywhere branches on it.
    for (const [value, readers] of readersByValue) {
      if (readers.length) continue;
      const rec = {
        kind: 'dead-value',
        declaration: decl.id,
        key,
        value,
        declared_at_lines: values.get(value).slice(0, 5),
        occurrences: values.get(value).length,
        detail: `${declaredIn} declares ${key}: ${value} on ${values.get(value).length} row(s), and no registered consumer reads that literal — those rows silently take the default instead`,
      };
      const w = byScope.value.get(value);
      if (w) waived.push({ ...rec, waived_by: w.tracked_by, expires: String(w.expires).slice(0, 10) });
      else violations.push(rec);
    }

    // dead-consumer / unread-value — OBLIGATIONS ONLY.
    // Discovery widens the reader set used for dead-value, but a file that
    // merely mentions the key has promised nothing. Only a declared obligation
    // can fail to keep one.
    for (const rel of obligated) {
      if (!fs.existsSync(path.join(root, rel))) continue; // already absent-consumer
      const readValues = [...readersByValue.entries()]
        .filter(([, rs]) => rs.some((r) => r.consumer === rel))
        .map(([v]) => v);
      const w = byScope.consumer.get(rel);

      if (!readValues.length) {
        const rec = {
          kind: 'dead-consumer',
          declaration: decl.id,
          key,
          consumer: rel,
          detail: `${rel} is obliged to consume ${key} but reads none of its ${values.size} declared values — the mechanism is inert on that path`,
        };
        if (w) waived.push({ ...rec, waived_by: w.tracked_by, expires: String(w.expires).slice(0, 10) });
        else violations.push(rec);
        continue;
      }

      if (decl.exhaustive === true) {
        const missing = [...values.keys()].filter((v) => !readValues.includes(v));
        if (missing.length) {
          const rec = {
            kind: 'unread-value',
            declaration: decl.id,
            key,
            consumer: rel,
            missing,
            reads: readValues,
            detail: `${rel} reads ${readValues.join(', ')} but not ${missing.join(', ')} — an exhaustive declaration means every obliged consumer branches on every value`,
          };
          if (w) waived.push({ ...rec, waived_by: w.tracked_by, expires: String(w.expires).slice(0, 10) });
          else violations.push(rec);
        }
      }
    }

    report.push({
      declaration: decl.id,
      key,
      declared_in: declaredIn,
      values_discovered: values.size,
      consumers_checked: consumers.length,
      obligations: obligated.length,
      evidence: evidenceQuality(discovered.length, obligated.length),
      readers: [...readersByValue.entries()].map(([v, rs]) => ({ value: v, read_by: rs.map((r) => `${r.consumer}:${r.lines.slice(0, 3).join(',')}`) })),
    });
  }

  // Coverage: every enum-shaped key in a governed file that no declaration
  // claims. Report-only — see the COVERAGE_* note above for why this is not a
  // violation, and why leaving it unreported would be worse than either.
  const uncovered = [];
  for (const [declaredIn, keys] of governed) {
    const abs = path.join(root, declaredIn);
    if (!fs.existsSync(abs)) continue;
    for (const k of discoverEnumShapedKeys(fs.readFileSync(abs, 'utf8'))) {
      if (keys.has(k.key)) continue;
      uncovered.push({ declared_in: declaredIn, ...k });
    }
  }

  // ── obsolete waivers ──────────────────────────────────────────────────────
  // A waiver that suppresses nothing is a declaration with no consumer — this
  // gate's own bug class, living in this gate's own registry.
  //
  // Found by living it. WS-559 landed, the upgrade path started reading
  // merge_strategy on all three paths, and the two waivers pointing at it went
  // silently inert: the gate reported "every waiver is current" while carrying
  // two entries that described a defect that no longer existed. Expiry alone
  // does not catch this — those waivers had two months left to quietly misstate
  // the state of the code.
  //
  // It fails rather than reports, because the cost is asymmetric: deleting a
  // stale waiver is a ten-second edit, whereas a registry that describes
  // yesterday's defects is exactly how the WS-559 evidence would have rotted.
  // Fixing a defect breaking the release until its waiver is removed is a
  // feature — it is the same forcing function as the expiry date, sprung by
  // success instead of by time.
  const suppressible = new Set();
  for (const v of [...violations, ...waived]) {
    if (v.consumer) suppressible.add(`${v.declaration}::consumer::${v.consumer}`);
    if (v.value) suppressible.add(`${v.declaration}::value::${v.value}`);
  }
  for (const decl of decls) {
    if (!decl || !decl.id) continue;
    for (const w of decl.waivers || []) {
      if (!w || !w.scope || !w.target || !w.tracked_by || !w.expires) continue; // malformed, already reported
      if (String(w.expires).slice(0, 10) < todayISO) continue;                  // expired, already reported
      const target = String(w.target).split('\\').join('/');
      if (suppressible.has(`${decl.id}::${w.scope}::${target}`)) continue;
      violations.push({
        kind: 'obsolete-waiver',
        declaration: decl.id,
        scope: w.scope,
        target,
        tracked_by: w.tracked_by,
        detail: `${decl.id} waives ${w.scope} ${target} for ${w.tracked_by}, but there is no longer any violation to suppress — delete the waiver; a registry describing a defect that no longer exists is this gate's own failure mode`,
      });
    }
  }

  return {
    ok: violations.length === 0,
    exit_code: violations.length === 0 ? 0 : 1,
    declarations_checked: decls.length,
    scripts_scanned: candidates.length,
    uncovered,
    violations,
    waived,
    report,
  };
}

// ─── rendering ──────────────────────────────────────────────────────────────

function renderHuman(result) {
  const out = [];
  if (result.error) return `declaration-liveness: ERROR — ${result.error}\n`;

  out.push(`declaration-liveness: ${result.declarations_checked} declaration(s) checked.`);

  for (const r of result.report) {
    const ev = r.evidence === 'declared' ? `${r.obligations} obliged`
      : r.evidence === 'weak' ? 'discovered — WEAK, name too common to mean much'
        : 'discovered';
    out.push(`  ${r.declaration} — ${r.key} in ${r.declared_in}: ${r.values_discovered} value(s), ${r.consumers_checked} consumer(s) [${ev}]`);
    if (r.kind === 'membership') {
      // One line, not one per file. A membership declaration with 30 discovered
      // mentions is telling you the key name is common, not showing you 30
      // pieces of evidence.
      const shown = r.readers.slice(0, 3).map((v) => v.read_by[0]).join(' | ');
      out.push(`      key read by ${r.readers.length} file(s)${shown ? ': ' + shown : ''}${r.readers.length > 3 ? ' …' : ''}`);
      if (!r.readers.length) out.push('      NO READER');
      continue;
    }
    for (const v of r.readers) {
      const shown = v.read_by.slice(0, 3).join(' | ');
      out.push(`      ${v.value}: ${v.read_by.length ? shown + (v.read_by.length > 3 ? ` … +${v.read_by.length - 3}` : '') : 'NO READER'}`);
    }
  }

  if (!result.violations.length) {
    out.push('  OK — every declared value has a live consumer, and every waiver is current.');
  } else {
    out.push(`  ${result.violations.length} violation(s):`);
    for (const v of result.violations) out.push(`    [${v.kind}] ${v.detail}`);
  }

  if (result.waived.length) {
    out.push(`  ${result.waived.length} waived — dated, tracked, and still failing:`);
    for (const w of result.waived) {
      out.push(`    [${w.kind}] ${w.consumer || w.value} — ${w.waived_by}, expires ${w.expires}`);
    }
  }

  if (result.uncovered && result.uncovered.length) {
    out.push(`  ${result.uncovered.length} enum-shaped key(s) no declaration governs — coverage gaps, not violations:`);
    for (const u of result.uncovered) {
      out.push(`    ${u.declared_in} :: ${u.key} — ${u.occurrences} row(s), ${u.distinct} value(s): ${u.sample.join(', ')}`);
    }
  }

  return out.join('\n') + '\n';
}

// ─── entry point ────────────────────────────────────────────────────────────

function findRoot(override) {
  if (override) return path.resolve(override);
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'kit', 'declarations.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // WS-549 / ADR-064 P3: fall back to the distribution root, never a hop count.
  return require('./lib/kit-paths').resolveDistRoot();
}

function main() {
  const { values } = cliGate(process.argv.slice(2), CLI);
  const root = findRoot(values.root);
  const result = checkDeclarationLiveness(root);

  if (values.human) process.stdout.write(renderHuman(result));
  else process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  process.exit(result.exit_code);
}

module.exports = { checkDeclarationLiveness, discoverValues, discoverEnumShapedKeys, readerEvidence, renderHuman };

if (require.main === module) main();
