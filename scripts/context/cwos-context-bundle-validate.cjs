#!/usr/bin/env node
/**
 * cwos-context-bundle-validate.cjs — context-bundle structural validator
 *
 * WHAT A BUNDLE IS. A scoped context manifest in `.claude/context/bundles/*.yaml`:
 * a list of files (optionally section-scoped) a task should load, a list of files it
 * should deliberately NOT load, the analytical lenses that may read it, and a byte
 * budget. It is a POINTER, not a copy and not a digest — see docs/context-bundles.md
 * for why that choice, and for the staleness answer this file implements.
 *
 * WARNING, NEVER VIOLATION — following validateFindingProblemClass() in
 * cwos-reconcile.js:759, and for the same recorded reason. Every state this
 * validator detects is a state a healthy repo can legitimately be in for a while:
 *   - a drifted hash means a source file was edited, which is normal work;
 *   - a breached budget means a bundle is growing, which is worth SEEING before
 *     it is worth stopping;
 *   - an unbundled math task means nobody has scoped it YET.
 * Each is a fact about the curation process, and — exactly as with an unclassifiable
 * finding — that fact must be able to persist in the tree without failing reconcile.
 * A validator that blocked here would be optimised into a rubber stamp within a week.
 *
 * WHAT THIS CAN AND CANNOT DO — AMENDED 2026-08-05, BECAUSE THE ORIGINAL WAS FALSE.
 *
 * This header used to say: "It cannot prevent an agent from reading an excluded file.
 * Nothing in this repo can; the tools are not sandboxed per task." BOTH CLAUSES WERE
 * FALSE, and the second was false about a capability this repo had already configured.
 * The sentence is recorded here rather than deleted because it did measurable damage:
 * a third party read this header as a source and inherited the impossibility claim
 * from it, and it is exactly the sentence anyone would have cited as the reason not to
 * build the control.
 *
 * DELIBERATE READS ARE ENFORCEABLE. Verified against the running repo and the official
 * hooks reference:
 *   - `PreToolUse` matchers accept arbitrary pipe-separated tool names, INCLUDING
 *     `Read`, `Grep`, and `Glob`. This machine's own global settings carry
 *     "matcher": "Write|Edit|NotebookEdit|Bash", which is the direct proof.
 *   - Exit code 2 blocks the tool call BEFORE it executes; the content never enters
 *     the context window. This repo already does it twice —
 *     `.claude/hooks/git-guard.cjs:276` is `process.exit(2)` at exactly that line,
 *     and `.claude/hooks/secrets-scan.cjs` likewise.
 *   - Hooks fire INSIDE subagents, carrying `agent_id` / `agent_type`.
 *   - `permissions.deny` supports `Read(<glob>)` and blocks at tool level with ZERO
 *     lines of code. `.claude/settings.json` already carried the field, empty.
 *
 * THE TRUE RESIDUE, WHICH IS THE PART WORTH STATING PRECISELY: harness-injected
 * context cannot be withheld by any of these mechanisms. `CLAUDE.md`,
 * `.claude/rules/*`, and auto-memory are placed in the window before any hook runs —
 * 51,684 bytes of it, measured. So the honest rule is:
 *
 *     DELIBERATE READS ARE ENFORCEABLE. HARNESS INJECTION IS NOT.
 *
 * The original generalised from that one true case to a universal. The barrier lives
 * at `.claude/hooks/context-barrier.cjs`; this validator remains the DECLARATION and
 * the post-hoc audit trail, and the two are not rivals — each closes the other's hole.
 * The barrier cannot reach harness injection or a subagent's summarised read-back; the
 * audit trail cannot stop a read. Both ship.
 *
 * WHY THIS FILE IS NOT IN kit/ ANY MORE (WS-424 / D1, D2). It used to be
 * `kit/scripts/cwos-bundle-validate.js`, where it was an UNMANAGED file inside a
 * managed tree — absent from `kit/hashes-3.8.5.yaml` entirely — while its only caller
 * was a locally-modified managed file that `/kit-upgrade` would have reverted, taking
 * the wiring with it. It also collided by basename with
 * `kit/scripts/lib/cwos-bundle-validate.js` (archetype bundles, a different subject),
 * one directory apart. Renamed and moved repo-local, which resolves both.
 *
 * Usage:
 *   node scripts/context/cwos-context-bundle-validate.cjs            # human-readable
 *   node scripts/context/cwos-context-bundle-validate.cjs --json     # machine-readable
 *   node scripts/context/cwos-context-bundle-validate.cjs --rehash   # rewrite sha256s
 *
 * Exit code is 0 whenever the validator itself ran. Findings are reported, never fatal.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Resolved against kit/, not relative — this file moved out of kit/scripts/ (WS-424 D1)
// but the YAML helpers are still kit-provided. READING a kit lib is safe; it is
// WRITING into kit/ that /kit-upgrade reverts, which is why the caller and this
// script now live outside it.
const { readYAMLFile, findRepoRoot } = require(
  require('path').join(__dirname, '..', '..', 'kit', 'scripts', 'lib', 'cwos-utils')
);

// ── The size ceiling ────────────────────────────────────────────────────────
// 40,000 bytes of resolved content per bundle (~10k tokens).
//
// This is not a round number picked for feel. It is anchored to the artefact the
// bundles exist to replace: .claude/context/POKER_THEORY.md is ~211KB at HEAD, and
// the mandated session-start load across CLAUDE.md + SYSTEM_MODEL + POKER_THEORY +
// VOCABULARY + DISCLAIMER + state.md + queue-index is ~486KB (~121k tokens). A
// 40KB ceiling means:
//   - no single bundle can reach 19% of POKER_THEORY.md alone, so a bundle cannot
//     silently BECOME the monolith it replaced;
//   - a task may compose three bundles and still load a quarter of today's default.
// If a bundle needs more than this, the answer is to SPLIT it — which forces the
// curator to name the second subject, and naming it is the useful act.
const CEILING_BYTES = 40000;

// Closed vocabulary for why a file is withheld. See docs/context-bundles.md §4.
const EXCLUDE_REASONS = new Set([
  'states-the-conclusion',   // already asserts what the lens is asked to derive
  'raises-vocabulary-likelihood', // its terminology would bias the framing reached for
  'budget',                  // dropped for size alone
  'irrelevant',              // out of subject scope
]);

const BUNDLE_MODES = new Set(['discovery', 'verification']);

function sha256Normalized(text) {
  // Normalise CRLF -> LF before hashing. Without this, every bundle on a Windows
  // checkout would report permanent drift against a hash taken on any other line
  // ending, and a check that always fires is a check nobody reads.
  return crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/**
 * Resolve an include to its actual text.
 * `section:` names a markdown heading; the slice runs from that heading to the next
 * heading of the same or higher level. This is what lets a bundle point at part of a
 * large doc rather than all of it — the interface assumed with the heavy/light split
 * being designed in docs/context-architecture.md.
 */
function resolveInclude(repoRoot, inc) {
  const abs = path.join(repoRoot, inc.path);
  if (!fs.existsSync(abs)) return { ok: false, reason: 'missing' };
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch (e) { return { ok: false, reason: 'unreadable' }; }
  if (!inc.section) return { ok: true, text };

  const lines = text.split(/\r?\n/);
  const wanted = String(inc.section).trim().toLowerCase();
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;
    if (m[2].trim().toLowerCase() === wanted) { start = i; level = m[1].length; break; }
  }
  if (start === -1) return { ok: false, reason: 'section-not-found' };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return { ok: true, text: lines.slice(start, end).join('\n') };
}

function loadBundles(repoRoot) {
  const dir = path.join(repoRoot, '.claude', 'context', 'bundles');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  let files;
  try { files = fs.readdirSync(dir); } catch { return []; }
  for (const f of files) {
    if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue;
    if (f.startsWith('_')) continue; // _template.yaml etc
    const r = readYAMLFile(path.join(dir, f));
    if (!r.ok || !r.data || !r.data.id) continue;
    out.push({ file: `.claude/context/bundles/${f}`, data: r.data });
  }
  return out;
}

function validate(repoRoot, opts = {}) {
  const violations = [];
  const bundles = loadBundles(repoRoot);
  const add = (bundleId, type, ref, message) => violations.push({ bundle_id: bundleId, type, ref, message });

  const agentsDir = path.join(repoRoot, '.claude', 'agents');
  const knownLenses = new Set();
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      if (f.endsWith('.md') && !f.endsWith('.kit-update')) knownLenses.add(f.slice(0, -3));
    }
  }

  // Product personas — loaded ONLY so we can detect the conflation, never to resolve
  // a lens against. A bundle naming `chris-live-player` as its lens is asking a
  // product-user persona to audit an estimator; that is the error this check exists
  // to name. See docs/context-bundles.md §3.
  const productPersonas = new Set();
  for (const sub of ['core', 'situational']) {
    const d = path.join(repoRoot, 'docs', 'design', 'personas', sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.md')) productPersonas.add(f.slice(0, -3));
  }

  const rehashPatches = [];

  for (const b of bundles) {
    const d = b.data;
    const id = d.id;

    if (d.mode && !BUNDLE_MODES.has(d.mode)) {
      add(id, 'bad-mode', d.mode, `${b.file} declares mode "${d.mode}"; expected one of ${[...BUNDLE_MODES].join(', ')}.`);
    }

    // ── B2: lenses resolve, and are ANALYTICAL lenses not product personas ──
    const lenses = []
      .concat(d.default_lens ? [d.default_lens] : [])
      .concat(Array.isArray(d.lenses) ? d.lenses : []);
    for (const L of lenses) {
      if (typeof L !== 'string' || !L.trim()) continue;
      const name = L.trim();
      if (knownLenses.has(name)) continue;
      if (productPersonas.has(name)) {
        add(id, 'persona-kind-confusion', name,
          `${b.file} names "${name}" as an analytical lens, but that is a PRODUCT persona `
          + `(docs/design/personas/). Product personas describe who a surface is FOR; analytical `
          + `lenses (.claude/agents/) describe who AUDITS it. These are different kinds and must not `
          + `be substituted for one another.`);
      } else {
        add(id, 'unresolved-lens', name,
          `${b.file} names lens "${name}", which has no .claude/agents/${name}.md. `
          + `Either add the agent definition or correct the name.`);
      }
    }

    // ── B1 / B3 / B4: includes exist, hashes hold, budget holds ──
    let totalBytes = 0;
    const includes = Array.isArray(d.includes) ? d.includes : [];
    if (includes.length === 0) {
      add(id, 'empty-bundle', b.file, `${b.file} declares no includes. A bundle that loads nothing scopes nothing.`);
    }
    for (const inc of includes) {
      if (!inc || typeof inc.path !== 'string') continue;
      const res = resolveInclude(repoRoot, inc);
      if (!res.ok) {
        if (res.reason === 'section-not-found') {
          add(id, 'missing-section', inc.path,
            `${b.file} includes ${inc.path} § "${inc.section}", but no such heading exists in the file. `
            + `A section pointer that resolves to nothing silently shrinks the bundle to less than it claims.`);
        } else {
          add(id, 'missing-include', inc.path,
            `${b.file} includes ${inc.path}, which does not exist (${res.reason}). `
            + `The bundle promises context it cannot deliver.`);
        }
        continue;
      }
      totalBytes += Buffer.byteLength(res.text, 'utf8');

      const actual = sha256Normalized(res.text);
      if (opts.rehash) {
        rehashPatches.push({ file: b.file, path: inc.path, section: inc.section || null, sha256: actual });
      } else if (typeof inc.sha256 === 'string' && inc.sha256.trim() && inc.sha256.trim() !== actual) {
        add(id, 'content-drift', inc.path,
          `${b.file} pins ${inc.path}${inc.section ? ` § "${inc.section}"` : ''} at sha256 `
          + `${inc.sha256.trim().slice(0, 12)}…, but it now hashes to ${actual.slice(0, 12)}…. `
          + `The pointer is still correct — the REVIEW is stale. Re-read the changed source, confirm the `
          + `bundle still scopes what it claims, then: node scripts/context/cwos-context-bundle-validate.cjs --rehash`);
      } else if (!inc.sha256) {
        add(id, 'unpinned-include', inc.path,
          `${b.file} includes ${inc.path} with no sha256. An unpinned include cannot report drift, `
          + `so the bundle's review status is unknowable. Run --rehash to pin it.`);
      }
    }

    const budget = Number(d.budget_bytes) || CEILING_BYTES;
    if (budget > CEILING_BYTES) {
      add(id, 'ceiling-breach', String(budget),
        `${b.file} declares budget_bytes=${budget}, above the ${CEILING_BYTES}-byte ceiling. `
        + `The ceiling is what stops a bundle becoming the monolith it replaced — raising it is a `
        + `decision to be argued in docs/context-bundles.md §5, not a field to be edited.`);
    }
    if (totalBytes > budget) {
      add(id, 'budget-breach', `${totalBytes}/${budget}`,
        `${b.file} resolves to ${totalBytes} bytes against its own budget of ${budget}. `
        + `Split the bundle — the act of naming the second subject is the useful part — or drop an include.`);
    }

    // ── B5: the withholding rule ──
    const excludes = Array.isArray(d.excludes) ? d.excludes : [];
    for (const ex of excludes) {
      if (!ex || typeof ex.reason !== 'string' || !EXCLUDE_REASONS.has(ex.reason.trim())) {
        add(id, 'bad-exclude-reason', (ex && ex.path) || '?',
          `${b.file} excludes ${(ex && ex.path) || '?'} with reason `
          + `"${(ex && ex.reason) || '(none)'}", which is not in the closed vocabulary: `
          + `${[...EXCLUDE_REASONS].join(', ')}. An uncategorised exclusion cannot be audited.`);
      }
    }
    if (d.mode === 'discovery') {
      const withheld = excludes.some((ex) => ex && String(ex.reason).trim() === 'states-the-conclusion');
      if (!withheld) {
        add(id, 'no-withholding', b.file,
          `${b.file} is a DISCOVERY bundle but withholds nothing that states a conclusion. `
          + `A discovery lens that loads the recorded answer reconstructs it instead of deriving it — `
          + `the inherited-convergence failure. Either declare what is withheld and why, or set `
          + `mode: verification, where loading the prior conclusion is correct.`);
      }
    }
  }

  // ── B6: a task classified as math/measurement that scopes no bundle ──
  const dupIds = new Map();
  for (const b of bundles) {
    if (dupIds.has(b.data.id)) {
      add(b.data.id, 'duplicate-bundle-id', b.file,
        `${b.file} and ${dupIds.get(b.data.id)} both declare id "${b.data.id}".`);
    } else dupIds.set(b.data.id, b.file);
  }

  const classToBundle = new Map();
  for (const b of bundles) {
    const at = b.data.applies_to;
    const pcs = at && Array.isArray(at.problem_classes) ? at.problem_classes : [];
    for (const pc of pcs) {
      if (typeof pc === 'string' && pc.trim()) classToBundle.set(pc.trim().toLowerCase(), b.data.id);
    }
  }
  if (classToBundle.size > 0) {
    const qDir = path.join(repoRoot, '.claude', 'workstream', 'queue');
    if (fs.existsSync(qDir)) {
      for (const f of fs.readdirSync(qDir)) {
        if (!/^WS-.+\.ya?ml$/.test(f)) continue;
        const r = readYAMLFile(path.join(qDir, f));
        if (!r.ok || !r.data) continue;
        const item = r.data;
        // Only OPEN work can still be scoped. Re-litigating closed items would
        // produce a warning list that only grows and can never be worked down.
        if (['done', 'completed', 'deferred', 'dismissed', 'decomposed'].includes(String(item.status))) continue;
        const pc = typeof item.problem_class === 'string' ? item.problem_class.trim().toLowerCase() : '';
        if (!pc || !classToBundle.has(pc)) continue;
        if (item.context_bundle) continue;
        add(classToBundle.get(pc), 'unbundled-task', item.id || f,
          `${item.id || f} carries problem_class "${item.problem_class}", which bundle `
          + `"${classToBundle.get(pc)}" claims, but the item declares no context_bundle. `
          + `The task will load whatever the session happens to load — which is the unreproducibility `
          + `this mechanism exists to remove. Add: context_bundle: "${classToBundle.get(pc)}"`);
      }
    }
  }

  // ── B9 (S7): a discovery finding must not cite a WITHHELD file as its source ──
  //
  // THIS IS NOT MADE REDUNDANT BY THE BARRIER, AND THE TICKET IS EXPLICIT THAT IT MUST
  // NOT BE TREATED AS THOUGH IT WERE. `.claude/hooks/context-barrier.cjs` stops a
  // deliberate read. It cannot reach the two holes this covers:
  //
  //   1. HARNESS INJECTION. CLAUDE.md, .claude/rules/*, and auto-memory are in the
  //      window before any hook runs. No barrier can withhold them. Measured: 51,684 B.
  //   2. SUBAGENT LAUNDERING. A delegated agent reads a withheld file and returns a
  //      SUMMARY. The content arrives as prose, having never been a Read call here.
  //
  // Each mechanism closes the other's hole, which is why both ship. Neither arm of the
  // comparison noticed that.
  //
  // WARN, not fail (S9 clause 3): this cannot distinguish a genuine violation from
  // INDEPENDENT RE-DERIVATION of something the withheld file also happens to contain —
  // and re-derivation is a GOOD outcome that should be marked replicated. Blocking here
  // would punish the replication case, which is the one the design most wants.
  const bundleById = new Map(bundles.map(b => [b.data.id, b.data]));
  const findDir = path.join(repoRoot, '.claude', 'workstream', 'findings');
  if (fs.existsSync(findDir)) {
    for (const f of fs.readdirSync(findDir)) {
      if (!/\.ya?ml$/.test(f)) continue;
      const r = readYAMLFile(path.join(findDir, f));
      if (!r.ok || !r.data) continue;
      const finding = r.data;
      const bId = finding.context_bundle;
      if (!bId) continue;                       // unbundled findings: nothing declared to check
      const bundle = bundleById.get(bId);
      if (!bundle) {
        add(bId, 'unknown-bundle-ref', finding.id || f,
          `${finding.id || f} declares context_bundle "${bId}", which no bundle defines.`);
        continue;
      }
      if (String(bundle.mode) !== 'discovery') continue;   // verification MAY cite anything

      const withheld = Array.isArray(bundle.excludes) ? bundle.excludes : [];
      // Everything the finding offers as provenance.
      const cited = []
        .concat(finding.evidence || [], finding.sources || [], finding.files || [],
          finding.file_refs || [], finding.citations || [])
        .map(x => (typeof x === 'string' ? x : (x && (x.path || x.file || x.source)) || ''))
        .filter(Boolean);
      if (cited.length === 0) continue;

      for (const ex of withheld) {
        const exPath = typeof ex === 'string' ? ex : (ex && ex.path);
        if (!exPath || String(exPath).startsWith('USER_MEMORY/')) continue;
        const norm = String(exPath).replace(/\\/g, '/').toLowerCase();
        const leaf = norm.split('/').pop();
        const guilty = cited.find(c => {
          const cn = String(c).replace(/\\/g, '/').toLowerCase();
          return cn.includes(norm) || (leaf && leaf.length > 8 && cn.includes(leaf));
        });
        if (guilty) {
          add(bId, 'withheld-source-cited', finding.id || f,
            `${finding.id || f} was produced under DISCOVERY bundle "${bId}", which withholds `
            + `"${exPath}" — and it cites "${guilty}" as a source. Either the withholding was `
            + `bypassed, or the content arrived by a route the barrier cannot see (harness `
            + `injection, or a subagent returning a summary). If the finding was genuinely `
            + `RE-DERIVED, that is replication and a good outcome: mark it replicated rather `
            + `than citing the withheld file as the source it came from.`);
        }
      }
    }
  }

  // ── B7: bundle vocabulary is grounded in the Standard of Record ──
  const vocabPath = path.join(repoRoot, 'docs', 'standard-of-record', 'VOCABULARY.md');
  if (fs.existsSync(vocabPath)) {
    let vocabText = '';
    try { vocabText = fs.readFileSync(vocabPath, 'utf8').toLowerCase(); } catch {}
    for (const b of bundles) {
      const terms = Array.isArray(b.data.vocabulary) ? b.data.vocabulary : [];
      for (const t of terms) {
        if (typeof t !== 'string' || !t.trim()) continue;
        if (vocabText.includes(t.trim().toLowerCase())) continue;
        add(b.data.id, 'vocabulary-drift', t.trim(),
          `${b.file} declares vocabulary term "${t.trim()}", which appears nowhere in `
          + `docs/standard-of-record/VOCABULARY.md. Per ADR-009 the terms already exist — either use `
          + `the established one, or add it to VOCABULARY.md deliberately.`);
      }
    }
  }

  return { violations, bundles: bundles.length, ceiling_bytes: CEILING_BYTES, rehashPatches };
}

// ── --rehash: rewrite recorded sha256 values in place ──────────────────────
function applyRehash(repoRoot, patches) {
  const byFile = new Map();
  for (const p of patches) {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  }
  let changed = 0;
  for (const [rel, ps] of byFile) {
    const abs = path.join(repoRoot, rel);
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (const p of ps) {
      // Find the `- path: <p.path>` line, then the sha256 line within its block.
      for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(/^(\s*)-\s+path:\s*["']?(.+?)["']?\s*$/);
        if (!m || m[2] !== p.path) continue;
        let wrote = false;
        for (let j = i + 1; j < lines.length && !/^\s*-\s+path:/.test(lines[j]); j += 1) {
          if (/^\s*sha256:/.test(lines[j])) {
            const indent = lines[j].match(/^(\s*)/)[1];
            if (lines[j] !== `${indent}sha256: "${p.sha256}"`) changed += 1;
            lines[j] = `${indent}sha256: "${p.sha256}"`;
            wrote = true;
            break;
          }
          if (lines[j].trim() === '') break;
        }
        if (!wrote) {
          const indent = m[1] + '  ';
          lines.splice(i + 1, 0, `${indent}sha256: "${p.sha256}"`);
          changed += 1;
        }
        break;
      }
    }
    fs.writeFileSync(abs, lines.join('\n'), 'utf8');
  }
  return changed;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const rehash = args.includes('--rehash');
  const repoRoot = findRepoRoot(process.cwd()) || process.cwd();

  const report = validate(repoRoot, { rehash });

  if (rehash) {
    const n = applyRehash(repoRoot, report.rehashPatches);
    if (!asJson) console.log(`cwos-bundle-validate --rehash: ${n} hash(es) updated across ${report.bundles} bundle(s).`);
    process.exit(0);
  }

  if (asJson) {
    process.stdout.write(JSON.stringify({ violations: report.violations, bundles: report.bundles }));
    process.exit(0);
  }

  console.log(`cwos-bundle-validate: ${report.bundles} bundle(s), ceiling ${report.ceiling_bytes} bytes`);
  if (report.violations.length === 0) {
    console.log('  no findings');
  } else {
    console.log(`  Findings (${report.violations.length}) — all advisory, none block:`);
    for (const v of report.violations) console.log(`    - [${v.type}] ${v.message}`);
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = { validate, CEILING_BYTES, sha256Normalized, resolveInclude };
