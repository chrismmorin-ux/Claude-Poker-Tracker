/**
 * faultRegister.test.js — the disclaimer, the ranking, and the retroactive flagging trail.
 *
 * THE TEST THAT MATTERS is `retroactive flagging`. It replays the WS-291 scenario against the
 * mechanism built to catch it: a fault is confirmed, and every prior Result Card that stood on
 * it comes back flagged. That trail is what did not exist when a falsified range model turned
 * out to have been wrong for the life of the project — every figure published under it stayed
 * published, because nothing connected "this was wrong" to "these results depended on it".
 *
 * The rest guards the properties that make the register more than a list: entries cannot be
 * confirmed or retired without evidence, the version is derived from content rather than
 * asserted, and the document and the module cannot drift apart.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import {
  FAULT_STATUSES,
  FAULT_SITES,
  SUSPECT_PENDING_REVIEW,
  REGISTER_EPOCH,
  BREADTH_PRIOR_WEIGHT,
  THE_DISCLAIMER,
  DISCLAIMER_TREATMENT,
  SUSPECTED_FAULTS,
  buildFaultEntry,
  faultEntryProblems,
  registerProblems,
  contaminatedCards,
  measuredBreadth,
  blendedBreadth,
  expectedDamage,
  rankFaults,
  flagContaminated,
  confirmFault,
  retireFault,
  registerSelfCheck,
  canonicalRegisterBody,
  registerVersion,
  blockedFalsifiers,
  clearFalsifierBlocker,
  isRegisterVersionShape,
  REGISTER_VERSION_PATTERN,
  WITHIN_CORPUS_DRIFT_2009,
} from '../faultRegister.js';
import { STACK_LAYERS } from '../stack.js';

// ── fixtures ────────────────────────────────────────────────────────────────────────────

/**
 * A card whose surface consumes the mismatched preflop stat. This is the shape WS-291 had:
 * a perfectly well-formed result standing on a layer that turned out to be wrong.
 */
const contaminatedCard = () => ({
  resultCardId: 'RC-consumes-the-bad-stat',
  match: {
    surfaceId: 'engine-read-foldTo3Bet-v1',
    dealBookId: 'handhq-200NLH-2009',
    fieldId: 'pool-mined-v1',
  },
  estimand: 'Expected value of 3-betting light, in bb per decision',
  treatment: 'per-decision substitution · one-decision horizon',
  metrics: { edgeBB: 0.4, n: 3000 },
  clusterUnit: 'players',
  manifest: { partition: 'pool-train@50', constants: { PRIOR_WEIGHT: 10 }, unseededSources: [] },
});

/** A card with no exposure to that stat. Its surface and estimand never mention it. */
const cleanCard = () => ({
  resultCardId: 'RC-untouched-by-the-bad-stat',
  match: {
    surfaceId: 'declared-river-value-card',
    dealBookId: 'generated-river-book-v2',
    fieldId: 'responsive-sim-field-v1',
  },
  estimand: 'Realized chips won on the river, clustered on sessions',
  treatment: 'whole-hand replay · realized outcome',
  metrics: { realizedChips: 12.5, ess: 210, n: 240 },
  clusterUnit: 'sessions',
  manifest: { partition: 'eval-holdout@50', constants: { PRIOR_WEIGHT: 10 }, unseededSources: [] },
});

const entryInput = (overrides = {}) => ({
  faultId: 'FAULT-test',
  title: 'A test fault',
  site: 'instrument',
  mechanism: 'The path by which it goes wrong.',
  contaminates: 'Anything at all.',
  matches: () => true,
  falsifier: 'Measure it.',
  probability: 0.5,
  probabilityBasis: 'Because.',
  priorBreadth: 0.5,
  ...overrides,
});

// ── the disclaimer ──────────────────────────────────────────────────────────────────────

describe('the disclaimer', () => {
  it('states every component of the estimand', () => {
    // AC4: substitution, horizon, opponents, population, units, cluster unit. A disclaimer
    // missing one of these is a mood, not a statement of what was measured.
    for (const key of ['substitution', 'horizon', 'opponents', 'population', 'units', 'clusterUnit', 'holeCards']) {
      expect(THE_DISCLAIMER[key], `disclaimer.${key}`).toBeTruthy();
    }
  });

  it('names the population mismatch rather than implying it', () => {
    expect(THE_DISCLAIMER.population).toMatch(/live/i);
    expect(THE_DISCLAIMER.population).toMatch(/transferred/i);
  });

  it('refuses hands as a cluster unit in prose as well as in code', () => {
    expect(THE_DISCLAIMER.clusterUnit).toMatch(/never hands/i);
  });

  it('is reusable verbatim as a TREATMENT string', () => {
    expect(DISCLAIMER_TREATMENT).toMatch(/one-decision horizon/);
    expect(DISCLAIMER_TREATMENT).toMatch(/range-marginalized/);
  });
});

// ── entry validation ────────────────────────────────────────────────────────────────────

describe('entry construction', () => {
  it('accepts a complete entry', () => {
    expect(faultEntryProblems(buildFaultEntry(entryInput()))).toEqual([]);
  });

  it('refuses an entry with no falsifier — it could never leave `untested`', () => {
    expect(() => buildFaultEntry(entryInput({ falsifier: '' }))).toThrow(/falsifier/);
  });

  it('refuses an entry with no mechanism — a worry is not an entry', () => {
    expect(() => buildFaultEntry(entryInput({ mechanism: '' }))).toThrow(/mechanism/);
  });

  it('refuses a bare probability with no stated basis', () => {
    expect(() => buildFaultEntry(entryInput({ probabilityBasis: '' }))).toThrow(/probabilityBasis/);
  });

  it.each([-0.1, 1.1, NaN, '0.5'])('refuses probability %s', (probability) => {
    expect(() => buildFaultEntry(entryInput({ probability }))).toThrow(/probability/);
  });

  it('refuses a site outside the vocabulary', () => {
    expect(() => buildFaultEntry(entryInput({ site: 'vibes' }))).toThrow(/site/);
  });

  it('accepts every stack layer as a site, without redefining the layer list', () => {
    for (const layer of STACK_LAYERS) {
      expect(FAULT_SITES).toContain(layer);
      expect(() => buildFaultEntry(entryInput({ site: layer }))).not.toThrow();
    }
  });

  it('refuses a matcher that is not a function', () => {
    expect(() => buildFaultEntry(entryInput({ matches: 'anything' }))).toThrow(/matches/);
  });

  it.each(['confirmed', 'retired'])('refuses status %s with no evidence', (status) => {
    expect(() => buildFaultEntry(entryInput({ status }))).toThrow(/requires at least one evidence/);
    expect(() => buildFaultEntry(entryInput({ status, evidence: ['a measurement'] }))).not.toThrow();
  });

  it.each(['untested', 'partially-supported'])('allows status %s with no evidence', (status) => {
    expect(() => buildFaultEntry(entryInput({ status }))).not.toThrow();
  });
});

// ── the shipped register ────────────────────────────────────────────────────────────────

describe('the shipped register', () => {
  it('is well-formed and has no duplicate ids', () => {
    expect(registerProblems()).toEqual([]);
  });

  it('gives every entry a falsifier — the register is a work queue, not a caveat list', () => {
    for (const entry of SUSPECTED_FAULTS) {
      expect(entry.falsifier, entry.faultId).toBeTruthy();
      expect(FAULT_STATUSES).toContain(entry.status);
    }
  });

  it('carries the confirmed foldTo3Bet mismatch with its evidence', () => {
    const entry = SUSPECTED_FAULTS.find((f) => f.faultId === 'FAULT-stat-definition-mismatch');
    expect(entry.status).toBe('confirmed');
    expect(entry.evidence.length).toBeGreaterThan(0);
    // Sited at the layer it actually lives at. It feeds fold-probability estimation, which is
    // what makes it a layer fault rather than a documentation nit.
    expect(entry.site).toBe('foldProbability');
  });

  it('ranks population mismatch first and leakage last, for opposite reasons', () => {
    const ranked = rankFaults();
    expect(ranked[0].faultId).toBe('FAULT-population-mismatch');

    const leakage = ranked.find((r) => r.faultId === 'FAULT-leakage-unclosed-channel');
    // The founder's ranking decision, made visible: leakage is LAST because it is unlikely,
    // and its breadth is TOTAL. Ranking by probability alone would have buried it identically
    // while hiding the reason — which is the whole argument for showing both components.
    expect(leakage.probability).toBeLessThan(0.2);
    expect(leakage.breadth.prior).toBe(1.0);
  });
});

// ── ranking ─────────────────────────────────────────────────────────────────────────────

describe('ranking by expected damage', () => {
  it('is probability x breadth', () => {
    const entry = buildFaultEntry(entryInput({ probability: 0.5, priorBreadth: 0.4 }));
    expect(expectedDamage(entry, [])).toBeCloseTo(0.2, 10);
  });

  it('sorts descending and is deterministic on ties', () => {
    const ranked = rankFaults();
    const live = ranked.filter((r) => r.status !== 'retired');
    for (let i = 1; i < live.length; i += 1) {
      expect(live[i - 1].expectedDamage).toBeGreaterThanOrEqual(live[i].expectedDamage);
    }
    expect(rankFaults().map((r) => r.faultId)).toEqual(ranked.map((r) => r.faultId));
  });

  it('shows both components on every row, so a reader can see which is carrying it', () => {
    for (const row of rankFaults()) {
      expect(typeof row.probability).toBe('number');
      expect(typeof row.breadth.prior).toBe('number');
      expect(row.breadth).toHaveProperty('observed');
      expect(row.breadth).toHaveProperty('evidenceWeight');
    }
  });

  it('sorts retired entries last regardless of score', () => {
    const high = buildFaultEntry(entryInput({
      faultId: 'FAULT-retired-but-scary', probability: 1, priorBreadth: 1,
      status: 'retired', evidence: ['measured and closed'],
    }));
    const ranked = rankFaults([high, ...SUSPECTED_FAULTS]);
    expect(ranked[ranked.length - 1].faultId).toBe('FAULT-retired-but-scary');
  });
});

describe('breadth: declared prior blended with measured evidence', () => {
  const alwaysMatches = buildFaultEntry(entryInput({ priorBreadth: 0.2, matches: () => true }));

  it('is the pure prior when there are no cards to measure against', () => {
    const b = blendedBreadth(alwaysMatches, []);
    expect(b.blended).toBeCloseTo(0.2, 10);
    expect(b.observed).toBeNull();
    expect(b.evidenceWeight).toBe(0);
    expect(measuredBreadth(alwaysMatches, [])).toBeNull();
  });

  it('moves toward the observed share as cards accumulate', () => {
    const cards = Array.from({ length: 10 }, (_, i) => ({ resultCardId: `RC-${i}` }));
    const b = blendedBreadth(alwaysMatches, cards);
    // prior 0.2 at weight 10, observed 1.0 on 10 cards -> (0.2*10 + 10) / 20 = 0.6
    expect(b.observed).toBe(1);
    expect(b.blended).toBeCloseTo(0.6, 10);
    expect(b.evidenceWeight).toBeCloseTo(10 / (10 + BREADTH_PRIOR_WEIGHT), 10);
  });

  it('lets evidence dominate at scale', () => {
    const cards = Array.from({ length: 200 }, (_, i) => ({ resultCardId: `RC-${i}` }));
    expect(blendedBreadth(alwaysMatches, cards).blended).toBeGreaterThan(0.9);
  });

  it('survives a matcher that throws on an unexpected card shape', () => {
    const brittle = buildFaultEntry(entryInput({
      matches: (card) => card.manifest.constants.PRIOR_WEIGHT > 0,
    }));
    expect(() => contaminatedCards(brittle, [{ resultCardId: 'RC-bare' }])).not.toThrow();
    expect(contaminatedCards(brittle, [{ resultCardId: 'RC-bare' }])).toEqual([]);
    // ...and the throw is REPORTED rather than silently swallowed.
    expect(registerSelfCheck([brittle], [{ resultCardId: 'RC-bare' }]).threwOn).toContain('FAULT-test');
  });
});

// ── THE ONE THAT MATTERS: retroactive flagging ──────────────────────────────────────────

describe('retroactive flagging — the trail WS-291 did not have', () => {
  const cards = () => [contaminatedCard(), cleanCard()];

  it('flags a card whose surface consumes the confirmed bad stat', () => {
    const flagged = flagContaminated({ cards: cards() });
    const row = flagged.find((f) => f.resultCardId === 'RC-consumes-the-bad-stat');

    expect(row).toBeDefined();
    expect(row.status).toBe(SUSPECT_PENDING_REVIEW);
    expect(row.faultIds).toContain('FAULT-stat-definition-mismatch');
    // The flag says WHAT it contaminates, not just that something is wrong. A flag with no
    // reason is a badge, and a reader cannot act on a badge.
    expect(row.reasons.join(' ')).toMatch(/foldTo3Bet/);
  });

  it('does NOT flag a card with no exposure to it', () => {
    const flagged = flagContaminated({ cards: cards() });
    const row = flagged.find((f) => f.resultCardId === 'RC-untouched-by-the-bad-stat');
    expect(row?.faultIds ?? []).not.toContain('FAULT-stat-definition-mismatch');
  });

  it('does not let an UNTESTED suspicion flag anything', () => {
    // If untested entries flagged, every card would carry every caveat on day one and the flag
    // would mean nothing — which is the flat caveat list this register exists to replace.
    const untested = SUSPECTED_FAULTS.filter((f) => f.status === 'untested');
    expect(untested.length).toBeGreaterThan(0);
    expect(flagContaminated({ faults: untested, cards: cards() })).toEqual([]);
  });

  it('CONFIRMING an entry flags every prior card that stood on it', () => {
    // The full scenario. `FAULT-horizon-bias` is untested and flags nothing; confirming it
    // reaches backwards into results that were already published.
    const before = flagContaminated({ cards: cards() });
    expect(before.flatMap((r) => r.faultIds)).not.toContain('FAULT-horizon-bias');

    const { flagged, entry } = confirmFault({
      faultId: 'FAULT-horizon-bias',
      evidence: ['whole-strategy arm run 2026-08-04; gap exceeded the per-decision figure'],
      cards: cards(),
    });

    expect(entry.status).toBe('confirmed');
    expect(flagged.map((f) => f.resultCardId)).toContain('RC-consumes-the-bad-stat');
    for (const row of flagged) {
      expect(row.status).toBe(SUSPECT_PENDING_REVIEW);
      expect(row.faultIds).toContain('FAULT-horizon-bias');
    }
  });

  it('refuses to confirm without evidence — a hunch may not invalidate prior work', () => {
    expect(() => confirmFault({ faultId: 'FAULT-horizon-bias', cards: cards() }))
      .toThrow(/requires evidence/);
    expect(() => confirmFault({ faultId: 'FAULT-horizon-bias', evidence: [], cards: cards() }))
      .toThrow(/requires evidence/);
  });

  it('does not mutate the shipped register when confirming', () => {
    const statusBefore = SUSPECTED_FAULTS.find((f) => f.faultId === 'FAULT-horizon-bias').status;
    confirmFault({ faultId: 'FAULT-horizon-bias', evidence: ['x'], cards: cards() });
    expect(SUSPECTED_FAULTS.find((f) => f.faultId === 'FAULT-horizon-bias').status).toBe(statusBefore);
  });

  it('is idempotent — a re-run adds no duplicate flags', () => {
    const once = flagContaminated({ cards: cards() });
    const twice = flagContaminated({ cards: cards() });
    expect(twice).toEqual(once);

    const entry = SUSPECTED_FAULTS.find((f) => f.faultId === 'FAULT-stat-definition-mismatch');
    // Even a register that somehow held the same entry twice must not double-count. A flag
    // count that grew on re-run would read as new evidence.
    const doubled = flagContaminated({ faults: [entry, entry], cards: cards() });
    expect(doubled[0].faultIds).toEqual(['FAULT-stat-definition-mismatch']);
  });

  it('throws on an unknown faultId rather than silently flagging nothing', () => {
    expect(() => confirmFault({ faultId: 'FAULT-does-not-exist', evidence: ['x'] })).toThrow(/no entry/);
  });
});

describe('retirement', () => {
  it('requires evidence, and keeps the entry in the register', () => {
    expect(() => retireFault({ faultId: 'FAULT-multiway-approximation' })).toThrow(/requires evidence/);

    const { faults, entry } = retireFault({
      faultId: 'FAULT-multiway-approximation',
      evidence: ['exact multiway computation agreed within noise on the bounded spot set'],
    });
    expect(entry.status).toBe('retired');
    expect(entry.evidence.length).toBeGreaterThan(0);
    // Never quietly disappears — "we looked and it was fine" must stay distinguishable from
    // "nobody ever wrote it down".
    expect(faults).toHaveLength(SUSPECTED_FAULTS.length);
    expect(faults.find((f) => f.faultId === 'FAULT-multiway-approximation')).toBeDefined();
  });
});

// ── the register held to its own standard ───────────────────────────────────────────────

describe('self-check — the register audited by its own DEGENERATE SIGNAL rule', () => {
  it('reports a matcher that flags everything as non-discriminating', () => {
    const universal = buildFaultEntry(entryInput({ faultId: 'FAULT-universal', matches: () => true }));
    const check = registerSelfCheck([universal], [contaminatedCard(), cleanCard()]);
    expect(check.rows[0].discriminating).toBe(false);
    expect(check.rows[0].note).toMatch(/partitions nothing/);
    expect(check.nonDiscriminating).toContain('FAULT-universal');
  });

  it('reports a matcher that flags nothing, and says the matcher might be the problem', () => {
    const never = buildFaultEntry(entryInput({ faultId: 'FAULT-never', matches: () => false }));
    const check = registerSelfCheck([never], [contaminatedCard(), cleanCard()]);
    expect(check.rows[0].discriminating).toBe(false);
    expect(check.rows[0].note).toMatch(/matcher is wrong/);
  });

  it('reports rather than rejects — a universally-true fault is honest, not illegal', () => {
    // Same argument the vocabulary makes for the `fear` warrant: outlaw the admission and it
    // hides somewhere nothing can find it.
    const universal = buildFaultEntry(entryInput({ matches: () => true }));
    expect(faultEntryProblems(universal)).toEqual([]);
  });

  it('finds at least one genuinely discriminating matcher in the shipped register', () => {
    // If NOTHING discriminated, the whole contamination model would be decorative.
    const check = registerSelfCheck(SUSPECTED_FAULTS, [contaminatedCard(), cleanCard()]);
    const discriminating = check.rows.filter((r) => r.discriminating);
    expect(discriminating.length).toBeGreaterThan(0);
  });
});

// ── version ─────────────────────────────────────────────────────────────────────────────

describe('version', () => {
  it('is the epoch plus a content hash', async () => {
    const version = await registerVersion();
    expect(version).toMatch(new RegExp(`^${REGISTER_EPOCH}\\+[0-9a-f]{12}$`));
  });

  it('is stable across calls on unchanged content', async () => {
    expect(await registerVersion()).toBe(await registerVersion());
  });

  it('CHANGES when any entry changes — nobody has to remember to bump it', async () => {
    const edited = SUSPECTED_FAULTS.map((f, i) => (
      i === 0 ? buildFaultEntry({ ...f, probability: f.probability === 0.5 ? 0.6 : 0.5 }) : f
    ));
    expect(await registerVersion(edited)).not.toBe(await registerVersion());
  });

  it('changes when a status changes, so a confirmation is visible in the stamp', async () => {
    const { faults } = confirmFault({ faultId: 'FAULT-horizon-bias', evidence: ['measured'] });
    expect(await registerVersion(faults)).not.toBe(await registerVersion());
  });

  it('excludes the matcher — a function has no stable serialization', () => {
    const body = canonicalRegisterBody();
    for (const entry of body.entries) {
      expect(entry).not.toHaveProperty('matches');
    }
    // ...but keeps the prose, which is the claim a reader actually relies on.
    expect(body.entries[0].contaminates).toBeTruthy();
  });
});

// ── doc / module drift ──────────────────────────────────────────────────────────────────

describe('the document and the module cannot drift apart', () => {
  const DOC = fileURLToPath(new URL('../../../../docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md', import.meta.url));

  const rankedTableIds = () => {
    const md = readFileSync(DOC, 'utf8');
    const between = md.split('<!-- RANKED-REGISTER:BEGIN -->')[1]?.split('<!-- RANKED-REGISTER:END -->')[0];
    expect(between, 'the doc must carry the RANKED-REGISTER anchors').toBeTruthy();
    const ids = [...between.matchAll(/`(FAULT-[a-z0-9-]+)`/g)].map((m) => m[1]);
    return [...new Set(ids)];
  };

  it('lists exactly the module\'s fault ids, in ranked order', () => {
    // Prose lives in the doc, data lives in the module, and this is what stops the two becoming
    // two sources of truth. No generator — a generator would just move the drift.
    expect(rankedTableIds()).toEqual(rankFaults().map((r) => r.faultId));
  });

  it('carries the founder-facing summary the register is required to open with', () => {
    const md = readFileSync(DOC, 'utf8');
    expect(md).toMatch(/## 1\. What this system can honestly say today/);
    expect(md).toMatch(/suspect-pending-review/);
  });
});

// ── a falsifier that cannot be run (WS-352) ─────────────────────────────────────────────

/**
 * WS-352 ran the rank-1 entry's falsifier and found it UNRUNNABLE — it names SRC-014, the
 * founder's live pool, which has no positive identity and no export path. These guard the
 * distinction that finding forced: "nobody measured it" and "it cannot be measured, here is
 * what would change that" are different states routing to different work.
 */
describe('falsifierBlockers — an entry that says why its own test cannot be run', () => {
  const runnable = (over = {}) => buildFaultEntry({
    faultId: 'FAULT-fixture',
    title: 'fixture',
    site: 'corpus',
    mechanism: 'a stated path by which it goes wrong',
    contaminates: 'some cards',
    matches: () => false,
    falsifier: 'measure the thing',
    probability: 0.5,
    probabilityBasis: 'stated so it can be argued with',
    priorBreadth: 0.5,
    ...over,
  });

  it('defaults to empty — an entry is assumed runnable until it says otherwise', () => {
    expect(runnable().falsifierBlockers).toEqual([]);
  });

  it('rejects a blocker that names nothing actionable', () => {
    expect(faultEntryProblems({ ...runnable(), falsifierBlockers: ['  '] }))
      .toContainEqual(expect.stringContaining('non-empty string'));
    expect(faultEntryProblems({ ...runnable(), falsifierBlockers: 'blocked' }))
      .toContainEqual(expect.stringContaining('must be an array'));
  });

  it('refuses to CONFIRM a blocked entry even with evidence — that would be a substituted test', () => {
    expect(() => runnable({
      status: 'confirmed',
      evidence: ['some other measurement entirely'],
      falsifierBlockers: ['the live arm does not exist yet'],
    })).toThrow(/not available while falsifierBlockers is non-empty/);
  });

  it('refuses to RETIRE a blocked entry even with evidence', () => {
    expect(() => runnable({
      status: 'retired',
      evidence: ['looked fine to me'],
      falsifierBlockers: ['the live arm does not exist yet'],
    })).toThrow(/not available while falsifierBlockers is non-empty/);
  });

  it('confirmFault cannot launder a blocked entry into confirmed', () => {
    const faults = [runnable({ falsifierBlockers: ['the live arm does not exist yet'] })];
    expect(() => confirmFault({
      faults, faultId: 'FAULT-fixture', evidence: ['a proxy measurement'], cards: [],
    })).toThrow(/falsifierBlockers/);
  });

  it('still allows confirmation once the blockers are cleared', () => {
    const faults = [runnable({ falsifierBlockers: [] })];
    const { entry } = confirmFault({ faults, faultId: 'FAULT-fixture', evidence: ['ran it'] });
    expect(entry.status).toBe('confirmed');
  });

  it('is hashed into the register version, so clearing a blocker is a recorded change', async () => {
    const base = [runnable()];
    const blocked = [runnable({ falsifierBlockers: ['the live arm does not exist yet'] })];
    expect(canonicalRegisterBody(blocked).entries[0].falsifierBlockers).toHaveLength(1);
    expect(await registerVersion(base)).not.toBe(await registerVersion(blocked));
  });

  it('reports the population-mismatch entry as blocked on the live arm, and keeps it untested', () => {
    const rows = blockedFalsifiers();
    const row = rows.find((r) => r.faultId === 'FAULT-population-mismatch');
    expect(row, 'WS-352 found the rank-1 falsifier unrunnable').toBeTruthy();
    // Untested rather than settled: the named test was never run, so nothing settled it.
    expect(row.status).toBe('untested');
    // Each blocker has to say what would clear it, or it routes to nobody.
    expect(row.blockers.length).toBeGreaterThan(0);
    for (const b of row.blockers) expect(b).toMatch(/UNBLOCKED BY:/);
    expect(row.blockers.join(' ')).toMatch(/SRC-014/);
  });

  it('leaves the entry evidence-free — "we could not test it" is not evidence', () => {
    const entry = SUSPECTED_FAULTS.find((f) => f.faultId === 'FAULT-population-mismatch');
    expect(entry.evidence).toEqual([]);
  });

  it('leaves every runnable entry unblocked, so the field discriminates', () => {
    expect(blockedFalsifiers().length).toBeLessThan(SUSPECTED_FAULTS.length);
  });
});

// ── a second falsifier that cannot be run, and the null it produced instead (WS-353) ────

/**
 * WS-353 ran the rank-2 entry's falsifier — fit the same priors on SRC-005 (Ignition, current)
 * and difference against the 2009 values cell by cell — and found it unrunnable for three
 * reasons, all on the SRC-005 arm.
 *
 * What it DID produce is `WITHIN_CORPUS_DRIFT_2009`: the corpus differenced against itself
 * across the nineteen days it actually spans. These tests exist because that measurement is the
 * exact shape of thing that gets quietly promoted into an answer to the sixteen-year question.
 * They pin it to its own horizon, keep it out of `evidence`, and make sure its refusal to
 * license 2026 is DATA the module carries rather than a caveat in a report nobody reopens.
 */
describe('FAULT-temporal-staleness — blocked, and the nineteen-day null (WS-353)', () => {
  const entry = () => SUSPECTED_FAULTS.find((f) => f.faultId === 'FAULT-temporal-staleness');

  it('reports the entry as blocked on the SRC-005 arm, and keeps it untested', () => {
    const row = blockedFalsifiers().find((r) => r.faultId === 'FAULT-temporal-staleness');
    expect(row, 'WS-353 found the rank-2 falsifier unrunnable').toBeTruthy();
    expect(row.status).toBe('untested');
    expect(row.blockers.length).toBeGreaterThan(0);
    for (const b of row.blockers) expect(b).toMatch(/UNBLOCKED BY:/);
    expect(row.blockers.join(' ')).toMatch(/SRC-005/);
  });

  it('leaves the entry evidence-free — a nineteen-day null is not evidence about sixteen years', () => {
    // The whole hazard of this ticket in one assertion. A within-corpus measurement IS a
    // measurement, and `evidence` is the field that gates confirmation and retirement. Putting
    // it there would let a future reader settle a sixteen-year question with a three-week number.
    expect(entry().evidence).toEqual([]);
  });

  it('keeps probability, breadth and wording untouched — being unable to run a test is not a result', () => {
    expect(entry().probability).toBe(0.9);
    expect(entry().priorBreadth).toBe(0.85);
    expect(entry().falsifier).toMatch(/SRC-005 \(Ignition, current\)/);
    expect(entry().falsifier).toMatch(/cell by cell/);
  });

  it('states the measurement\'s span and stake, so nobody can read it as corpus-wide', () => {
    expect(WITHIN_CORPUS_DRIFT_2009.spanDays).toBe(19);
    expect(WITHIN_CORPUS_DRIFT_2009.sourceId).toBe('SRC-012');
    expect(WITHIN_CORPUS_DRIFT_2009.stakes).toMatch(/50NLH ONLY/);
    expect(WITHIN_CORPUS_DRIFT_2009.cells).toBe(24);
    expect(WITHIN_CORPUS_DRIFT_2009.handsScored).toBeGreaterThan(0);
    expect(WITHIN_CORPUS_DRIFT_2009.minCellDenominator).toBeGreaterThan(0);
  });

  it('refuses to license 2026 IN THE DATA, not in a comment', () => {
    expect(WITHIN_CORPUS_DRIFT_2009.doesNotLicense).toMatch(/2026/);
    expect(WITHIN_CORPUS_DRIFT_2009.doesNotLicense).toMatch(/extrapolat/i);
    expect(WITHIN_CORPUS_DRIFT_2009.licenses).toMatch(/null/i);
  });

  it('is clustered on days, never hands — the repo rule, applied to its own null', () => {
    expect(WITHIN_CORPUS_DRIFT_2009.clusterUnit).toBe('days');
    expect(WITHIN_CORPUS_DRIFT_2009.clusterUnit).not.toBe('hands');
  });

  it('is frozen, so the null cannot be edited by whoever is quoting a gap against it', () => {
    // `toBeDefined` first on purpose. `Object.isFrozen(undefined)` is TRUE, so without it this
    // assertion passes when the constant does not exist — a check that cannot fail, which is
    // `FAULT-degenerate-signal` committed inside the test guarding the register that names it.
    expect(WITHIN_CORPUS_DRIFT_2009).toBeDefined();
    expect(Object.isFrozen(WITHIN_CORPUS_DRIFT_2009)).toBe(true);
  });

  it('is inside the hashed register body — moving the null moves the version', () => {
    // Presence in the canonical body IS the hash claim: `registerVersion` hashes the whole body.
    // Asserted through a leaf value so a missing key fails rather than comparing undefined
    // against undefined.
    expect(canonicalRegisterBody()).toHaveProperty('withinCorpusDrift.spanDays', 19);
    expect(canonicalRegisterBody().withinCorpusDrift).toEqual(WITHIN_CORPUS_DRIFT_2009);
  });

  it('the doc records the blocked status too, so the two cannot drift', () => {
    const DOC = fileURLToPath(new URL('../../../../docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md', import.meta.url));
    const md = readFileSync(DOC, 'utf8');
    const table = md.split('<!-- RANKED-REGISTER:BEGIN -->')[1].split('<!-- RANKED-REGISTER:END -->')[0];
    const row = table.split('\n').find((l) => l.includes('FAULT-temporal-staleness'));
    expect(row, 'the ranked table must carry the entry').toBeTruthy();
    expect(row).toMatch(/falsifier blocked/);
    // And every module-level blocked entry must be marked blocked in the table, not just this one.
    for (const b of blockedFalsifiers()) {
      const r = table.split('\n').find((l) => l.includes(b.faultId));
      expect(r, `${b.faultId} is blocked in the module`).toMatch(/falsifier blocked/);
    }
  });
});

// ── clearing a blocker, and NOT thereby settling the entry (WS-368 AC-7) ──────────────────────

/**
 * WS-368 (commit 3befa26d) built what the FIRST of FAULT-population-mismatch's three blockers
 * asked for: a closed provenance set stamped at construction on every hand write path, so
 * `getHandsBySource('live')` is a real selector. That blocker stopped being true while the
 * register went on asserting it.
 *
 * The hazard this block guards is the collapse of "one of three cleared" into "the entry came
 * unblocked" on a later reading. Two blockers still stand, the entry is still `untested`, and
 * the mechanism existing is not the same claim as the data existing.
 */
describe('clearedBlockers — one of three, recorded, and not a settlement (WS-368 AC-7)', () => {
  const entry = () => SUSPECTED_FAULTS.find((f) => f.faultId === 'FAULT-population-mismatch');

  const B1 = 'ARM A IS UNSELECTABLE. UNBLOCKED BY: a positive identity.';
  const B2 = 'ARM A IS UNREACHABLE. UNBLOCKED BY: an export.';

  const blocked = (over = {}) => buildFaultEntry({
    faultId: 'FAULT-fixture-clearing',
    title: 'fixture',
    site: 'corpus',
    mechanism: 'a stated path by which it goes wrong',
    contaminates: 'some cards',
    matches: () => false,
    falsifier: 'measure the thing',
    probability: 0.5,
    probabilityBasis: 'stated so it can be argued with',
    priorBreadth: 0.5,
    falsifierBlockers: [B1, B2],
    ...over,
  });

  it('clears the identity blocker off the real entry and leaves the other two standing', () => {
    const row = blockedFalsifiers().find((r) => r.faultId === 'FAULT-population-mismatch');
    expect(row, 'the entry must STILL be blocked').toBeTruthy();
    expect(row.blockers).toHaveLength(2);
    expect(row.clearedCount).toBe(1);
    expect(row.blockers.join(' ')).toMatch(/UNREACHABLE BY THE HARNESS/);
    expect(row.blockers.join(' ')).toMatch(/NO VOLUME FLOOR/);
    // The cleared one is gone from the blocking list, not merely annotated inside it.
    expect(row.blockers.join(' ')).not.toMatch(/HAS NO POSITIVE IDENTITY/);
  });

  it('keeps the entry untested, evidence-free, and unsettleable', () => {
    expect(entry().status).toBe('untested');
    expect(entry().evidence).toEqual([]);
    expect(() => confirmFault({ faultId: 'FAULT-population-mismatch', evidence: ['a commit'] }))
      .toThrow(/not available while falsifierBlockers is non-empty/);
    expect(() => retireFault({ faultId: 'FAULT-population-mismatch', evidence: ['a commit'] }))
      .toThrow(/not available while falsifierBlockers is non-empty/);
  });

  it('preserves the cleared blocker VERBATIM with the commit that cleared it', () => {
    const [cleared] = entry().clearedBlockers;
    expect(cleared.blocker).toMatch(/SRC-014 HAS NO POSITIVE IDENTITY/);
    expect(cleared.blocker).toMatch(/UNBLOCKED BY:/);
    expect(cleared.clearedBy.join(' ')).toMatch(/3befa26d/);
    expect(cleared.at).toBe('2026-08-05');
  });

  it('states in DATA what the clearance does not cover, including that the live set is empty', () => {
    // The three things a reader in a hurry collapses, asserted separately so an edit that drops
    // one fails here rather than in six months.
    const note = entry().clearedBlockers[0].note;
    expect(note, 'the other blockers still hold').toMatch(/still (blocked|hold)/i);
    expect(note, 'mechanism is not data').toMatch(/empty/i);
    expect(note, 'no guess was written onto old rows').toMatch(/unknown/i);
  });

  it('refuses a clearance with no evidence — same bar as confirmation, mirrored', () => {
    expect(faultEntryProblems({
      ...blocked(),
      falsifierBlockers: [],
      clearedBlockers: [{ blocker: B1, clearedBy: [], at: '2026-08-05', note: 'identity only' }],
    })).toContainEqual(expect.stringContaining('may not be cleared on assertion alone'));
  });

  it('refuses a clearance with no note — a limitless clearance reads as an unblocked entry', () => {
    expect(faultEntryProblems({
      ...blocked(),
      falsifierBlockers: [],
      clearedBlockers: [{ blocker: B1, clearedBy: ['commit abc'], at: '2026-08-05', note: '  ' }],
    })).toContainEqual(expect.stringContaining('WHAT THIS DOES NOT CLEAR'));
  });

  it('refuses a blocker held as both cleared and blocking', () => {
    expect(faultEntryProblems({
      ...blocked(),
      clearedBlockers: [{ blocker: B1, clearedBy: ['commit abc'], at: '2026-08-05', note: 'identity only' }],
    })).toContainEqual(expect.stringContaining('ALSO still listed in falsifierBlockers'));
  });

  it('clearFalsifierBlocker demands the blocker text verbatim', () => {
    expect(() => clearFalsifierBlocker({
      faults: [blocked()], faultId: 'FAULT-fixture-clearing', blocker: 'ARM A IS UNSELECTABLE',
      evidence: ['commit abc'], note: 'identity only',
    })).toThrow(/does not declare that blocker verbatim/);
  });

  it('returns what is STILL blocked, so a partial clearance cannot read as a full one', () => {
    const faults = [blocked()];
    const out = clearFalsifierBlocker({
      faults,
      faultId: 'FAULT-fixture-clearing',
      blocker: B1,
      evidence: ['commit abc — built the selector'],
      note: 'covers identity only; the export path is untouched',
      at: '2026-08-05',
    });
    expect(out.stillBlocked).toBe(true);
    expect(out.remainingBlockers).toEqual([B2]);
    expect(out.entry.status).toBe('untested');
    expect(out.entry.clearedBlockers).toHaveLength(1);
    // A NEW register — the input entry is frozen and untouched.
    expect(faults[0].falsifierBlockers).toHaveLength(2);
  });

  it('refuses assertion-only clearance and note-less clearance', () => {
    const args = {
      faults: [blocked()], faultId: 'FAULT-fixture-clearing', blocker: B1,
    };
    expect(() => clearFalsifierBlocker({ ...args, evidence: [], note: 'x' }))
      .toThrow(/requires evidence/);
    expect(() => clearFalsifierBlocker({ ...args, evidence: ['commit abc'], note: '' }))
      .toThrow(/what it does NOT clear/);
  });

  it('is inside the hashed register body — clearing a blocker moves the version', async () => {
    const base = [blocked()];
    const { faults: after } = clearFalsifierBlocker({
      faults: base,
      faultId: 'FAULT-fixture-clearing',
      blocker: B1,
      evidence: ['commit abc'],
      note: 'identity only',
      at: '2026-08-05',
    });
    expect(canonicalRegisterBody(after).entries[0].clearedBlockers).toHaveLength(1);
    expect(await registerVersion(base)).not.toBe(await registerVersion(after));
  });

  it('leaves the register as a whole well-formed', () => {
    expect(registerProblems()).toEqual([]);
  });
});

// ── the register version's SHAPE, which is what a card stamp is checked against (WS-353 follow-up) ──

describe('registerVersion shape — the join key, not just a non-empty string', () => {
  it('mints something matching its own published pattern', async () => {
    const v = await registerVersion();
    expect(v).toMatch(REGISTER_VERSION_PATTERN);
    expect(isRegisterVersionShape(v)).toBe(true);
  });

  it.each([null, undefined, '', 'unknown', 'v1', 'FR-1', 'FR-1+', 'FR-1+ABCDEF012345', 'FR-1+e3867c10fc2'])(
    'rejects %s as a register version',
    (value) => {
      expect(isRegisterVersionShape(value)).toBe(false);
    },
  );

  it('accepts a future epoch, because bumping the epoch is a legal change', () => {
    expect(isRegisterVersionShape('FR-2+000000000000')).toBe(true);
    expect(isRegisterVersionShape('FR-12+8c4e65578ca2')).toBe(true);
  });
});
