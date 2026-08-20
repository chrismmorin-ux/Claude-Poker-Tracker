/**
 * emitConductCard — turn an induced ruleset into the Standard-of-Record form.
 *
 * The procedure produces a description; this makes it a RECORD, so that two descriptions of
 * the same villain can be laid against each other and so that a fault confirmed next month can
 * find the cards that depended on it.
 *
 * WHY THIS DOES NOT USE `buildReplicationManifest` VERBATIM. `manifestProblems` requires the
 * seven REQUIRED_CONSTANTS — PRIOR_WEIGHT, ACTION_TAU_FRACTION, MIN_CONTINUATION_WEIGHT,
 * REFINEMENT_BUDGET_MS, MAX_STAGE_SHARE, REFINEMENT_UNITS_PER_MS, KL_FLOOR. Every one is a
 * constant of the ENGINE's decision model, and the induction that produces a Conduct Card
 * consumes none of them: it reads a labelled table and splits it. Stamping them would assert a
 * dependence that does not exist, which is the same class of dishonesty the manifest was built
 * to stop — the register itself calls the constant set "a floor, not a schema — stamp whatever
 * else a run depends on". So the card carries the manifest's SHAPE with the constant floor that
 * actually applies to it: the induction parameters, which fully determine its rule count.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildConductCard, buildMix } from '../../src/utils/standardOfRecord/conductCard.js';
import { registerVersion } from '../../src/utils/standardOfRecord/faultRegister.js';
import { SCHEMA_VERSION } from './decisionSchema.mjs';

const git = (args, fallback) => {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
  catch { return fallback; }
};

/** sha256 over the corpus slice actually read, so a rerun on a different slice cannot pass as a rerun. */
export const dealBookHashOf = (files) => {
  const h = createHash('sha256');
  for (const f of [...files].map((x) => (typeof x === 'string' ? x : x.path)).sort()) {
    h.update(String(f).replace(/\\/g, '/'));
    h.update('\0');
  }
  return `sha256:${h.digest('hex')}`;
};

/**
 * CANONICAL BODY — an explicit, ordered, FULL-DEPTH projection.
 *
 * The previous one-liner was `JSON.stringify(card, Object.keys(card).sort())`, which reads
 * like a key-ordering and is actually a replacer allowlist applied at every depth. It hashed
 * 639 of 70,195 bytes. Sabotaging every rate, interval, holding, gate and hash inside the card
 * left the digest identical - so every downstream citation of a card by contentHash was
 * citing a rule count.
 *
 * Written as a recursive sort rather than a hand-listed projection because a hand-listed one
 * silently stops covering fields added later, and this schema is explicitly additive.
 */
const canonicalize = (v) => {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonicalize(v[k]);
    return out;
  }
  return v;
};
// Exported so the known-answer check tests THIS function rather than a copy of it. A check
// that reimplements what it verifies is two representations that never have to agree - the
// exact defect this directory has been bitten by twice.
export const canonical = (card) => JSON.stringify(canonicalize(card));

/**
 * The ERA COORDINATES, parsed from the corpus directory name.
 *
 * HandHQ lays its data out as `PS-2009-07-01_2009-07-23_50NLH_OBFU`, which carries the site,
 * the exact date window and the stake — every one of which the card previously reduced to the
 * prose string "online-50NL-2009". Prose does not sort, and an archetype trajectory has to be
 * plotted against something that does.
 *
 * DERIVED FROM THE HANDS THE CARD CONTAINS, never the wider slice that was scanned. Villain 1's
 * 1,544 hands are ALL PokerStars, even though the scan covered Full Tilt files too; stamping the
 * scan's sites would have put a site on his card that he never played on.
 */
const DIR_RE = /(FTP|PS)-(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_([A-Za-z0-9]+)_/;
const SITE = { PS: 'PokerStars', FTP: 'FullTilt' };

export const provenanceOf = (paths, decisions) => {
  const sites = new Set(), starts = [], ends = [], stakes = new Set();
  for (const p of paths) {
    const m = DIR_RE.exec(String(p).split('\\').join('/'));
    if (!m) continue;
    sites.add(SITE[m[1]] || m[1]);
    starts.push(m[2]); ends.push(m[3]); stakes.add(m[4]);
  }
  if (!sites.size) return null;
  const dateStart = starts.sort()[0];
  const dateEnd = ends.sort().slice(-1)[0];
  const spanDays = Math.round(
    (Date.parse(dateEnd) - Date.parse(dateStart)) / 86400000,
  ) + 1;

  // Table size per HAND, not per decision — a 6-handed hand with four decisions in it is one
  // hand, and counting decisions would weight busy hands as if they were extra tables.
  const seatsByHand = new Map();
  for (const d of decisions) if (d.seatsDealt != null) seatsByHand.set(d.handId, d.seatsDealt);
  const tableSizes = {};
  for (const n of seatsByHand.values()) tableSizes[n] = (tableSizes[n] || 0) + 1;

  return {
    site: [...sites].sort().join('+'),
    dateStart, dateEnd, spanDays,
    stake: [...stakes].sort().join('+'),
    tableSizes,
    // Stated because it is the fact most likely to be forgotten when the card is quoted: a
    // 23-day window is a SNAPSHOT of a player, not a career, and a player can change inside one.
    note: `${spanDays} days of play. A snapshot, not a career — this card cannot see change within the subject.`,
  };
};

/**
 * @param {Object} input
 * @param {string} input.subjectId
 * @param {Array}  input.rules       - induced leaves, each carrying `.mix`
 * @param {Array}  input.decisions   - every labelled decision for this subject
 * @param {Array}  input.files       - the corpus files read
 * @param {Array}  input.gates       - the instrument self-checks, already run
 * @param {Object} input.induction   - {minRule, maxDepth, alpha, requireSignificance}
 * @param {Function} input.wilson
 * @param {string} input.population
 */
export const emitConductCard = async ({
  subjectId, rules, decisions, files, gates, induction, wilson, population,
  sourcePaths = null,
}) => {
  const handIds = new Set(decisions.map((d) => d.handId));
  const shown = decisions.filter((d) => d.handKnown);

  // Which shown hands he actually CHOSE to play. A free big-blind showdown reveals what he was
  // dealt, never what he selects, and a composition claim resting on those is resting on noise.
  const voluntaryHands = new Set(
    decisions.filter((d) => d.street === 'preflop'
      && (d.action === 'call' || d.action === 'raise' || d.action === 'bet'))
      .map((d) => d.handId),
  );
  const voluntarilyEnteredShown = new Set(
    shown.filter((d) => voluntaryHands.has(d.handId)).map((d) => d.handId),
  ).size;

  const ordered = [...rules].sort((a, b) => b.n - a.n);
  const ruleId = (r, i) => `r${String(i + 1).padStart(2, '0')}`;

  const mixes = ordered.map((r, i) => buildMix({
    ruleId: ruleId(r, i),
    when: r.conds.map((c) => c.value).join(' AND ') || 'everything else',
    n: r.n,
    actions: r.mix.dist.map(([action, k]) => ({ action, k, ci: wilson(k, r.n) })),
    verdict: r.verdict,
    separators: (r.mix.separators || []).slice(0, 5).map((s) => ({ feature: s.feature, p: s.pAdj })),
    shown: r.pool.filter((d) => d.handKnown)
      .map((d) => ({ cards: d.holeCards.join(''), action: d.action, street: d.street })),
    streets: r.pool.reduce((m, d) => { m[d.street] = (m[d.street] || 0) + 1; return m; }, {}),
  }));

  // The enclosure clause: the leaf that catches whatever the named conditions did not reach.
  const residualIdx = ordered.findIndex((r) => r.conds.some((c) => c.value === 'everything else'));
  const residual = residualIdx >= 0
    ? { ruleId: ruleId(ordered[residualIdx], residualIdx), kind: 'named-everything-else' }
    // A tree whose leaves partition the decision set is enclosed by construction: every
    // decision reaches exactly one leaf. Stated rather than assumed, because "enclosed" is a
    // claim and this is the reason it holds.
    : { ruleId: mixes[mixes.length - 1].ruleId, kind: 'partition-is-total',
        note: 'The induced leaves partition every decision, so the ruleset is enclosed by construction rather than by a named fallback.' };

  const unresolved = mixes
    .filter((m) => m.verdict === 'hidden-cond' || m.verdict === 'needs-cards')
    .map((m) => ({
      ruleId: m.ruleId,
      verdict: m.verdict,
      resolvedBy: m.verdict === 'needs-cards'
        ? 'the range-inference layer — the discriminating fact is his holding, and no amount of additional corpus supplies it'
        : `sample: ${m.separators[0]?.feature ?? 'a named feature'} separates this leaf but every cut lands under the minimum-rule floor`,
    }));

  // OCCUPANCY — the situations he actually lived through. Bounds every downstream claim,
  // because the card is silent outside it and a best response would exploit the silence.
  const occupancy = {
    unit: 'decision',
    total: decisions.length,
    byStreet: decisions.reduce((m, d) => { m[d.street] = (m[d.street] || 0) + 1; return m; }, {}),
    byFacing: decisions.reduce((m, d) => { m[d.facing] = (m[d.facing] || 0) + 1; return m; }, {}),
    note: 'The card describes only these situations. A best-response computed outside this occupancy measures the card\'s holes, not the subject\'s weakness.',
  };

  const card = buildConductCard({
    cardId: `CC-${subjectId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}`,
    subjectId,
    dealBook: {
      dealBookHash: dealBookHashOf(files),
      files: files.length,
      hands: handIds.size,
      decisions: decisions.length,
    },
    evidence: {
      decisions: decisions.length,
      revealedDecisions: shown.length,
      revealedShare: shown.length / decisions.length,
      shownHands: new Set(shown.map((d) => d.handId)).size,
      voluntarilyEnteredShown,
    },
    rules: mixes,
    residual,
    unresolved,
    // ARITY 1 IS THE HONEST VALUE AND IT IS THE POINT OF THE FIELD. `classifyLeaf` tests
    // features one at a time; on 2026-08-18 an independent search over 113,704 OR-combinations
    // refuted a mix verdict this search had produced. Declaring the arity is what keeps "no
    // separator found" from being read as "no separator exists".
    separatorSearch: {
      arity: 1,
      correction: 'bonferroni, one family of m observable features plus the card test',
      /**
       * MEASURED FROM THE RUN, not typed. The family size is the number of hypotheses the
       * verdict was actually chosen among, and it moved on 2026-08-19 when the card test was
       * brought inside the same correction as the features it competes with. Before that the
       * features were corrected and the card test was not, so a separator at raw p=0.012 could
       * lose to a card test at p=0.032 and the leaf would be published as "only his cards
       * resolve it" - the one verdict that says more corpus cannot help.
       */
      familySize: (() => {
        const sizes = ordered.map((r) => r.mix?.family).filter((x) => Number.isFinite(x));
        if (!sizes.length) return null;
        return { min: Math.min(...sizes), max: Math.max(...sizes), leaves: sizes.length };
      })(),
      alpha: induction.alpha,
      combinationsSearched: false,
      note: 'Single features only, each leaf corrected over its own family of testable features plus the card test. A disjunction of three conditions refuted one of these verdicts at corrected p=0.024 on 2026-08-18, so every mix here is provisional until the search covers combinations. Separately, on 2026-08-19 analysts given single leaves blind found observable separators in two spots this arity-1 search had labelled needs-cards.',
    },
    induction,
    gates,
    occupancy,
    manifest: {
      engineCommit: git(['rev-parse', 'HEAD'], 'unknown'),
      engineDirty: git(['status', '--porcelain'], '') !== '',
      dealBookHash: dealBookHashOf(files),
      schemaVersion: SCHEMA_VERSION,
      seeds: {},
      // A POSITIVE CLAIM of bit-reproducibility: the induction draws no randomness at all, so
      // an empty list here is a statement rather than an omission.
      unseededSources: [],
      constants: induction,
      constantFloorNote: 'The Result Card REQUIRED_CONSTANTS are engine-model constants and this induction consumes none of them; stamping them would assert a dependence that does not exist. These four fully determine the rule count.',
    },
    // AWAITED. `registerVersion` is async; calling it bare stamped a Promise, and the card
    // validator caught it on the first live run — which is what the validator is for.
    disclaimerRegisterVersion: await registerVersion(),
    population,
    provenance: provenanceOf(
      sourcePaths || files.map((f) => (typeof f === 'string' ? f : f.path)),
      decisions,
    ),
  });

  card.contentHash = `sha256:${createHash('sha256').update(canonical(card)).digest('hex')}`;
  return card;
};
