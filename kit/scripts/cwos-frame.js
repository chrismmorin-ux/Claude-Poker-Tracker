#!/usr/bin/env node
/**
 * cwos-frame — Engine Intent Contract pre-flight (WS-277, ADR-038 Layer 3).
 *
 * Resolves mode/readiness/success_shape/scope_ceiling/stretch BEFORE any
 * specialized engine burns tokens. Confidence-scored smart defaults reduce
 * the typical pre-flight to a one-screen confirm; only fields below the
 * confidence threshold trigger targeted prompts.
 *
 * Exactly 2 subcommands per ADR-037 Decision #3 (well under 5-cap):
 *   compose — read engine + target + recent events + readiness signals;
 *             produce JSON {contract, confidences, prompts_needed}.
 *             No event emitted (compose is read-only scratch state per
 *             ADR-038 Decision #7).
 *   confirm — take a (possibly-edited) compose-output JSON, validate
 *             schema, emit `engine_intent_recorded` event with revisions
 *             array per ALTERATION-5 two-field provenance.
 *
 * Escape valves and abandonment ride upstream (in /engine dispatch):
 *   --just-run on /engine emits engine_intent_bypassed silently
 *   founder cancel before confirm emits engine_intent_abandoned
 *
 * Replay-pure: pass --clock <iso> for tests; events-only mutations (no
 * filesystem state writes).
 *
 * Usage:
 *   cwos-frame compose --engine <id> --target <ref> [--clock <iso>] [--no-emit]
 *   cwos-frame confirm --contract-file <path> [--clock <iso>] [--ai-autonomous] [--no-emit]
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findWorkstreamDir, readYAMLFile, parseYAML, todayISO, loadEventDeps } = require('./lib/cwos-utils');
const deferTranslators = require('./core/defer-translators');

const { appendEvent, ensureCommandId } = loadEventDeps();

// WS-277: pull pure-function helpers from existing CLIs (extracted in this WS).
let isSessionHealthy = () => ({ healthy: true, stale_session_ids: [], reason: null });
try {
  process.env.CWOS_SESSION_RECOVERY_NORUN = '1';
  ({ isSessionHealthy } = require('./cwos-session-recovery'));
} catch { /* fallback to no-op */ }

let computeStaleness = () => ({ violations: [] });
try {
  process.env.CWOS_STALENESS_NORUN = '1';
  ({ computeStaleness } = require('./cwos-staleness'));
} catch { /* fallback */ }

// ─── Constants + defaults (per ADR-038 + WS-277 decision_flags) ────────────

const VALID_MODES = ['decide', 'build-best', 'mockup', 'explore'];
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_STALENESS_WINDOW = 50; // unused for now; reserved for context inference
const DEFAULT_SCOPE_CEILING = 'token:80k';
const DEFAULT_READINESS_REGISTRY = path.join(__dirname, 'core', 'engine-readiness-registry.yaml');

// ─── Helpers ───────────────────────────────────────────────────────────────

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function repoRoot() {
  const ws = findWorkstreamDir(process.cwd());
  return path.resolve(ws, '..', '..');
}

function loadFrameConfig() {
  // Read .cwos-config.yaml frame.* settings; fall back to per-WS defaults.
  const defaults = {
    confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
    default_staleness_window: DEFAULT_STALENESS_WINDOW,
    engine_readiness_rules: DEFAULT_READINESS_REGISTRY,
    default_scope_ceiling: DEFAULT_SCOPE_CEILING,
  };
  try {
    const p = path.join(repoRoot(), '.cwos-config.yaml');
    if (!fs.existsSync(p)) return defaults;
    const r = readYAMLFile(p);
    if (!r.ok || !r.data || !r.data.frame) return defaults;
    const f = r.data.frame;
    return {
      confidence_threshold: typeof f.confidence_threshold === 'number' ? f.confidence_threshold : defaults.confidence_threshold,
      default_staleness_window: typeof f.default_staleness_window === 'number' ? f.default_staleness_window : defaults.default_staleness_window,
      engine_readiness_rules: typeof f.engine_readiness_rules === 'string' ? path.resolve(repoRoot(), f.engine_readiness_rules) : defaults.engine_readiness_rules,
      default_scope_ceiling: typeof f.default_scope_ceiling === 'string' ? f.default_scope_ceiling : defaults.default_scope_ceiling,
    };
  } catch { return defaults; }
}

function loadReadinessRegistry(p) {
  if (!fs.existsSync(p)) return {};
  const r = readYAMLFile(p);
  if (!r.ok || !r.data) return {};
  return r.data;
}

// ─── Smart-default inference (pure functions, exported for tests) ──────────

/**
 * Read an engine's YAML frontmatter and return the PARSED object.
 * Tolerates CRLF (Windows) and LF. Returns null if no engine MD found / no
 * frontmatter / parse failure. WS-296 swapped this from raw-text return to
 * parsed-object return so list fields (e.g. `failed_states_seed:`) work via
 * cwos-utils.parseYAML rather than line-regex.
 */
function readEngineFrontmatter(engineName, repoPath) {
  if (!engineName || !repoPath) return null;
  const candidates = [
    path.join(repoPath, 'engines', 'standard', `${engineName}.md`),
    path.join(repoPath, 'engines', 'library', engineName, 'SKILL.md'),
  ];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    const text = fs.readFileSync(c, 'utf8');
    const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;
    try {
      return parseYAML(fmMatch[1]);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Mode inference: engine MD frontmatter `default_mode:` (authoritative, WS-278)
 * else fall back to engine name pattern matching.
 *   *-audit            → decide      (audit engines compare options)
 *   *-mockup, sketch   → mockup
 *   *-engine, build-*  → build-best
 *   *-enhance, explore → explore
 *   otherwise          → explore (defensive default)
 *
 * @param {string} engineName
 * @param {string} [repoPath] — when provided, frontmatter is consulted first.
 */
function inferMode(engineName, repoPath) {
  if (!engineName || typeof engineName !== 'string') return { value: 'explore', confidence: 0.3 };

  const fm = readEngineFrontmatter(engineName, repoPath);
  if (fm && typeof fm.default_mode === 'string') {
    const declared = fm.default_mode.trim();
    if (VALID_MODES.includes(declared)) return { value: declared, confidence: 0.9 };
    // invalid value → fall through to name-pattern (defensive; do not throw)
  }

  const n = engineName.toLowerCase();
  if (n.endsWith('-audit') || n.endsWith('audit')) return { value: 'decide', confidence: 0.85 };
  if (n.includes('mockup') || n.includes('sketch')) return { value: 'mockup', confidence: 0.85 };
  if (n === 'eng-engine' || n.startsWith('build-') || n.endsWith('-engine')) return { value: 'build-best', confidence: 0.8 };
  if (n.endsWith('-enhance') || n.includes('explore')) return { value: 'explore', confidence: 0.8 };
  return { value: 'explore', confidence: 0.4 }; // fallback — low confidence, will surface a prompt
}

/**
 * Readiness inference: combines staleness + session-health + per-engine rules.
 * Returns { value: 'ready'|'defer', reason: string|null, reasons: [], confidence: number }.
 *
 * `reason` is the back-compat single-string field consumed by the
 * `engine_intent_recorded` event schema (readiness_reason: string|null).
 * `reasons` is the structured array consumed by defer-translators to build
 * the founder-facing readiness_human block (FIND-127 / WS-291). Each entry:
 *   { type: 'staleness'|'session'|'engine-rule', machine_text, detail }
 */
function inferReadiness({ engineName, target, wsDir, registry, today, now }) {
  const reasons = [];
  // Staleness check
  try {
    const stale = computeStaleness(wsDir, { today });
    if (stale.violations && stale.violations.length > 0) {
      const v = stale.violations[0];
      reasons.push({
        type: 'staleness',
        machine_text: v.message,
        detail: {
          file: v.file,
          type: v.type,
          days_since: v.days_since,
          max_days: v.max_days,
          message: v.message,
        },
      });
    }
  } catch { /* non-fatal */ }
  // Session health check
  try {
    const sh = isSessionHealthy(wsDir, { now });
    if (!sh.healthy) {
      reasons.push({
        type: 'session',
        machine_text: sh.reason,
        detail: { stale_session_ids: sh.stale_session_ids || [], message: sh.reason },
      });
    }
  } catch { /* non-fatal */ }
  // Engine-specific readiness rules
  const rules = (registry && registry[engineName]) || [];
  for (const rule of rules) {
    const r = evaluateReadinessRule(rule, { engineName, target, wsDir });
    if (!r.ok) {
      reasons.push({
        type: 'engine-rule',
        machine_text: r.reason,
        detail: {
          engine: engineName,
          rule_check: rule.check,
          rule_program: rule.program,
          rule_path: rule.path,
          rule_glob: rule.glob,
          rule_min: rule.min,
          reason: r.reason,
        },
      });
    }
  }
  if (reasons.length === 0) {
    return { value: 'ready', reason: null, reasons: [], confidence: 0.9 };
  }
  // Back-compat: build the joined-string reason for the event schema.
  const joined = reasons.map((r) => `${r.type}: ${r.machine_text}`).join(' | ');
  return { value: 'defer', reason: joined, reasons, confidence: 0.7 };
}

function evaluateReadinessRule(rule, { engineName, target, wsDir }) {
  if (!rule || typeof rule !== 'object') return { ok: true };
  const reason = rule.reason || `${engineName}: readiness rule failed`;
  if (rule.check === 'baseline_run') {
    const program = rule.program || target;
    const evidenceDir = path.join(wsDir, 'evidence', String(program));
    if (!fs.existsSync(evidenceDir)) return { ok: false, reason };
    const files = fs.readdirSync(evidenceDir);
    if (files.length === 0) return { ok: false, reason };
    return { ok: true };
  }
  if (rule.check === 'min_count') {
    const root = path.resolve(wsDir, '..', '..');
    const glob = rule.glob || '';
    if (!glob) return { ok: true };
    // Pragmatic: count matching files via fs walk, no glob lib needed
    const count = countMatches(root, glob);
    if (count < (rule.min || 1)) return { ok: false, reason };
    return { ok: true };
  }
  if (rule.check === 'file_exists') {
    const root = path.resolve(wsDir, '..', '..');
    const p = path.join(root, rule.path || '');
    if (!fs.existsSync(p)) return { ok: false, reason };
    return { ok: true };
  }
  // Unknown check type — treat as passing (forward compat)
  return { ok: true };
}

function countMatches(root, glob) {
  // Tiny glob: only handles `<dir>/*/<file>` and `<dir>/*` patterns.
  // Sufficient for the registry's needs; not a general glob impl.
  const parts = glob.split('/');
  if (parts.length < 2) return fs.existsSync(path.join(root, glob)) ? 1 : 0;
  // Walk pragmatically by joining static prefix until we hit a *
  let staticPrefix = root;
  let i = 0;
  for (; i < parts.length; i++) {
    if (parts[i].includes('*')) break;
    staticPrefix = path.join(staticPrefix, parts[i]);
  }
  if (!fs.existsSync(staticPrefix)) return 0;
  if (i === parts.length) return 1; // no wildcard, file exists
  // First-wildcard segment
  const wild = parts[i];
  const remainder = parts.slice(i + 1);
  let count = 0;
  for (const entry of fs.readdirSync(staticPrefix)) {
    if (wild === '*' || matchesGlobSegment(entry, wild)) {
      const sub = path.join(staticPrefix, entry, ...remainder);
      if (remainder.length === 0) count++;
      else if (fs.existsSync(sub)) count++;
    }
  }
  return count;
}

function matchesGlobSegment(s, pattern) {
  if (pattern === '*') return true;
  // Simple * → .* mapping; sufficient for registry patterns.
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return re.test(s);
}

/**
 * Success-shape inference: read engine MD frontmatter for `success_shape`
 * if declared. No prose-shape inference — explicit declarations only.
 */
function inferSuccessShape(engineName, repoPath) {
  const fm = readEngineFrontmatter(engineName, repoPath);
  if (fm && typeof fm.success_shape === 'string' && fm.success_shape.trim()) {
    return { value: fm.success_shape.trim(), confidence: 0.75 };
  }
  return { value: null, confidence: 0.4 }; // missing — caller decides whether to prompt
}

/**
 * WS-296 / FIND-129: which Failed-State anchors does this engine's cross-critic
 * (or equivalent prompt) need injected? Read from frontmatter `failed_states_seed:`.
 * Returns { value: [names] | null, confidence }. Null when not declared — no
 * injection happens (preserves existing engines' behavior).
 */
function inferFailedStatesSeed(engineName, repoPath) {
  const fm = readEngineFrontmatter(engineName, repoPath);
  if (!fm || !Array.isArray(fm.failed_states_seed) || fm.failed_states_seed.length === 0) {
    return { value: null, confidence: 0 };
  }
  const names = fm.failed_states_seed
    .filter((n) => typeof n === 'string' && n.trim().length > 0)
    .map((n) => n.trim());
  if (names.length === 0) return { value: null, confidence: 0 };
  return { value: names, confidence: 0.9 };
}

/**
 * WS-296 / FIND-129: pure function. Extract named Failed States from a
 * markdown source file (typically `system/intention.md`).
 *
 * Source format: a `## Failed States` heading followed by a numbered list:
 *
 *   1. **Name of state.** Body text on one or more lines until the next
 *      numbered item or the next `## ` heading.
 *
 * Returns:
 *   {
 *     section_hash: <sha256 of the full section content (hex)>,
 *     source_path: <label string passed in via sourceLabel, or absolute path>,
 *     states: [
 *       { name, content, position_at_compose, content_hash }
 *     ],
 *     warnings: [string]   // requested names not found, missing file, etc.
 *   }
 *
 * Names are matched case-insensitively against the bolded title (with the
 * trailing period stripped). Order of `states` mirrors the order of the
 * `names` argument (not the source-file order). Names not found produce a
 * warning + an entry with `content: null`, `content_hash: ''`.
 *
 * Renumbering protection: section_hash changes whenever ANY edit lands in
 * the section (insertion, reorder, body change). Per-state content_hash
 * pinpoints which anchor body changed.
 */
function extractFailedStates(intentionMdAbsPath, names, sourceLabel) {
  const label = typeof sourceLabel === 'string' && sourceLabel ? sourceLabel : intentionMdAbsPath;
  const safeNames = Array.isArray(names) ? names.filter((n) => typeof n === 'string' && n.trim()) : [];
  const emptyStates = safeNames.map((n) => ({
    name: n, content: null, position_at_compose: null, content_hash: '',
  }));

  if (safeNames.length === 0) return null;
  if (!fs.existsSync(intentionMdAbsPath)) {
    return {
      section_hash: '', source_path: label, states: emptyStates,
      warnings: [`source file not found: ${label}`],
    };
  }

  const text = fs.readFileSync(intentionMdAbsPath, 'utf8').replace(/\r\n/g, '\n');
  // Locate the `## Failed States` section. Capture from the heading through
  // the line BEFORE the next `## ` heading at column 0, or to end of file.
  const headingIdx = text.search(/^## Failed States\b/m);
  if (headingIdx === -1) {
    return {
      section_hash: '', source_path: label, states: emptyStates,
      warnings: [`'## Failed States' section not found in ${label}`],
    };
  }
  const tail = text.slice(headingIdx);
  const nextHeadingMatch = tail.slice(1).search(/^## /m); // skip the heading itself
  const sectionContent = nextHeadingMatch === -1 ? tail : tail.slice(0, nextHeadingMatch + 1);
  const sectionHash = crypto.createHash('sha256').update(sectionContent).digest('hex');

  // Parse numbered bolded list: "N. **Name.** body..." with body running
  // until the next "M. **" line OR a horizontal rule (`---` on its own line)
  // OR end of section.
  const itemRegex = /^(\d+)\.\s+\*\*([^*]+?)\.\*\*\s*([\s\S]*?)(?=^\d+\.\s+\*\*|^---\s*$|\Z)/gm;
  const parsedItems = [];
  let m;
  while ((m = itemRegex.exec(sectionContent)) !== null) {
    parsedItems.push({
      position: parseInt(m[1], 10),
      name: m[2].trim(),
      content: m[3].trim(),
    });
  }

  const warnings = [];
  const states = safeNames.map((requestedName) => {
    const norm = requestedName.trim().toLowerCase();
    const found = parsedItems.find((p) => p.name.toLowerCase() === norm);
    if (!found) {
      warnings.push(`failed state not found: '${requestedName}'`);
      return { name: requestedName, content: null, position_at_compose: null, content_hash: '' };
    }
    const contentHash = crypto.createHash('sha256').update(`${found.name}\n${found.content}`).digest('hex');
    return {
      name: found.name,
      content: found.content,
      position_at_compose: found.position,
      content_hash: contentHash,
    };
  });

  return { section_hash: sectionHash, source_path: label, states, warnings };
}

function inferScopeCeiling(engineName, defaultCeiling) {
  // Today: every engine gets the default. Future: per-engine token budgets in registry.
  return { value: defaultCeiling, confidence: 0.5 };
}

// ─── WS-309: pre-flight cost estimation ────────────────────────────────────

/**
 * Parse a contract scope_ceiling string into an integer token count.
 * Mirrors parseTokenCeiling in cwos-engine-contract-verify.js. Kept local to
 * avoid a cross-CLI require that would slow compose's read path.
 */
function parseCeilingTokens(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/^token:\s*/, '');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2] === 'k' ? 1000 : m[2] === 'm' ? 1_000_000 : 1;
  return Math.round(n * mult);
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/**
 * Estimate expected token cost for an upcoming engine run.
 * Reads engine_run_completed events for the same engineId, takes the median
 * of the most recent N samples with non-null tokens_derived. If no history,
 * falls back to ceiling × 0.6. Confidence drops with sample count.
 *
 * Returns { value, confidence, basis } where confidence is one of
 * 'high' | 'medium' | 'low' | 'none'.
 */
function estimateTokens({ events, engineId, scopeCeiling, samplesNeeded = 5 }) {
  const samples = [];
  if (Array.isArray(events)) {
    for (let i = events.length - 1; i >= 0 && samples.length < samplesNeeded; i--) {
      const e = events[i];
      if (!e || !e.payload) continue;
      if (e.payload.type !== 'engine_run_completed') continue;
      if (e.payload.engine_id !== engineId) continue;
      if (typeof e.payload.tokens_derived !== 'number') continue;
      samples.push(e.payload.tokens_derived);
    }
  }
  if (samples.length >= 3) {
    return { value: median(samples), confidence: 'high', basis: `historical-median(n=${samples.length})` };
  }
  if (samples.length >= 1) {
    return { value: median(samples), confidence: 'medium', basis: `historical-median(n=${samples.length})` };
  }
  const ceilingTokens = parseCeilingTokens(scopeCeiling);
  if (ceilingTokens != null) {
    return { value: Math.round(ceilingTokens * 0.6), confidence: 'low', basis: 'fallback-ceiling-x0.6' };
  }
  return { value: null, confidence: 'none', basis: 'no-data' };
}

// ─── Catch-state pre-fill (WS-299) ─────────────────────────────────────────

const CATCH_STATE_WINDOW_MS = 30 * 60 * 1000; // 30 min — proxy for "10 founder turns"
const CATCH_STATE_DISMISSAL_MS = 60 * 60 * 1000; // 60 min — auto-dismiss as silent after this

function readEventLogTail(eventsDir, maxEvents) {
  if (!fs.existsSync(eventsDir)) return [];
  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.jsonl')).sort();
  const events = [];
  for (let i = files.length - 1; i >= 0 && events.length < maxEvents; i--) {
    const text = fs.readFileSync(path.join(eventsDir, files[i]), 'utf8');
    const lines = text.split('\n').filter(Boolean);
    for (let j = lines.length - 1; j >= 0 && events.length < maxEvents; j--) {
      try { events.unshift(JSON.parse(lines[j])); } catch (_) { /* skip */ }
    }
  }
  return events;
}

/**
 * Look up the most recent engine_candidate_suggested event matching the
 * (engine, target) tuple within CATCH_STATE_WINDOW_MS. Returns the event
 * object or null. Used to pre-fill compose defaults from the suggestion's
 * suggested_contract.
 */
function findRecentSuggestion(events, engine, target, nowMs) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (!e || !e.payload || e.payload.type !== 'engine_candidate_suggested') continue;
    const ts = e.timestamp ? Date.parse(e.timestamp) : 0;
    if (!ts || (nowMs - ts) > CATCH_STATE_WINDOW_MS) continue;
    if (e.payload.suggested_engine !== engine) continue;
    // target match: empty target on either side counts as wildcard
    if (target && e.payload.suggested_target && e.payload.suggested_target !== target) continue;
    return e;
  }
  return null;
}

/**
 * Find outstanding suggestions (engine_candidate_suggested events with no
 * matching engine_intent_recorded since AND no engine_candidate_dismissed
 * referencing them). Returns the events that need a dismissal verdict.
 */
function findOutstandingSuggestions(events, currentInvokeEngine, currentInvokeTarget, nowMs) {
  const suggestionById = new Map();
  const dismissedRefs = new Set();
  for (const e of events) {
    if (!e || !e.payload) continue;
    const t = e.payload.type;
    if (t === 'engine_candidate_suggested') suggestionById.set(e.id, e);
    else if (t === 'engine_candidate_dismissed' && e.payload.candidate_event_ref) {
      dismissedRefs.add(e.payload.candidate_event_ref);
    }
  }
  const outstanding = [];
  for (const [id, ev] of suggestionById) {
    if (dismissedRefs.has(id)) continue;
    const ts = ev.timestamp ? Date.parse(ev.timestamp) : 0;
    if (!ts) continue;
    const ageMs = nowMs - ts;
    // Decide dismissal: invoked-different-engine vs silent vs in-window-no-action
    let reason = null;
    if (currentInvokeEngine) {
      const matches = ev.payload.suggested_engine === currentInvokeEngine
        && (!ev.payload.suggested_target || !currentInvokeTarget || ev.payload.suggested_target === currentInvokeTarget);
      if (!matches && ageMs <= CATCH_STATE_WINDOW_MS) reason = 'invoked-different-engine';
    }
    if (!reason && ageMs > CATCH_STATE_DISMISSAL_MS) reason = 'silent';
    if (reason) outstanding.push({ event: ev, reason, ageMs });
  }
  return outstanding;
}

// ─── 1. compose ────────────────────────────────────────────────────────────

function runCompose(args) {
  const engine = readFlag(args, 'engine');
  const target = readFlag(args, 'target') || '';
  const stretchFlag = hasFlag(args, 'stretch');
  const clock = readFlag(args, 'clock');
  const today = (clock && clock.length >= 10) ? clock.slice(0, 10) : todayISO();
  const now = clock ? Date.parse(clock) : Date.now();

  if (!engine) {
    process.stderr.write('compose: --engine <id> is required\n');
    process.exit(2);
  }

  const config = loadFrameConfig();
  const registry = loadReadinessRegistry(config.engine_readiness_rules);
  const wsDir = path.join(repoRoot(), '.claude', 'workstream');

  const modeInf = inferMode(engine, repoRoot());
  const readinessInf = inferReadiness({ engineName: engine, target, wsDir, registry, today, now });
  const successShapeInf = inferSuccessShape(engine, repoRoot());
  const scopeCeilingInf = inferScopeCeiling(engine, config.default_scope_ceiling);
  const stretchInf = { value: !!stretchFlag, confidence: 1.0 }; // explicit binary
  const failedStatesSeedInf = inferFailedStatesSeed(engine, repoRoot());

  const contract = {
    mode: modeInf.value,
    readiness: readinessInf.value,
    readiness_reason: readinessInf.reason,
    success_shape: successShapeInf.value,
    scope_ceiling: scopeCeilingInf.value,
    stretch: stretchInf.value,
    engine,
    target,
    created_at_unbound: today, // confirm-time becomes the binding timestamp
  };

  // WS-296 / FIND-129: inject Failed-State excerpts so the engine reads
  // constitutional anchors from the envelope instead of system/intention.md
  // (upholds INV-cli-envelope-consumed-completely). Only fires when the
  // engine MD frontmatter declares `failed_states_seed:`.
  if (failedStatesSeedInf.value) {
    const intentionRel = 'system/intention.md';
    const intentionAbs = path.join(repoRoot(), intentionRel);
    const extracted = extractFailedStates(intentionAbs, failedStatesSeedInf.value, intentionRel);
    if (extracted) {
      contract.failed_states_seed = {
        section_hash: extracted.section_hash,
        source_path: extracted.source_path,
        states: extracted.states,
      };
      if (Array.isArray(extracted.warnings) && extracted.warnings.length > 0) {
        contract.failed_states_seed.warnings = extracted.warnings;
      }
    }
  }

  const confidences = {
    mode: modeInf.confidence,
    readiness: readinessInf.confidence,
    success_shape: successShapeInf.confidence,
    scope_ceiling: scopeCeilingInf.confidence,
    stretch: stretchInf.confidence,
  };

  // WS-299: Layer-3 pre-fill from catch-state suggestion if one exists
  // matching engine+target within CATCH_STATE_WINDOW_MS. Suggestion's
  // suggested_contract overrides defaults; provenance recorded for confirm.
  const eventsDir = path.join(repoRoot(), '.claude', 'workstream', 'events');
  const recentEvents = readEventLogTail(eventsDir, 200);
  const matchedSuggestion = findRecentSuggestion(recentEvents, engine, target, now);
  let prefillProvenance = null;
  if (matchedSuggestion && matchedSuggestion.payload.suggested_contract) {
    const sc = matchedSuggestion.payload.suggested_contract;
    if (sc.mode && VALID_MODES.includes(sc.mode)) { contract.mode = sc.mode; confidences.mode = Math.max(confidences.mode, 0.85); }
    if (typeof sc.stretch === 'boolean' && !stretchFlag) { contract.stretch = sc.stretch; }
    if (sc.success_shape) { contract.success_shape = sc.success_shape; confidences.success_shape = Math.max(confidences.success_shape, 0.8); }
    if (sc.scope_ceiling) { contract.scope_ceiling = sc.scope_ceiling; confidences.scope_ceiling = Math.max(confidences.scope_ceiling, 0.7); }
    prefillProvenance = {
      pre_filled_from: matchedSuggestion.id,
      catch_state_confidence: matchedSuggestion.payload.confidence,
      trigger_signals: matchedSuggestion.payload.trigger_signals || [],
    };
  }

  const threshold = config.confidence_threshold;
  const promptsNeeded = Object.entries(confidences)
    .filter(([_, c]) => c < threshold)
    .map(([field]) => field);

  // WS-296: surface failed_states_seed extraction warnings (e.g. requested
  // name not found in source). Absence of declared seed is intentional and
  // does NOT prompt — only extraction failures do.
  if (contract.failed_states_seed && Array.isArray(contract.failed_states_seed.warnings)) {
    for (const w of contract.failed_states_seed.warnings) {
      promptsNeeded.push(`failed_states_seed_warning: ${w}`);
    }
  }

  // WS-309: pre-flight cost estimation. Reads historical engine_run_completed
  // events for this engine and produces an estimated_tokens value with
  // confidence. When confidence is high AND the estimate exceeds the contract
  // ceiling, append a non-fatal prompt so the founder sees it before confirm.
  const estimate = estimateTokens({
    events: recentEvents,
    engineId: engine,
    scopeCeiling: contract.scope_ceiling,
    samplesNeeded: 5,
  });
  contract.estimated_tokens = estimate.value;
  contract.estimated_tokens_confidence = estimate.confidence;
  contract.estimated_tokens_basis = estimate.basis;

  const ceilingTokens = parseCeilingTokens(contract.scope_ceiling);
  if (
    estimate.confidence === 'high' &&
    estimate.value != null &&
    ceilingTokens != null &&
    estimate.value > ceilingTokens
  ) {
    promptsNeeded.push(`scope_ceiling_overage_warning: estimated ~${estimate.value} tokens exceeds contract ceiling ${ceilingTokens} (${estimate.basis})`);
  }

  // FIND-127 / WS-291: build the founder-facing readiness_human block when
  // readiness=defer. Only populated on defer; ready paths leave it null.
  const readinessHuman = (readinessInf.value === 'defer' && Array.isArray(readinessInf.reasons))
    ? deferTranslators.composeReadinessHuman(readinessInf.reasons)
    : null;

  writeJson({
    contract,
    confidences,
    confidence_threshold: threshold,
    prompts_needed: promptsNeeded,
    composed_at: today,
    catch_state_prefill: prefillProvenance,
    readiness_human: readinessHuman,
  });
}

// ─── 2. confirm ────────────────────────────────────────────────────────────

function runConfirm(args) {
  const contractFile = readFlag(args, 'contract-file');
  const aiAutonomous = hasFlag(args, 'ai-autonomous');
  const noEmit = hasFlag(args, 'no-emit');
  const clock = readFlag(args, 'clock');
  if (!contractFile) {
    process.stderr.write('confirm: --contract-file <path> is required\n');
    process.exit(2);
  }
  let payload;
  try { payload = JSON.parse(fs.readFileSync(contractFile, 'utf8')); }
  catch (e) {
    process.stderr.write(`confirm: cannot parse contract file: ${e.message}\n`);
    process.exit(2);
  }
  const composeOutput = payload.contract ? payload : { contract: payload, confidences: {}, prompts_needed: [] };
  const contract = composeOutput.contract;

  // Validate required fields
  if (!contract || !contract.mode || !contract.engine || typeof contract.stretch !== 'boolean') {
    process.stderr.write('confirm: contract is missing required fields (mode, engine, stretch)\n');
    process.exit(2);
  }
  if (!VALID_MODES.includes(contract.mode)) {
    process.stderr.write(`confirm: invalid mode '${contract.mode}'. Valid: ${VALID_MODES.join(', ')}\n`);
    process.exit(2);
  }

  // Compute revisions array — what fields differ from the compose defaults.
  // For simplicity v1: we don't have the original defaults to diff against
  // unless the caller passed them in `composeOutput.original_defaults`.
  // Future iteration: cwos-frame compose includes a baseline copy in its
  // output for confirm to diff against.
  const revisions = Array.isArray(payload.revisions) ? payload.revisions : [];

  const contractId = `cnt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const ackAt = clock || new Date().toISOString();

  const eventPayload = {
    type: 'engine_intent_recorded',
    contract_id: contractId,
    engine: contract.engine,
    target: contract.target || '',
    contract: {
      mode: contract.mode,
      readiness: contract.readiness || 'ready',
      readiness_reason: contract.readiness_reason || null,
      success_shape: contract.success_shape || null,
      scope_ceiling: contract.scope_ceiling || null,
      stretch: !!contract.stretch,
      // WS-296 / FIND-129: pass through if compose injected it. Optional —
      // only populated for engines that declare `failed_states_seed:` in MD
      // frontmatter.
      ...(contract.failed_states_seed ? { failed_states_seed: contract.failed_states_seed } : {}),
    },
    revisions,
    created_at: ackAt,
    created_by: aiAutonomous ? 'ai-autonomous' : 'founder',
    composed_by: 'cli-deterministic',
  };
  // WS-299: pre-fill provenance — flows from compose.catch_state_prefill if present
  if (payload.catch_state_prefill) eventPayload.catch_state_prefill = payload.catch_state_prefill;

  let eventId = null;
  if (!noEmit && appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('frame-confirm');
      const r = appendEvent({
        source_track: 'T7:engines',
        source_tier: aiAutonomous ? 'llm-emission' : 'founder-prompt',
        track_tag: '/engine',
        command_id: commandId,
        payload: eventPayload,
      });
      if (r && r.ok && r.event) eventId = r.event.id;
      else if (r && !r.ok) process.stderr.write(`confirm: event validation: ${(r.errors || []).join('; ')}\n`);
    } catch (e) {
      process.stderr.write(`confirm: event emission failed (non-fatal): ${e.message}\n`);
    }
  }

  // WS-299: emit engine_candidate_dismissed events for outstanding suggestions.
  // 'invoked-different-engine' fires when founder is invoking an engine that
  // doesn't match the still-open suggestion(s). 'silent' fires for suggestions
  // older than CATCH_STATE_DISMISSAL_MS with no matching invocation.
  const dismissedEmitted = [];
  if (!noEmit && appendEvent && ensureCommandId) {
    try {
      const eventsDir = path.join(repoRoot(), '.claude', 'workstream', 'events');
      const recent = readEventLogTail(eventsDir, 200);
      const nowMs = Date.parse(ackAt) || Date.now();
      const outstanding = findOutstandingSuggestions(recent, contract.engine, contract.target || '', nowMs);
      for (const o of outstanding) {
        const cid = ensureCommandId('catch-state-dismiss');
        const dismissalPayload = {
          type: 'engine_candidate_dismissed',
          candidate_event_ref: o.event.id,
          suggested_engine: (o.event.payload && o.event.payload.suggested_engine) || null,
          dismissal_reason: o.reason,
          invoked_engine: o.reason === 'invoked-different-engine' ? contract.engine : null,
          dismissed_at: ackAt,
        };
        try {
          appendEvent({
            source_track: 'T7:engines', source_tier: 'founder-prompt',
            track_tag: '/engine', command_id: cid, payload: dismissalPayload,
          });
          dismissedEmitted.push({ ref: o.event.id, reason: o.reason });
        } catch (_) { /* non-fatal */ }
      }
    } catch (e) {
      process.stderr.write(`confirm: dismissal scan failed (non-fatal): ${e.message}\n`);
    }
  }

  writeJson({
    ok: true,
    contract_id: contractId,
    event_id: eventId,
    contract: eventPayload.contract,
    revisions,
    catch_state_prefill: eventPayload.catch_state_prefill || null,
    catch_state_dismissed: dismissedEmitted,
    note: noEmit ? 'no-emit mode — event was NOT written to log' : undefined,
  });
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

// WS-303 / FIND-RUN016-4: subcommands whose primary job is to emit a contract
// event MUST exit non-zero on uncaught error. AS-23's silencing was intended
// for shadow instrumentation, not for the contract-emission boundary itself —
// silencing here hides the failure of the very thing the subcommand exists
// to do. Subcommands NOT in this set retain AS-23's exit-0 fallback.
const CONTRACT_EMITTING_SUBCOMMANDS = new Set(['compose', 'confirm']);

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write('usage: cwos-frame <compose|confirm> [options]\n');
    process.exit(sub ? 0 : 1);
  }
  try {
    switch (sub) {
      case 'compose': return runCompose(args.slice(1));
      case 'confirm': return runConfirm(args.slice(1));
      default:
        process.stderr.write(`cwos-frame: unknown subcommand: ${sub}\n`);
        process.exit(2);
    }
  } catch (err) {
    process.stderr.write(`cwos-frame: ${err.message}\n${err.stack || ''}\n`);
    // Contract-emitting subcommands fail loudly; others retain AS-23 silencing.
    process.exit(CONTRACT_EMITTING_SUBCOMMANDS.has(sub) ? 2 : 0);
  }
}

if (require.main === module) main();

module.exports = {
  runCompose, runConfirm,
  inferMode, inferReadiness, inferSuccessShape, inferScopeCeiling,
  inferFailedStatesSeed, extractFailedStates, // WS-296
  loadFrameConfig, loadReadinessRegistry, evaluateReadinessRule,
  findRecentSuggestion, findOutstandingSuggestions, readEventLogTail,
  estimateTokens, parseCeilingTokens, median,
  VALID_MODES, DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_STALENESS_WINDOW, DEFAULT_SCOPE_CEILING,
  CATCH_STATE_WINDOW_MS, CATCH_STATE_DISMISSAL_MS,
  CONTRACT_EMITTING_SUBCOMMANDS,
};
