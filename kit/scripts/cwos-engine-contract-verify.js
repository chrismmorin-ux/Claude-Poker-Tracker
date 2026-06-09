#!/usr/bin/env node
/**
 * cwos-engine-contract-verify.js — deterministic post-run contract-compliance
 * verifier. Closes the FIND-122 self-attestation gap surfaced by run-015.
 *
 * Reads a completed engine run's briefing.md (Contract Alignment table) +
 * cross-critique + synthesis + the matching engine_intent_recorded event,
 * then cross-checks each "honored" claim against measurable evidence.
 * Emits `engine_contract_verified` with per-field pass/fail and exits 2
 * when a contract claim contradicts evidence (alarm), 0 otherwise.
 *
 * Per WS-288 decision_flag (founder-approved 2026-05-04): partial verifier
 * ships first — mode/stretch/success_shape verified actively; scope_ceiling
 * returned BLOCKED-BY-WS-289 verdict until the per-engine token meter landed.
 * WS-309 closed that gap (2026-05-07): scope_ceiling now compares the run's
 * measured tokens_derived (stamped by cwos-engine-complete.js) to the
 * contract's ceiling and emits PASS/PARTIAL/FAIL/BLOCKED with overage ratio.
 *
 * Replay-pure: read-only against runs/<run-id>/artifacts/* + events/*.jsonl.
 * --apply emits the engine_contract_verified event via core/events.
 *
 * Usage:
 *   node cwos-engine-contract-verify.js --run-id run-015
 *   node cwos-engine-contract-verify.js --run-id run-015 --apply
 *   node cwos-engine-contract-verify.js --run-id run-015 --quiet
 *   node cwos-engine-contract-verify.js --run-id run-015 \
 *        --runs-dir <p> --events-dir <p>   # for tests
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findRepoRoot, loadEventDeps } = require('./lib/cwos-utils');

const { appendEvent, ensureCommandId } = loadEventDeps();

const DEFAULT_RUNS_DIR = '.claude/workstream/runs';
const DEFAULT_EVENTS_DIR = '.claude/workstream/events';

function parseArgs(argv) {
  const out = { runId: null, apply: false, quiet: false, runsDir: null, eventsDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run-id' && argv[i + 1]) out.runId = argv[++i];
    else if (a === '--apply') out.apply = true;
    else if (a === '--quiet') out.quiet = true;
    else if (a === '--runs-dir' && argv[i + 1]) out.runsDir = argv[++i];
    else if (a === '--events-dir' && argv[i + 1]) out.eventsDir = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

// ─── Briefing parser ───────────────────────────────────────────────────────

/**
 * Parse the Contract Alignment table from briefing.md.
 * Returns { mode, stretch, success_shape, scope_ceiling } where each value
 * is { claim: 'honored'|'departed'|'unknown', text: '<full cell text>' }.
 */
function parseContractAlignment(briefingText) {
  const lines = briefingText.split(/\r?\n/);
  let inSection = false;
  const claims = {
    mode: { claim: 'missing', text: '' },
    stretch: { claim: 'missing', text: '' },
    success_shape: { claim: 'missing', text: '' },
    scope_ceiling: { claim: 'missing', text: '' },
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#+\s+Contract Alignment\b/i.test(l)) { inSection = true; continue; }
    if (inSection && /^#+\s+/.test(l)) break;
    if (!inSection) continue;
    const m = l.match(/^\|\s*\*\*([a-z_]+)\*\*\s*\|\s*(.*?)\s*\|\s*$/i);
    if (m) {
      const field = m[1].toLowerCase();
      const cell = m[2];
      if (claims[field]) {
        const lower = cell.toLowerCase();
        let claim = 'unknown';
        if (/\bdeparted\b/.test(lower)) claim = 'departed';
        else if (/\bhonored\b/.test(lower)) claim = 'honored';
        claims[field] = { claim, text: cell };
      }
    }
  }
  return claims;
}

function parseBriefingHeader(briefingText) {
  // Expects: **Run:** run-015 | **Engine:** eng-engine | **Target:** prog-engine-reliability | **Date:** 2026-05-03
  const m = briefingText.match(
    /\*\*Run:\*\*\s*([\w-]+)[^|]*\|\s*\*\*Engine:\*\*\s*([\w-]+)[^|]*\|\s*\*\*Target:\*\*\s*([^|\n]+?)\s*(?:\||\n|$)/i
  );
  if (!m) return null;
  return { runId: m[1].trim(), engine: m[2].trim(), target: m[3].trim() };
}

// ─── Event-log lookup ──────────────────────────────────────────────────────

function readEventLog(eventsDir) {
  if (!fs.existsSync(eventsDir)) return [];
  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.jsonl')).sort();
  const events = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(eventsDir, f), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch (_) { /* skip malformed */ }
    }
  }
  return events;
}

/**
 * Find the engine_intent_recorded event for a given run.
 *
 * Strategy (preferred → fallback):
 *   (1) If an engine_run_completed event exists with matching run_id, use its
 *       timestamp to bound the search. The intent event is the latest
 *       engine_intent_recorded with engine+target match before completion.
 *   (2) Otherwise: heuristic — the latest engine_intent_recorded matching
 *       engine+target. Brittle if multiple runs share engine+target on one day;
 *       returned with `binding: 'heuristic'` so the report flags the weakness.
 */
function findIntentEvent(events, runId, engineFromBriefing, targetFromBriefing) {
  const runCompleted = events.find(
    (e) => e.payload && e.payload.type === 'engine_run_completed' && e.payload.run_id === runId
  );
  const intentEvents = events
    .filter((e) => e.payload && e.payload.type === 'engine_intent_recorded')
    .filter((e) => {
      const p = e.payload;
      return p.engine === engineFromBriefing && p.target === targetFromBriefing;
    });
  if (!intentEvents.length) return null;
  if (runCompleted) {
    const before = intentEvents.filter((e) => e.timestamp <= runCompleted.timestamp);
    const pick = before.length ? before[before.length - 1] : intentEvents[intentEvents.length - 1];
    return { event: pick, binding: 'engine_run_completed' };
  }
  return { event: intentEvents[intentEvents.length - 1], binding: 'heuristic' };
}

// ─── Per-field verifiers ───────────────────────────────────────────────────

/**
 * Verify mode against synthesis evidence.
 *   decide      → expects RICE / ranking markers
 *   build-best  → expects single committed direction (no enumerated alternatives)
 *   mockup      → expects mockup/sketch/low-fidelity markers; NO RICE
 *   explore     → expects alternatives/options framing; NO single ranked output
 */
function verifyMode(claim, contractMode, synthesisText) {
  const text = (synthesisText || '').toLowerCase();
  const raw = synthesisText || '';
  const hasRice = /\brice\b|\breach\b.*\bimpact\b|\bconfidence\b.*\beffort\b/.test(text);
  // Ranked-finding signal: literal numbered lists OR severity-graded
  // FIND-NNN sections. The latter is the shape real eng-engine syntheses use
  // (see run-015 `### FIND-NNN: <title>` + `**Severity:** ...` + `**Score:** ...`).
  // WS-301 / FIND-RUN016-1: tightened to AND with hasRice for decide mode —
  // a numbered list alone is not adversarial-resistant.
  const hasNumberedRanking = /^\s*(?:#+\s*)?\d+[.)]\s+/m.test(raw)
    || /\bFIND-\d{2,}\b/.test(raw);
  const hasMockupMarkers = /\bmockup\b|\bsketch\b|\blow[- ]fidelity\b|\bwireframe\b/.test(text);
  const hasAlternatives = /\balternatives?\b|\boptions?\b|\btrade[- ]?offs?\b/.test(text);

  const evidence = [];
  let pass = null;

  switch (contractMode) {
    case 'decide':
      pass = hasRice && hasNumberedRanking;
      evidence.push(`RICE markers: ${hasRice}`, `numbered/FIND ranking: ${hasNumberedRanking}`);
      break;
    case 'mockup':
      pass = hasMockupMarkers && !hasRice;
      evidence.push(`mockup markers: ${hasMockupMarkers}`, `RICE absent: ${!hasRice}`);
      break;
    case 'explore':
      pass = hasAlternatives && !hasRice;
      evidence.push(`alternatives framing: ${hasAlternatives}`, `RICE absent: ${!hasRice}`);
      break;
    case 'build-best':
      pass = !hasAlternatives || hasNumberedRanking;
      evidence.push(`committed direction (no enumerated alternatives OR top-ranked): ${pass}`);
      break;
    default:
      return makeVerdict('mode', claim, 'UNKNOWN-MODE', `mode=${contractMode} not in enum; cannot verify`);
  }

  if (claim === 'departed') return makeVerdict('mode', claim, 'HONEST-DEPART', `claim=departed; evidence: ${evidence.join('; ')}`);
  if (claim === 'honored' && pass) return makeVerdict('mode', claim, 'PASS', `claim=honored + evidence consistent (${evidence.join('; ')})`);
  if (claim === 'honored' && !pass) return makeVerdict('mode', claim, 'FAIL', `claim=honored but evidence contradicts (${evidence.join('; ')})`);
  return makeVerdict('mode', claim, 'INCONCLUSIVE', `claim=${claim}; evidence: ${evidence.join('; ')}`);
}

/**
 * Verify stretch against cross-critique evidence.
 *   stretch=true  → cross-critique MUST reference questioned AS-N tags
 *   stretch=false → cross-critique must NOT show such patterns
 */
function verifyStretch(claim, contractStretch, crossCritiqueText) {
  const text = crossCritiqueText || '';
  // STRONG patterns: explicit verbs of questioning/probing/challenging AS-N tags.
  // A single STRONG match is sufficient evidence the engine engaged in
  // stretch-mode behavior.
  const strongPatterns = [
    /\bAS-\d+\s*\?/,                                                   // direct question mark
    /\bquestion(?:ing|ed|s)?\b[^\n.]{0,60}\bAS-\d+/i,                  // "questioning AS-58"
    /\bAS-\d+\b[^\n.]{0,60}\b(?:probe|challenge|interrogate)/i,        // explicit probe verbs
  ];
  // WEAK patterns: AS-N appears alongside falsif/load-bearing language. This
  // can be reporting verdicts from parallel personas rather than the engine
  // generating new stretch-mode questioning. Treated as PARTIAL signal.
  const weakPatterns = [
    /\bAS-\d+\b[^\n.]{0,60}\bfalsif/i,
    /\bload[- ]?bearing\b[^\n.]{0,60}\bAS-\d+/i,
  ];
  const strongHits = strongPatterns.filter((re) => re.test(text)).length;
  const weakHits = weakPatterns.reduce((n, re) => n + ((text.match(new RegExp(re, re.flags + 'g')) || []).length), 0);
  const evidence = `stretch=${contractStretch}; cross-critique strong-pattern hits: ${strongHits}, weak-pattern hits: ${weakHits}`;

  if (claim === 'departed') return makeVerdict('stretch', claim, 'HONEST-DEPART', `claim=departed; ${evidence}`);

  if (contractStretch === true) {
    // stretch=true should produce questioning. STRONG hits PASS; only WEAK is PARTIAL.
    if (strongHits >= 1) return makeVerdict('stretch', claim, 'PASS', `claim=honored; stretch-mode questioning observed; ${evidence}`);
    if (weakHits >= 1) return makeVerdict('stretch', claim, 'PARTIAL', `claim=honored; weak engagement only; ${evidence}`);
    return makeVerdict('stretch', claim, 'FAIL', `claim=honored stretch=true but no AS-N questioning observed; ${evidence}`);
  }
  // stretch=false: should NOT question AS-N tags.
  if (strongHits >= 1) return makeVerdict('stretch', claim, 'FAIL', `claim=honored stretch=false but AS-N explicitly questioned; ${evidence}`);
  if (weakHits >= 1) return makeVerdict('stretch', claim, 'PARTIAL', `claim=honored stretch=false but AS-N referenced with falsif/load-bearing language; may be reporting parallel-persona verdicts rather than engine-level questioning; ${evidence}`);
  return makeVerdict('stretch', claim, 'PASS', `claim=honored; ${evidence}`);
}

/**
 * Verify success_shape — fuzzy by nature.
 * Tokenize success_shape into items (split on +, ;, " and "), then keyword-check
 * each item against briefing+synthesis. PASS if ≥80% of items present;
 * PARTIAL if 50-80%; FAIL if <50% AND claim was "honored".
 */
function verifySuccessShape(claim, contractSuccessShape, briefingText, synthesisText) {
  if (!contractSuccessShape) {
    return makeVerdict('success_shape', claim, 'NO-CONTRACT-VALUE', 'contract.success_shape is null/empty');
  }
  const haystack = ((briefingText || '') + '\n' + (synthesisText || '')).toLowerCase();
  // Split into items on +, ;, semantic " and ", commas
  const rawItems = contractSuccessShape.split(/[+;]|(?:\band\b)|,/i).map((s) => s.trim()).filter(Boolean);
  // For each item, extract 2-3 distinctive keywords (>3 chars, not stopwords)
  const STOP = new Set(['the', 'and', 'with', 'that', 'this', 'from', 'into', 'over', 'plus', 'each', 'than', 'more', 'less']);
  const itemResults = [];
  for (const item of rawItems) {
    const words = item.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [];
    const distinctive = words.filter((w) => !STOP.has(w)).slice(0, 3);
    if (!distinctive.length) { itemResults.push({ item, found: 'skipped-no-keywords' }); continue; }
    const hits = distinctive.filter((w) => haystack.includes(w));
    itemResults.push({ item, keywords: distinctive, hits, found: hits.length >= Math.ceil(distinctive.length / 2) });
  }
  const evaluable = itemResults.filter((r) => r.found !== 'skipped-no-keywords');
  const presentCount = evaluable.filter((r) => r.found === true).length;
  const total = evaluable.length || 1;
  const ratio = presentCount / total;
  const evidence = `${presentCount}/${total} success_shape items present in briefing+synthesis (${(ratio * 100).toFixed(0)}%)`;

  if (claim === 'departed') return makeVerdict('success_shape', claim, 'HONEST-DEPART', `claim=departed; ${evidence}`);
  if (claim === 'honored' && ratio >= 0.8) return makeVerdict('success_shape', claim, 'PASS', evidence);
  if (claim === 'honored' && ratio >= 0.5) return makeVerdict('success_shape', claim, 'PARTIAL', evidence);
  if (claim === 'honored' && ratio < 0.5) return makeVerdict('success_shape', claim, 'FAIL', `claim=honored but ${evidence}`);
  return makeVerdict('success_shape', claim, 'INCONCLUSIVE', evidence);
}

/**
 * Parse a contract scope_ceiling string into an integer token count.
 * Supports: "token:80k", "token:80000", "token:1.5m", "80000", "80k", null.
 * Returns null on unparseable input.
 */
function parseTokenCeiling(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/^token:\s*/, '');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2] === 'k' ? 1000 : m[2] === 'm' ? 1_000_000 : 1;
  return Math.round(n * mult);
}

/**
 * Verify scope_ceiling against the run's measured tokens_derived.
 *
 * WS-309 closes WS-288's deferred verdict: instead of returning
 * BLOCKED-BY-WS-289 unconditionally, compare the run's tokens_derived field
 * (stamped by cwos-engine-complete.js) to the contract's scope_ceiling.
 *
 *   tokens_derived missing → BLOCKED (data unavailable, legacy run)
 *   contract unparseable   → BLOCKED (parse failure)
 *   ratio ≤ 1.0            → PASS
 *   ratio ≤ 1.10           → PARTIAL (within 10% overage tolerance)
 *   ratio > 1.10           → FAIL
 *
 * BLOCKED stays out of ALARM_VERDICTS so historical runs grandfather; only
 * FAIL trips the alarm.
 */
function verifyScopeCeiling(claim, contractScopeCeiling, runEvent) {
  const ceiling = parseTokenCeiling(contractScopeCeiling);
  const derived = runEvent && runEvent.payload && runEvent.payload.tokens_derived;
  const source = (runEvent && runEvent.payload && runEvent.payload.tokens_derived_source) || 'unavailable';

  if (derived == null) {
    return makeVerdict(
      'scope_ceiling',
      claim,
      'BLOCKED',
      `tokens_derived missing on engine_run_completed (source=${source}); contract value=${contractScopeCeiling || 'null'}`,
    );
  }
  if (ceiling == null) {
    return makeVerdict(
      'scope_ceiling',
      claim,
      'BLOCKED',
      `unparseable contract scope_ceiling=${contractScopeCeiling}; tokens_derived=${derived}`,
    );
  }

  const ratio = derived / ceiling;
  const ratioPct = (ratio * 100).toFixed(0);
  const baseEvidence = `${derived} of ${ceiling} ceiling (${ratioPct}%); source=${source}`;
  if (claim === 'departed') {
    return makeVerdict('scope_ceiling', claim, 'HONEST-DEPART', `claim=departed; ${baseEvidence}`);
  }
  if (ratio <= 1.0) return makeVerdict('scope_ceiling', claim, 'PASS', baseEvidence);
  if (ratio <= 1.10) return makeVerdict('scope_ceiling', claim, 'PARTIAL', `${baseEvidence} — within 10% overage tolerance`);
  return makeVerdict('scope_ceiling', claim, 'FAIL', `${baseEvidence} — overage exceeds 10% tolerance`);
}

function makeVerdict(field, claim, verdict, evidence) {
  return { field, claim, verdict, evidence };
}

// ─── Orchestration ─────────────────────────────────────────────────────────

const ALARM_VERDICTS = new Set(['FAIL']);

function summarize(results) {
  let alarmed = false;
  let pass = 0, partial = 0, blocked = 0, fail = 0, depart = 0, other = 0;
  for (const r of results) {
    if (ALARM_VERDICTS.has(r.verdict)) { alarmed = true; fail++; }
    else if (r.verdict === 'PASS') pass++;
    else if (r.verdict === 'PARTIAL') partial++;
    // WS-309: BLOCKED replaced BLOCKED-BY-WS-289 once the per-engine token
    // meter shipped. Both labels counted as blocked for backward compat with
    // historical verified events.
    else if (r.verdict === 'BLOCKED' || r.verdict === 'BLOCKED-BY-WS-289') blocked++;
    else if (r.verdict === 'HONEST-DEPART') depart++;
    else other++;
  }
  let overall = 'PASS';
  if (alarmed) overall = 'FAIL';
  else if (partial > 0 || other > 0) overall = 'PARTIAL';
  return { overall, alarmed, counts: { pass, partial, blocked, fail, depart, other } };
}

function renderReport({ runId, intentBinding, engine, target, contractId, contractMode, contractStretch, results, summary }) {
  const lines = [];
  lines.push(`# engine_contract_verified — ${runId}`);
  lines.push('');
  lines.push(`**Engine:** ${engine}  |  **Target:** ${target}  |  **Contract:** ${contractId}`);
  lines.push(`**Binding:** ${intentBinding}  |  **Overall:** ${summary.overall}  |  **Alarmed:** ${summary.alarmed}`);
  lines.push('');
  lines.push('| Field | Contract value | Briefing claim | Verdict | Evidence |');
  lines.push('|-------|----------------|----------------|---------|----------|');
  for (const r of results) {
    const cv = r.contract_value === undefined ? '' : String(r.contract_value);
    lines.push(`| ${r.field} | ${cv} | ${r.claim} | ${r.verdict} | ${r.evidence.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  if (summary.alarmed) {
    lines.push('> ⚠ ALARM: at least one Contract Alignment claim contradicts evidence. Routing a HIGH-severity finding to prog-engine-reliability is appropriate.');
  } else if (summary.counts.blocked > 0) {
    lines.push('> Note: a verdict is BLOCKED — measurement data unavailable for the field (legacy run or upstream telemetry gap). Other fields verified against evidence.');
  }
  return lines.join('\n') + '\n';
}

function verify(opts, repoRoot) {
  const runId = opts.runId;
  if (!runId) {
    return { ok: false, exit: 2, error: 'verify: --run-id <run-NNN> is required' };
  }
  const runsDir = opts.runsDir || path.join(repoRoot, DEFAULT_RUNS_DIR);
  const eventsDir = opts.eventsDir || path.join(repoRoot, DEFAULT_EVENTS_DIR);
  const briefingPath = path.join(runsDir, runId, 'artifacts', 'phase-3', 'briefing.md');
  if (!fs.existsSync(briefingPath)) {
    return { ok: false, exit: 2, error: `verify: briefing not found at ${briefingPath}` };
  }
  const briefingText = fs.readFileSync(briefingPath, 'utf8');
  const header = parseBriefingHeader(briefingText);
  if (!header) {
    return { ok: false, exit: 2, error: `verify: could not parse Run/Engine/Target header from ${briefingPath}` };
  }
  if (header.runId && header.runId !== runId) {
    // Header says run-NNN; --run-id said something else. Trust the briefing.
    // (Rare; only happens if the file was misnamed.)
  }
  const claims = parseContractAlignment(briefingText);

  const events = readEventLog(eventsDir);
  const intent = findIntentEvent(events, runId, header.engine, header.target);
  if (!intent) {
    return {
      ok: false,
      exit: 2,
      error: `verify: no engine_intent_recorded event found matching engine=${header.engine}+target=${header.target}`,
    };
  }
  const contract = (intent.event.payload && intent.event.payload.contract) || {};
  const contractId = intent.event.payload && intent.event.payload.contract_id;

  // Optional: read sibling artifacts
  const synthesisPath = path.join(runsDir, runId, 'artifacts', 'phase-3', 'synthesis.md');
  const crossCritiquePath = path.join(runsDir, runId, 'artifacts', 'phase-2', 'cross-critique.md');
  const synthesisText = fs.existsSync(synthesisPath) ? fs.readFileSync(synthesisPath, 'utf8') : '';
  const crossCritiqueText = fs.existsSync(crossCritiquePath) ? fs.readFileSync(crossCritiquePath, 'utf8') : '';

  const results = [];
  const m = verifyMode(claims.mode.claim, contract.mode, synthesisText);
  m.contract_value = contract.mode;
  results.push(m);

  const s = verifyStretch(claims.stretch.claim, contract.stretch, crossCritiqueText);
  s.contract_value = contract.stretch;
  results.push(s);

  const ss = verifySuccessShape(claims.success_shape.claim, contract.success_shape, briefingText, synthesisText);
  ss.contract_value = contract.success_shape;
  results.push(ss);

  // WS-309: pass the matching engine_run_completed event so verifyScopeCeiling
  // can read tokens_derived (preferred source: command_telemetry_stamped;
  // fallback: artifact_size_proxy stamped by cwos-engine-complete.js).
  const runCompletedEvent = events.find(
    (e) => e.payload && e.payload.type === 'engine_run_completed' && e.payload.run_id === runId
  ) || null;
  const sc = verifyScopeCeiling(claims.scope_ceiling.claim, contract.scope_ceiling, runCompletedEvent);
  sc.contract_value = contract.scope_ceiling;
  results.push(sc);

  const summary = summarize(results);

  return {
    ok: true,
    exit: summary.alarmed ? 2 : 0,
    payload: {
      type: 'engine_contract_verified',
      contract_id: contractId,
      run_id: runId,
      engine: header.engine,
      target: header.target,
      verified_at: new Date().toISOString(),
      binding: intent.binding,
      results: results.map((r) => ({
        field: r.field,
        claim: r.claim,
        verdict: r.verdict,
        evidence: r.evidence,
        contract_value: r.contract_value === undefined ? null : r.contract_value,
      })),
      overall: summary.overall,
      alarmed: summary.alarmed,
      counts: summary.counts,
    },
    report: renderReport({
      runId,
      intentBinding: intent.binding,
      engine: header.engine,
      target: header.target,
      contractId,
      contractMode: contract.mode,
      contractStretch: contract.stretch,
      results,
      summary,
    }),
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write('usage: cwos-engine-contract-verify --run-id <run-NNN> [--apply] [--quiet]\n');
    process.exit(0);
  }
  const repoRoot = findRepoRoot(process.cwd());
  const result = verify(opts, repoRoot);
  if (!result.ok) {
    process.stderr.write(result.error + '\n');
    process.exit(result.exit);
  }

  if (!opts.quiet) process.stdout.write(result.report);

  if (opts.apply && appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('engine-contract-verify');
      const r = appendEvent({
        source_track: 'T7:engines',
        source_tier: 'founder-prompt',
        track_tag: '/engine',
        command_id: commandId,
        payload: result.payload,
      });
      if (r && !r.ok) process.stderr.write(`verify: event validation: ${(r.errors || []).join('; ')}\n`);
    } catch (e) {
      process.stderr.write(`verify: event emission failed (non-fatal): ${e.message}\n`);
    }
  } else if (opts.apply) {
    process.stderr.write('verify: --apply requested but core/events helpers unavailable (older kit) — event NOT emitted\n');
  }

  process.exit(result.exit);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseContractAlignment,
  parseBriefingHeader,
  findIntentEvent,
  verifyMode,
  verifyStretch,
  verifySuccessShape,
  verifyScopeCeiling,
  parseTokenCeiling,
  summarize,
  verify,
  renderReport,
};
