#!/usr/bin/env node
/**
 * cwos-verify — Executable invariant checks.
 *
 * Implements the 11 scriptable invariants from system/invariants.md as
 * deterministic checks. Replaces "verified by manual inspection" with
 * "verified by code." Wired into vital signs via cwos-state.js.
 *
 * Usage:
 *   node cwos-verify.js                    # all checks, summary
 *   node cwos-verify.js --only INV-014     # single check
 *   node cwos-verify.js --quiet            # silent unless failure
 *   node cwos-verify.js --strict           # exit 1 on any failure
 *   node cwos-verify.js --fix              # update Last Verified dates for passing checks
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { globFiles, readYAMLFile, findWorkstreamDir, todayISO, findRepoRoot, makeEventEmitter } = require('./lib/cwos-utils');

const emitEvent = makeEventEmitter();

// ─── Repo Root Discovery ────────────────────────────────────────────────────

function resolveRepoRoot() {
  const dir = findRepoRoot(process.cwd(), { markers: ['CLAUDE.md', 'kit'], requireAll: true, maxDepth: 8 });
  if (!fs.existsSync(path.join(dir, 'CLAUDE.md')) || !fs.existsSync(path.join(dir, 'kit'))) {
    throw new Error('Could not find repo root (CLAUDE.md + kit/ not found in any ancestor)');
  }
  return dir;
}

// ─── Recursive grep ─────────────────────────────────────────────────────────

function grepRecursive(rootDir, dirs, pattern, fileFilter) {
  const matches = [];
  const regex = new RegExp(pattern);
  for (const d of dirs) {
    const fullDir = path.join(rootDir, d);
    if (!fs.existsSync(fullDir)) continue;
    walkDir(fullDir, (filePath) => {
      if (fileFilter && !fileFilter(filePath)) return;
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (regex.test(line)) {
            matches.push({ file: path.relative(rootDir, filePath), line: i + 1, text: line.trim() });
          }
        });
      } catch { /* skip unreadable */ }
    });
  }
  return matches;
}

function walkDir(dir, callback) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full, callback);
      else if (entry.isFile()) callback(full);
    }
  } catch { /* skip */ }
}

// ─── Invariant Checks ───────────────────────────────────────────────────────

const INVARIANT_CHECKS = [
  { id: 'INV-001', name: 'Personas Live in personas/ Only', check: checkNoKitAgentsDir },
  { id: 'INV-002', name: 'Engine INDEX Covers All Engines', check: checkEngineIndex },
  { id: 'INV-004', name: 'No Persona Simulation', check: checkNoPersonaSimulation },
  { id: 'INV-006', name: 'Queue Index Matches Queue Files', check: checkQueueIndexParity },
  { id: 'INV-008', name: 'Fleet Registry Paths Are Valid', check: checkFleetPaths },
  { id: 'INV-009', name: 'ADR Index Matches ADR Files', check: checkAdrIndex },
  { id: 'INV-010', name: 'User Guide Covers All Commands', check: checkUserGuideCoverage },
  { id: 'INV-011', name: 'System State Updated After Each Phase', check: checkStateFreshness },
  { id: 'INV-013', name: 'Convergence Engine in HomeBase-Only Set', check: checkConvergenceEngine },
  { id: 'INV-014', name: 'No Phantom Engines in Registry', check: checkRegistrySkillPaths },
  { id: 'INV-016', name: 'Optimization Backlog Reviewed After Fleet Feedback', check: checkOptimizationBacklog },
  { id: 'INV-018', name: 'Command Hardlinks Match Across kit/fleet/sim → .claude/commands', check: checkHardlinkPreservation },
  { id: 'INV-024', name: 'Distribution Referential Integrity (MANIFEST ↔ INDEX ↔ registry ↔ commands)', check: checkDistributionRefs },
  { id: 'INV-025', name: 'schema_version Type Consistency', check: checkSchemaVersionConsistency },
  { id: 'INV-026', name: 'Hook Liveness (Stop / SessionStart stamps recent)', check: checkHookLiveness },
  { id: 'INV-027', name: 'Command File Size Budget', check: checkCommandFileSizeBudget },
  { id: 'INV-028', name: 'Shadow-event instrumentation coverage (ADR-018 step 1)', check: checkShadowInstrumentationCoverage },
  { id: 'INV-029', name: 'Rollback runbook inventory matches tracked files', check: checkRunbookDrift },
  { id: 'INV-030', name: 'Snapshot-diff: events cover every mutation (WS-186)', check: checkSnapshotDiffSmoke },
  { id: 'INV-031', name: 'Replay-purity: state/*.json equals cwos-replay from events (ADR-020)', check: checkReplayPurity },
  { id: 'INV-032', name: 'Typed-API coverage: commands read state via stateStore (WS-199)', check: checkTypedApiCoverage },
  { id: 'INV-033', name: 'First-session commands are free of schema-jargon placeholders (WS-150)', check: checkFounderSurfacePlaceholders },
  { id: 'INV-034', name: 'Program contracts are customized (no [CUSTOMIZE: placeholders) (WS-152)', check: checkUncustomizedContracts },
  { id: 'INV-035', name: 'Library engine MANIFEST extends: values resolve (FIND-070 / WS-141)', check: checkManifestExtendsResolves },
  { id: 'INV-039', name: 'Fleet kit_version drift bound (FAIL-012 / WS-225)', check: checkFleetVersionDrift },
  { id: 'INV-040', name: 'Critical-tier program templates instantiated in HomeBase registry (FAIL-015 / WS-226)', check: checkTemplateProgramInstantiation },
  { id: 'INV-038', name: 'Approved sprints record anti_goal_check for constitutional accountability (FAIL-010 / WS-227)', check: checkAntiGoalCrossCheck },
  { id: 'INV-037', name: 'Sprint anchor distribution bound — internal-infra ≤ 70% in 90-day window (FAIL-009 / WS-230)', check: checkAnchorDistribution },
  { id: 'INV-036', name: 'Hook-race protection holds — concurrent stampHookLiveness preserves both fields (FAIL-007 / WS-228)', check: checkHookRaceProtection },
  { id: 'INV-readpath-determinism', name: 'AI not invoked for pure read-path work — parse-and-compare phases ship as scripts (ADVISORY) (WS-391)', check: checkReadPathDeterminism },
  { id: 'INV-041', name: 'Every product program ships a capability_brief (FAIL-016 / WS-166)', check: checkCapabilityBriefSchema },
  { id: 'INV-042', name: 'Output Shape coverage — common-traffic commands declare response shape (FIND-082 / WS-158)', check: checkOutputShapeCoverage },
  { id: 'INV-043', name: 'CLI-bypass-via-command — audited commands actually invoked (FIND-119 / WS-276)', check: checkCliBypassViaCommand },
  { id: 'INV-044', name: 'Replay-pure fields: every cached field is deterministic across replays (WS-261 / AS-037-11)', check: checkReplayPureFields },
  { id: 'INV-cli-envelope-consumed-completely', name: 'AI obeys Prohibited Reads — Read tool count per /next ≤ 5 (WS-271 / AS-037-1)', check: checkReadRestraint },
  { id: 'INV-045', name: 'Shell-safe pattern — no execSync template-literal interpolation in kit/scripts/ (ADR-043 / WS-306)', check: checkShellSafePattern },
  { id: 'INV-046', name: 'Persona-dispatch runtime audit — most-recent manifest per tracked engine has no FAIL (WS-316 / ADR-044)', check: checkPersonaDispatch },
  { id: 'INV-047', name: 'Program YAML schema — no duplicate top-level keys in prog-*.yaml (FIND-128 / WS-295)', check: checkProgramYamlSchema },
  { id: 'INV-048', name: 'Engine Intent Contract block matches frontmatter (name + default_mode) (WS-327)', check: checkEngineContractConsistency },
  { id: 'INV-049', name: 'HomeBase-only engines flagged in MANIFEST — every engines/homebase-only/* entry has homebase_only: true (WS-315 / ADR-049)', check: checkHomebaseOnlyManifestFlag },
  { id: 'INV-053', name: 'Adopter-value relation declared on kit-quality findings (WS-436 / FIND-312)', check: checkAdopterValueRelation },
  { id: 'INV-055', name: 'Adopter-controlled config values pass through boundedPath helpers (WS-430 / FIND-300 + FIND-261)', check: checkBoundedPathContainment },
  { id: 'INV-056', name: 'Every kit/commands/*.md has a MANIFEST entry (reverse INV-024) (WS-420 / FIND-279)', check: checkCommandManifestCoverage },
  { id: 'INV-057', name: 'cwos-adopt-install.js uses writeFileAtomic exclusively (WS-426 / FIND-291 + FIND-292)', check: checkAdoptInstallAtomicWrites },
  { id: 'INV-059', name: 'No shipped kit file hardcodes docs/evolution/ — calibration paths must resolve per repo scope (WS-421 / FIND-281)', check: checkNoHardcodedEvolutionPaths },
  { id: 'INV-program-fields-have-runtime-effect', name: 'prog-template accountability fields have runtime readers (WS-366 / FIND-248)', check: checkProgramFieldsHaveRuntimeEffect },
];

function checkNoKitAgentsDir(rootDir) {
  const exists = fs.existsSync(path.join(rootDir, 'kit', 'agents'));
  return {
    passed: !exists,
    detail: exists ? 'kit/agents/ directory exists — must not exist (personas live in personas/)' : 'kit/agents/ does not exist',
  };
}

// ─── Engine Intent Contract Consistency (INV-048 / WS-327) ─────────────────
//
// Each engine MD has frontmatter declaring `name:` and `default_mode:`, and an
// `## Intent Contract (ADR-038)` block that re-states both values for human
// readability. The two must agree — when they drift, cwos-frame.js loads one
// mode while the engine's documented contract claims another.
//
// Reference template: kit/templates/engines/contract-honoring.snippet.

function _parseEngineFrontmatter(content) {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return null;
  const fm = content.slice(3, end).split('\n');
  const out = {};
  for (const line of fm) {
    const m = line.match(/^([a-z_-]+):\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2].replace(/^["']|["']$/g, '');
    out[m[1]] = v;
  }
  return out;
}

function _parseContractBlock(content) {
  const idx = content.indexOf('## Intent Contract');
  if (idx < 0) return null;
  // Block runs until the next `---` separator or the next `## ` heading.
  const tail = content.slice(idx);
  const stop = tail.search(/\n(---|##\s)/);
  const block = stop < 0 ? tail : tail.slice(0, stop);
  // Engine name in the match-on line: `engine: <name>` (backticked).
  const nameMatch = block.match(/engine:\s*([a-z][a-z0-9_-]*)/i);
  // Default mode in the mode bullet: `default_mode: <mode>` (backticked).
  const modeMatch = block.match(/default_mode:\s*([a-z][a-z0-9_-]*)/i);
  return {
    engineName: nameMatch ? nameMatch[1] : null,
    defaultMode: modeMatch ? modeMatch[1] : null,
  };
}

function checkEngineContractConsistency(rootDir) {
  const files = [];
  const stdDir = path.join(rootDir, 'engines/standard');
  if (fs.existsSync(stdDir)) {
    for (const f of globFiles(stdDir, '*.md')) files.push(f);
  }
  const libDir = path.join(rootDir, 'engines/library');
  if (fs.existsSync(libDir)) {
    for (const e of fs.readdirSync(libDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const skill = path.join(libDir, e.name, 'SKILL.md');
      if (fs.existsSync(skill)) files.push(skill);
    }
  }

  const mismatches = [];
  let checked = 0;
  for (const f of files) {
    let content;
    try { content = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const fm = _parseEngineFrontmatter(content);
    const block = _parseContractBlock(content);
    if (!fm || !block) continue; // engine without contract block is skipped (warned by INV-002 / WS-313)
    checked++;
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    if (fm.name && block.engineName && fm.name !== block.engineName) {
      mismatches.push(`${rel}: name fm=${fm.name} block=${block.engineName}`);
    }
    if (fm.default_mode && block.defaultMode && fm.default_mode !== block.defaultMode) {
      mismatches.push(`${rel}: default_mode fm=${fm.default_mode} block=${block.defaultMode}`);
    }
  }

  return {
    passed: mismatches.length === 0,
    detail: mismatches.length === 0
      ? `${checked} engines: frontmatter ↔ Intent Contract block consistent (name + default_mode)`
      : `${mismatches.length} mismatches across ${checked} engines:\n  ` + mismatches.join('\n  '),
  };
}

// ─── HomeBase-only Manifest Flag (INV-049 / WS-315 / ADR-049) ──────────────
//
// Engines under `engines/homebase-only/` are HomeBase-internal — they audit
// the kit, evolve the product, or analyze the fleet. They MUST never ship to
// adopted repos via /fleet-update. The propagation guard is a single
// `homebase_only: true` flag on the MANIFEST entry, which fleet-update.md
// step 3 filters on. This check verifies the flag is actually present on
// every homebase-only entry, and absent from standard/library entries.
// Without this invariant, adding a new homebase-only engine and forgetting
// the flag silently propagates HomeBase-internal apparatus to every adopted
// repo on the next /fleet-update.

function checkHomebaseOnlyManifestFlag(rootDir) {
  const manifestPath = path.join(rootDir, 'kit', 'MANIFEST.yaml');
  if (!fs.existsSync(manifestPath)) {
    return { passed: false, detail: 'kit/MANIFEST.yaml not found' };
  }
  const { ok, data } = readYAMLFile(manifestPath);
  if (!ok || !data || !Array.isArray(data.files)) {
    return { passed: false, detail: 'kit/MANIFEST.yaml unparseable or missing files: array' };
  }

  const violations = [];
  let homebaseOnlyCount = 0;
  let distributableCount = 0;
  for (const entry of data.files) {
    const src = entry && entry.source ? String(entry.source) : '';
    if (!src.startsWith('engines/')) continue;
    const flag = entry.homebase_only === true;
    if (src.startsWith('engines/homebase-only/')) {
      homebaseOnlyCount++;
      if (!flag) violations.push(`${src}: missing homebase_only: true`);
    } else if (src.startsWith('engines/standard/') || src.startsWith('engines/library/')) {
      distributableCount++;
      if (flag) violations.push(`${src}: has homebase_only: true but lives outside engines/homebase-only/`);
    }
  }

  // Cross-check: every *.md file under engines/homebase-only/ that COULD be
  // a propagation source (i.e. matches the patterns MANIFEST registers) must
  // have a MANIFEST entry. A dangling file is not directly a propagation
  // leak, but it signals MANIFEST drift — and a future fleet-update path
  // that walks the filesystem instead of the MANIFEST would leak it.
  const homebaseDir = path.join(rootDir, 'engines', 'homebase-only');
  const registeredSources = new Set();
  for (const entry of data.files) {
    if (entry && entry.source) registeredSources.add(String(entry.source));
  }
  if (fs.existsSync(homebaseDir)) {
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) { walk(full); continue; }
        if (!ent.isFile() || !ent.name.endsWith('.md')) continue;
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        // Only top-level *.md files and pack SKILL.md files are MANIFEST-registered;
        // other files inside packs (helpers, READMEs) are not propagation sources.
        const inPackButNotSkill = /engines\/homebase-only\/[^/]+\/.+/.test(rel) && !/\/SKILL\.md$/.test(rel);
        if (inPackButNotSkill) continue;
        if (!registeredSources.has(rel)) {
          violations.push(`${rel}: file exists under engines/homebase-only/ but no MANIFEST entry`);
        }
      }
    };
    walk(homebaseDir);
  }

  // WS-383: runtime bundle check. Beyond the static MANIFEST referential
  // integrity above, if a resolved archetype bundle artifact is present in this
  // repo (the archetype_bundle_resolved block in .cwos-onboarding.yaml, written
  // by /adopt), validate it against the schema + INV-049 using the same shared
  // validator the installer uses. On HomeBase (no onboarding file) this is a
  // no-op. In an adopted repo it catches a bundle that somehow installed a
  // homebase-only engine reference.
  const onboardingPath = path.join(rootDir, '.cwos-onboarding.yaml');
  if (fs.existsSync(onboardingPath)) {
    const ob = readYAMLFile(onboardingPath);
    const resolved = ob.ok && ob.data ? ob.data.archetype_bundle_resolved : null;
    if (resolved && typeof resolved === 'object') {
      const { validateArchetypeBundle, loadHomebaseOnlyEngines } = require('./lib/cwos-bundle-validate');
      const homebaseOnlyEngines = loadHomebaseOnlyEngines(rootDir);
      const { ok: bok, errors } = validateArchetypeBundle(resolved, { homebaseOnlyEngines });
      if (!bok) {
        for (const e of errors) violations.push(`.cwos-onboarding.yaml archetype_bundle_resolved: ${e}`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `${homebaseOnlyCount} homebase-only entries flagged correctly; ${distributableCount} distributable engine entries free of homebase_only flag`
      : `${violations.length} violation(s):\n  ` + violations.join('\n  '),
  };
}

// ─── No Hardcoded docs/evolution/ in Shipped Kit (INV-059 / WS-421 / FIND-281) ─
//
// docs/evolution/ is the HomeBase-only Product Evolution apparatus — it never
// propagates to adopted repos. Any shipped file (standard/library engines, core
// personas, or commands) that hardcodes a docs/evolution/ write target silently
// no-ops in an adopted repo, so calibration loops (findings-feedback.yaml,
// change-impacts.yaml, AC-11) produce zero data downstream. Shipped writers must
// instead resolve the calibration dir per repo scope (resolveEvolutionDir in
// cwos-utils.js). This scanner asserts no docs/evolution/ literal survives in the
// distributable surface.
//
// Allowlist (explicit, tracked — not silent suppression):
//  - kit/commands/evolve.md — /evolve IS the Product Evolution command, flagged
//    homebase_only: true in MANIFEST (never ships). It legitimately operates on
//    the evolution dir (constitutions, change-impacts), like a homebase-only engine.
//  - engines/library/corrective-plan/SKILL.md — references a HomeBase measurement
//    scorecard (corrective-scorecards/), a different subsystem from the calibration
//    write-loops this invariant targets. Tracked separately by FIND-282; its
//    measurement-record section is governed by ADR-050's labeled exception (sunset
//    2026-06-13, WS-408). Deferred here to avoid colliding with that in-flight work.
const EVOLUTION_PATH_ALLOWLIST = new Set([
  'kit/commands/evolve.md',
  'engines/library/corrective-plan/SKILL.md',
]);

function checkNoHardcodedEvolutionPaths(rootDir) {
  const scopeDirs = [
    'engines/standard',
    'engines/library',
    'personas/core',
    'kit/commands',
  ];
  const violations = [];
  let scanned = 0;

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!ent.isFile() || !ent.name.endsWith('.md')) continue;
      const rel = path.relative(rootDir, full).replace(/\\/g, '/');
      if (EVOLUTION_PATH_ALLOWLIST.has(rel)) continue;
      scanned++;
      const text = fs.readFileSync(full, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (line.includes('docs/evolution/')) {
          violations.push(`${rel}:${i + 1}`);
        }
      });
    }
  };

  for (const d of scopeDirs) walk(path.join(rootDir, d));

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `${scanned} shipped file(s) scanned across ${scopeDirs.length} dirs; no docs/evolution/ literals (allowlist: ${[...EVOLUTION_PATH_ALLOWLIST].join(', ') || 'none'})`
      : `${violations.length} hardcoded docs/evolution/ reference(s) in shipped kit — resolve per repo scope via resolveEvolutionDir:\n  ` + violations.join('\n  '),
  };
}

// ─── Adopter-Value Relation on Kit-Quality Findings (INV-053 / WS-436) ─────
//
// Forward-enforcing gate: every kit-quality finding detected on or after
// the WS-436 ship date must declare adopter_value_relation, and findings
// tagged `no` must be in status: blocked unless they carry an override
// rationale. Synthesis-time partner to the failed_states_seed compose-time
// injection (WS-296). FIND-312 / REC-002 source.

const ADOPTER_VALUE_ENUM = new Set(['yes', 'enables-yes', 'no-but-mitigates-data-loss', 'no']);
const ADOPTER_VALUE_CUTOVER = '2026-05-14';

function checkAdopterValueRelation(rootDir) {
  let wsDir;
  try { wsDir = findWorkstreamDir(rootDir); }
  catch { return { passed: false, detail: '.claude/workstream/ not found' }; }

  const findingsDir = path.join(wsDir, 'findings');
  if (!fs.existsSync(findingsDir)) {
    return { passed: true, detail: 'no findings directory — nothing to check' };
  }

  const files = globFiles(findingsDir, 'FIND-*.yaml');
  const violations = [];
  let checked = 0;
  let exempted = 0;

  for (const f of files) {
    const r = readYAMLFile(f);
    if (!r.ok || !r.data) continue;
    const d = r.data;

    // Forward-only enforcement: program == kit-quality AND detected_at >= cutover
    if (d.program !== 'kit-quality') continue;
    const detectedAt = (d.detected_at || d.created_at || '').toString();
    if (!detectedAt || detectedAt < ADOPTER_VALUE_CUTOVER) { exempted++; continue; }

    checked++;
    const rel = d.adopter_value_relation;
    if (rel === undefined || rel === null || rel === '') {
      violations.push(`${path.basename(f)}: missing adopter_value_relation (detected_at=${detectedAt})`);
      continue;
    }
    if (!ADOPTER_VALUE_ENUM.has(rel)) {
      violations.push(`${path.basename(f)}: invalid adopter_value_relation: ${JSON.stringify(rel)} (must be one of ${Array.from(ADOPTER_VALUE_ENUM).join('|')})`);
      continue;
    }
    if (rel === 'no') {
      const status = (d.status || '').toString();
      const hasOverride = d.adopter_value_override_rationale && String(d.adopter_value_override_rationale).trim().length > 0;
      if (status !== 'blocked' && !hasOverride) {
        violations.push(`${path.basename(f)}: adopter_value_relation=no but status=${status || '(missing)'} and no override rationale — must be blocked or carry adopter_value_override_rationale`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `${checked} post-cutover kit-quality finding(s) compliant; ${exempted} pre-cutover exempt`
      : `${violations.length} violation(s):\n  ` + violations.slice(0, 10).join('\n  ') + (violations.length > 10 ? `\n  ... and ${violations.length - 10} more` : ''),
  };
}

// INV-055 — Adopter-controlled config values must flow through boundedPath helpers.
// Scans cwos-adopt-install.js + cwos-scope-check.js for the dangerous patterns we
// know we eliminated in WS-430, and confirms resolveSystemDir is wrapped. Deterministic
// pattern match — no AI judgment.
function checkBoundedPathContainment(rootDir) {
  const targets = [
    'kit/scripts/cwos-adopt-install.js',
    'kit/scripts/cwos-scope-check.js',
  ];

  const violations = [];

  for (const rel of targets) {
    const absPath = path.join(rootDir, rel);
    if (!fs.existsSync(absPath)) {
      violations.push(`${rel}: file missing`);
      continue;
    }
    const text = fs.readFileSync(absPath, 'utf8');
    const lines = text.split('\n');

    // Forbidden patterns — these flowed adopter-controlled values into
    // path.join unchecked before WS-430.
    const forbidden = [
      { re: /path\.join\(\s*config\.target\s*,\s*destRel\b/, why: 'path.join(config.target, destRel) — use boundedPathInRepo' },
      { re: /path\.join\(\s*config\.target\s*,\s*entry\.destination/, why: 'path.join(config.target, entry.destination...) — use boundedPathInRepo' },
      { re: /path\.join\(\s*config\.target\s*,\s*evidenceDir/, why: 'path.join(config.target, evidenceDir...) — use boundedPathInRepo' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments and lines that are inside strings (heuristic: leading whitespace + comment marker)
      if (/^\s*(?:\/\/|\*)/.test(line)) continue;
      for (const { re, why } of forbidden) {
        if (re.test(line)) {
          violations.push(`${rel}:${i + 1}: ${why}`);
        }
      }
    }

    // resolveSystemDir presence + boundedSystemDir wrap — scoped to the
    // function body (next ~15 lines after the declaration).
    const resolveIdx = lines.findIndex(l => /^function\s+resolveSystemDir\s*\(/.test(l));
    if (resolveIdx === -1) {
      violations.push(`${rel}: resolveSystemDir not found`);
    } else {
      const bodyEnd = Math.min(resolveIdx + 25, lines.length);
      const bodySlice = lines.slice(resolveIdx, bodyEnd).join('\n');
      if (!/boundedSystemDir\s*\(/.test(bodySlice)) {
        violations.push(`${rel}:${resolveIdx + 1}: resolveSystemDir does not call boundedSystemDir`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? 'cwos-adopt-install.js + cwos-scope-check.js: resolveSystemDir wrapped; no forbidden path.join sites'
      : `${violations.length} violation(s):\n  ` + violations.join('\n  '),
  };
}

// INV-056 — Reverse-direction kit/commands ↔ MANIFEST coverage. INV-024 enforces
// MANIFEST → file existence; this asserts the inverse: every kit/commands/*.md
// has a MANIFEST entry. The phantom-reference class is otherwise invisible.
function checkCommandManifestCoverage(rootDir) {
  const commandsDir = path.join(rootDir, 'kit', 'commands');
  const manifestPath = path.join(rootDir, 'kit', 'MANIFEST.yaml');

  if (!fs.existsSync(commandsDir)) {
    return { passed: false, detail: `kit/commands/ not found at ${commandsDir}` };
  }
  if (!fs.existsSync(manifestPath)) {
    return { passed: false, detail: `kit/MANIFEST.yaml not found at ${manifestPath}` };
  }

  const commandFiles = globFiles(commandsDir, '*.md').map(f => path.basename(f));

  // Build the set of sources the MANIFEST claims to install. Tolerate parse
  // warnings (CWOS YAML subset); only the source field matters here.
  const { ok, data, error } = readYAMLFile(manifestPath);
  if (!ok) {
    return { passed: false, detail: `MANIFEST parse failed: ${error}` };
  }

  const entries = Array.isArray(data.files) ? data.files : [];
  const manifestCommandSources = new Set();
  for (const e of entries) {
    if (e && typeof e.source === 'string' && e.source.startsWith('kit/commands/') && e.source.endsWith('.md')) {
      manifestCommandSources.add(path.basename(e.source));
    }
  }

  const orphans = commandFiles.filter(f => !manifestCommandSources.has(f));

  return {
    passed: orphans.length === 0,
    detail: orphans.length === 0
      ? `${commandFiles.length} command file(s); all present in MANIFEST`
      : `${orphans.length} command file(s) missing from MANIFEST: ${orphans.join(', ')}`,
  };
}

// INV-057 — cwos-adopt-install.js must use writeFileAtomic, never raw fs.writeFileSync.
// Raw writes are non-atomic under OneDrive sync (HC-002) and can leave state files
// truncated mid-write. Deterministic line-scan; comments are skipped.
function checkAdoptInstallAtomicWrites(rootDir) {
  const targetPath = path.join(rootDir, 'kit', 'scripts', 'cwos-adopt-install.js');
  if (!fs.existsSync(targetPath)) {
    return { passed: false, detail: `kit/scripts/cwos-adopt-install.js not found at ${targetPath}` };
  }
  const lines = fs.readFileSync(targetPath, 'utf8').split('\n');
  const violations = [];
  const pattern = /\bfs\.writeFileSync\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (pattern.test(line)) {
      violations.push(`${i + 1}: ${trimmed.slice(0, 80)}`);
    }
  }
  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? 'cwos-adopt-install.js: no raw fs.writeFileSync calls; all writes go through writeFileAtomic'
      : `${violations.length} raw fs.writeFileSync site(s) in cwos-adopt-install.js (must use writeFileAtomic):\n  ` + violations.join('\n  '),
  };
}

// WS-366 / FIND-248 — delegates to cwos-program-fields-have-runtime-effect.js
// which owns the field→reader mapping table. Keeping the table in its own
// script makes the publish-time gate runnable as a standalone CLI too.
function checkProgramFieldsHaveRuntimeEffect(rootDir) {
  let mod;
  try { mod = require('./cwos-program-fields-have-runtime-effect'); }
  catch (e) { return { passed: false, detail: `validator script not loadable: ${e.message}` }; }
  const result = mod.checkAccountabilityFieldReaders(rootDir);
  if (result.error) {
    return { passed: false, detail: `validator error: ${result.error}` };
  }
  if (result.failures.length === 0) {
    return { passed: true, detail: `${result.fields_checked} accountability fields have runtime readers` };
  }
  const lines = result.failures.map((f) => `${f.field} (${f.reason})`).join('; ');
  return { passed: false, detail: `${result.failures.length} decoration-only field(s): ${lines}` };
}

function checkEngineIndex(rootDir) {
  const standard = globFiles(path.join(rootDir, 'engines/standard'), '*.md').map(f => path.basename(f, '.md'));
  const libraryDirs = fs.existsSync(path.join(rootDir, 'engines/library'))
    ? fs.readdirSync(path.join(rootDir, 'engines/library'), { withFileTypes: true })
        .filter(e => e.isDirectory())
        .filter(e => fs.existsSync(path.join(rootDir, 'engines/library', e.name, 'SKILL.md')))
        .map(e => e.name)
    : [];

  const indexPath = path.join(rootDir, 'engines/INDEX.md');
  if (!fs.existsSync(indexPath)) return { passed: false, detail: 'engines/INDEX.md not found' };
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  const missing = [];
  for (const name of standard) {
    if (!indexContent.includes(name)) missing.push(`standard/${name}`);
  }
  for (const name of libraryDirs) {
    if (!indexContent.includes(name)) missing.push(`library/${name}`);
  }

  return {
    passed: missing.length === 0,
    detail: missing.length === 0
      ? `${standard.length} standard + ${libraryDirs.length} library engines all listed in INDEX.md`
      : `${missing.length} engines missing from INDEX.md: ${missing.join(', ')}`,
  };
}

function checkNoPersonaSimulation(rootDir) {
  const matches = grepRecursive(
    rootDir,
    ['kit', 'engines'],
    'adopt that viewpoint|as the orchestrator.*critique|for each.*perspective.*produce',
    (f) => f.endsWith('.md')
  );
  return {
    passed: matches.length === 0,
    detail: matches.length === 0
      ? 'No persona-simulation patterns found in kit/ or engines/'
      : `${matches.length} matches found: ${matches.slice(0, 3).map(m => `${m.file}:${m.line}`).join(', ')}`,
  };
}

function checkQueueIndexParity(rootDir) {
  let wsDir;
  try { wsDir = findWorkstreamDir(rootDir); }
  catch { return { passed: false, detail: '.claude/workstream/ not found' }; }

  const queueFiles = globFiles(path.join(wsDir, 'queue'), 'WS-*.yaml');
  const fileCount = queueFiles.length;

  // WS-147: strict-parse every queue file so orphan-block-sequence drops
  // surface here instead of silently truncating items at every consumer.
  // Queue YAMLs are CWOS-authored, so a strict failure is a real bug.
  const malformed = [];
  for (const f of queueFiles) {
    const r = readYAMLFile(f, { strict: true });
    if (!r.ok && Array.isArray(r.warnings) && r.warnings.length > 0) {
      malformed.push(`${path.basename(f)}: ${r.error}`);
    }
  }

  // WS-205 (SPR-064): prefer typed-API read via state-store (ADR-020).
  // Falls back to queue-index.yaml if state-store is unavailable (pre-step-2
  // repos or when state/queue.json hasn't been materialized yet).
  let indexCount = null;
  let indexSource = null;
  try {
    const ss = require('./core/state-store');
    const store = ss.loadState(wsDir);
    const items = store.queue.all();
    if (Array.isArray(items)) { indexCount = items.length; indexSource = 'state-store'; }
  } catch { /* fall through */ }

  if (indexCount === null) {
    const indexPath = path.join(wsDir, 'queue-index.yaml');
    if (!fs.existsSync(indexPath)) return { passed: false, detail: 'queue-index.yaml not found (and state-store unavailable)' };
    const { ok, data } = readYAMLFile(indexPath);
    if (!ok) return { passed: false, detail: 'queue-index.yaml could not be parsed' };
    indexCount = Array.isArray(data.items) ? data.items.length : 0;
    indexSource = 'queue-index.yaml';
  }

  if (malformed.length > 0) {
    return {
      passed: false,
      detail: `${malformed.length} queue file(s) have parse warnings (orphan items dropped silently): ${malformed.slice(0, 3).join(' | ')}`,
    };
  }

  return {
    passed: indexCount === fileCount,
    detail: indexCount === fileCount
      ? `Index and files match (${fileCount} items, source=${indexSource})`
      : `Index has ${indexCount} entries (source=${indexSource}); queue/ has ${fileCount} WS-*.yaml files`,
  };
}

function checkFleetPaths(rootDir) {
  const registryPath = path.join(rootDir, 'fleet/registry.yaml');
  if (!fs.existsSync(registryPath)) return { passed: false, detail: 'fleet/registry.yaml not found' };
  const { ok, data } = readYAMLFile(registryPath);
  if (!ok) return { passed: false, detail: 'fleet/registry.yaml could not be parsed' };

  const repos = Array.isArray(data.repos) ? data.repos : [];
  const missing = [];
  let realCount = 0;
  let simCount = 0;

  for (const repo of repos) {
    // Simulated repos are ephemeral — their path field points to sim/.sandbox/
    // which only exists during sim runs. Check the `source` path instead
    // (the template repo that gets copied into the sandbox).
    if (repo.type === 'simulated') {
      simCount++;
      if (repo.source) {
        const sourcePath = path.isAbsolute(repo.source) ? repo.source : path.join(rootDir, repo.source);
        if (!fs.existsSync(sourcePath)) {
          missing.push(`${repo.name || '?'} (simulated) → source ${repo.source}`);
        }
      }
      continue;
    }
    realCount++;
    // `skip_path_check: true` is for registry entries whose filesystem
    // folder hasn't been created yet (reserved names, planned repos).
    // The name is still tracked so future /discover / /adopt runs can
    // wire it up, but INV-008 should not flag the missing path as drift.
    if (repo.skip_path_check === true) continue;
    if (repo.path && !fs.existsSync(repo.path)) {
      missing.push(`${repo.name || repo.id || '?'} → ${repo.path}`);
    }
  }

  return {
    passed: missing.length === 0,
    detail: missing.length === 0
      ? `${realCount} real + ${simCount} simulated repos, all paths/sources exist`
      : `${missing.length} missing: ${missing.slice(0, 3).join(', ')}`,
  };
}

function checkAdrIndex(rootDir) {
  const canonicalDir = path.join(rootDir, 'docs/adrs');
  const docsDir = path.join(rootDir, 'docs');
  const indexPath = path.join(canonicalDir, 'INDEX.md');
  if (!fs.existsSync(indexPath)) return { passed: false, detail: 'docs/adrs/INDEX.md not found' };

  // Scan ADR-named directories only (docs/adr*/), not all of docs/.
  // Avoids false positives from commentary files like docs/design-reviews/ADR-018-pressure-test.md
  // that name-reference an ADR but aren't ADRs themselves. The WS-286 failure mode this guards
  // against is specifically docs/adr/ vs docs/adrs/ divergence.
  const adrNumberRe = /^ADR-(\d{3})(?:[-.]|$)/;
  const byNumber = new Map();   // number → [{rel, base}]
  const stray = [];             // ADR files outside canonical dir
  let adrDirs = [];
  try {
    adrDirs = fs.readdirSync(docsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^adrs?$/i.test(d.name))
      .map(d => path.join(docsDir, d.name));
  } catch { /* docs/ may not exist */ }

  for (const dir of adrDirs) {
    walkDir(dir, (filePath) => {
      const base = path.basename(filePath);
      if (base === 'INDEX.md') return;
      const m = base.match(adrNumberRe);
      if (!m) return;
      const num = m[1];
      const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
      const inCanonical = path.dirname(filePath) === canonicalDir;
      if (!inCanonical) stray.push(rel);
      if (!byNumber.has(num)) byNumber.set(num, []);
      byNumber.get(num).push({ rel, base });
    });
  }

  const duplicates = [];
  for (const [num, hits] of byNumber.entries()) {
    if (hits.length > 1) duplicates.push(`#${num}: ${hits.map(h => h.rel).join(' + ')}`);
  }

  // Coverage check: every canonical ADR file must appear in INDEX.md.
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const canonicalAdrs = globFiles(canonicalDir, 'ADR-*.md').map(f => path.basename(f, '.md'));
  const missing = canonicalAdrs.filter(name => !indexContent.includes(name));

  const failures = [];
  if (stray.length) failures.push(`${stray.length} ADR(s) outside docs/adrs/: ${stray.join(', ')}`);
  if (duplicates.length) failures.push(`${duplicates.length} duplicate number(s): ${duplicates.join('; ')}`);
  if (missing.length) failures.push(`${missing.length} missing from INDEX.md: ${missing.join(', ')}`);

  return {
    passed: failures.length === 0,
    detail: failures.length === 0
      ? `${canonicalAdrs.length} ADRs in docs/adrs/, 0 duplicates, 0 strays, all in INDEX.md`
      : failures.join(' | '),
  };
}

function checkUserGuideCoverage(rootDir) {
  const commandFiles = globFiles(path.join(rootDir, 'kit/commands'), '*.md').map(f => path.basename(f, '.md'));
  const guidePath = path.join(rootDir, 'docs/guides/user-guide.md');
  if (!fs.existsSync(guidePath)) return { passed: false, detail: 'docs/guides/user-guide.md not found' };
  const guideContent = fs.readFileSync(guidePath, 'utf8');

  const missing = commandFiles.filter(name => !guideContent.includes(`/${name}`));
  return {
    passed: missing.length === 0,
    detail: missing.length === 0
      ? `${commandFiles.length} commands all referenced in user-guide.md`
      : `${missing.length} commands missing from user-guide.md: ${missing.join(', ')}`,
  };
}

function checkStateFreshness(rootDir) {
  const statePath = path.join(rootDir, 'system/state.md');
  if (!fs.existsSync(statePath)) return { passed: false, detail: 'system/state.md not found' };
  const content = fs.readFileSync(statePath, 'utf8');
  const match = content.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return { passed: false, detail: 'Could not find "Last updated:" date in state.md' };

  const stateDate = new Date(match[1]);
  const today = new Date(todayISO());
  const daysOld = Math.floor((today - stateDate) / (1000 * 60 * 60 * 24));

  return {
    passed: daysOld <= 14,
    detail: daysOld <= 14
      ? `state.md updated ${daysOld} days ago (within 14-day window)`
      : `state.md is ${daysOld} days old — should be refreshed (run cwos-state.js)`,
  };
}

function checkConvergenceEngine(rootDir) {
  const enginePath = path.join(rootDir, 'engines/homebase-only/convergence.md');
  const indexPath = path.join(rootDir, 'engines/INDEX.md');
  const auditPath = path.join(rootDir, 'kit/commands/audit.md');

  const engineExists = fs.existsSync(enginePath);
  const inIndex = fs.existsSync(indexPath) && fs.readFileSync(indexPath, 'utf8').includes('convergence');
  const inAudit = fs.existsSync(auditPath) && fs.readFileSync(auditPath, 'utf8').includes('convergence');

  const issues = [];
  if (!engineExists) issues.push('engines/homebase-only/convergence.md missing');
  if (!inIndex) issues.push('not referenced in engines/INDEX.md');
  if (!inAudit) issues.push('not referenced in kit/commands/audit.md');

  return {
    passed: issues.length === 0,
    detail: issues.length === 0 ? 'convergence engine present in all 3 locations' : issues.join('; '),
  };
}

function checkRegistrySkillPaths(rootDir) {
  const registryPath = path.join(rootDir, 'kit/templates/workstream/engines/registry.yaml');
  if (!fs.existsSync(registryPath)) return { passed: false, detail: 'registry template not found' };

  // Parse line-by-line to find active (uncommented) skill_path entries.
  //
  // Post-WS-139: skill_path is expected to point at an actual file that exists
  // in both HomeBase and in adopted repos post-install. Standard engines live
  // at `engines/standard/<name>.md`; library engines at
  // `engines/library/<category>/<name>/SKILL.md`. Both are distributed by
  // kit/MANIFEST.yaml (:1153-1277 for standard, library blocks below) so the
  // destination paths are stable across /adopt.
  //
  // The prior loose fallback (tried .claude/commands/, kit/commands/, AND
  // engines/standard/) masked phantom entries because engines/standard/ always
  // exists in HomeBase even when no command wrapper exists. That was the
  // INV-014 loophole flagged by FIND-068.
  const content = fs.readFileSync(registryPath, 'utf8');
  const lines = content.split('\n');
  const phantoms = [];

  for (const line of lines) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*skill_path:\s*(.+?)\s*$/);
    if (!m) continue;
    const skillPath = m[1].replace(/^["']|["']$/g, '');
    const resolved = path.join(rootDir, skillPath);
    if (!fs.existsSync(resolved)) {
      phantoms.push(skillPath);
    }
  }

  return {
    passed: phantoms.length === 0,
    detail: phantoms.length === 0
      ? 'All active registry skill_paths resolve to existing files'
      : `${phantoms.length} phantom entries: ${phantoms.join(', ')}`,
  };
}

function checkOptimizationBacklog(rootDir) {
  const backlogPath = path.join(rootDir, 'docs/OPTIMIZATION-BACKLOG.md');
  if (!fs.existsSync(backlogPath)) return { passed: true, detail: 'No backlog file (informational check)' };

  // Find most recent fleet-feedback run
  let wsDir;
  try { wsDir = findWorkstreamDir(rootDir); }
  catch { return { passed: true, detail: 'No workstream — informational check skipped' }; }

  const runsDir = path.join(wsDir, 'runs');
  if (!fs.existsSync(runsDir)) return { passed: true, detail: 'No runs/ — no fleet-feedback runs to compare' };

  let latestFleetFeedback = null;
  for (const entry of fs.readdirSync(runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(runsDir, entry.name, 'manifest.yaml');
    if (!fs.existsSync(manifestPath)) continue;
    const { ok, data } = readYAMLFile(manifestPath);
    if (!ok) continue;
    if (data.engine === 'fleet-feedback') {
      const ts = data.completed_at || data.started_at;
      if (ts && (!latestFleetFeedback || ts > latestFleetFeedback)) latestFleetFeedback = ts;
    }
  }

  if (!latestFleetFeedback) return { passed: true, detail: 'No fleet-feedback runs yet — nothing to compare' };

  const backlogMtime = fs.statSync(backlogPath).mtime.toISOString();
  const passed = backlogMtime >= latestFleetFeedback;

  return {
    passed,
    detail: passed
      ? `Backlog modified ${backlogMtime.slice(0, 10)} after last fleet-feedback ${latestFleetFeedback.slice(0, 10)}`
      : `Backlog last touched ${backlogMtime.slice(0, 10)} but fleet-feedback ran ${latestFleetFeedback.slice(0, 10)} — review backlog`,
  };
}

function checkHardlinkPreservation(rootDir) {
  // WS-142 / FIND-074: real content-hash hardlink scanner.
  //
  // The prior implementation (pre-2026-04-20) created a synthetic pair in
  // .cwos-verify-tmp/ and validated inode equality after a single
  // writeFileAtomic — it never touched a single real command file. sim.md
  // was silently content-diverged in production for days and this check had
  // no way to see it.
  //
  // New contract: walk every source-side command file in kit/, fleet/, sim/,
  // compute the expected .claude/commands/<basename> target, and require:
  //   (a) target exists,
  //   (b) same inode (NTFS hardlink preserved — otherwise Edit tool or
  //       rename-based writes have broken the link), and
  //   (c) byte-for-byte content match (SHA-256).
  //
  // Known pre-existing drift: sim/commands/sim.md diverged from
  // .claude/commands/sim.md during development (Edit-tool inode break,
  // documented in system/failures.md). The scanner will report this as
  // CONTENT-DIVERGED until /verify --fix-hardlinks --force is run or the
  // underlying divergence is manually resolved.
  const crypto = require('crypto');

  const sources = [
    { dir: path.join(rootDir, 'kit/commands'),   label: 'kit' },
    { dir: path.join(rootDir, 'fleet/commands'), label: 'fleet' },
    { dir: path.join(rootDir, 'sim/commands'),   label: 'sim' },
  ];
  const targetDir = path.join(rootDir, '.claude/commands');

  if (!fs.existsSync(targetDir)) {
    return { passed: false, detail: `target directory missing: .claude/commands/` };
  }

  const issues = [];
  let total = 0;

  for (const src of sources) {
    if (!fs.existsSync(src.dir)) continue;
    const files = globFiles(src.dir, '*.md');
    for (const f of files) {
      total++;
      const basename = path.basename(f);
      const tgt = path.join(targetDir, basename);

      if (!fs.existsSync(tgt)) {
        issues.push(`${src.label}/${basename}: TARGET-MISSING`);
        continue;
      }

      let srcStat, tgtStat;
      try {
        srcStat = fs.statSync(f);
        tgtStat = fs.statSync(tgt);
      } catch (e) {
        issues.push(`${src.label}/${basename}: STAT-ERROR (${e.code})`);
        continue;
      }

      if (srcStat.ino !== tgtStat.ino || tgtStat.nlink < 2) {
        issues.push(`${src.label}/${basename}: INODE-BROKEN (src=${srcStat.ino}, tgt=${tgtStat.ino}, nlink=${tgtStat.nlink})`);
        continue;
      }

      // Inode match implies content match on NTFS, but verify defensively
      // against filesystem bugs or mount-point divergence.
      const srcHash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      const tgtHash = crypto.createHash('sha256').update(fs.readFileSync(tgt)).digest('hex');
      if (srcHash !== tgtHash) {
        issues.push(`${src.label}/${basename}: CONTENT-DIVERGED`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    detail: issues.length === 0
      ? `${total} hardlink pairs OK (content + inode match)`
      : `${issues.length}/${total} pairs broken: ${issues.slice(0, 3).join('; ')}${issues.length > 3 ? '; ...' : ''}`,
  };
}

// Optional helper — re-establish broken hardlinks by overwriting the
// .claude/commands/ target with the kit/fleet/sim source via NTFS hardlink.
// Invoked by `cwos-verify.js --fix-hardlinks` (or --fix-hardlinks --force to
// overwrite divergent content). Keep outside the main check so dry runs are
// always non-destructive.
function fixBrokenHardlinks(rootDir, opts = {}) {
  const crypto = require('crypto');
  const force = opts.force === true;

  const sources = [
    { dir: path.join(rootDir, 'kit/commands'),   label: 'kit' },
    { dir: path.join(rootDir, 'fleet/commands'), label: 'fleet' },
    { dir: path.join(rootDir, 'sim/commands'),   label: 'sim' },
  ];
  const targetDir = path.join(rootDir, '.claude/commands');
  const actions = { fixed: [], skipped: [], errors: [] };

  for (const src of sources) {
    if (!fs.existsSync(src.dir)) continue;
    for (const f of globFiles(src.dir, '*.md')) {
      const basename = path.basename(f);
      const tgt = path.join(targetDir, basename);

      let broken = false;
      let divergent = false;
      try {
        if (!fs.existsSync(tgt)) {
          broken = true;
        } else {
          const srcStat = fs.statSync(f);
          const tgtStat = fs.statSync(tgt);
          if (srcStat.ino !== tgtStat.ino || tgtStat.nlink < 2) {
            broken = true;
            const sHash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
            const tHash = crypto.createHash('sha256').update(fs.readFileSync(tgt)).digest('hex');
            if (sHash !== tHash) divergent = true;
          }
        }
      } catch (e) {
        actions.errors.push(`${src.label}/${basename}: ${e.message}`);
        continue;
      }

      if (!broken) continue;

      if (divergent && !force) {
        actions.skipped.push(`${src.label}/${basename}: content diverged — use --force to overwrite target`);
        continue;
      }

      try {
        if (fs.existsSync(tgt)) fs.rmSync(tgt, { force: true });
        // ADR-043 / WS-306: NTFS hardlinks are supported natively by
        // fs.linkSync on Windows. Earlier code shelled out to PowerShell
        // when linkSync threw — that path interpolated unsanitized paths
        // into a -Command string. Drop the fallback; surface failures
        // through the existing actions.errors channel instead.
        fs.linkSync(f, tgt);
        actions.fixed.push(`${src.label}/${basename}`);
      } catch (e) {
        actions.errors.push(`${src.label}/${basename}: relink failed — ${e.message}`);
      }
    }
  }

  return actions;
}

// ─── INV-024: Distribution Referential Integrity (WS-143 / FIND-073) ──────
//
// Anchored on kit/MANIFEST.yaml as the single source of truth for "what the
// kit distributes." INDEX, registry, and command-prose references are
// treated as derivatives and validated against MANIFEST. The check catches
// five distinct classes of drift that previously required separate ad-
// hoc checks (or worse, no check at all):
//
//   (1) REGISTRY_SKILL_NOT_IN_MANIFEST — an active skill_path in the
//       template registry points at a file that MANIFEST doesn't distribute,
//       meaning /fleet-update ships a registry entry referencing something
//       adopted repos won't have post-install.
//   (2) INDEX_ENGINE_NOT_IN_MANIFEST — engines/INDEX.md lists an engine
//       that isn't in MANIFEST. Founders who browse INDEX assume it
//       reflects reality; this keeps it honest.
//   (3) COMMAND_DOC_REF_MISSING — a command file (kit/commands/*.md)
//       references a docs/*.md that doesn't exist on disk. This catches
//       the docs/bow-contract.md dangling-reference class documented in
//       FIND-069 before it ships to the fleet.
//   (4) COMMAND_DOC_REF_UNDISTRIBUTED — a distributed command references
//       a docs/*.md that exists in HomeBase but isn't in MANIFEST, so
//       adopted repos receive the command but not the doc it cites.
//   (5) TEMPLATE_PROGRAM_ENGINE_REF_UNDISTRIBUTED — a MANIFEST-distributed
//       program template (kit/templates/workstream/programs/prog-*.yaml)
//       declares a protocols.<name>.engine that does NOT resolve to a
//       distribution-cleared engine (engines/standard/ or engines/library/).
//       This is the FIND-235 / WS-353 leak class: the canonical instance was
//       prog-launch.yaml referencing the homebase-only `convergence` engine,
//       which never propagates — so every adopted repo fired "engine not in
//       registry" warnings. Scope note: only MANIFEST-listed templates are
//       checked; HomeBase-internal program templates that live in the dir but
//       never ship (e.g. prog-detectability, prog-optimization) are out of
//       scope by construction. Schema-shape checks on the same surface are
//       owned by INV-025; this class covers only engine-ref resolvability.
//
// Commented-out registry entries are intentional (planned/deferred work)
// and are not violations.
function checkDistributionRefs(rootDir) {
  // ── Parse MANIFEST: extract every `source:` path ─────────────────────
  const manifestPath = path.join(rootDir, 'kit/MANIFEST.yaml');
  if (!fs.existsSync(manifestPath)) return { passed: false, detail: 'kit/MANIFEST.yaml not found' };
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifestSources = new Set();
  for (const line of manifestContent.split('\n')) {
    const m = line.match(/^\s*-\s*source:\s*(.+?)\s*$/);
    if (m) manifestSources.add(m[1].replace(/^["']|["']$/g, '').replace(/\\/g, '/'));
  }

  const violations = [];

  // ── (1) Template registry skill_paths must be in MANIFEST ────────────
  const registryPath = path.join(rootDir, 'kit/templates/workstream/engines/registry.yaml');
  if (fs.existsSync(registryPath)) {
    for (const line of fs.readFileSync(registryPath, 'utf8').split('\n')) {
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*skill_path:\s*(.+?)\s*$/);
      if (!m) continue;
      const sp = m[1].replace(/^["']|["']$/g, '').replace(/\\/g, '/');
      if (!manifestSources.has(sp)) {
        violations.push(`REGISTRY_SKILL_NOT_IN_MANIFEST: ${sp}`);
      }
    }
  }

  // ── (2) engines/INDEX.md named engines must be in MANIFEST ───────────
  //
  // INDEX is a markdown doc; engines are listed in tables with the shape:
  //   | **engine-name** | `engines/standard/name.md` | description | ... |
  //   | **library-name** | `engines/library/name/` | ... |         (dir)
  //   | **Base** | `engines/base/` | ...                 (infra — skip)
  //   | **Procedure** | `engines/procedures/` | ...      (infra — skip)
  // We extract (name, path) pairs, skip the two dispatch-infrastructure
  // rows, and require the path (normalized to a file) to match a MANIFEST
  // source. Directory-shaped paths resolve to `<dir>SKILL.md`.
  //
  // WS-444 / FIND-315: INDEX also opens with a taxonomy legend table whose
  // rows point at the bare scope directories (`engines/standard/`,
  // `engines/library/`, `engines/homebase-only/`) — these describe the three
  // engine SCOPES, not individual engines, and previously produced three
  // false INDEX_ENGINE_NOT_IN_MANIFEST violations (they resolved to a
  // nonexistent `<scope>/SKILL.md`). A bare top-level scope dir is never an
  // engine, so skip it.
  const indexPath = path.join(rootDir, 'engines/INDEX.md');
  if (fs.existsSync(indexPath)) {
    const indexText = fs.readFileSync(indexPath, 'utf8');
    const ROW_RE = /\|\s*\*\*([A-Za-z][A-Za-z0-9-]+)\*\*\s*\|\s*`(engines\/[^`]+)`/g;
    const INFRA_PREFIX = /^engines\/(base|procedures|styles)\//;
    const SCOPE_DIR_RE = /^engines\/(standard|library|homebase-only)\/$/;
    for (const m of indexText.matchAll(ROW_RE)) {
      const engPath = m[2].replace(/\\/g, '/');
      if (INFRA_PREFIX.test(engPath)) continue;
      if (SCOPE_DIR_RE.test(engPath)) continue; // taxonomy legend row, not an engine
      // Normalize directory refs (engines/library/foo/) to the SKILL.md file.
      const resolved = engPath.endsWith('/') ? `${engPath}SKILL.md` : engPath;
      if (!manifestSources.has(resolved)) {
        violations.push(`INDEX_ENGINE_NOT_IN_MANIFEST: ${m[1]} -> ${resolved}`);
      }
    }
  }

  // ── (3) kit/commands/ references to docs/*.md must exist on disk ─────
  //
  // Case-insensitive (`docs/INVARIANTS.md` and `docs/bow-contract.md` both
  // warrant checking). Some commands deliberately describe legacy/migration
  // paths that do NOT exist; those are exempted explicitly.
  //
  // SKIPLIST:
  //   - `audit.md`: scans for legacy misplaced files by path; its docs/*
  //     references are data to check, not real links.
  //   - `discover.md` (WS-444 / FIND-315): probes a TARGET repo and lists the
  //     files it looks for there (e.g. `docs/CONSTRAINTS.md`, `docs/INVARIANTS.md`).
  //     Those are descriptions of the adopted repo's layout, not HomeBase doc
  //     links — they must not be required to exist on disk here.
  const cmdDir = path.join(rootDir, 'kit/commands');
  const SKIPLIST = new Set(['audit.md', 'discover.md']);
  if (fs.existsSync(cmdDir)) {
    const DOC_REF_RE = /docs\/([A-Za-z][A-Za-z0-9/-]+\.md)/g;
    for (const f of globFiles(cmdDir, '*.md')) {
      const cmdName = path.basename(f);
      if (SKIPLIST.has(cmdName)) continue;
      const text = fs.readFileSync(f, 'utf8');
      const seen = new Set();
      for (const m of text.matchAll(DOC_REF_RE)) {
        const ref = 'docs/' + m[1];
        if (seen.has(ref)) continue;
        seen.add(ref);
        // Skip template placeholders — paths containing `NNN` are a
        // documented CWOS convention for dynamic-number substitution
        // (e.g. ADR-NNN.md, WS-NNN.yaml). Commands that show these in
        // their prose/examples are not referencing real files.
        if (/NNN/.test(ref)) continue;
        const onDisk = fs.existsSync(path.join(rootDir, ref));
        if (!onDisk) {
          violations.push(`COMMAND_DOC_REF_MISSING: ${cmdName} -> ${ref}`);
        }
        // (4) intentionally left as an advisory — many commands reference
        // HomeBase-internal docs (PRODUCT.md, ADRs) that aren't distributed,
        // which is fine. A future refinement could require distributed docs
        // to be MANIFEST-declared; for now we only flag missing-on-disk.
      }
    }
  }

  // ── (5) Distributed template programs' protocol engine refs must resolve
  //        to a distribution-cleared engine (WS-353 / FIND-235) ───────────
  //
  // The distributable engine set is derived from MANIFEST itself: an engine
  // is shippable iff MANIFEST distributes engines/standard/<id>.md or
  // engines/library/<id>/... . homebase-only engines live under
  // engines/homebase-only/ and so are naturally absent from this set. We
  // iterate ONLY MANIFEST-listed template programs — a program template that
  // lives in the dir but isn't distributed never reaches an adopted repo, so
  // a homebase-only ref there is harmless and out of scope.
  const distributableEngines = new Set();
  for (const src of manifestSources) {
    let m = src.match(/^engines\/standard\/([a-z0-9][a-z0-9-]*)\.md$/);
    if (m) { distributableEngines.add(m[1]); continue; }
    m = src.match(/^engines\/library\/([a-z0-9][a-z0-9-]*)\//);
    if (m) distributableEngines.add(m[1]);
  }
  // Only meaningful to check engine-ref resolvability if we actually resolved
  // a distributable set from MANIFEST (defends against a malformed/empty parse
  // turning every ref into a false violation).
  if (distributableEngines.size > 0) {
    let homebaseOnly = new Set();
    try {
      const { loadHomebaseOnlyEngines } = require('./lib/cwos-bundle-validate');
      homebaseOnly = loadHomebaseOnlyEngines(rootDir);
    } catch { /* messaging-only; absence just means we can't label "homebase-only" vs "unknown" */ }

    for (const src of manifestSources) {
      if (!/^kit\/templates\/workstream\/programs\/prog-.*\.yaml$/.test(src)) continue;
      const progPath = path.join(rootDir, src);
      if (!fs.existsSync(progPath)) continue; // INV-024 class (1)-style missing-source is a separate concern
      const r = readYAMLFile(progPath);
      if (!r.ok || !r.data || !r.data.protocols || typeof r.data.protocols !== 'object') continue;
      const protocols = r.data.protocols;
      for (const protoName of Object.keys(protocols)) {
        const proto = protocols[protoName];
        if (!proto || typeof proto !== 'object') continue;
        const engine = proto.engine;
        if (!engine || typeof engine !== 'string') continue;
        if (distributableEngines.has(engine)) continue;
        const kind = homebaseOnly.has(engine) ? 'homebase-only — will not propagate' : 'unknown engine';
        violations.push(`TEMPLATE_PROGRAM_ENGINE_REF_UNDISTRIBUTED: ${src} protocols.${protoName}.engine="${engine}" (${kind})`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `referential integrity OK (MANIFEST anchors INDEX, registry, command doc-refs, template program engine-refs)`
      : `${violations.length} violations: ${violations.slice(0, 4).join('; ')}${violations.length > 4 ? '; ...' : ''}`,
    violations, // full list (additive; INVARIANT_CHECKS only reads passed/detail) — enables class-specific assertions in tests
  };
}

// ─── INV-025: schema_version Type Consistency (WS-144 / FIND-081) ──────────
//
// YAML 1.1 coerces bare scalars in sneaky ways (NO/YES → booleans, 3.0 →
// float). FIND-060's resolution quoted every `schema_version:` field in kit
// templates to defend against that. But live `.claude/workstream/` files use
// integer form, creating a silent type mismatch: any downstream `=== 3`
// check passes on live files and fails on templates. The program that
// declares "Schema Version Consistency" as a problem class was violating its
// own rule.
//
// Canonical form: integer. `3` is not subject to YAML Norway (NO/YES only);
// `3.0` would be (as float) but we never use float versions. The live-file
// form is already integer, so the fix is to un-quote templates.
//
// This check scans every YAML file under kit/templates/ and
// .claude/workstream/ for `schema_version:` lines and requires the value to
// be an unquoted integer matching the family-expected version (programs→3,
// config→1, registry→3).
function checkSchemaVersionConsistency(rootDir) {
  const SCHEMA_VERSION_RE = /^\s*schema_version:\s*(.+?)\s*$/;
  const EXPECTED_BY_FAMILY = [
    { re: /programs[\\/]prog-[^\\/]+\.ya?ml$/,       expected: 3 },
    { re: /programs[\\/]registry\.ya?ml$/,            expected: 3 },
    { re: /programs[\\/]skeleton[\\/]prog\.ya?ml$/,   expected: 3 },
    { re: /workstream[\\/]config\.ya?ml$/,            expected: 1 },
  ];

  const scanDirs = [
    path.join(rootDir, 'kit/templates'),
    path.join(rootDir, '.claude/workstream'),
  ].filter(d => fs.existsSync(d));

  const violations = [];

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.ya?ml$/.test(e.name)) continue;

      let content;
      try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }

      const m = content.split('\n').map(l => l.match(SCHEMA_VERSION_RE)).find(Boolean);
      if (!m) continue;

      const raw = m[1];
      const rel = path.relative(rootDir, full).replace(/\\/g, '/');

      // Determine expected version for this file's family.
      let expected = null;
      for (const fam of EXPECTED_BY_FAMILY) {
        if (fam.re.test(full)) { expected = fam.expected; break; }
      }
      if (expected === null) continue; // unknown family — skip

      // Type check: reject quoted strings.
      if (/^["'].*["']$/.test(raw)) {
        violations.push(`${rel}: quoted string value ${raw} (expected integer ${expected})`);
        continue;
      }

      // Value check: must match expected integer.
      if (String(parseInt(raw, 10)) !== raw || parseInt(raw, 10) !== expected) {
        violations.push(`${rel}: value ${raw} (expected integer ${expected})`);
      }
    }
  }

  for (const d of scanDirs) walk(d);

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `All schema_version values are consistent integer form per family`
      : `${violations.length} violations: ${violations.slice(0, 3).join('; ')}${violations.length > 3 ? '; ...' : ''}`,
  };
}

// ─── INV-026: Hook Liveness (WS-138 / FIND-067) ───────────────────────────
//
// Stop + SessionStart hooks run with `2>/dev/null || true`, suppressing every
// error. If cwos-heartbeat.js or cwos-session-recovery.js crashes (bad
// require chain, permission error, YAML parse fail), the failure is invisible
// and session state rots silently. This check reads the liveness stamp file
// that both scripts write at the top of their main() and flags staleness.
//
// Decision logic:
//   (1) No .current-session pointer or it points nowhere → PASS, N/A (no
//       active session means no hook should be firing; nothing to verify).
//   (2) Active session exists, stamp file missing → FAIL (hook likely never
//       runs — Node missing? path wrong? permissions?).
//   (3) Active session exists, stamp older than 2 hours → FAIL (hook is
//       firing elsewhere but not updating the stamp — script crashed between
//       require and stamp-write, or file is read-only, etc.).
//   (4) Otherwise → PASS.
//
// The 2-hour threshold is conservative: the Stop hook fires on every Claude
// response, so during an active session the stamp updates in minutes. Two
// hours absorbs long tool-waits (remote agents, browser automation) without
// false-positive-ing.
function checkHookLiveness(rootDir) {
  const wsDir = path.join(rootDir, '.claude/workstream');
  if (!fs.existsSync(wsDir)) {
    return { passed: true, detail: 'no workstream dir (INV-026 N/A)' };
  }

  const currentPtr = path.join(wsDir, '.current-session');
  if (!fs.existsSync(currentPtr)) {
    return { passed: true, detail: 'no active session (hook-liveness N/A)' };
  }

  const sessionId = fs.readFileSync(currentPtr, 'utf8').trim();
  if (!sessionId) {
    return { passed: true, detail: '.current-session is empty (hook-liveness N/A)' };
  }

  const sessionPath = path.join(wsDir, 'sessions', `${sessionId}.yaml`);
  if (!fs.existsSync(sessionPath)) {
    return { passed: true, detail: `pointer to missing session ${sessionId} (hook-liveness N/A)` };
  }

  const sessionContent = fs.readFileSync(sessionPath, 'utf8');
  const statusMatch = sessionContent.match(/^status:\s*(\S+)/m);
  if (!statusMatch || statusMatch[1] !== 'active') {
    return { passed: true, detail: `session ${sessionId} status=${statusMatch?.[1] || 'unknown'} (hook-liveness N/A)` };
  }

  const livenessPath = path.join(wsDir, '.hooks-liveness.yaml');
  if (!fs.existsSync(livenessPath)) {
    return {
      passed: false,
      detail: `active session ${sessionId} but .hooks-liveness.yaml missing — hooks may never have fired. Check .claude/settings.local.json and kit/scripts/cwos-heartbeat.js.`,
    };
  }

  const livenessContent = fs.readFileSync(livenessPath, 'utf8');
  const stampMatch = livenessContent.match(/^last_heartbeat_hook_at:\s*"?([^"\n]+)"?\s*$/m);
  if (!stampMatch) {
    return {
      passed: false,
      detail: `active session ${sessionId} but liveness stamp has no last_heartbeat_hook_at — hook script may have crashed before stamping.`,
    };
  }

  const stampTime = Date.parse(stampMatch[1].trim());
  if (isNaN(stampTime)) {
    return {
      passed: false,
      detail: `last_heartbeat_hook_at is not a parseable ISO timestamp: ${stampMatch[1]}`,
    };
  }

  const ageHours = (Date.now() - stampTime) / (60 * 60 * 1000);
  if (ageHours > 2) {
    return {
      passed: false,
      detail: `active session ${sessionId} but last heartbeat hook fired ${ageHours.toFixed(1)}h ago — hook likely broken (check Node install and kit/scripts/cwos-heartbeat.js).`,
    };
  }

  return {
    passed: true,
    detail: `active session ${sessionId}; last heartbeat hook ${ageHours.toFixed(2)}h ago (threshold 2h)`,
  };
}

// ─── INV-027: Command File Size Budget (WS-149 / FIND-080) ────────────────
//
// Command files have grown unbounded (engine.md at 853 lines, top 4 at ~26k
// tokens per session). This check surfaces growth before it balloons session
// cost further. Soft limit 500 lines = warning embedded in detail (still
// passes). Hard limit 1000 lines = invariant fails.
//
// Scope is kit/commands/*.md only. fleet/ and sim/ are infrastructure;
// engines/standard/*.md and engines/library/**/*.md are engine-dispatch
// payload with different budget profiles. claude-preamble.md is a separate
// concern (always-loaded) and may get its own invariant later.
function checkCommandFileSizeBudget(rootDir) {
  const SOFT_LIMIT = 500;
  const HARD_LIMIT = 1000;
  const cmdDir = path.join(rootDir, 'kit/commands');
  if (!fs.existsSync(cmdDir)) {
    return { passed: true, detail: 'no kit/commands/ dir' };
  }

  const files = globFiles(cmdDir, '*.md');
  const warns = [];
  const fails = [];
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    const entry = { name: path.basename(f), lines };
    if (lines >= HARD_LIMIT) fails.push(entry);
    else if (lines >= SOFT_LIMIT) warns.push(entry);
  }

  if (fails.length > 0) {
    fails.sort((a, b) => b.lines - a.lines);
    return {
      passed: false,
      detail: `${fails.length} commands over hard limit (${HARD_LIMIT} lines): ${fails.map(e => `${e.name} (${e.lines})`).join(', ')}. Restructure or split.`,
    };
  }

  if (warns.length > 0) {
    warns.sort((a, b) => b.lines - a.lines);
    return {
      passed: true,
      detail: `All under hard limit (${HARD_LIMIT}). ${warns.length}/${files.length} over soft limit (${SOFT_LIMIT}, warn-only): ${warns.map(e => `${e.name} (${e.lines})`).join(', ')}.`,
    };
  }

  return {
    passed: true,
    detail: `All ${files.length} command files within soft limit (${SOFT_LIMIT} lines).`,
  };
}

// ─── INV-042: Output Shape coverage (FIND-082 / WS-158) ─────────────────────
//
// Common-traffic kit commands must declare the response shape the founder
// will see, using the BoW envelope from docs/bow-contract.md. The 12 commands
// in scope were identified by the design-audit engine (run-001 / FIND-082)
// as having procedural preambles but no output-shape guidance — the gap that
// kept HomeBase's AI-conversation surface at L2.
//
// Check: each in-scope file must contain a literal `## Output Shape` heading
// at the start of a line. The 6 reference commands (/status, /pulse,
// /session-start, /welcome, /session-end, /onboard-check) are out of scope
// per founder direction in SPR-083.

const OUTPUT_SHAPE_COMMANDS = [
  'next.md', 'plan.md', 'audit.md', 'decide.md', 'build-engine.md',
  'engine.md', 'evolve.md', 'feedback.md', 'verify.md', 'autopilot.md',
  'checkpoint.md', 'workstream.md',
];

function checkOutputShapeCoverage(rootDir) {
  const cmdDir = path.join(rootDir, 'kit/commands');
  if (!fs.existsSync(cmdDir)) {
    return { passed: true, detail: 'no kit/commands/ dir' };
  }

  const missing = [];
  for (const name of OUTPUT_SHAPE_COMMANDS) {
    const file = path.join(cmdDir, name);
    if (!fs.existsSync(file)) {
      missing.push(`${name} (file not found)`);
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    if (!/^## Output Shape\s*$/m.test(content)) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      detail: `${missing.length}/${OUTPUT_SHAPE_COMMANDS.length} command(s) missing '## Output Shape' heading: ${missing.join(', ')}. Add the section per docs/bow-contract.md envelope.`,
    };
  }

  return {
    passed: true,
    detail: `All ${OUTPUT_SHAPE_COMMANDS.length} in-scope commands declare '## Output Shape'.`,
  };
}

// ─── INV-028: Shadow-event instrumentation coverage ─────────────────────────
//
// ADR-018 step 1 escape-valve contract: script-layer instrumentation must
// cover ≥95% of state-mutating call sites. Coverage below 95% opens the
// step-1.5 wrapper-instrumentation amendment (§Alternatives #8).
//
// "State-mutating call site" = a write/append/unlink/rename/copyFile call
// targeting a path under `.claude/workstream/`, `system/`, or the kit
// index/counter files. A script is "covered" if it imports `appendEvent`
// from `core/events` directly OR routes through the canonical
// `makeEventEmitter()` / `loadEventDeps()` factories from lib/cwos-utils.
// A command (`kit/commands/*.md`) is covered if it contains a
// `cwos-event append` invocation line.
//
// This check is warn-only for commands + script-layer: it returns
// { passed: <coverage_ok>, detail: <summary> } and surfaces the uncovered
// site list in `detail`. Fails only when coverage < 95%.

function checkShadowInstrumentationCoverage(rootDir) {
  const THRESHOLD = 0.95;

  // Script-layer coverage
  const scriptDir = path.join(rootDir, 'kit', 'scripts');
  const excluded = ['lib', 'core', '__tests__', 'git-hooks'];
  const scripts = fs.existsSync(scriptDir)
    ? fs.readdirSync(scriptDir).filter((f) => f.endsWith('.js') && !excluded.includes(path.basename(f, '.js')) && !f.endsWith('.test.js'))
    : [];
  const mutatingScripts = [];
  const instrumentedScripts = [];
  for (const f of scripts) {
    const full = path.join(scriptDir, f);
    const text = fs.readFileSync(full, 'utf8');
    const mutates = /writeFileAtomic|writeFileSync|appendFileSync|renameSync|unlinkSync|copyFileSync/.test(text);
    if (!mutates) continue;
    mutatingScripts.push(f);
    if (/require\(['"]\.\/core\/events['"]\)|require\(['"]\.\.\/core\/events['"]\)|makeEventEmitter\(\)|loadEventDeps\(\)/.test(text)) {
      instrumentedScripts.push(f);
    }
  }

  // Command-layer coverage
  const cmdDir = path.join(rootDir, 'kit', 'commands');
  const cmds = fs.existsSync(cmdDir)
    ? fs.readdirSync(cmdDir).filter((f) => f.endsWith('.md'))
    : [];
  const commandsInstrumented = [];
  const commandsUncovered = [];
  for (const f of cmds) {
    const text = fs.readFileSync(path.join(cmdDir, f), 'utf8');
    if (/cwos-event(\.js)?\s+append\s+command_completed/.test(text)) commandsInstrumented.push(f);
    else commandsUncovered.push(f);
  }

  const scriptCov = mutatingScripts.length === 0 ? 1 : instrumentedScripts.length / mutatingScripts.length;
  const cmdCov = cmds.length === 0 ? 1 : commandsInstrumented.length / cmds.length;
  const overallCov = (scriptCov + cmdCov) / 2;
  const passed = overallCov >= THRESHOLD;

  const scriptUncovered = mutatingScripts.filter((f) => !instrumentedScripts.includes(f));
  const detail = passed
    ? `Coverage ${(overallCov * 100).toFixed(0)}% — scripts ${instrumentedScripts.length}/${mutatingScripts.length}, commands ${commandsInstrumented.length}/${cmds.length}.`
    : `Coverage ${(overallCov * 100).toFixed(0)}% < ${(THRESHOLD * 100).toFixed(0)}% — scripts ${instrumentedScripts.length}/${mutatingScripts.length} (${scriptUncovered.slice(0, 5).join(', ')}${scriptUncovered.length > 5 ? `, +${scriptUncovered.length - 5} more` : ''}), commands ${commandsInstrumented.length}/${cmds.length} (${commandsUncovered.slice(0, 5).join(', ')}${commandsUncovered.length > 5 ? `, +${commandsUncovered.length - 5} more` : ''}). Uncovered sites are candidates for the instrumentation long-tail WS; escape valve at §Alternatives #8 if <95% after 1 month.`;

  return { passed, detail };
}

// ─── INV-029: Rollback runbook drift ────────────────────────────────────────
//
// OPT-006 signal from WS-176 capstone: the step-1 rollback runbook drifted
// as SPR-058 added new files that the runbook's inventory did not list.
// This check catches that class of drift by extracting claimed file paths
// from every `docs/runbooks/*-rollback.md` and diffing against `git ls-files`
// under the directories the runbook claims to cover.
//
// Algorithm:
//   1. Find every docs/runbooks/*-rollback.md.
//   2. Parse ALL file-path mentions from:
//        - `git rm ... <path>` lines (with -r, -f variants)
//        - `git checkout <sha> -- <paths>` lines
//        - Markdown bullets of the form "- `<path>`" or similar
//   3. Identify the directory prefixes the runbook "covers" (any path
//      ending with `/` plus the unique parent dirs of listed files).
//   4. For each covered directory, list all tracked files via
//      `git ls-files <dir>` and check they appear in the runbook's
//      path set.
//   5. Report files tracked-but-unlisted (drift inward) and
//      listed-but-untracked (drift outward — stale references).
//
// Warn-only: passes at ≥90% coverage match. <90% fails with a specific
// drift report.

function checkRunbookDrift(rootDir) {
  const { runGit } = require('./lib/shell-safe');
  const THRESHOLD = 0.90;

  const runbookDir = path.join(rootDir, 'docs', 'runbooks');
  if (!fs.existsSync(runbookDir)) {
    return { passed: true, detail: 'no docs/runbooks/ dir — nothing to check' };
  }

  const runbooks = fs.readdirSync(runbookDir)
    .filter((f) => f.endsWith('-rollback.md'))
    .map((f) => path.join(runbookDir, f));
  if (runbooks.length === 0) {
    return { passed: true, detail: 'no *-rollback.md files — nothing to check' };
  }

  const reports = [];
  let worst = 1.0;

  for (const rb of runbooks) {
    const text = fs.readFileSync(rb, 'utf8');
    const claimed = extractRunbookPaths(text);
    const coveredDirs = extractCoveredDirs(text);

    // Tracked files under each covered dir, from git ls-files
    const tracked = new Set();
    for (const d of coveredDirs) {
      try {
        const r = runGit(['ls-files', d], { cwd: rootDir });
        if (!r.ok) continue;
        for (const line of String(r.stdout).split('\n').filter(Boolean)) {
          // Normalize to forward-slash relative paths
          tracked.add(line.trim().replace(/\\/g, '/'));
        }
      } catch { /* dir may not exist; skip */ }
    }

    const claimedNorm = new Set(Array.from(claimed).map((p) => p.replace(/\\/g, '/')));
    const missingFromRunbook = [];
    for (const f of tracked) if (!claimedNorm.has(f)) missingFromRunbook.push(f);
    const staleInRunbook = [];
    for (const c of claimedNorm) {
      if (!tracked.has(c) && coveredDirs.some((d) => c.startsWith(d.replace(/\\/g, '/') + '/'))) {
        staleInRunbook.push(c);
      }
    }

    const totalTracked = tracked.size;
    const coverageRatio = totalTracked === 0 ? 1 : (totalTracked - missingFromRunbook.length) / totalTracked;
    if (coverageRatio < worst) worst = coverageRatio;

    reports.push({
      runbook: path.basename(rb),
      covered_dirs: coveredDirs,
      total_tracked: totalTracked,
      claimed: claimedNorm.size,
      missing_from_runbook: missingFromRunbook,
      stale_in_runbook: staleInRunbook,
      coverage: coverageRatio,
    });
  }

  const passed = worst >= THRESHOLD;
  const summary = reports.map((r) => {
    const miss = r.missing_from_runbook.length;
    const stale = r.stale_in_runbook.length;
    return `${r.runbook}: ${(r.coverage * 100).toFixed(0)}% covered (${r.total_tracked} tracked, ${miss} missing, ${stale} stale)`;
  }).join('; ');

  if (passed) return { passed: true, detail: summary };

  // Failure detail enumerates the worst offender(s)
  const offender = reports.reduce((a, b) => (a.coverage <= b.coverage ? a : b));
  const miss = offender.missing_from_runbook.slice(0, 5).join(', ');
  const stale = offender.stale_in_runbook.slice(0, 5).join(', ');
  return {
    passed: false,
    detail: `${summary}. Worst: ${offender.runbook} missing-from-runbook [${miss}${offender.missing_from_runbook.length > 5 ? `, +${offender.missing_from_runbook.length - 5} more` : ''}]; stale [${stale}${offender.stale_in_runbook.length > 5 ? `, +${offender.stale_in_runbook.length - 5} more` : ''}]`,
  };
}

function extractRunbookPaths(text) {
  const paths = new Set();
  const lines = text.split('\n');
  // Path-looking fragments: allow letters, digits, dashes, underscores,
  // dots, slashes. Must contain at least one slash so we don't pick up
  // bare identifiers or sentence tokens.
  const pathFrag = /(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+/g;
  for (const line of lines) {
    let m;
    while ((m = pathFrag.exec(line)) !== null) {
      const s = m[0];
      // Filter obvious non-path matches (URLs, section slugs).
      if (/^https?:/i.test(s)) continue;
      if (/^[0-9a-f]{40,}/.test(s)) continue; // git SHAs with slashes (unlikely but guard)
      paths.add(s);
    }
  }
  return paths;
}

// Only dirs EXPLICITLY scoped via `git rm -r <dir>`, `rm -rf <dir>`, or a
// trailing-slash mention count. Individual file mentions are not sufficient
// to declare a whole directory "covered" — that would treat every line of a
// narrative runbook as a wholesale scope claim.
function extractCoveredDirs(text) {
  const dirs = new Set();
  const dirFrag = /((?:[a-zA-Z0-9_.-]+\/)+)/g;
  // Pattern 1: `git rm -r <dir>` / `git rm -rf <dir>`
  const gitRmRe = /git\s+rm\s+-r\w*\s+((?:[a-zA-Z0-9_.-]+\/)+)/g;
  let m;
  while ((m = gitRmRe.exec(text)) !== null) dirs.add(m[1].replace(/\/$/, ''));
  // Pattern 2: `rm -rf <dir>`
  const rmRfRe = /\brm\s+-rf\s+((?:[a-zA-Z0-9_.-]+\/)+)/g;
  while ((m = rmRfRe.exec(text)) !== null) dirs.add(m[1].replace(/\/$/, ''));
  // Pattern 3: bullet list items naming a dir with trailing slash, e.g.
  // `- .claude/workstream/events/` or in a code-span `kit/scripts/core/`.
  const trailSlashRe = /(?:[`"'\s])((?:[a-zA-Z0-9_.-]+\/)+)(?=[`"'\s,)])/g;
  while ((m = trailSlashRe.exec(text)) !== null) dirs.add(m[1].replace(/\/$/, ''));

  // De-dupe by longest-prefix
  const sorted = Array.from(dirs).sort((a, b) => a.length - b.length);
  const minimal = [];
  for (const d of sorted) {
    if (!minimal.some((m) => d === m || d.startsWith(m + '/'))) minimal.push(d);
  }
  // Constrain to dirs managed by CWOS
  const allowed = ['kit/', 'sim/', 'docs/', '.claude/', 'system/', 'personas/', 'engines/', 'fleet/'];
  return minimal.filter((d) => allowed.some((a) => d.startsWith(a) || (d + '/').startsWith(a)));
}

// ─── INV-030: Snapshot-diff smoke test ──────────────────────────────────────
//
// Replaces the ADR-018 §Consequences 48-hour dogfooding protocol (WS-186).
// Rather than run HomeBase for 48 hours on parallel branches and diff
// mutations, we synthesize a controlled mutation, invoke the shadow-event
// path, and verify snapshot-diff reconciles it.
//
// The check runs in two stages:
//   1. Pure-function self-test: construct before/after snapshots + events
//      in memory, verify snapshot-diff correctly classifies them.
//   2. Presence check: confirm kit/scripts/core/snapshot-diff.js exists
//      and loads without error.
//
// This is deliberately lightweight — the full suite in
// kit/scripts/__tests__/snapshot-diff.test.js covers end-to-end behavior.
// INV-030 here is a "can the verifier run at all" smoke signal that fires
// during every verify invocation.

function checkSnapshotDiffSmoke(rootDir) {
  const snapshotDiffPath = path.join(rootDir, 'kit', 'scripts', 'core', 'snapshot-diff.js');
  if (!fs.existsSync(snapshotDiffPath)) {
    return { passed: false, detail: 'kit/scripts/core/snapshot-diff.js missing — WS-186 deliverable absent' };
  }
  let sd;
  try { sd = require(snapshotDiffPath); }
  catch (err) { return { passed: false, detail: `snapshot-diff.js failed to load: ${err.message}` }; }
  if (typeof sd.verify !== 'function' || typeof sd.snapshotState !== 'function') {
    return { passed: false, detail: 'snapshot-diff.js loaded but missing verify/snapshotState export' };
  }

  // In-memory smoke test: one instrumented mutation, one uninstrumented.
  const before = { 'tracked.yaml': '1'.repeat(64), 'hidden.yaml': 'a'.repeat(64) };
  const after = { 'tracked.yaml': '2'.repeat(64), 'hidden.yaml': 'b'.repeat(64) };
  const events = [{ payload: { path: 'tracked.yaml' } }];
  const r = sd.verify({ beforeSnap: before, afterSnap: after, events });
  if (r.ok) return { passed: false, detail: 'smoke expected missing=1 (hidden.yaml) but snapshot-diff reported ok' };
  if (!r.missing.includes('hidden.yaml')) {
    return { passed: false, detail: `smoke failed: expected missing=[hidden.yaml], got ${JSON.stringify(r.missing)}` };
  }
  if (!r.reconciled.includes('tracked.yaml')) {
    return { passed: false, detail: `smoke failed: expected reconciled=[tracked.yaml], got ${JSON.stringify(r.reconciled)}` };
  }

  return {
    passed: true,
    detail: 'snapshot-diff loads and classifies a synthetic 1-tracked / 1-hidden scenario correctly. Full replay-corpus integration lives in kit/scripts/__tests__/snapshot-diff.test.js.',
  };
}

// ─── INV-031: replay-purity hard invariant (ADR-020) ────────────────────────
//
// Runs `cwos-replay check` programmatically. Passes IFF
// state/*.json equals what a fresh replay from events produces.
// Hard fail, not warn-only — ADR-020 locked this.
//
// When state/*.json doesn't exist yet (pre-step-2 repos, or a fresh
// clone that hasn't run any commands), the "clean slate" is itself
// a valid state (no events have materialized anything). INV-031
// treats an absent state dir + empty event log as a trivial pass.

function checkReplayPurity(rootDir) {
  const replayPath = path.join(rootDir, 'kit', 'scripts', 'core', 'cwos-replay.js');
  if (!fs.existsSync(replayPath)) {
    return { passed: true, detail: 'cwos-replay.js not present — replay-purity N/A (pre-step-2)' };
  }
  let replay;
  try { replay = require(replayPath); }
  catch (err) { return { passed: false, detail: `cwos-replay failed to load: ${err.message}` }; }

  const wsDir = path.join(rootDir, '.claude', 'workstream');
  if (!fs.existsSync(wsDir)) {
    return { passed: true, detail: 'no workstream dir — replay-purity N/A' };
  }

  let r;
  try { r = replay.check({ workstreamDir: wsDir }); }
  catch (err) { return { passed: false, detail: `cwos-replay check threw: ${err.message}` }; }

  if (r.ok) {
    return {
      passed: true,
      detail: `clean — ${r.event_count} events replayed; all domains match.`,
    };
  }
  return {
    passed: false,
    detail: `DRIFT: ${r.drift_summary || 'state differs from event-log replay'}. Run \`node kit/scripts/core/cwos-replay.js rebuild\` to restore.`,
  };
}

// ─── INV-044: Per-field replay-purity (WS-261 / AS-037-11) ───────────────
//
// Complements INV-031 (whole-state replay-purity) with per-field
// granularity. Catches non-replay-pure derivations that happen to match
// disk state today but use Date.now() / random / unstable iteration
// order — INV-031 misses these because the disk state was written by
// the same impure reducer, so disk + replay both have the same wrong
// value at any given moment.
//
// Step-2 absent (no core/replay-test.js) = trivial pass; pre-step-2
// repos have no cached fields to check.

function checkReplayPureFields(rootDir) {
  const harnessPath = path.join(rootDir, 'kit', 'scripts', 'core', 'replay-test.js');
  if (!fs.existsSync(harnessPath)) {
    return { passed: true, detail: 'replay-test.js not present — per-field check N/A (pre-WS-261)' };
  }
  let harness;
  try { harness = require(harnessPath); }
  catch (err) { return { passed: false, detail: `replay-test failed to load: ${err.message}` }; }

  const wsDir = path.join(rootDir, '.claude', 'workstream');
  if (!fs.existsSync(wsDir)) {
    return { passed: true, detail: 'no workstream dir — per-field check N/A' };
  }

  let r;
  try { r = harness.replayPurityCheck(wsDir); }
  catch (err) { return { passed: false, detail: `replayPurityCheck threw: ${err.message}` }; }

  if (r.ok) {
    return {
      passed: true,
      detail: `clean — ${r.event_count} events replayed; ${r.fields_checked} fields checked; 0 violations.`,
    };
  }
  const sample = r.violations.slice(0, 3).map((v) =>
    `${v.domain}.${v.item_id}.${v.field} (${v.kind})`
  ).join(', ');
  return {
    passed: false,
    detail: `${r.violations.length} replay-purity violation(s). Sample: ${sample}. Run \`node kit/scripts/cwos-replay-test.js check\` for full list.`,
  };
}

// ─── INV-032: Typed-API coverage (ADR-020 WS-199) ────────────────────────
//
// Scans kit/scripts/cwos-*.js for raw-index reads that now have a
// typed-API equivalent. Reports per-script + overall coverage. Warn-
// only at SPR-062 ship — tightens as commands migrate (each typed-API
// migration WS updates the expected coverage floor).
//
// Raw-index patterns = string matches of the file paths the reducers
// have superseded. Typed-API patterns = evidence the script imports
// state-store. A script that does BOTH is "partial" (migrating). A
// script that only does raw-index is "legacy". Only state-store = "migrated".
// A script that does NEITHER is "read-free" (excluded from denominator).

function checkTypedApiCoverage(rootDir) {
  const scriptDir = path.join(rootDir, 'kit', 'scripts');
  if (!fs.existsSync(scriptDir)) {
    return { passed: true, detail: 'no kit/scripts/ — N/A' };
  }
  const excluded = ['lib', 'core', '__tests__', 'git-hooks'];
  const scripts = fs.readdirSync(scriptDir)
    .filter((f) => f.endsWith('.js') && !excluded.includes(path.basename(f, '.js')) && !f.endsWith('.test.js'));

  // WS-209 (SPR-065): raw-READ patterns specifically. A script that
  // only WRITES to these index files (e.g., cwos-migrate's
  // writeFileAtomic backward-compat path, cwos-reconcile's rebuild)
  // isn't a "legacy reader" — it's maintaining the fallback for
  // pre-step-2 consumers. Only readYAMLFile / fs.readFileSync /
  // fs.readFile references count as raw reads.
  const RAW_INDEX_NAMES = /(queue-index\.yaml|findings-index\.yaml|sprint-index\.yaml|programs\/registry\.yaml)/;
  const READ_VERBS = /(readYAMLFile|fs\.readFile|fs\.readFileSync|require)/;

  function hasRawRead(text) {
    // Walk each line: raw read if the line has both a READ verb AND
    // an index-file reference.
    const lines = text.split('\n');
    for (const line of lines) {
      if (READ_VERBS.test(line) && RAW_INDEX_NAMES.test(line)) return true;
    }
    return false;
  }

  const TYPED_API_PATTERN = /require\(['"][./]*\/?core\/state-store['"]\)/;

  const stats = { legacy: [], partial: [], migrated: [], read_free: [] };
  for (const f of scripts) {
    const text = fs.readFileSync(path.join(scriptDir, f), 'utf8');
    const hasRaw = hasRawRead(text);
    const hasTyped = TYPED_API_PATTERN.test(text);
    if (!hasRaw && !hasTyped) stats.read_free.push(f);
    else if (hasRaw && hasTyped) stats.partial.push(f);
    else if (hasTyped) stats.migrated.push(f);
    else stats.legacy.push(f);
  }

  const reading = stats.legacy.length + stats.partial.length + stats.migrated.length;
  const migrated = stats.migrated.length + (stats.partial.length * 0.5);  // partial counts half
  const coverage = reading === 0 ? 1 : migrated / reading;

  // Warn-only phase: always pass, report coverage as detail. Later
  // sprints will flip this to enforcing a floor (e.g., ≥50% by SPR-064).
  return {
    passed: true,
    detail: `coverage ${(coverage * 100).toFixed(0)}% — migrated ${stats.migrated.length}, partial ${stats.partial.length}, legacy ${stats.legacy.length}, read-free ${stats.read_free.length}. Legacy (next migration targets): ${stats.legacy.slice(0, 5).join(', ')}${stats.legacy.length > 5 ? `, +${stats.legacy.length - 5} more` : ''}.`,
  };
}

// ─── INV-033: Founder-surface schema-jargon lint (WS-150) ──────────────────

// Scans the 4 commands that dominate the first-session founder surface
// (/welcome, /status, /session-start, /onboard-check) for schema-jargon
// placeholders inside output fences. FIND-077 specifically flagged tokens
// like <M-state>, <one-clause ...>, <bullet list ...>, <adoption arc ...>,
// <envelope ...> that were meant to be substituted but sometimes leak
// verbatim into founder output — reading like a YAML schema instead of
// plain English.
//
// This lint flags ONLY those specific jargon patterns (not generic
// substitution placeholders like <N>, <title>, <WS-NNN> that BoW output
// shapes legitimately use). Inline backticked examples are excluded.
function checkFounderSurfacePlaceholders(rootDir) {
  const FOUNDER_SURFACE_FILES = [
    'kit/commands/welcome.md',
    'kit/commands/status.md',
    'kit/commands/session-start.md',
    'kit/commands/onboard-check.md',
  ];
  const JARGON_PATTERNS = [
    /<M-state[^>]*>/i,
    /<one-clause[^>]*>/i,
    /<bullet list[^>]*>/i,
    /<component summary[^>]*>/i,
    /<list names[^>]*>/i,
    /<adoption arc[^>]*>/i,
    /<envelope[^>]*>/i,
    /<schema[- ][^>]*>/i,
  ];

  const violations = [];
  for (const rel of FOUNDER_SURFACE_FILES) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      if (!inFence) continue;
      const stripped = line.replace(/`[^`]*`/g, '');
      for (const re of JARGON_PATTERNS) {
        const m = stripped.match(re);
        if (m) violations.push(`${rel}:${i + 1}: ${m[0]}`);
      }
    }
  }

  if (violations.length === 0) {
    return { passed: true, detail: `All 4 founder-surface commands are clean of schema-jargon placeholders inside output fences.` };
  }
  return {
    passed: false,
    detail: `${violations.length} schema-jargon placeholder(s) in founder output: ${violations.slice(0, 4).join(' | ')}${violations.length > 4 ? ` (+${violations.length - 4} more)` : ''}`,
  };
}

// ─── INV-034: Uncustomized program contracts (WS-152) ──────────────────────

// A program's `contract:` field is the plain-language promise it makes to
// the founder. When an adopted repo ships with a template program, the
// field contains [CUSTOMIZE: ...] placeholder text — reading it as if it
// were a trusted contract is the "placeholder-as-contract" failure mode
// WS-152 closes.
//
// Severity ladder (per founder decision on WS-152):
//   - WARN by default (check passes but surfaces the list) so fresh
//     adopted repos aren't blocked on day one.
//   - FAIL once the founder has declined customization 3+ times via the
//     /pulse re-prompt (tracked as `customization_declined_count` in
//     .cwos-onboarding.yaml). Declining three times is an explicit signal
//     that the founder has seen the nag and is ignoring it; that's when
//     cwos-verify starts breaking.
//
// Scope: product programs only. System programs (`monitor_only: true`)
// are excluded because their contracts speak to the operator, not the
// founder, and ship customized by design.
function checkUncustomizedContracts(rootDir) {
  const workstreamDir = findWorkstreamDir(rootDir);
  const programsDir = path.join(workstreamDir, 'programs');
  if (!fs.existsSync(programsDir)) {
    return { passed: true, detail: 'No programs directory — nothing to check.' };
  }

  const programFiles = globFiles(programsDir, 'prog-*.yaml')
    .filter(f => !path.basename(f).includes('template'));

  const uncustomized = [];
  for (const file of programFiles) {
    const parsed = readYAMLFile(file);
    if (!parsed) continue;
    if (parsed.monitor_only === true) continue;
    const contract = parsed.contract;
    if (typeof contract !== 'string') continue;
    if (contract.includes('[CUSTOMIZE:')) {
      uncustomized.push(parsed.id || path.basename(file, '.yaml'));
    }
  }

  if (uncustomized.length === 0) {
    return { passed: true, detail: `All ${programFiles.length} product program contracts are customized.` };
  }

  // Read decline count from onboarding.yaml (best-effort — absent == 0)
  const onboardingPath = path.join(rootDir, '.cwos-onboarding.yaml');
  let declineCount = 0;
  if (fs.existsSync(onboardingPath)) {
    const onboarding = readYAMLFile(onboardingPath);
    if (onboarding && typeof onboarding.customization_declined_count === 'number') {
      declineCount = onboarding.customization_declined_count;
    }
  }

  const listLabel = uncustomized.slice(0, 5).join(', ') + (uncustomized.length > 5 ? ` (+${uncustomized.length - 5} more)` : '');

  // FAIL once declined 3+ times, else WARN-as-pass.
  if (declineCount >= 3) {
    return {
      passed: false,
      detail: `${uncustomized.length} program(s) still have placeholder contracts after ${declineCount} decline(s): ${listLabel}. Customize via /pulse or /onboard-check.`,
    };
  }

  // WARN-as-pass: surface the list in the detail line without failing.
  return {
    passed: true,
    detail: `WARN: ${uncustomized.length} program(s) with placeholder contracts (${listLabel}). Decline count ${declineCount}/3 — escalates to FAIL at 3.`,
  };
}

// INV-039: No adopted fleet repo may have kit_version drift > 1 minor version
// behind HEAD's kit/VERSION without an open migration WS item. Every additional
// minor version of drift compounds: stacked schema bumps, command renames, and
// preamble changes all turn into customization-unknown rows in /fleet-update,
// past the founder's reviewable budget. The escape hatch — `cwos-migrate.js` —
// must be invoked before /fleet-update to keep state migration in its own
// reversible step. This invariant catches drift before /fleet-update is run,
// so the founder sees the migration backlog item instead of discovering the
// stale state during a 247-file diff review.
//
// Escape: a backlog or in_progress WS item with `category: fleet` and
// `migrating_repo: <name>` clears the violation for that repo (the migration
// is acknowledged, just not yet shipped).
//
// Source: FAIL-012 / premortem-2026-04-25 / WS-225.
function checkFleetVersionDrift(rootDir) {
  const registryPath = path.join(rootDir, 'fleet/registry.yaml');
  const versionPath = path.join(rootDir, 'kit/VERSION');
  if (!fs.existsSync(registryPath)) return { passed: true, detail: 'fleet/registry.yaml not found — no fleet to check' };
  if (!fs.existsSync(versionPath)) return { passed: false, detail: 'kit/VERSION not found' };

  const { ok, data } = readYAMLFile(registryPath);
  if (!ok) return { passed: false, detail: 'fleet/registry.yaml could not be parsed' };

  const headVersionRaw = fs.readFileSync(versionPath, 'utf8').trim();
  const headParts = headVersionRaw.split('.').map(n => parseInt(n, 10));
  if (headParts.length < 2 || headParts.some(Number.isNaN)) {
    return { passed: false, detail: `kit/VERSION (${headVersionRaw}) does not parse as semver` };
  }
  const [headMajor, headMinor] = headParts;

  // Allowed drift: 1 minor by default. Future: read from a config file.
  const MAX_DRIFT_MINOR = 1;

  // Collect open migration WS items as escape-hatch evidence. A WS item with
  // `category: fleet` whose body or front-matter mentions the repo name (in a
  // `migrating_repo:` field or in description text referencing "migrate" + the
  // repo) clears the violation for that repo. Keep the match permissive — the
  // goal is "founder has acknowledged the drift," not strict schema.
  const queueDir = path.join(rootDir, '.claude/workstream/queue');
  const openMigrationsByRepo = new Set();
  if (fs.existsSync(queueDir)) {
    const wsFiles = fs.readdirSync(queueDir).filter(f => /^WS-.*\.yaml$/.test(f));
    for (const f of wsFiles) {
      const raw = fs.readFileSync(path.join(queueDir, f), 'utf8');
      // Status filter — only open items count
      const statusMatch = raw.match(/^\s*status:\s*["']?(\w+)["']?/m);
      const status = statusMatch ? statusMatch[1] : null;
      if (status !== 'backlog' && status !== 'in_progress') continue;
      // Category filter
      if (!/^\s*category:\s*["']?fleet["']?/m.test(raw)) continue;
      // migrating_repo: explicit field
      const explicit = raw.match(/^\s*migrating_repo:\s*["']?([^"'\s]+)["']?/m);
      if (explicit) openMigrationsByRepo.add(explicit[1]);
      // Soft match in description: "migrate <repo>" mentioned
      const descMatches = raw.match(/migrat\w+\s+([A-Z][\w-]+)/g);
      if (descMatches) for (const m of descMatches) {
        const name = m.match(/migrat\w+\s+([A-Z][\w-]+)/)[1];
        openMigrationsByRepo.add(name);
      }
    }
  }

  const repos = Array.isArray(data.repos) ? data.repos : [];
  const violations = [];
  const warnings = [];
  let checkedCount = 0;

  for (const repo of repos) {
    if (repo.type === 'simulated') continue;       // sim repos don't track kit_version
    if (repo.skip_path_check === true) continue;   // reserved/un-cloned
    if (!repo.adopted_at) continue;                // unadopted — no drift to measure
    checkedCount++;

    const repoVersionRaw = repo.kit_version;
    if (typeof repoVersionRaw !== 'string' || !repoVersionRaw.length) {
      warnings.push(`${repo.name || '?'}: missing kit_version (adopted but field absent)`);
      continue;
    }
    const repoParts = repoVersionRaw.split('.').map(n => parseInt(n, 10));
    if (repoParts.length < 2 || repoParts.some(Number.isNaN)) {
      warnings.push(`${repo.name || '?'}: kit_version (${repoVersionRaw}) does not parse as semver`);
      continue;
    }
    const [repoMajor, repoMinor] = repoParts;

    // Major mismatch = unconditional violation (drift is conceptually infinite).
    if (repoMajor !== headMajor) {
      if (openMigrationsByRepo.has(repo.name)) continue;
      violations.push(`${repo.name}: kit_version ${repoVersionRaw} → HEAD ${headVersionRaw} (major mismatch — migration required)`);
      continue;
    }

    const drift = headMinor - repoMinor;
    if (drift > MAX_DRIFT_MINOR) {
      if (openMigrationsByRepo.has(repo.name)) continue;
      violations.push(`${repo.name}: kit_version ${repoVersionRaw} → HEAD ${headVersionRaw} (drift = ${drift} minor)`);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      detail: `${violations.length}/${checkedCount} adopted repo(s) over drift bound (max ${MAX_DRIFT_MINOR} minor): ${violations.slice(0, 3).join('; ')}${violations.length > 3 ? ` (+${violations.length - 3} more)` : ''}. Open a fleet WS item with migrating_repo:<name>, or run cwos-migrate.js + /fleet-update.`,
    };
  }
  if (warnings.length > 0) {
    return {
      passed: true,
      detail: `WARN: ${warnings.length}/${checkedCount} repo(s) with version-parse warnings: ${warnings.slice(0, 3).join('; ')}. ${checkedCount - warnings.length} repo(s) within bound.`,
    };
  }
  return { passed: true, detail: `${checkedCount} adopted repo(s) within ${MAX_DRIFT_MINOR}-minor drift bound of HEAD ${headVersionRaw}` };
}

// INV-038: Sprints approved on or after 2026-04-25 (WS-227 ship date) must
// record an `anti_goal_check:` field, and if their goal/items match an
// anti-goal or failed-state corpus phrase, the field must show status:
// passed | exempted | accepted_implicit. Sample-based: scans last 30
// approved sprint files. Grandfathers pre-2026-04-25 sprints (no field
// expected). Source: FAIL-010 / WS-227 / premortem-2026-04-25 §P2.
//
// Escape: founder explicitly chose option 4 (EXEMPTION) at /next Step 4a;
// the sprint YAML records reason + matches. Or option 1 with implicit
// accept (discouraged but legal — surfaces as accepted_implicit).
function checkAntiGoalCrossCheck(rootDir) {
  const sprintsDir = path.join(rootDir, '.claude/workstream/sprints');
  if (!fs.existsSync(sprintsDir)) return { passed: true, detail: 'sprints/ not found — nothing to check' };

  // Cutoff: WS-227 ship date. Sprints approved before this don't need the field.
  const CUTOFF_DATE = '2026-04-25';

  const sprintFiles = fs.readdirSync(sprintsDir)
    .filter(f => /^SPR-\d+\.yaml$/.test(f))
    .map(f => ({ name: f, path: path.join(sprintsDir, f) }))
    .sort((a, b) => b.name.localeCompare(a.name)) // most-recent (highest SPR number) first
    .slice(0, 30);

  if (sprintFiles.length === 0) return { passed: true, detail: 'No sprint files found' };

  // Load corpus once for goal/title scanning. Use the same anti_goals + failed_states
  // sections the /next Step 4a check relies on, with the same phrase-coverage logic.
  let corpus = null;
  try {
    const utils = require('./lib/cwos-utils');
    corpus = utils.loadCorpus(path.join(rootDir, 'kit/data/constitutional-detector-corpus.yaml'));
  } catch {
    return { passed: false, detail: 'Could not load constitutional-detector-corpus.yaml — INV-038 cannot run' };
  }
  const stop = corpus.stopwords;
  const COVERAGE_THRESHOLD = 0.70;

  function detectInGoal(text) {
    const inputTokens = new Set(String(text).toLowerCase().split(/\W+/).filter(t => t && !stop.includes(t)));
    for (const scope of ['anti_goals', 'failed_states']) {
      const block = corpus[scope];
      if (!block || !Array.isArray(block.canonical_phrases)) continue;
      const jaccardThreshold = block.similarity_threshold;
      for (const phrase of block.canonical_phrases) {
        const phraseTokens = new Set(phrase.toLowerCase().split(/\W+/).filter(t => t && !stop.includes(t)));
        if (phraseTokens.size === 0) continue;
        // Jaccard
        let inter = 0;
        for (const t of inputTokens) if (phraseTokens.has(t)) inter++;
        const union = inputTokens.size + phraseTokens.size - inter;
        const jaccard = union === 0 ? 0 : inter / union;
        // Phrase coverage
        const coverage = inter / phraseTokens.size;
        if (jaccard >= jaccardThreshold || coverage >= COVERAGE_THRESHOLD) {
          return { scope, phrase, jaccard, coverage };
        }
      }
    }
    return null;
  }

  const violations = [];
  let postCutoffCount = 0;
  let withFieldCount = 0;

  for (const f of sprintFiles) {
    const raw = fs.readFileSync(f.path, 'utf8');
    // Extract approved_at
    const apprMatch = raw.match(/^approved_at:\s*["']?(\d{4}-\d{2}-\d{2})/m);
    if (!apprMatch) continue;
    const approved = apprMatch[1];
    if (approved < CUTOFF_DATE) continue; // grandfathered
    postCutoffCount++;

    // Check for anti_goal_check field
    const hasField = /^anti_goal_check:/m.test(raw);
    if (hasField) withFieldCount++;

    // Determine if the sprint goal/items would have triggered a match
    const goalMatch = raw.match(/^goal:\s*>?\s*\n?([^]*?)(?=\n\w+:|$)/m);
    const goalText = goalMatch ? goalMatch[1].trim() : '';
    // Item titles
    const titleMatches = [...raw.matchAll(/^\s+- id:\s*["']?\w+[\s\S]*?title:\s*["']?(.+?)["']?\s*$/gm)];
    const titles = titleMatches.map(m => m[1]);
    const combined = [goalText, ...titles].join(' ');
    const detection = detectInGoal(combined);

    // Only flag if: corpus matched AND no field was recorded.
    // (If corpus matched AND field exists, the founder addressed it. Pass.)
    // (If corpus didn't match, no requirement — pass.)
    if (detection && !hasField) {
      violations.push(`${f.name}: matched ${detection.scope}/"${detection.phrase}" but has no anti_goal_check field`);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      detail: `${violations.length}/${postCutoffCount} post-${CUTOFF_DATE} sprint(s) matched anti-goal/failed-state corpus but record no anti_goal_check field: ${violations.slice(0, 3).join('; ')}`,
    };
  }
  return {
    passed: true,
    detail: `${postCutoffCount} post-${CUTOFF_DATE} sprint(s) checked; ${withFieldCount} record anti_goal_check field; 0 unaddressed corpus matches`,
  };
}

// INV-040: Every critical-tier program template under
// kit/templates/workstream/programs/prog-*.yaml must be instantiated in
// HomeBase's own .claude/workstream/programs/ AND listed in registry.yaml.
// This catches the "shipped a guardrail and forgot to apply it to ourselves"
// failure mode (FAIL-015) — prog-self-compliance shipped 2026-04-23 as a
// kit template but was never instantiated in HomeBase's registry, so /pulse
// never triggered sweep cadence on the constitution-watching program. The
// "system that polices the constitution is policed by no one" is now caught
// deterministically: if a critical-tier monitor program ships in the kit,
// HomeBase must instantiate it. Escape hatch: optional
// `skip_homebase_instantiation: true` field on the template, for templates
// that ship to adopted repos but don't apply to HomeBase itself.
//
// Source: FAIL-015 / WS-226 / premortem-2026-04-25 §C1.
function checkTemplateProgramInstantiation(rootDir) {
  const templateDir = path.join(rootDir, 'kit/templates/workstream/programs');
  if (!fs.existsSync(templateDir)) return { passed: true, detail: 'kit/templates/workstream/programs/ not found — nothing to check' };

  const homebaseProgramsDir = path.join(rootDir, '.claude/workstream/programs');
  const registryPath = path.join(homebaseProgramsDir, 'registry.yaml');
  if (!fs.existsSync(registryPath)) return { passed: false, detail: '.claude/workstream/programs/registry.yaml not found' };

  const { ok, data } = readYAMLFile(registryPath);
  if (!ok) return { passed: false, detail: '.claude/workstream/programs/registry.yaml could not be parsed' };

  const registeredIds = new Set(
    Array.isArray(data.programs) ? data.programs.filter(p => p && p.id).map(p => p.id) : []
  );

  const templateFiles = fs.readdirSync(templateDir)
    .filter(f => /^prog-[\w-]+\.yaml$/.test(f) && f !== 'prog-template.yaml');

  const violations = [];
  let checkedCount = 0;

  for (const templateFile of templateFiles) {
    const templatePath = path.join(templateDir, templateFile);
    const raw = fs.readFileSync(templatePath, 'utf8');
    // Tier-critical filter (narrow scope per WS-226 plan)
    if (!/^\s*tier:\s*["']?critical["']?/m.test(raw)) continue;
    // Escape hatch
    if (/^\s*skip_homebase_instantiation:\s*true/m.test(raw)) continue;

    // Extract program id from filename (prog-<id>.yaml)
    const idMatch = templateFile.match(/^prog-([\w-]+)\.yaml$/);
    if (!idMatch) continue;
    const programId = idMatch[1];
    checkedCount++;

    // Check 1: HomeBase has a corresponding instantiated program file
    const instantiatedPath = path.join(homebaseProgramsDir, templateFile);
    if (!fs.existsSync(instantiatedPath)) {
      violations.push(`${programId}: template ${templateFile} exists but .claude/workstream/programs/${templateFile} does not`);
      continue;
    }

    // Check 2: registry.yaml has an entry for this program with tier: critical
    if (!registeredIds.has(programId)) {
      violations.push(`${programId}: instantiated program file exists but registry.yaml has no entry`);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      detail: `${violations.length}/${checkedCount} critical-tier template(s) not instantiated in HomeBase: ${violations.slice(0, 3).join('; ')}${violations.length > 3 ? ` (+${violations.length - 3} more)` : ''}. Copy the template to .claude/workstream/programs/ + add entry to registry.yaml + run /pulse run <id> baseline.`,
    };
  }
  return {
    passed: true,
    detail: `${checkedCount} critical-tier template(s) all instantiated in HomeBase registry`,
  };
}

// INV-035: Every library engine MANIFEST's `extends:` value must resolve to a
// file in engines/base/. The bug caught here (FIND-070 / WS-141): three
// MANIFESTs used `extends: base/context-gather` where every other MANIFEST
// used `extends: context-gather`. The resolver reads base/ itself as a prefix
// and fails to find `engines/base/base/context-gather.md`, breaking /engine
// assembly for those engines. Easy to miss because failure mode was a silent
// assembly error at run time, not a validation error.
function checkManifestExtendsResolves(rootDir) {
  const libDir = path.join(rootDir, 'engines/library');
  if (!fs.existsSync(libDir)) {
    return { passed: true, detail: 'engines/library/ not present — nothing to check.' };
  }

  const engineDirs = fs.readdirSync(libDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => path.join(libDir, e.name));

  const violations = [];
  let checked = 0;

  for (const d of engineDirs) {
    const manifestPath = path.join(d, 'MANIFEST.yaml');
    if (!fs.existsSync(manifestPath)) continue;
    checked++;
    const raw = fs.readFileSync(manifestPath, 'utf8');
    // Parse line-by-line — YAML parser is overkill for a single field.
    for (const line of raw.split('\n')) {
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*extends:\s*([^\s#][^\s#]*)/);
      if (!m) continue;
      const val = m[1].replace(/^["']|["']$/g, '').trim();
      if (val === 'null' || val === '~' || val === '') continue;
      // Resolver contract: `extends: <name>` → engines/base/<name>.md
      const resolved = path.join(rootDir, 'engines/base', `${val}.md`);
      if (!fs.existsSync(resolved)) {
        violations.push(`${path.basename(d)}: extends: ${val} → ${path.relative(rootDir, resolved)} (missing)`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `${checked} library engine MANIFEST(s): all extends: values resolve.`
      : `${violations.length} MANIFEST(s) with unresolvable extends: ${violations.slice(0, 5).join('; ')}${violations.length > 5 ? ` (+${violations.length - 5} more)` : ''}`,
  };
}

// ─── INV-036: hook-race protection (FAIL-007 / WS-228) ─────────────────────
//
// Runs the hook-race fixture (kit/scripts/__tests__/hook-race.test.js) which
// spawns two child processes concurrently writing different fields into the
// same .hooks-liveness.yaml. With WS-228's withFileLock wrapping in place,
// both fields must survive every trial. Without it, the read-modify-write
// race clobbers one field on the first-write window.
//
// Multi-trial loop because the race window is narrow (only the first-write
// pair); a single trial catches the regression ~40% of the time, five trials
// >90%. INV-036 is the protection-side assertion: with the lock, all trials
// must preserve both fields. The falsification side (running --no-lock and
// observing the regression) is documented in invariants.md but not run by
// cwos-verify — that would intentionally produce non-deterministic failures.
//
// Spec divergence from WS-231 original: the fixture asserts field-preservation
// in .hooks-liveness.yaml, NOT events.jsonl drift. stampHookLiveness writes
// are intentionally not emitted to events (cwos-session-recovery.js:48-50),
// so the original "diff events.jsonl + cwos-replay" approach was based on a
// wrong premise. Field-clobber is the actual failure mode.

function checkHookRaceProtection(rootDir) {
  const fixturePath = path.join(rootDir, 'kit', 'scripts', '__tests__', 'hook-race.test.js');
  if (!fs.existsSync(fixturePath)) {
    return { passed: true, detail: 'hook-race fixture not present — INV-036 N/A (pre-WS-231)' };
  }

  let fixture;
  try { fixture = require(fixturePath); }
  catch (err) { return { passed: false, detail: `hook-race fixture failed to load: ${err.message}` }; }

  const TRIALS = 5;
  const WRITES_PER_ACTOR = 50;
  const startedAt = Date.now();
  const trialDurations = [];

  for (let i = 1; i <= TRIALS; i++) {
    let result;
    try {
      result = fixture.runRace({ withLock: true, writesPerActor: WRITES_PER_ACTOR });
    } catch (err) {
      return {
        passed: false,
        detail: `INV-036 trial ${i}/${TRIALS} threw: ${err.message}. Hook-race protection regression — investigate withFileLock wrapping in cwos-heartbeat.js + cwos-session-recovery.js (stampHookLiveness call sites).`,
      };
    }
    trialDurations.push(result.durationMs);
    if (!result.hasHeartbeat || !result.hasRecovery) {
      const missing = [];
      if (!result.hasHeartbeat) missing.push('last_heartbeat_hook_at');
      if (!result.hasRecovery) missing.push('last_session_recovery_hook_at');
      return {
        passed: false,
        detail: `INV-036 trial ${i}/${TRIALS} field-clobber detected: missing=[${missing.join(', ')}] after ${result.totalWrites} concurrent writes (sandbox=${result.sandbox}). WS-228 withFileLock wrapping is broken — concurrent stampHookLiveness is not serializing.`,
      };
    }
  }

  const totalMs = Date.now() - startedAt;
  const avgMs = Math.round(trialDurations.reduce((a, b) => a + b, 0) / TRIALS);
  return {
    passed: true,
    detail: `${TRIALS} trials × ${WRITES_PER_ACTOR * 2} concurrent writes — both fields preserved (avg ${avgMs}ms/trial, ${totalMs}ms total). withFileLock wrapping serializes stampHookLiveness as designed.`,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const strict = args.includes('--strict');
  const fix = args.includes('--fix');
  const fixHardlinks = args.includes('--fix-hardlinks');
  const force = args.includes('--force');
  const onlyIdx = args.indexOf('--only');
  const onlyId = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  const rootDir = resolveRepoRoot();

  // --fix-hardlinks runs the scanner in repair mode and returns early. Never
  // invoke implicitly — requires explicit flag. --force adds permission to
  // overwrite content-divergent targets.
  if (fixHardlinks) {
    const actions = fixBrokenHardlinks(rootDir, { force });
    console.log(`cwos-verify --fix-hardlinks:`);
    console.log(`  fixed:   ${actions.fixed.length} (${actions.fixed.join(', ') || 'none'})`);
    console.log(`  skipped: ${actions.skipped.length} ${actions.skipped.length ? '(need --force): ' + actions.skipped.join('; ') : ''}`);
    console.log(`  errors:  ${actions.errors.length} ${actions.errors.length ? actions.errors.join('; ') : ''}`);
    process.exit(actions.errors.length > 0 ? 1 : 0);
  }

  const checks = onlyId ? INVARIANT_CHECKS.filter(c => c.id === onlyId) : INVARIANT_CHECKS;
  if (checks.length === 0) {
    console.error(`No invariant matches "${onlyId}". Available: ${INVARIANT_CHECKS.map(c => c.id).join(', ')}`);
    process.exit(1);
  }

  const results = [];
  for (const inv of checks) {
    let result;
    try { result = inv.check(rootDir); }
    catch (e) { result = { passed: false, detail: `Check threw: ${e.message}` }; }
    results.push({ ...inv, ...result });
  }

  const failed = results.filter(r => !r.passed);

  if (!quiet || failed.length > 0) {
    console.log(`cwos-verify: ${results.length - failed.length}/${results.length} invariants passed`);
    for (const r of results) {
      const icon = r.passed ? 'PASS' : 'FAIL';
      console.log(`  [${icon}] ${r.id} — ${r.name}`);
      if (!r.passed || !quiet) console.log(`         ${r.detail}`);
    }
  }

  if (fix && failed.length === 0) {
    updateLastVerifiedDates(rootDir, results);
    if (!quiet) console.log(`Updated "Last Verified" date in invariants.md for ${results.length} passing checks`);
  }

  // WS-376: update per-INV consecutive-failure log. Only updates checks that
  // actually ran (--only narrows the set; we only mutate what we observed).
  try {
    updateInvariantFiringLog(rootDir, results);
  } catch (e) {
    // Non-fatal — firing log is observability, not gate-bearing
    if (!quiet) console.error(`firing-log update failed: ${e.message}`);
  }

  if (strict && failed.length > 0) process.exit(1);
}

// WS-376 / FIND-251: persistent firing log so consecutive-failure thresholds
// can drive cwos-migrate-watch.js escalations. Schema and atomicity follow the
// state-store pattern (read → mutate → writeFileAtomic).
function updateInvariantFiringLog(rootDir, results) {
  const wsDir = path.join(rootDir, '.claude', 'workstream');
  if (!fs.existsSync(wsDir)) return; // not a workstream-bearing repo
  const metaDir = path.join(wsDir, 'meta');
  if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
  const logPath = path.join(metaDir, 'invariant-firing-log.yaml');

  let data = { schema_version: 1, invariants: {} };
  if (fs.existsSync(logPath)) {
    const r = readYAMLFile(logPath);
    if (r.ok && r.data && r.data.invariants) data = r.data;
    if (!data.invariants) data.invariants = {};
  }

  const today = todayISO();
  for (const r of results) {
    const id = r.id;
    if (!id) continue;
    const prior = data.invariants[id] || {
      consecutive_failures: 0,
      first_failed_at: null,
      last_failed_at: null,
      last_status: null,
      threshold: 5,
      migration_ws_id: null,
    };
    if (r.passed) {
      // Reset counter on PASS. Preserve migration_ws_id if already escalated.
      data.invariants[id] = {
        ...prior,
        consecutive_failures: 0,
        last_status: 'PASS',
        last_failed_at: prior.last_failed_at,
      };
    } else {
      const newCount = (prior.consecutive_failures || 0) + 1;
      data.invariants[id] = {
        ...prior,
        consecutive_failures: newCount,
        first_failed_at: prior.first_failed_at || today,
        last_failed_at: today,
        last_status: 'FAIL',
      };
    }
  }

  const yaml = serializeFiringLog(data);
  fs.writeFileSync(logPath, yaml, 'utf8');
}

function serializeFiringLog(data) {
  const out = [`schema_version: ${data.schema_version || 1}`, 'invariants:'];
  const ids = Object.keys(data.invariants || {}).sort();
  for (const id of ids) {
    const e = data.invariants[id];
    out.push(`  ${id}:`);
    out.push(`    consecutive_failures: ${e.consecutive_failures || 0}`);
    out.push(`    first_failed_at: ${e.first_failed_at ? `"${e.first_failed_at}"` : 'null'}`);
    out.push(`    last_failed_at: ${e.last_failed_at ? `"${e.last_failed_at}"` : 'null'}`);
    out.push(`    last_status: ${e.last_status ? `"${e.last_status}"` : 'null'}`);
    out.push(`    threshold: ${e.threshold || 5}`);
    out.push(`    migration_ws_id: ${e.migration_ws_id ? `"${e.migration_ws_id}"` : 'null'}`);
  }
  return out.join('\n') + '\n';
}

function updateLastVerifiedDates(rootDir, results) {
  const invPath = path.join(rootDir, 'system/invariants.md');
  if (!fs.existsSync(invPath)) return;
  let content = fs.readFileSync(invPath, 'utf8');
  const today = todayISO();
  for (const r of results) {
    if (!r.passed) continue;
    // Find the section for this invariant and update its Last Verified date
    const sectionRegex = new RegExp(
      `(### ${r.id}:[\\s\\S]*?\\*\\*Last Verified:\\*\\*\\s*)\\d{4}-\\d{2}-\\d{2}`,
      'g'
    );
    content = content.replace(sectionRegex, `$1${today}`);
  }
  fs.writeFileSync(invPath, content, 'utf8');
  emitEvent('T11:vital-signs', 'invariants-stamped', {
    path: path.relative(process.cwd(), invPath).replace(/\\/g, '/'),
    stamped_count: results.filter((r) => r.passed).length,
  });
}

// INV-037: Sprint anchor distribution bound. Counts anchors of completed
// sprints in the last 90 days by program category. Fails if internal-infra
// programs anchor more than 70% — the threshold above which CWOS is
// optimizing CWOS instead of serving the fleet (FAIL-009 / Failed State #10).
//
// Scope rules (must stay in sync with /next Step 3a-rotation):
//   - fleet/repo-goal: anchor's program is fleet-health, OR files_involved
//     touches fleet/, kit/MANIFEST.yaml, engines/INDEX.md, or
//     kit/templates/workstream/engines/registry.yaml.
//   - internal-infra: every other program.
//
// Override path: a sprint can carry override_class: "internal-investment-phase"
// in its YAML to be excluded from the rolling window (with rationale recorded
// in override_reason). The override is the founder's escape valve for
// legitimate periods of pure kit work.
//
// Source: FAIL-009 + FAIL-011 / WS-230 / premortem-2026-04-25 (Compound A).
function checkAnchorDistribution(rootDir) {
  const sprintsDir = path.join(rootDir, '.claude/workstream/sprints');
  if (!fs.existsSync(sprintsDir)) return { passed: true, detail: 'sprints/ not found — nothing to check' };

  const queueDir = path.join(rootDir, '.claude/workstream/queue');
  const archiveDir = path.join(queueDir, 'archive');

  // Window: 90 days, ending today.
  const today = new Date(todayISO() + 'T00:00:00Z');
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - 90);

  // Collect sprint files (active + archive)
  const sprintFiles = [
    ...globFiles(sprintsDir, 'SPR-*.yaml'),
    ...(fs.existsSync(path.join(sprintsDir, 'archive'))
      ? globFiles(path.join(sprintsDir, 'archive'), 'SPR-*.yaml')
      : []),
  ];

  const FLEET_PROGRAMS = new Set(['fleet-health']);
  const FLEET_FILE_PATTERNS = [
    /^fleet\//,
    /^kit\/MANIFEST\.yaml$/,
    /^engines\/INDEX\.md$/,
    /^kit\/templates\/workstream\/engines\/registry\.yaml$/,
  ];

  function classifyAnchor(anchorItemFile) {
    if (!fs.existsSync(anchorItemFile)) return null;
    const r = readYAMLFile(anchorItemFile);
    if (!r.ok) return null;
    const program = r.data.program;
    if (program && FLEET_PROGRAMS.has(program)) return 'fleet';
    const files = Array.isArray(r.data.files_involved) ? r.data.files_involved : [];
    for (const f of files) {
      const norm = String(f).replace(/\\/g, '/').replace(/\s.*$/, '').trim();
      for (const pat of FLEET_FILE_PATTERNS) {
        if (pat.test(norm)) return 'fleet';
      }
    }
    return 'internal';
  }

  let fleet = 0;
  let internal = 0;
  let overrides = 0;
  let inWindow = 0;
  const sampleAnchors = []; // for detail output

  for (const sf of sprintFiles) {
    const r = readYAMLFile(sf);
    if (!r.ok) continue;
    const data = r.data;
    if (data.status !== 'completed') continue;

    // Window cutoff: prefer completed_at, fall back to approved_at, then created_at.
    const dateStr = data.completed_at || data.approved_at || data.created_at;
    if (!dateStr) continue;
    const dateOnly = String(dateStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) continue;
    const sprintDate = new Date(dateOnly + 'T00:00:00Z');
    if (sprintDate < windowStart || sprintDate > today) continue;
    inWindow++;

    // Override path: legitimate-internal-investment phase
    if (data.override_class === 'internal-investment-phase') {
      overrides++;
      continue;
    }

    if (!Array.isArray(data.items) || data.items.length === 0) continue;
    const anchorId = data.items[0].id;
    if (!anchorId) continue;

    const queueFile = fs.existsSync(path.join(queueDir, `${anchorId}.yaml`))
      ? path.join(queueDir, `${anchorId}.yaml`)
      : path.join(archiveDir, `${anchorId}.yaml`);

    const cls = classifyAnchor(queueFile);
    if (cls === 'fleet') fleet++;
    else if (cls === 'internal') internal++;
    else continue; // unclassifiable — don't count
    sampleAnchors.push({ sprint: data.id, anchor: anchorId, cls });
  }

  const counted = fleet + internal;
  if (counted === 0) {
    return {
      passed: true,
      detail: `No completed sprints with classifiable anchors in last 90 days (${inWindow} in window, ${overrides} overrides) — nothing to check`,
    };
  }

  const internalPct = internal / counted;
  const THRESHOLD = 0.70;
  if (internalPct > THRESHOLD) {
    return {
      passed: false,
      detail: `Internal-infra anchored ${internal}/${counted} (${(internalPct * 100).toFixed(0)}%) of last 90d sprints — exceeds ${(THRESHOLD * 100).toFixed(0)}% bound. CWOS is optimizing itself faster than it's serving the fleet. Run /next will surface fleet-rotation suggestions; or set override_class: internal-investment-phase on sprints if intentional.`,
    };
  }
  return {
    passed: true,
    detail: `Internal-infra anchored ${internal}/${counted} (${(internalPct * 100).toFixed(0)}%); fleet anchored ${fleet}/${counted} (${(fleet / counted * 100).toFixed(0)}%) — within ${(THRESHOLD * 100).toFixed(0)}% bound (${overrides} sprint(s) excluded via override_class)`,
  };
}

// ─── INV-041: capability_brief schema (FAIL-016 / WS-166) ──────────────────
// Every product program (not monitor_only) ships a capability_brief block
// conforming to the schema in prog-template.yaml. This closes the "no silent
// install" loop (feedback_no_silent_install_no_user_invention; ADR-028) at
// the schema layer — programs cannot be added without a founder-facing brief.
function checkCapabilityBriefSchema(rootDir) {
  const validatorPath = path.join(rootDir, 'kit', 'scripts', 'cwos-program-schema-validate.js');
  if (!fs.existsSync(validatorPath)) {
    return { passed: true, detail: 'cwos-program-schema-validate.js not present — INV-041 N/A (pre-WS-166)' };
  }
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync('node', [validatorPath, '--quiet'], { cwd: rootDir, encoding: 'utf8' });
    const result = JSON.parse(out);
    if (result.ok) {
      return { passed: true, detail: `${result.programs_checked} product program(s) all ship valid capability_brief (${result.programs_skipped} skipped: monitor_only or template)` };
    }
    const sample = result.failures.slice(0, 3).map(f => `${f.program}: ${f.errors[0]}`).join('; ');
    return {
      passed: false,
      detail: `${result.failures.length} program(s) failed capability_brief schema: ${sample}${result.failures.length > 3 ? ` (+${result.failures.length - 3} more)` : ''}. Run \`node kit/scripts/cwos-program-schema-validate.js\` for full output.`,
    };
  } catch (err) {
    return { passed: false, detail: `capability_brief validator threw: ${err.message}. INV-041 cannot run.` };
  }
}

// ─── INV-043: CLI-bypass-via-command (FIND-119 / WS-276) ───────────────────
//
// FIND-119 (filed 2026-05-01 during WS-259 audit) measured AI bypassing the
// command envelope: across 10 days of event log, all 10 audited procedural
// commands had 0 invocations while /next had 26. The AI was reading
// prog-*.yaml directly instead of invoking /pulse, etc., defeating ADR-037's
// projected token savings.
//
// This INV reads envelope state — populated by command_started/command_completed
// events — and surfaces sustained bypass: ≥3 of the audited commands at zero
// invocations across a 30-day window AND total envelope traffic ≥ 20 events
// (so we don't flag a quiet repo). The mechanism is observability — no hard
// binding here. Mechanism 3 (env-var on script entry points) is documented
// as the escalation path in ADR-037 if this signal stays red.
//
// Replay-pure: derives entirely from envelope state, which is reducer-built
// from the event log per ADR-018/ADR-020.
function checkCliBypassViaCommand(rootDir) {
  const wsDir = path.join(rootDir, '.claude', 'workstream');
  if (!fs.existsSync(wsDir)) {
    return { passed: true, detail: 'no .claude/workstream — INV-043 N/A' };
  }

  let store;
  try {
    const ss = require('./core/state-store');
    store = ss.loadState(wsDir);
  } catch (err) {
    return { passed: true, detail: `state-store unavailable (pre-step-2 repo): ${err.message}. INV-043 N/A` };
  }

  const items = store.envelope.all();
  if (!Array.isArray(items)) {
    return { passed: true, detail: 'envelope items not iterable — INV-043 N/A' };
  }

  // Window: last 30 days from "today". Use the most recent completed_at as
  // the clock anchor so the check is replay-stable (Date.now() would not be).
  const completedAts = items
    .map((it) => it && it.completed_at)
    .filter((s) => typeof s === 'string' && s.length > 0)
    .sort();
  if (completedAts.length === 0) {
    return { passed: true, detail: 'no completed envelope events — INV-043 deferred (no traffic to audit)' };
  }
  const latest = new Date(completedAts[completedAts.length - 1]);
  const windowStart = new Date(latest.getTime() - 30 * 24 * 60 * 60 * 1000);

  const inWindow = items.filter((it) => {
    if (!it || !it.completed_at) return false;
    const t = new Date(it.completed_at);
    return !isNaN(t.getTime()) && t >= windowStart;
  });

  // Sparse-data guard: don't flag if traffic is too low to be meaningful.
  if (inWindow.length < 20) {
    return {
      passed: true,
      detail: `only ${inWindow.length} envelope events in 30-day window (threshold: 20) — INV-043 deferred until more traffic accumulates`,
    };
  }

  // Audited watchlist: commands whose existence was the basis of FIND-119.
  // The 5 "load-bearing-must-fire" set is what triggers the finding.
  const REQUIRED = ['/pulse', '/audit', '/verify', '/workstream', '/decide'];
  const counts = Object.create(null);
  for (const tag of REQUIRED) counts[tag] = 0;
  for (const it of inWindow) {
    if (it && typeof it.tag === 'string' && counts[it.tag] !== undefined) counts[it.tag]++;
  }
  const zeros = REQUIRED.filter((tag) => counts[tag] === 0);

  // Trigger: ≥3 of the 5 required commands at zero invocations.
  if (zeros.length >= 3) {
    const summary = REQUIRED.map((t) => `${t}=${counts[t]}`).join(', ');
    return {
      passed: false,
      detail: `command-envelope bypass: ${zeros.length}/5 required commands at zero invocations across 30-day window (${inWindow.length} total events). Counts: ${summary}. Route a finding to prog-self-compliance — Mechanism 3 (hard env-var binding) escalation criterion: this remaining red after 30 more days.`,
    };
  }

  return {
    passed: true,
    detail: `command envelope holding: ${zeros.length}/5 required commands at zero invocations (threshold: 3). Window: ${inWindow.length} events.`,
  };
}

// ─── INV-cli-envelope-consumed-completely (WS-271) ────────────────────────

/**
 * Reads tool_rounds_by_type.Read from recent /next envelope items and
 * flags any invocation exceeding the per-invocation Read threshold
 * (default 5; tunable via .cwos-config.yaml read_restraint.per_invocation_max).
 *
 * Founder-acknowledged invocations (via /next gate --override-read-restraint
 * "<rationale>") are skipped. The acknowledgment event carries the next
 * /next's command_id_anticipated, OR a generic "next-N-invocations" scope.
 * For simplicity v1: acknowledgment skips ALL violations within a 1-hour
 * window after the ack event.
 *
 * Per AS-037-1, fleet-rollout success = median /next Read count ≤ 3 over
 * 5 invocations. This INV catches per-invocation excess (> 5) on the
 * spot — the median test runs separately as a follow-up after enough
 * data accumulates.
 *
 * Source: ADR-037 Top Risk #1 + Decision #4 + AS-037-1 / WS-271 / SPR-108.
 */

/**
 * INV-045 — Shell-safe pattern (ADR-043 / WS-306).
 *
 * Scans every .js file under kit/scripts/ (excluding __tests__/ and
 * lib/shell-safe.js itself) for unsafe `execSync` call-sites:
 *   1. execSync called with a template literal whose body contains ${...}
 *      interpolation (string interpolation reaches the shell).
 *   2. child_process.exec called in callback form (also unsafe; runs
 *      through a shell).
 *
 * Any hit is a violation. Migrate the call to kit/scripts/lib/shell-safe.js.
 */
function checkShellSafePattern(rootDir) {
  const scriptsDir = path.join(rootDir, 'kit', 'scripts');
  if (!fs.existsSync(scriptsDir)) {
    return { passed: true, detail: 'no kit/scripts/ — INV-045 N/A' };
  }
  const violations = [];
  const skipPaths = [
    path.join('kit', 'scripts', '__tests__'),
    path.join('kit', 'scripts', 'lib', 'shell-safe.js'),
  ];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(rootDir, full);
      if (skipPaths.some(s => rel.startsWith(s))) continue;
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.js')) {
        const text = fs.readFileSync(full, 'utf8');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Lines may opt out via an inline `shell-safe-skip` comment when
          // the line is the validator's own regex or a documented exception.
          if (/shell-safe-skip/.test(line)) continue;
          // Match unsafe template-literal interpolation in execSync call-sites. // shell-safe-skip
          if (/execSync\s*\(\s*`[^`]*\$\{/.test(line)) { // shell-safe-skip
            violations.push(`${rel}:${i + 1}: execSync with template-literal interpolation`);
          }
          // Match exec(...) callback form (not execSync) — common alias. // shell-safe-skip
          if (/[^a-zA-Z]exec\s*\(\s*`[^`]*\$\{/.test(line)) { // shell-safe-skip
            violations.push(`${rel}:${i + 1}: child_process.exec with template-literal interpolation`);
          }
        }
      }
    }
  }
  walk(scriptsDir);
  if (violations.length === 0) {
    return { passed: true, detail: 'No unsafe execSync interpolation under kit/scripts/' };
  }
  return {
    passed: false,
    detail: `${violations.length} unsafe shell-out site(s) — migrate to kit/scripts/lib/shell-safe.js (ADR-043):\n  ${violations.slice(0, 10).join('\n  ')}${violations.length > 10 ? `\n  ... +${violations.length - 10} more` : ''}`,
  };
}

function checkReadRestraint(rootDir) {
  const wsDir = path.join(rootDir, '.claude', 'workstream');
  if (!fs.existsSync(wsDir)) {
    return { passed: true, detail: 'no .claude/workstream — INV-cli-envelope-consumed-completely N/A' };
  }

  // Threshold tuning
  const configPath = path.join(rootDir, '.cwos-config.yaml');
  let max = 5;
  try {
    if (fs.existsSync(configPath)) {
      const { readYAMLFile } = require('./lib/cwos-utils');
      const r = readYAMLFile(configPath);
      if (r.ok && r.data && r.data.read_restraint && typeof r.data.read_restraint.per_invocation_max === 'number') {
        max = r.data.read_restraint.per_invocation_max;
      }
    }
  } catch { /* fall through to default */ }

  let store;
  try {
    const ss = require('./core/state-store');
    store = ss.loadState(wsDir);
  } catch (err) {
    return { passed: true, detail: `state-store unavailable (pre-step-2 repo): ${err.message}. INV N/A` };
  }

  const items = store.envelope.all();
  if (!Array.isArray(items)) {
    return { passed: true, detail: 'envelope items not iterable — INV N/A' };
  }

  // Filter for /next invocations with tool_rounds_by_type populated.
  // WS-271 telemetry extension is brand-new — pre-existing invocations
  // have no tool_rounds_by_type field. Skip them silently.
  const nextRuns = items.filter((it) =>
    it && it.tag === '/next' &&
    it.tool_rounds_by_type && typeof it.tool_rounds_by_type === 'object' &&
    it.completed_at
  );

  if (nextRuns.length === 0) {
    return { passed: true, detail: `no /next invocations with tool_rounds_by_type telemetry yet — INV deferred until WS-271 telemetry coverage accumulates` };
  }

  // Acknowledgments: load all read_restraint_acknowledged events and treat
  // any /next invocation that completed within 1 hour AFTER an ack as
  // exempt. v1 keeps the matching loose; tightening per-command_id is a
  // follow-up.
  const ACK_WINDOW_MS = 60 * 60 * 1000;
  let allEvents = [];
  try {
    const eventsMod = require('./core/events');
    const r = eventsMod.readAllChunks(wsDir);
    allEvents = r.events || [];
  } catch { /* event log unreadable — proceed with empty acks */ }
  const ackTimestamps = allEvents
    .filter((ev) => ev && ev.payload && ev.payload.type === 'read_restraint_acknowledged')
    .map((ev) => ev.timestamp)
    .filter((t) => typeof t === 'string')
    .map((t) => new Date(t).getTime())
    .filter((t) => !isNaN(t));

  function isAcknowledged(item) {
    const t = new Date(item.completed_at).getTime();
    if (isNaN(t)) return false;
    return ackTimestamps.some((ackT) => t >= ackT && t - ackT <= ACK_WINDOW_MS);
  }

  const violations = [];
  for (const inv of nextRuns) {
    if (isAcknowledged(inv)) continue;
    const reads = (inv.tool_rounds_by_type && typeof inv.tool_rounds_by_type.Read === 'number') ? inv.tool_rounds_by_type.Read : 0;
    if (reads > max) {
      violations.push({ command_id: inv.command_id, reads, completed_at: inv.completed_at });
    }
  }

  if (violations.length === 0) {
    return {
      passed: true,
      detail: `clean — last ${nextRuns.length} /next invocation(s) with telemetry all ≤ ${max} Reads`,
    };
  }

  const summary = violations.slice(0, 3).map((v) => `${v.command_id}=${v.reads}`).join(', ');
  return {
    passed: false,
    detail: `${violations.length} /next invocation(s) exceeded ${max} Read tool calls (per-invocation threshold). Examples: ${summary}. Findings should be routed to prog-kit-quality with dedup_key read-restraint-<command_id>. Founder may acknowledge legitimate re-reads via /next gate --override-read-restraint "<rationale ≥20 chars>".`,
  };
}

// ─── INV-046: Persona-dispatch runtime audit (WS-316 / ADR-044) ─────────────
//
// Lagging-indicator that catches dispatch regressions by reading production
// manifests. Pass when no engine reports FAIL — WARN (no production runs yet)
// and STALE (pre-anchor evidence) do not block. The remedy for STALE is to
// re-run the affected engine; the remedy for WARN is to run the engine for
// the first time. /verify only fails on real FAILs.

let _runtimeDispatchAudit = null;
try { _runtimeDispatchAudit = require('./cwos-runtime-dispatch-audit'); } catch { /* optional */ }

function checkPersonaDispatch(rootDir) {
  if (!_runtimeDispatchAudit) {
    return { passed: true, detail: 'cwos-runtime-dispatch-audit.js not present (WS-316 not adopted) — skipping' };
  }
  let wsDir;
  try { wsDir = findWorkstreamDir(rootDir); }
  catch { return { passed: true, detail: '.claude/workstream/ not found — skipping' }; }

  const result = _runtimeDispatchAudit.audit({
    wsDir,
    engines: _runtimeDispatchAudit.DEFAULT_TRACKED_ENGINES,
    minBytes: _runtimeDispatchAudit.DEFAULT_MIN_BYTES,
    anchor: _runtimeDispatchAudit.ADR_044_ANCHOR,
  });

  const summary = `${result.pass} PASS, ${result.warn} WARN, ${result.stale || 0} STALE, ${result.fail} FAIL across ${result.tracked_engines.length} tracked engine(s)`;

  if (result.fail === 0) {
    const stalePart = (result.stale || 0) > 0
      ? ` (${result.stale} stale — re-run the engine to verify post-ADR-044 dispatch)`
      : '';
    return { passed: true, detail: `${summary}${stalePart}` };
  }

  const failingEngines = result.results
    .filter(r => r.status === 'FAIL')
    .map(r => `${r.engine} (${r.most_recent_run}): ${r.failures.slice(0, 2).join('; ')}`)
    .slice(0, 3)
    .join(' | ');
  return {
    passed: false,
    detail: `${summary}. Failing engines: ${failingEngines}. Re-run via /engine <engine> on a tiny target to refresh dispatch evidence; or inspect: node kit/scripts/cwos-runtime-dispatch-audit.js`,
  };
}

// INV-readpath-determinism (WS-391): AI must not be invoked for pure read-path
// work; a parse-and-compare phase ships as a script. Detector is heuristic, so
// this is ADVISORY (always passes) — it surfaces the conversion backlog as a
// visible count rather than hard-failing. Route to prog-token-economy. The
// remedy is to convert the flagged section to a cwos-* script or annotate it
// `<!-- readpath-ok: <reason> -->`.
let _readpathLint = null;
try { _readpathLint = require('./cwos-readpath-lint'); } catch { /* optional */ }

function checkReadPathDeterminism(rootDir) {
  if (!_readpathLint) {
    return { passed: true, detail: 'cwos-readpath-lint.js not present (WS-391 not adopted) — skipping' };
  }
  let result;
  try { result = _readpathLint.lint({ root: rootDir }); }
  catch (e) { return { passed: true, detail: `readpath-lint not runnable: ${e.message} — advisory skipped` }; }

  if (result.count === 0) {
    return { passed: true, detail: 'no un-scripted mechanical read-path engine sections' };
  }
  const top = result.candidates.slice(0, 3)
    .map(c => `${c.engine}:${c.line} [${c.triggers.join('/')}]`)
    .join(' | ');
  return {
    passed: true, // ADVISORY — never blocks
    detail: `ADVISORY: ${result.count} engine section(s) still do mechanical read-work without a script (convert to cwos-* or annotate readpath-ok). e.g. ${top}`,
  };
}

// ─── INV-047: Program YAML schema (FIND-128 / WS-295) ─────────────────────
//
// Detects duplicate top-level keys in `.claude/workstream/programs/prog-*.yaml`
// and `kit/templates/workstream/programs/prog-*.yaml`. The CWOS YAML parser
// (and most YAML parsers) silently picks the last value when duplicate keys
// appear at the same level, hiding the corruption. FIND-128 surfaced 22 days
// after a prog-engine-reliability.yaml hand-edit produced three duplicated
// `health_breakdown` blocks with conflicting values — the file parsed fine,
// /pulse rendered the last block, the conflict was invisible.
//
// Scope: top-level (column-0) keys only. Nested-block duplicate detection
// requires AST-level YAML parsing that the CWOS parser doesn't expose; the
// FIND-128 failure mode was top-level, and that's what this check guards.
function checkProgramYamlSchema(rootDir) {
  const scanDirs = [
    path.join(rootDir, '.claude/workstream/programs'),
    path.join(rootDir, 'kit/templates/workstream/programs'),
  ].filter(d => fs.existsSync(d));

  const violations = [];

  function scanFile(filePath) {
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');

    // Layer 1 — top-level scan via regex. Catches the FIND-128 sibling case
    // where a hand-edit appends a second `health_breakdown:` block at column 0.
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }
    const lines = content.split('\n');
    const seen = new Map(); // key -> array of line numbers (1-indexed)
    const KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*):\s*(?:#.*)?$|^([A-Za-z_][A-Za-z0-9_]*):\s+\S/;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^\s*(?:#|$)/.test(line)) continue;
      if (/^[ \t]/.test(line)) continue;
      const m = line.match(KEY_RE);
      if (!m) continue;
      const key = m[1] || m[2];
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(i + 1);
    }
    for (const [key, lineNums] of seen) {
      if (lineNums.length > 1) {
        violations.push(`${rel}: duplicate top-level key '${key}' at lines ${lineNums.join(', ')}`);
      }
    }

    // Layer 2 — nested-block scan via parser warnings. The actual FIND-128
    // failure was three duplicated sub-blocks INSIDE `health_breakdown:`. Each
    // duplicated nested key (e.g. `finding_health` appearing twice under
    // `health_breakdown`) shows up as a `duplicate_key:<name>` warning emitted
    // by parseMapping (WS-295 parser change). Layer 1 misses these because
    // they are indented; Layer 2 catches them.
    const parsed = readYAMLFile(filePath);
    if (parsed.warnings && parsed.warnings.length > 0) {
      for (const w of parsed.warnings) {
        if (typeof w.reason === 'string' && w.reason.startsWith('duplicate_key:')) {
          violations.push(`${rel}: ${w.reason} at line ${w.line}`);
        }
      }
    }
  }

  for (const dir of scanDirs) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const e of entries) {
      if (!/^prog-.+\.ya?ml$/.test(e)) continue;
      scanFile(path.join(dir, e));
    }
  }

  return {
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `All program YAMLs have unique top-level keys`
      : `${violations.length} violation(s): ${violations.slice(0, 3).join('; ')}${violations.length > 3 ? '; ...' : ''}`,
  };
}

if (require.main === module) {
  main();
}

module.exports = { checkCliBypassViaCommand, checkReadRestraint, checkPersonaDispatch, checkProgramYamlSchema, checkAdopterValueRelation, checkCommandManifestCoverage, checkAdoptInstallAtomicWrites, checkDistributionRefs, checkNoHardcodedEvolutionPaths };
