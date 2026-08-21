/**
 * decisionContextArmGate.test.js — WS-540.
 *
 * ONE INVARIANT: the decision-context row is built ABOVE the arm gate.
 *
 * WHY THIS FILE EXISTS RATHER THAN A CASE IN decisionContextSet.test.js. The bug it guards
 * lived in the ORDER of two blocks in `heroEvTask.mjs`, not in any function's behaviour, and
 * every unit in that file passed while it was present.
 *
 * THE BUG, MEASURED 2026-08-21. `buildDecisionContext` sat BELOW the arm gate
 * (`if (armFailure) { ...; continue; }`). That gate drops a decision for EVERY arm when ANY
 * arm abstains, so the persisted set silently excluded precisely the decisions today's rungs
 * could not score:
 *
 *     n=76  slice:  76 rows produced, 70 scored -> 6 excluded  (7.9%)
 *     n=296 slice: 296 rows produced, 266 scored -> 30 excluded (10.1%)
 *
 * That is the opposite of what the set is for. Its whole claim is "an arm authored tomorrow
 * can still be scored against it", and it failed hardest on the rows tomorrow's arm most
 * needs — the ones today's rules abstain on.
 *
 * WHY THE SHIPPED REPLAY GATE CANNOT CATCH IT, which is the reason a test has to.
 * `rescore-rungs.mjs --gate` re-scores the SAME rungs against the set and diffs the output.
 * Every row in a short set is by construction a row all those rungs handled, so the gate
 * compares two runs over the same biased sample and passes green. The failure is invisible
 * to the one instrument built to verify it — it only ever shows up later, as a new rung
 * quietly measuring nothing on the decisions it was written for.
 *
 * A SOURCE-ORDER ASSERTION IS THE HONEST INSTRUMENT HERE. Driving `scoreHeroEvPlayer`
 * end-to-end needs a corpus, a range profile and hands that survive four production gates —
 * a fixture large enough that it would itself need trusting. The repo already guards this
 * class of silent defect at the source level (`atomsSelfCheck` fails a captured field with
 * no reader; `check-engine-bare-import.mjs` fails a bare engine import). This is that
 * pattern. The runtime half of the guard — `contexts.length < decisions.length` throws —
 * lives beside the code in `heroEvTask.mjs` and fires during any capturing run.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TASK = join(HERE, '..', 'backtest', 'heroEvTask.mjs');

const lineOf = (lines, needle, label) => {
  const idx = lines.findIndex((l) => l.includes(needle));
  if (idx < 0) {
    throw new Error(
      `decisionContextArmGate: could not find ${label} in heroEvTask.mjs (looked for ${JSON.stringify(needle)}). `
      + 'The marker moved or was renamed — re-anchor this test rather than deleting it; the '
      + 'invariant it guards is not visible in any unit test.',
    );
  }
  return idx;
};

describe('WS-540 — the context row is built above the arm gate', () => {
  const lines = readFileSync(TASK, 'utf8').split('\n');

  it('contexts.push happens BEFORE the arm-failure continue', () => {
    const push = lineOf(lines, 'contexts.push(contextRow)', 'the context push');
    const gate = lineOf(lines, 'let armFailure = null', 'the arm gate');
    // Strictly above. Equal or below means a decision an arm could not score never reaches
    // the set, and nothing downstream can tell.
    expect(push).toBeLessThan(gate);
  });

  it('buildDecisionContext is called BEFORE the arm loop, not after it', () => {
    const build = lineOf(lines, 'buildDecisionContext({', 'the context build');
    const gate = lineOf(lines, 'let armFailure = null', 'the arm gate');
    expect(build).toBeLessThan(gate);
  });

  it('the PRODUCTION gates stay above the context build — those rows are correctly absent', () => {
    // A decision with no geometry / unresolved outcome / non-finite netBB has no valid row
    // at all. Excluding those is right, and they must keep their `continue` above the build,
    // or the set fills with rows no arm can score for a reason that is not the arm's.
    const build = lineOf(lines, 'buildDecisionContext({', 'the context build');
    for (const marker of ['counters.geometrySkips++', 'counters.outcomeUnresolved', 'counters.heroSeatNotInOutcome++']) {
      expect(lineOf(lines, marker, marker)).toBeLessThan(build);
    }
  });

  it('the sampling cadence does not key off a post-gate count', () => {
    // `decisions.length` is incremented only for decisions that cleared the arm gate. Keying
    // the byte probe off it above the gate would make a PRODUCTION measurement depend on
    // which arms happened to fail — and it silently did, before the move.
    const cadence = lines.filter((l) => l.includes('CONTEXT_BYTES_SAMPLE_EVERY') && l.includes('%'));
    expect(cadence.length).toBeGreaterThan(0);
    for (const l of cadence) expect(l).not.toContain('decisions.length');
  });

  it('the runtime invariant is present and throws rather than warning', () => {
    const src = lines.join('\n');
    expect(src).toContain('contexts.length < decisions.length');
    const at = src.indexOf('contexts.length < decisions.length');
    // A warning here would be worthless: the run would still write the short set, and the
    // gate would still pass over it.
    expect(src.slice(at, at + 400)).toContain('throw new Error');
  });
});
