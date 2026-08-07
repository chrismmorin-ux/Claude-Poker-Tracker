/**
 * atomsSelfCheck.mjs — the standing check that stops the atom store becoming dead weight (WS-328).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS ENFORCES.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Every captured field ships with at least one query that reads it, written at capture time, in
 * a standing self-check that runs after every Match and prints the field's distribution. If you
 * cannot write the query, you do not yet understand what the field is for, and the field is
 * speculation rather than instrumentation.
 *
 * The rule exists because the repo has already failed this exact way: `predictionAudit` capture
 * shipped and nothing ever read it. Data captured but never queried is WORSE than absent — it
 * looks like coverage, costs run time, and rots silently because nothing exercises it.
 *
 * ENFORCEMENT IS BY SCHEMA DIFF, NOT BY DISCIPLINE. `missingReaders` walks
 * `SOR_SCHEMAS.decisionAtom` and the atom-set manifest and reports any field with no reader
 * registered below. Add a field to the schema without adding a reader here and the check fails
 * on the next run. A checklist in a docblock cannot do that; this can.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * DEPTH, AND WHY A GREEN TICK IS NOT ENOUGH.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Proving a field is QUERIED does not prove the query was the RIGHT one: a reader that prints a
 * distribution satisfies the gate completely while supporting no inference at all. That is the
 * predictionAudit failure moved one level up — from "is it read" to "is it understood". So each
 * reader declares a `READER_DEPTHS` value and the check reports the MIX rather than a boolean.
 * `descriptive` is a legitimate and common answer; it is only dangerous when it is invisible.
 */

import { SOR_SCHEMAS, READER_DEPTHS } from '../../src/utils/standardOfRecord/schemas.js';

/** Fields that live on the atom SET manifest rather than on an atom. */
export const ATOM_SET_MANIFEST_FIELDS = Object.freeze([
  'atomSetId', 'surfaceId', 'fullSampleRate', 'seatOccupancy', 'atomCount', 'anchorGeneration',
]);

const D = READER_DEPTHS;

const count = (atoms, pred) => atoms.reduce((n, a) => n + (pred(a) ? 1 : 0), 0);
const present = (atoms, field) => count(atoms, (a) => a[field] !== null && a[field] !== undefined);
const histogram = (atoms, keyOf) => {
  const h = {};
  for (const a of atoms) {
    const k = String(keyOf(a));
    h[k] = (h[k] ?? 0) + 1;
  }
  return h;
};
const topN = (h, n = 6) => Object.fromEntries(
  Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, n),
);

/**
 * ONE READER PER CAPTURED FIELD.
 *
 * `question` is the FORCING QUESTION the field exists to answer, restated at the point of
 * reading so a reader that has drifted from its field's purpose is visible in the output.
 */
export const ATOM_READERS = Object.freeze([
  { field: 'schemaVersion', depth: D.DESCRIPTIVE,
    question: 'Are all atoms in this set the same schema version?',
    read: (atoms) => ({ versions: histogram(atoms, (a) => a.schemaVersion) }) },

  { field: 'atomId', depth: D.INFERENTIAL,
    question: 'Is any decision double-counted?',
    read: (atoms) => {
      const ids = new Set(atoms.map((a) => a.atomId));
      return { unique: ids.size, total: atoms.length, duplicates: atoms.length - ids.size };
    } },

  { field: 'situationKey', depth: D.INFERENTIAL,
    question: 'How much of the situation space did this run touch, and how thin is the tail?',
    read: (atoms) => {
      const h = histogram(atoms, (a) => a.situationKey);
      const keys = Object.values(h);
      return {
        distinctKeys: keys.length,
        singletonKeys: keys.filter((n) => n === 1).length,
        medianPerKey: keys.sort((x, y) => x - y)[Math.floor(keys.length / 2)] ?? 0,
        top: topN(h),
      };
    } },

  { field: 'carried', depth: D.DESCRIPTIVE,
    question: 'Which carried axes actually arrived, and which are silently empty?',
    read: (atoms) => {
      const seen = {};
      for (const a of atoms) for (const k of Object.keys(a.carried ?? {})) seen[k] = (seen[k] ?? 0) + 1;
      return { axesPresent: seen, atomsWithNoCarriedContext: count(atoms, (a) => Object.keys(a.carried ?? {}).length === 0) };
    } },

  { field: 'surfaceId', depth: D.INFERENTIAL,
    question: 'Can every atom be attributed to a surface?',
    read: (atoms) => ({ surfaces: histogram(atoms, (a) => a.surfaceId) }) },

  { field: 'action', depth: D.INFERENTIAL,
    question: 'How often did the surface actually emit a distribution?',
    read: (atoms) => {
      const scored = count(atoms, (a) => Object.keys(a.action ?? {}).length > 0);
      const pure = count(atoms, (a) => Object.values(a.action ?? {}).some((w) => w >= 0.999));
      return {
        scored, total: atoms.length,
        scoredGivenModeled: atoms.length ? scored / atoms.length : null,
        conditional: 'P(distribution emitted | node was modeled)',
        pureActions: pure,
        actionsSeen: topN(histogram(atoms.flatMap((a) => Object.keys(a.action ?? {})).map((k) => ({ k })), (x) => x.k), 10),
      };
    } },

  { field: 'ruleId', depth: D.INFERENTIAL,
    question: 'Which rules fired versus the residual clause? (null ruleId IS the residual)',
    read: (atoms) => {
      const residual = count(atoms, (a) => a.ruleId === null);
      return {
        residualShare: atoms.length ? residual / atoms.length : null,
        conditional: 'P(residual clause fired | a decision was made)',
        rules: topN(histogram(atoms, (a) => a.ruleId ?? '(residual)')),
      };
    } },

  { field: 'warrant', depth: D.INFERENTIAL,
    question: 'What is EV by warrant class — how much rests on rules the author labelled fear?',
    read: (atoms) => ({
      warrants: histogram(atoms, (a) => a.warrant ?? '(none declared)'),
      note: 'EV-by-warrant needs an outcome join; the warrant column is here and populated by '
        + 'Declared surfaces. A reconstructed audit has no per-rule warrant, hence (none declared).',
    }) },

  { field: 'layers', depth: D.INFERENTIAL,
    question: 'Which layer is wrong, independently of whether the recommendation was?',
    read: (atoms) => {
      const h = {};
      for (const a of atoms) for (const l of a.layers ?? []) h[l.layer] = (h[l.layer] ?? 0) + 1;
      return {
        layerEmissions: h,
        atomsWithNoStack: count(atoms, (a) => (a.layers ?? []).length === 0),
        note: 'Empty until the surface declares a Stack (WS-324). Zero here is a COVERAGE fact, '
          + 'not a finding — layer probes cannot run on this set.',
      };
    } },

  { field: 'outcome', depth: D.INFERENTIAL,
    question: 'What actually happened, so a prediction can be scored at all?',
    read: (atoms) => ({
      withOutcome: present(atoms, 'outcome'),
      observedActions: topN(histogram(atoms, (a) => a.outcome?.observedAction ?? '(none)'), 10),
      conditional: 'counts of the REALIZED action, over modeled nodes',
    }) },

  { field: 'skipReason', depth: D.INFERENTIAL,
    question: 'Why is coverage thin here — WHICH decisions were unscorable, and for what reason?',
    read: (atoms) => ({
      skipped: count(atoms, (a) => a.skipReason !== null),
      reasons: histogram(atoms.filter((a) => a.skipReason), (a) => a.skipReason),
      note: 'Atom-level, not a run-level counter. A counter says 40% were skipped; this says '
        + 'WHICH contexts, which is what makes "why is 4-bet coverage thin?" answerable.',
    }) },

  { field: 'alternativeScores', depth: D.INFERENTIAL,
    question: 'How close was this decision? Near-ties are where strategies differ.',
    read: (atoms) => {
      const withScores = atoms.filter((a) => a.alternativeScores?.margin != null);
      const margins = withScores.map((a) => a.alternativeScores.margin).sort((x, y) => x - y);
      const q = (p) => (margins.length ? margins[Math.min(margins.length - 1, Math.floor(p * margins.length))] : null);
      return {
        withMargin: withScores.length,
        marginP10: q(0.10), marginMedian: q(0.50), marginP90: q(0.90),
        nearTies: margins.filter((m) => m < 0.10).length,
        conditional: 'top-two margin, over atoms whose surface scored 2+ alternatives',
      };
    } },

  { field: 'rulesMatchedAndLost', depth: D.INFERENTIAL,
    question: 'What would rule-level ablation say, without a re-run?',
    read: (atoms) => ({
      atomsWithContenders: count(atoms, (a) => (a.rulesMatchedAndLost ?? []).length > 0),
      note: 'Populated by Declared surfaces, whose ordered rules can lose. Zero on a reconstructed '
        + 'audit is a property of the surface, not a gap in the capture.',
    }) },

  { field: 'beliefState', depth: D.INFERENTIAL,
    question: 'What did we believe each opponent held here? (input to the belief-vs-truth join)',
    read: (atoms) => ({
      withBelief: present(atoms, 'beliefState'),
      joinableWithTruth: count(atoms, (a) => a.beliefState != null && a.truth?.basis === 'observed'),
      conditional: 'atoms carrying BOTH a belief and an OBSERVED truth — the only rows a '
        + 'calibration claim may use; hypothesized-basis rows are a category error, not noise',
    }) },

  { field: 'truth', depth: D.INFERENTIAL,
    question: 'What did they actually hold, and was the belief observed or hypothesized?',
    read: (atoms) => ({
      withTruth: present(atoms, 'truth'),
      byBasis: histogram(atoms.filter((a) => a.truth), (a) => a.truth.basis),
      conditional: 'P(holding revealed | node modeled) — SHOWDOWN-SELECTED, so this subset is '
        + 'biased toward hands that got called down and is not a random sample of decisions',
    }) },

  { field: 'seeds', depth: D.INFERENTIAL,
    question: 'Can this exact decision be replayed bit-for-bit?',
    read: (atoms) => {
      const named = new Set();
      for (const a of atoms) for (const k of Object.keys(a.seeds ?? {})) named.add(k);
      const withNone = count(atoms, (a) => Object.keys(a.seeds ?? {}).length === 0);
      return {
        seedNames: [...named],
        atomsWithNoSeeds: withNone,
        replayable: atoms.length ? (atoms.length - withNone) / atoms.length : null,
        conditional: 'P(the decision names at least one seed | atom). A decision with no seeds '
          + 'is replayable only if it is deterministic — which is a claim, not a default.',
      };
    } },

  { field: 'actorSeat', depth: D.INFERENTIAL,
    question: 'Are villain decisions captured, or is this a hero-only log?',
    read: (atoms) => ({ seats: histogram(atoms, (a) => a.actorSeat ?? '(none)') }) },

  { field: 'actorRole', depth: D.INFERENTIAL,
    question: 'Does the table play back differently against card A vs card B?',
    read: (atoms) => {
      const roles = histogram(atoms, (a) => a.actorRole ?? '(none)');
      return {
        roles,
        note: 'Villain rows present means the question is REACHABLE in principle. It is NOT '
          + 'answerable on a recorded corpus: those villains never saw our card, so their actions '
          + 'cannot respond to it. A responsive Field (WS-326) is the missing half.',
      };
    } },

  { field: 'wallTimeMs', depth: D.INFERENTIAL,
    question: 'Is this card affordable to run?',
    read: (atoms) => {
      const t = atoms.map((a) => a.wallTimeMs).filter(Number.isFinite);
      return {
        measured: t.length,
        totalMs: t.reduce((s, x) => s + x, 0),
        meanMs: t.length ? t.reduce((s, x) => s + x, 0) / t.length : null,
      };
    } },

  { field: 'tokens', depth: D.DESCRIPTIVE,
    question: 'What did an AI-authored decision cost in tokens?',
    read: (atoms) => {
      const t = atoms.map((a) => a.tokens).filter(Number.isFinite);
      return { measured: t.length, totalTokens: t.reduce((s, x) => s + x, 0) };
    } },

  // ── v3 (WS-431): atomId's parts, run coordinates, omission discriminator. ─────────────
  { field: 'playerId', depth: D.INFERENTIAL,
    question: 'Can these atoms be JOINED against a decision record or future run — are the id parts present, not just their hash?',
    read: (atoms) => ({
      withParts: count(atoms, (a) => a.playerId != null && a.handId != null && a.order != null),
      total: atoms.length,
      players: new Set(atoms.map((a) => a.playerId).filter((p) => p != null)).size,
    }) },
  { field: 'handId', depth: D.DESCRIPTIVE,
    question: 'How many atoms share a hand — the within-hand correlation structure?',
    read: (atoms) => {
      const h = histogram(atoms.filter((a) => a.handId != null), (a) => `${a.playerId}|${a.handId}`);
      const per = Object.values(h);
      return { hands: per.length, maxAtomsPerHand: per.length ? Math.max(...per) : 0 };
    } },
  { field: 'order', depth: D.DESCRIPTIVE,
    question: 'Where in hands do these decisions sit?',
    read: (atoms) => ({ withOrder: count(atoms, (a) => Number.isFinite(a.order)) }) },
  { field: 'stable', depth: D.INFERENTIAL,
    question: 'Is each atom tied to its record row and admission wave — duplicate-free canonical coordinates?',
    read: (atoms) => {
      const keys = atoms.filter((a) => a.stable).map((a) => `${a.stable.p}|${a.stable.k}|${a.stable.d}|${a.surfaceId}`);
      return { withStable: keys.length, duplicates: keys.length - new Set(keys).size };
    } },
  { field: 'omissions', depth: D.DESCRIPTIVE,
    question: 'What was DELIBERATELY not captured, with what stated reason?',
    read: (atoms) => {
      const reasons = {};
      for (const a of atoms) for (const [f, why] of Object.entries(a.omissions ?? {})) reasons[`${f}: ${why}`] = (reasons[`${f}: ${why}`] ?? 0) + 1;
      return { omissions: topN(reasons, 8) };
    } },
]);

/** Readers for the atom SET manifest — the facts that are true of the run, not of a decision. */
export const MANIFEST_READERS = Object.freeze([
  { field: 'atomSetId', depth: D.DESCRIPTIVE, question: 'Which set is this?',
    read: (_atoms, m) => ({ atomSetId: m?.atomSetId ?? null }) },
  { field: 'surfaceId', depth: D.DESCRIPTIVE, question: 'Which surface produced it?',
    read: (_atoms, m) => ({ surfaceId: m?.surfaceId ?? null }) },
  { field: 'fullSampleRate', depth: D.INFERENTIAL,
    question: 'How exact can a layer ablation over this set be?',
    read: (atoms, m) => {
      const full = atoms.reduce((n, a) => n + ((a.layers ?? []).some((l) => l.valueKind === 'full') ? 1 : 0), 0);
      return {
        declaredRate: m?.fullSampleRate ?? null,
        observedFullAtoms: full,
        note: 'The rate is RECORDED, never inferred from how many full values are present — a low '
          + 'rate, a crashed run and a dropped filter are three different facts with opposite '
          + 'meanings. Declared vs observed disagreeing is the signal.',
      };
    } },
  { field: 'seatOccupancy', depth: D.INFERENTIAL,
    question: 'Does this card earn more against a table that has been together two hours?',
    read: (_atoms, m) => {
      const spans = m?.seatOccupancy ?? [];
      const lengths = spans.map((s) => s.handsSeated).filter(Number.isFinite);
      return {
        spans: spans.length,
        distinctPlayers: new Set(spans.map((s) => s.playerId)).size,
        medianHandsSeated: lengths.length
          ? lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)] : null,
        note: 'Without this the table-history question is permanently unanswerable — it cannot be '
          + 'recovered from atoms, because occupancy is a property of the table over time.',
      };
    } },
  { field: 'atomCount', depth: D.INFERENTIAL,
    question: 'Was the set truncated? A short read must not read as a small sample.',
    read: (atoms, m) => ({ declared: m?.atomCount ?? null, readable: atoms.length,
      agrees: m?.atomCount === atoms.length }) },
  { field: 'anchorGeneration', depth: D.INFERENTIAL,
    question: 'Which Deal Book generation does this set stand on?',
    read: (_atoms, m) => ({ anchorGeneration: m?.anchorGeneration ?? null }) },
]);

/**
 * Which schema fields have NO reader. Non-empty means the check fails.
 *
 * This is the anti-rot rule made mechanical: the schema is the source of truth for what is
 * captured, so a field added there without a reader here is detected by DIFF, not by memory.
 */
export const missingReaders = ({ atomSchema = SOR_SCHEMAS.decisionAtom } = {}) => {
  const atomCovered = new Set(ATOM_READERS.map((r) => r.field));
  const manifestCovered = new Set(MANIFEST_READERS.map((r) => r.field));
  const missing = [];
  for (const f of atomSchema) {
    if (!atomCovered.has(f.name)) missing.push(`decisionAtom.${f.name}`);
  }
  for (const name of ATOM_SET_MANIFEST_FIELDS) {
    if (!manifestCovered.has(name)) missing.push(`atomSetManifest.${name}`);
  }
  return missing;
};

/**
 * Run every reader over an atom set.
 *
 * @param {Array} atoms
 * @param {Object} manifest - `buildAtomSetManifest` output
 * @returns {{ok: boolean, missingReaders: string[], reports: Array, depthMix: Object}}
 */
export const atomsSelfCheck = (atoms = [], manifest = null, { atomSchema } = {}) => {
  // `atomSchema` is injectable ONLY so a test can prove the gate fires. Production always
  // reads the live registry — a gate that can be handed a friendly schema is not a gate.
  const missing = missingReaders(atomSchema ? { atomSchema } : {});
  const reports = [];
  const depthMix = { [D.DESCRIPTIVE]: 0, [D.INFERENTIAL]: 0 };

  for (const r of [...ATOM_READERS, ...MANIFEST_READERS]) {
    depthMix[r.depth] += 1;
    let value;
    let error = null;
    try {
      value = r.read(atoms, manifest);
    } catch (err) {
      error = err?.message ?? String(err);
      value = null;
    }
    reports.push({ field: r.field, depth: r.depth, question: r.question, value, error });
  }

  const failedReaders = reports.filter((r) => r.error);
  return {
    ok: missing.length === 0 && failedReaders.length === 0,
    missingReaders: missing,
    failedReaders: failedReaders.map((r) => ({ field: r.field, error: r.error })),
    reports,
    depthMix,
    atomCount: atoms.length,
  };
};

/**
 * Throw when the self-check fails. Called by every runner AFTER the Match, per the accept
 * criterion — a check that only runs when someone remembers is the state before this ticket.
 */
export const assertAtomsSelfCheck = (atoms, manifest, opts = {}) => {
  const out = atomsSelfCheck(atoms, manifest, opts);
  if (out.missingReaders.length) {
    throw new Error(
      'atomsSelfCheck: captured fields with NO reader — '
      + `${out.missingReaders.join(', ')}. Every captured field ships with at least one query `
      + 'that reads it, written at capture time. If you cannot write the query, you do not yet '
      + 'understand what the field is for, and it is speculation rather than instrumentation.',
    );
  }
  if (out.failedReaders.length) {
    throw new Error(
      `atomsSelfCheck: readers threw — ${out.failedReaders.map((f) => `${f.field}: ${f.error}`).join('; ')}`,
    );
  }
  return out;
};

/** Human-readable dump. The "prints the field's distribution" half of the rule. */
export const formatSelfCheck = (out) => {
  const lines = [
    `atoms self-check — ${out.atomCount} atoms, ${out.reports.length} readers `
    + `(${out.depthMix.inferential} inferential / ${out.depthMix.descriptive} descriptive)`,
  ];
  for (const r of out.reports) {
    lines.push(`  ${r.field.padEnd(20)} ${r.question}`);
    lines.push(`  ${' '.repeat(20)} ${JSON.stringify(r.value)}`);
  }
  return lines.join('\n');
};
