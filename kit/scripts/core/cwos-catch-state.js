/**
 * cwos-catch-state.js — Step-3 classifier per ADR-040 / ADR-018 cascade.
 *
 * Catch-state surfaces engine candidates from conversation signals BEFORE
 * the engine is invoked. Two output modes:
 *   PREDICTIVE     — no engine context; suggest one based on signals
 *   DISAMBIGUATING — active engine context; suggest a better-fit alternative
 *
 * Architecture (ADR-040 Decision #1): rule-tier (R1–R6) → LLM fallback.
 * Confidence gate at 0.6 (Decision #8); below-threshold suggestions are
 * recorded as `engine_candidate_suppressed` for tuning, never surfaced.
 *
 * v1 scope (WS-298): rules + stub LLM interface + 3 event schemas + AS-CATCH-1
 * baseline script. Live LLM wiring + WS-276 surface integration land in WS-299.
 *
 * Zero external deps (CWOS convention).
 */

'use strict';

const CONFIDENCE_THRESHOLD = 0.6;
const ENGINE_RELEVANCE_TURNS = 5;
const PRE_FILL_WINDOW_TURNS = 10;

// ─── Constants ─────────────────────────────────────────────────────────────

// Engines this classifier can suggest. Source-of-truth is engines/{standard,library}/
// directory listings; this list is the v1 surface.
const KNOWN_ENGINES = new Set([
  'decision-enhance',
  'plan-enhance',
  'sprint-enhance',
  'item-enhance',
  'eng-engine',
  'design-critique',
  'design-audit',
  'compliance-audit',
  'claims-audit',
  'domain-audit',
  'financial-audit',
  'provenance-audit',
  'legal-safety',
  'incident-response',
  'context-curator',
  'business-engine',
  'research-review',
  'traction',
  'refactor-prep',
  'migration-prep',
  'upgrade-prep',
]);

// R6 keyword → engine mapping. Specificity-weighted: longer/rarer keywords carry
// higher confidence than common words.
const FAILURE_MODE_KEYWORDS = [
  { kw: /\bcompliance\b/i, engine: 'compliance-audit', confidence: 0.78 },
  { kw: /\bclaims?\b/i, engine: 'claims-audit', confidence: 0.72 },
  { kw: /\bdomain\b/i, engine: 'domain-audit', confidence: 0.65 },
  { kw: /\bfinanc(?:ial|ing|e)\b/i, engine: 'financial-audit', confidence: 0.75 },
  { kw: /\bprovenance\b/i, engine: 'provenance-audit', confidence: 0.85 },
  { kw: /\b(?:legal|liability|terms[- ]of[- ]service)\b/i, engine: 'legal-safety', confidence: 0.78 },
  { kw: /\b(?:incident|outage|on[- ]?call)\b/i, engine: 'incident-response', confidence: 0.8 },
  { kw: /\brefactor\b/i, engine: 'refactor-prep', confidence: 0.72 },
  { kw: /\bmigrat(?:e|ion|ing)\b/i, engine: 'migration-prep', confidence: 0.75 },
  { kw: /\b(?:upgrade|version[- ]bump|major[- ]bump)\b/i, engine: 'upgrade-prep', confidence: 0.7 },
];

// Per-engine mode/contract pre-fill defaults. Conservative — overridden by
// rule-specific shape where the rule has stronger context.
const ENGINE_CONTRACT_DEFAULTS = {
  'decision-enhance': { mode: 'decide', stretch: false, success_shape: 'structured tradeoff matrix with ranked options + recommended path', scope_ceiling: 'rounds:8' },
  'plan-enhance':     { mode: 'explore', stretch: false, success_shape: 'phased plan with explicit dependencies + open questions', scope_ceiling: 'rounds:6' },
  'sprint-enhance':   { mode: 'decide', stretch: false, success_shape: 'sprint composition with anti-goal cross-check', scope_ceiling: 'rounds:5' },
  'eng-engine':       { mode: 'build-best', stretch: false, success_shape: '8-12 ranked findings with calibration', scope_ceiling: 'token:80k' },
  'design-critique':  { mode: 'decide', stretch: false, success_shape: 'ranked critique with severity tags', scope_ceiling: 'token:60k' },
  'design-audit':     { mode: 'decide', stretch: false, success_shape: 'ranked findings with severity tags', scope_ceiling: 'token:80k' },
  'compliance-audit': { mode: 'decide', stretch: false, success_shape: 'compliance gap report with severity tags', scope_ceiling: 'token:60k' },
  'claims-audit':     { mode: 'decide', stretch: false, success_shape: 'claims inventory with backing-evidence map', scope_ceiling: 'token:60k' },
  'research-review':  { mode: 'explore', stretch: false, success_shape: 'review with open questions + suggested next probes', scope_ceiling: 'rounds:6' },
};

function defaultContractFor(engine) {
  return ENGINE_CONTRACT_DEFAULTS[engine] || { mode: 'decide', stretch: false, success_shape: null, scope_ceiling: 'rounds:5' };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function lastFounderTurn(turns) {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'founder') return turns[i];
  return null;
}

function recentFounderText(turns, n) {
  const out = [];
  for (let i = turns.length - 1; i >= 0 && out.length < n; i--) {
    if (turns[i].role === 'founder') out.push(turns[i].text || '');
  }
  return out.reverse().join('\n');
}

function extractTargetFromText(text) {
  // Heuristic target extraction: file paths, prog-* names, "design doc",
  // "plan", quoted ws ids.
  const m1 = text.match(/\bprog-[\w-]+\b/);
  if (m1) return { value: m1[0], type: 'program' };
  const m2 = text.match(/\b[\w/.-]+\.(?:md|js|yaml|json|tsx?|jsx?|py)\b/);
  if (m2) return { value: m2[0], type: 'file' };
  if (/\bdesign[- ]?(?:doc|spec|review)\b/i.test(text)) return { value: 'design-doc', type: 'design' };
  if (/\bplan(?:[- ]doc)?\b/i.test(text)) return { value: 'plan', type: 'plan' };
  if (/\bWS-\d{3}\b/.test(text)) return { value: text.match(/\bWS-\d{3}\b/)[0], type: 'ws' };
  return null;
}

function targetTypeToEngine(type) {
  if (type === 'program') return 'eng-engine';
  if (type === 'design') return 'design-critique';
  if (type === 'plan') return 'plan-enhance';
  if (type === 'ws') return 'item-enhance';
  if (type === 'file') return 'design-critique';
  return 'research-review';
}

// ─── Rules R1–R6 ──────────────────────────────────────────────────────────

/**
 * R1: tradeoff phrasing — "should I X or Y" / "X vs Y" / "X or Y".
 * Mode: DISAMBIGUATING if active engine context, else PREDICTIVE.
 */
function R1(input) {
  const last = lastFounderTurn(input.conversationTurns);
  if (!last) return { fires: false };
  const text = last.text || '';
  // "should I/we ... or ..." within a single sentence
  const tradeoff = /\bshould\s+(?:i|we)\s+[\w\s,'"`-]{1,80}\bor\b/i.test(text)
                || /\b(?:choose|pick|decide)\s+between\b/i.test(text)
                || /\b\w[\w-]*\s+vs\.?\s+\w[\w-]*\b/i.test(text)
                || /\beither\s+\w+[\w\s,'"`-]{1,40}\bor\b/i.test(text);
  if (!tradeoff) return { fires: false };
  const mode = input.activeEngineContext ? 'DISAMBIGUATING' : 'PREDICTIVE';
  const target = extractTargetFromText(text);
  // Confidence: explicit "should I/we" question is highest signal.
  let confidence = 0.7;
  if (/\bshould\s+(?:i|we)\b/i.test(text)) confidence = 0.82;
  if (/\bchoose\s+between\b/i.test(text)) confidence = 0.85;
  return {
    fires: true,
    mode,
    suggested_engine: 'decision-enhance',
    suggested_target: target ? target.value : null,
    suggested_contract: defaultContractFor('decision-enhance'),
    confidence,
  };
}

/**
 * R2: ≥3 options listed adjacent to tradeoff/choice vocab.
 */
function R2(input) {
  const text = recentFounderText(input.conversationTurns, 3);
  const numbered = text.match(/^\s*[1-9][.)]\s+\S/gm) || [];
  const bulleted = text.match(/^\s*[-*]\s+\S/gm) || [];
  const items = numbered.length + bulleted.length;
  if (items < 3) return { fires: false };
  const hasTradeoffVocab = /\b(?:tradeoffs?|trade[- ]?offs?|pros?\s+and\s+cons?|alternatives?|options?)\b/i.test(text);
  if (!hasTradeoffVocab) return { fires: false };
  const target = extractTargetFromText(text);
  return {
    fires: true,
    mode: 'PREDICTIVE',
    suggested_engine: 'decision-enhance',
    suggested_target: target ? target.value : null,
    suggested_contract: defaultContractFor('decision-enhance'),
    confidence: items >= 5 ? 0.78 : 0.7,
  };
}

/**
 * R3: target file/program described in detail across ≥3 founder turns,
 * no engine invoked.
 */
function R3(input) {
  if (input.activeEngineContext) return { fires: false };
  // Scan recent founder turns for repeated target reference.
  const founderTurns = input.conversationTurns.filter((t) => t.role === 'founder').slice(-8);
  if (founderTurns.length < 3) return { fires: false };
  const targetCounts = new Map();
  for (const t of founderTurns) {
    const tgt = extractTargetFromText(t.text || '');
    if (!tgt) continue;
    const key = `${tgt.type}:${tgt.value}`;
    targetCounts.set(key, (targetCounts.get(key) || 0) + 1);
  }
  let dominantKey = null, dominantCount = 0;
  for (const [k, n] of targetCounts) if (n > dominantCount) { dominantKey = k; dominantCount = n; }
  if (dominantCount < 3) return { fires: false };
  const [type, value] = dominantKey.split(':');
  const engine = targetTypeToEngine(type);
  return {
    fires: true,
    mode: 'PREDICTIVE',
    suggested_engine: engine,
    suggested_target: value,
    suggested_contract: defaultContractFor(engine),
    confidence: dominantCount >= 5 ? 0.8 : 0.68,
  };
}

/**
 * R4: "should we" / "is this right" / "what would break" without engine.
 */
function R4(input) {
  if (input.activeEngineContext) return { fires: false };
  const last = lastFounderTurn(input.conversationTurns);
  if (!last) return { fires: false };
  const text = last.text || '';
  const patterns = [
    /\bshould\s+we\b/i,
    /\bis\s+this\s+right\b/i,
    /\bwhat\s+(?:would|might|could)\s+break\b/i,
    /\bdoes\s+this\s+make\s+sense\b/i,
    /\bam\s+i\s+(?:missing|overlooking)\b/i,
  ];
  if (!patterns.some((re) => re.test(text))) return { fires: false };
  // Differentiate decision vs design-critique by content:
  // "what would break" / "is this right" leans design-critique (validate);
  // "should we" / "does this make sense" leans decision-enhance.
  const designLean = /\bwhat\s+(?:would|might|could)\s+break\b/i.test(text)
                  || /\bis\s+this\s+right\b/i.test(text);
  const engine = designLean ? 'design-critique' : 'decision-enhance';
  const target = extractTargetFromText(text);
  return {
    fires: true,
    mode: 'PREDICTIVE',
    suggested_engine: engine,
    suggested_target: target ? target.value : null,
    suggested_contract: defaultContractFor(engine),
    confidence: 0.65,
  };
}

/**
 * R5: planning vocabulary — "plan how to", "scope the work", "break this down".
 */
function R5(input) {
  const last = lastFounderTurn(input.conversationTurns);
  if (!last) return { fires: false };
  const text = last.text || '';
  const patterns = [
    /\bplan\s+how\s+to\b/i,
    /\bscope\s+(?:the|this|that|out\s+the)\s+work\b/i,
    /\bbreak\s+(?:this|it|the\s+work)\s+(?:down|into)\b/i,
    /\bphase\s+(?:this|it)\s+out\b/i,
    /\bsequence\s+(?:the|this)\s+work\b/i,
  ];
  if (!patterns.some((re) => re.test(text))) return { fires: false };
  const target = extractTargetFromText(text);
  return {
    fires: true,
    mode: 'PREDICTIVE',
    suggested_engine: 'plan-enhance',
    suggested_target: target ? target.value : null,
    suggested_contract: defaultContractFor('plan-enhance'),
    confidence: 0.78,
  };
}

/**
 * R6: failure-mode keywords adjacent to a target → corresponding library engine.
 */
function R6(input) {
  const text = recentFounderText(input.conversationTurns, 2);
  if (!text) return { fires: false };
  const target = extractTargetFromText(text);
  for (const { kw, engine, confidence } of FAILURE_MODE_KEYWORDS) {
    if (kw.test(text)) {
      // Require target proximity for confidence; isolated keyword is weak signal.
      const adj = target ? confidence : Math.max(0.4, confidence - 0.2);
      return {
        fires: true,
        mode: 'PREDICTIVE',
        suggested_engine: engine,
        suggested_target: target ? target.value : null,
        suggested_contract: defaultContractFor(engine),
        confidence: adj,
      };
    }
  }
  return { fires: false };
}

const RULES = [
  { name: 'R1', fn: R1 },
  { name: 'R2', fn: R2 },
  { name: 'R3', fn: R3 },
  { name: 'R4', fn: R4 },
  { name: 'R5', fn: R5 },
  { name: 'R6', fn: R6 },
];

// ─── LLM fallback (stub for WS-298; live wiring in WS-299) ────────────────

/**
 * LLM fallback interface. v1 returns null — wiring lands in WS-299.
 * Fires only when no rule matches AND ≥ENGINE_RELEVANCE_TURNS engine-relevant
 * founder turns have accumulated in recentEvents (per ADR-040 Decision #4).
 */
async function llmFallback(/* input */) {
  return { suggestion: null, suppressed: null, provider: 'stub', reason: 'WS-299 wires the live provider' };
}

function isEngineRelevantConversation(input) {
  const founderTurns = input.conversationTurns.filter((t) => t.role === 'founder');
  if (founderTurns.length < ENGINE_RELEVANCE_TURNS) return false;
  // Engine-relevance heuristic: presence of decision/planning/target vocab in
  // the recent founder turns. Conservative: require at least one signal.
  const text = founderTurns.slice(-ENGINE_RELEVANCE_TURNS).map((t) => t.text || '').join('\n');
  return /\b(?:decide|decision|plan|scope|tradeoff|design|implement|prog-|\.md\b)/i.test(text);
}

// ─── Classify (entry point) ────────────────────────────────────────────────

/**
 * Classify a conversation snapshot into an engine candidate suggestion.
 *
 * @param {object} input
 *   conversationTurns: [{role: 'founder'|'assistant', text, ts?}]
 *   activeEngineContext: string | null  — engine_id of last invocation
 *   recentEvents: array  — cumulative event log (for engine-relevance check)
 * @param {object} opts (optional)
 *   llmFallback: async (input) → suggestion | null  — override for tests
 *
 * @returns {{ suggestion, suppressed, fallbackUsed, ruleHits, latencyMs }}
 *   suggestion: engine_candidate_suggested payload | null
 *   suppressed: engine_candidate_suppressed payload | null (mutually exclusive with suggestion)
 *   fallbackUsed: boolean
 *   ruleHits: ['R1', 'R3', ...]  — names of rules that fired (for AS-CATCH-1 telemetry)
 *   latencyMs: number  — wall time spent classifying
 */
async function classify(input, opts) {
  const t0 = Date.now();
  opts = opts || {};
  const fallback = opts.llmFallback || llmFallback;

  const ruleHits = [];
  let firstHit = null;
  for (const { name, fn } of RULES) {
    const r = fn(input);
    if (r.fires) {
      ruleHits.push(name);
      if (!firstHit) firstHit = { name, ...r };
    }
  }

  let candidate = firstHit;
  let fallbackUsed = false;

  if (!candidate && isEngineRelevantConversation(input)) {
    fallbackUsed = true;
    const fbResult = await fallback(input);
    if (fbResult && fbResult.suggestion) candidate = { name: 'LLM', ...fbResult.suggestion };
  }

  const latencyMs = Date.now() - t0;
  if (!candidate) return { suggestion: null, suppressed: null, fallbackUsed, ruleHits, latencyMs };

  const payloadBase = {
    trigger_signals: ruleHits.length ? ruleHits : ['LLM'],
    mode: candidate.mode,
    active_engine_context: input.activeEngineContext || null,
    suggested_engine: candidate.suggested_engine,
    suggested_target: candidate.suggested_target || null,
    suggested_contract: candidate.suggested_contract || null,
    confidence: candidate.confidence,
    alternatives_considered: ruleHits
      .filter((n) => n !== (firstHit && firstHit.name))
      .map((n) => {
        const r = RULES.find((x) => x.name === n).fn(input);
        return { engine_id: r.suggested_engine, why_not: `lower-priority match (${n})` };
      }),
  };

  if (candidate.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      suggestion: { type: 'engine_candidate_suggested', ...payloadBase },
      suppressed: null,
      fallbackUsed,
      ruleHits,
      latencyMs,
    };
  }
  return {
    suggestion: null,
    suppressed: {
      type: 'engine_candidate_suppressed',
      ...payloadBase,
      suppressed_reason: `below_threshold (confidence=${candidate.confidence} < ${CONFIDENCE_THRESHOLD})`,
    },
    fallbackUsed,
    ruleHits,
    latencyMs,
  };
}

module.exports = {
  classify,
  R1, R2, R3, R4, R5, R6,
  RULES,
  llmFallback,
  isEngineRelevantConversation,
  extractTargetFromText,
  targetTypeToEngine,
  defaultContractFor,
  CONFIDENCE_THRESHOLD,
  ENGINE_RELEVANCE_TURNS,
  PRE_FILL_WINDOW_TURNS,
  KNOWN_ENGINES,
  FAILURE_MODE_KEYWORDS,
};
