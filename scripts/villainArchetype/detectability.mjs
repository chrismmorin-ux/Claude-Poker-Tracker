/**
 * detectability — could this instrument have FOUND each behaviour, if the villain had it?
 *
 * FOUNDER, 2026-08-19: *"I want to build in a test for this conduct card artifact ... a big list
 * of potential actions or behaviors a villain could have ... This list of potential behaviors
 * becomes our checklist for 'could an agent find this in the data if it existed'."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A DIFFERENT QUESTION FROM ANYTHING ELSE THE PROFILE ASKS.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Every other measurement here asks "what did he do". This one asks what the instrument is
 * BLIND to, and it is the only question whose answer does not depend on the villain at all. A
 * dossier that reports no timing tells, no tilt and no opponent-specific adjustment reads as a
 * description of a stable, unexploitable player - and would read exactly the same if the record
 * simply had no timestamps, no hand ordering and no opponent ids. Those are indistinguishable
 * on the page and opposite in what they mean.
 *
 * This is the Census discipline from the Standard of Record applied to behaviour rather than to
 * coverage: a zero is not one fact but three - observed-zero, unexamined, or dropped - and the
 * register refuses to collapse them. `not-detectable` here means UNEXAMINED, and saying so is
 * the whole point.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY IT IS CODE AND NOT A DOCUMENT.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A checklist in a markdown file is a thing someone is supposed to remember to read. This reads
 * the LIVE schema and the LIVE rows: a capability counts as present only if its columns exist
 * AND carry non-null values in the data being profiled. Add a column and behaviours become
 * detectable automatically; break one and they stop, in the same run that broke it.
 */
import { readFileSync } from 'node:fs';
import { FIELDS } from './decisionSchema.mjs';

/**
 * What each capability requires of the schema, and of the data.
 *
 * A capability is PRESENT only when every listed column exists and at least one row carries a
 * real value for it. The second half matters: `suit_max` existed for a whole run while being
 * `-` on every row, because the labeller never threaded it through — a column that is present
 * and always null is worse than an absent one, because it looks like coverage.
 */
export const CAPABILITIES = {
  'action': { columns: ['ACTION'] },
  'position': { columns: ['seat_pos', 'to_act_after'] },
  'bet-size': { columns: ['bet_bb', 'bet_to_bb', 'bet_x_pot'] },
  'pot-size': { columns: ['pot_bb', 'price_pct'] },
  'stack-depth': { columns: ['stack_bb', 'spr'] },
  'board-cards': { columns: ['board', 'high_card', 'suit_max'] },
  'street-sequence': { columns: ['prev_checked', 'i_bet_prev', 'faced_agg_prev'] },
  'players-count': { columns: ['opps_live', 'players'] },
  'hole-cards': { columns: [], absent: true,
    why: 'his cards are recorded only when a hand reaches showdown; the folding half of every '
      + 'range is structurally unobserved' },
  // Present, but SURVIVOR-FILTERED and thin: a hand reaches showdown by CONTINUING, so strong
  // holdings are over-represented, and cards are visible on well under a tenth of decisions.
  // Any behaviour whose confirmation rests on this is `partial`, never `detectable`.
  'showdown-cards': { columns: ['cards'], filtered: true },
  'opponent-identity': { columns: [], absent: true,
    why: 'no column identifies WHO he is playing against, so every per-opponent rate is pooled '
      + 'across all of them and a flat aggregate can hide a player he targets' },
  'opponent-stats': { columns: [], absent: true,
    why: 'requires opponent identity first, then their own measured frequencies' },
  /**
   * WAS DECLARED ABSENT, AND WAS NOT. This entry read "nothing records who won the pot or how
   * much; every EV, leak and payoff question is therefore unanswerable from this record", and
   * on that sentence 43 of 128 behaviours - a third of the register - were written off as
   * unreachable, with the fix filed as a corpus-extraction project.
   *
   * It was never tested. `handOutcome.mjs` had already shipped, the adapter was already
   * emitting the debit side for it, and measured against villain 1 it resolves 2,703 of 2,704
   * hands with a zero-sum residual of 0.0000 bb. The claim was true of the raw file and false
   * of the pipeline, and nothing in either place forced those two statements to meet.
   *
   * Left as a live column check rather than flipped to a hardcoded `present`, so that if the
   * wiring ever breaks the behaviours go blind again in the run that broke them.
   */
  'hand-outcome': { columns: ['won', 'net_bb', 'final_pot_bb'] },
  'hand-ordering': { columns: ['hand'], ordered: true,
    why: 'hand ids exist and sort, so before/after comparisons are possible in principle' },
  'session-boundary': { columns: [], absent: true,
    why: 'no session start/end marker, so drift, tilt recovery and last-orbit effects cannot be '
      + 'scoped to a sitting' },
  'timestamp': { columns: [], absent: true,
    why: 'no decision latency is captured, so every timing tell is invisible' },
  'population-baseline': { columns: [], absent: true,
    why: 'the profile measures ONE villain; comparing him to a pool rate needs the pool mined '
      + 'on the same axes' },
};

/** A capability is present only if its columns exist AND carry real values in these rows. */
export const measureCapabilities = (rows, header) => {
  const has = new Map();
  for (const [name, spec] of Object.entries(CAPABILITIES)) {
    if (spec.absent) { has.set(name, { present: false, why: spec.why }); continue; }
    const missing = spec.columns.filter((c) => !header.includes(c));
    if (missing.length) {
      has.set(name, { present: false, why: `column(s) not in the schema: ${missing.join(', ')}` });
      continue;
    }
    const dead = spec.columns.filter((c) => {
      const i = header.indexOf(c);
      return !rows.some((r) => r[i] !== '-' && r[i] !== '' && r[i] != null);
    });
    has.set(name, dead.length
      ? { present: false, why: `column(s) present but null on every row: ${dead.join(', ')}` }
      : { present: true });
  }
  return has;
};

/**
 * Score every behaviour against what the instrument actually has.
 *
 * `partial` is deliberately its own verdict rather than being rounded to either side: a
 * behaviour whose frequency signature is measurable but whose confirmation needs hole cards can
 * be FOUND and not PROVEN, and reporting that as either "detectable" or "blind" would be a lie
 * in one direction or the other.
 */
export const scoreBehaviours = (behaviours, capabilities) => behaviours.map((b) => {
  const need = b.requires || [];
  const missing = need.filter((c) => !capabilities.get(c)?.present);
  // Confirmation-only card dependence does not block detection of the frequency signature.
  const blocking = missing.filter((c) => !(c === 'hole-cards' && b.needsCards === 'only-for-confirmation'));
  /**
   * A behaviour resting on showdown cards is PARTIAL even though the column exists.
   *
   * The first version of this scored those `detectable`, and `partial` came out at 0% - a
   * category that never fires is not a verdict, it is dead code that flatters the census.
   * Showdowns are survivor-filtered (a hand reaches one by continuing) and cover under a tenth
   * of decisions, so a composition claim built on them is FOUND but not PROVEN.
   */
  const survivorOnly = need.some((c) => capabilities.get(c)?.present && CAPABILITIES[c]?.filtered)
    && (b.needsCards === 'yes' || b.needsCards === 'only-for-confirmation');
  const verdict = blocking.length ? 'blind'
    : (missing.length || survivorOnly) ? 'partial' : 'detectable';
  return {
    ...b,
    verdict,
    missing,
    reasons: missing.map((c) => `${c}: ${capabilities.get(c)?.why || 'unavailable'}`),
  };
});

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('detectability.mjs')) {
  const tsv = readFileSync(process.env.TSV || '.tmp-arch/profiles-v2/jSCaL6Fm4lAi.tsv', 'utf8')
    .trim().split('\n');
  const header = tsv[0].split('\t');
  const rows = tsv.slice(1).map((r) => r.split('\t'));
  const reg = JSON.parse(readFileSync(
    process.env.REGISTRY || 'scripts/villainArchetype/behaviourRegistry.json', 'utf8'));

  const caps = measureCapabilities(rows, header);
  console.log('CAPABILITIES');
  for (const [name, v] of caps) {
    console.log(`  ${v.present ? 'have' : 'MISS'}  ${name.padEnd(20)} ${v.present ? '' : v.why}`);
  }

  const scored = scoreBehaviours(reg.behaviours, caps);
  const by = { detectable: 0, partial: 0, blind: 0 };
  for (const s of scored) by[s.verdict]++;
  const n = scored.length;
  console.log(`\nBEHAVIOUR CENSUS — ${n} behaviours`);
  console.log(`  detectable  ${String(by.detectable).padStart(3)}  (${(100 * by.detectable / n).toFixed(0)}%)`);
  console.log(`  partial     ${String(by.partial).padStart(3)}  (${(100 * by.partial / n).toFixed(0)}%)  frequency visible, confirmation needs cards`);
  console.log(`  BLIND       ${String(by.blind).padStart(3)}  (${(100 * by.blind / n).toFixed(0)}%)  could NOT be found even if he did it`);

  const why = new Map();
  for (const s of scored) {
    if (s.verdict !== 'blind') continue;
    for (const c of s.missing) why.set(c, (why.get(c) || 0) + 1);
  }
  console.log('\nWHAT THE BLINDNESS COSTS — behaviours lost per missing capability');
  for (const [c, k] of [...why].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padStart(3)}  ${c.padEnd(20)} ${CAPABILITIES[c]?.why || ''}`);
  }
}
