/**
 * ruleFitter — read a villain's labelled decisions and state, in the first person, the rules
 * they appear to be following.
 *
 * WHAT A RULE IS HERE. Not a stat. A rule is a claim about what the player does when they
 * look at a specific situation, keyed on the things actually in front of them — the price,
 * the stack depth, how many opponents are live, whether anyone has shown strength. Never on
 * a position label or a style bucket: those are outputs of a decision process, never inputs
 * to it (POKER_THEORY §7.1).
 *
 * TWO KINDS OF RULE, because two different instruments measure them.
 *
 *   FREQUENCY RULES — "I enter 22% of pots when nobody has come in." Measured on EVERY
 *   decision, so n is large. This is simultaneously a RANGE-SIZE claim: a rule naming a
 *   range ("JJ+, AQo+, ATs+") carries a combinatorial measure, and a villain entering 22%
 *   refutes an 8% range outright with no card ever shown.
 *
 *   THRESHOLD RULES — "I call up to 38% required equity, and fold past it." Fitted by
 *   binning decisions on the price faced and finding where the continue rate crosses 50%.
 *   This is the rule shape the founder asked for and the one a stat cannot express: a single
 *   fold-to-bet percentage averages over every price and therefore describes no decision.
 *
 * ARCHETYPES CARRY A STANDARD DEVIATION (founder ruling, 2026-08-18). An archetype is not a
 * point, it is (mu, sigma) per rule, where sigma is BEHAVIOURAL spread — how much genuine
 * variation the archetype tolerates — held separately from sampling noise. Membership is a
 * z-test against sqrt(sigma^2 + sampling variance), never an absolute percentage-point band.
 * An absolute band flatters a 3.9% base rate and punishes a 50% one; sigma units are
 * comparable across rules, which is what makes "25% of villains follow these rules at 95%
 * confidence" a single coherent claim rather than eight incomparable ones.
 */

/** The decision situations a rule can key on. Each yields (k, n) per villain. */
export const CONTEXTS = [
  {
    id: 'enter-first-in',
    question: 'When nobody has entered the pot, do I play?',
    firstPerson: (p) => `I enter ${pct(p)} of pots when nobody has come in`,
    rangeClaim: true,
    applies: (d) => d.street === 'preflop' && d.firstIn && d.facing === 'no bet',
    fired: (d) => d.action === 'raise' || d.action === 'call',
  },
  {
    id: 'raise-when-entering',
    question: 'When I enter first-in, do I raise or limp?',
    firstPerson: (p) => (p > 0.9
      ? `I always raise when I enter first — I never limp`
      : `I raise ${pct(p)} of the hands I enter first-in, and limp the rest`),
    applies: (d) => d.street === 'preflop' && d.firstIn && d.facing === 'no bet'
      && (d.action === 'raise' || d.action === 'call'),
    fired: (d) => d.action === 'raise',
  },
  {
    id: 'iso-over-limpers',
    question: 'When players have limped in front of me, do I raise them?',
    firstPerson: (p) => `I raise over limpers ${pct(p)} of the time`,
    applies: (d) => d.street === 'preflop' && d.limpersAhead > 0 && d.facing === 'no bet',
    fired: (d) => d.action === 'raise',
  },
  {
    id: 'continue-vs-raise',
    question: 'Facing a raise, do I continue?',
    firstPerson: (p) => `I continue against a raise ${pct(p)} of the time`,
    rangeClaim: true,
    applies: (d) => d.street === 'preflop' && d.facing === 'a raise',
    fired: (d) => d.action !== 'fold',
  },
  {
    id: '3bet-vs-raise',
    question: 'Facing a raise, do I re-raise?',
    firstPerson: (p) => `I 3-bet ${pct(p)} of the raises I face`,
    rangeClaim: true,
    applies: (d) => d.street === 'preflop' && d.facing === 'a raise',
    fired: (d) => d.action === 'raise',
  },
  {
    id: 'continue-vs-3bet',
    question: 'Facing a 3-bet, do I continue?',
    firstPerson: (p) => `I continue against a 3-bet ${pct(p)} of the time`,
    applies: (d) => d.street === 'preflop' && d.facing === 'a 3-bet',
    fired: (d) => d.action !== 'fold',
  },
  {
    id: 'cbet-flop',
    question: 'I raised preflop and the flop is checked to me. Do I bet?',
    firstPerson: (p) => `I c-bet the flop ${pct(p)} of the time when I raised preflop`,
    applies: (d) => d.street === 'flop' && d.iAmPreflopAggressor && d.facing === 'no bet',
    fired: (d) => d.action === 'bet',
  },
  {
    id: 'bet-when-checked-to',
    question: 'It is checked to me and I did not raise preflop. Do I bet?',
    firstPerson: (p) => `I bet ${pct(p)} of the pots that get checked to me without my having raised`,
    applies: (d) => d.street !== 'preflop' && !d.iAmPreflopAggressor && d.facing === 'no bet',
    fired: (d) => d.action === 'bet',
  },
  {
    id: 'continue-vs-bet',
    question: 'Facing a bet after the flop, do I continue?',
    firstPerson: (p) => `I continue against a postflop bet ${pct(p)} of the time`,
    applies: (d) => d.street !== 'preflop' && d.facing === 'a bet',
    fired: (d) => d.action !== 'fold',
  },
  {
    id: 'raise-vs-bet',
    question: 'Facing a bet after the flop, do I raise it?',
    firstPerson: (p) => `I raise ${pct(p)} of the postflop bets I face`,
    applies: (d) => d.street !== 'preflop' && d.facing === 'a bet',
    fired: (d) => d.action === 'raise',
  },
];

/** Price bands, in required equity, for the threshold rules. */
export const PRICE_BANDS = [
  { id: 'cheap', lo: 0, hi: 0.25, label: 'a cheap price (under 25%)' },
  { id: 'standard', lo: 0.25, hi: 0.35, label: 'a standard price (25-35%)' },
  { id: 'steep', lo: 0.35, hi: 0.45, label: 'a steep price (35-45%)' },
  { id: 'very-steep', lo: 0.45, hi: 1.01, label: 'a very steep price (over 45%)' },
];

const pct = (p) => `${(p * 100).toFixed(0)}%`;

/** (k, n) for one villain in every context. */
export const fitContexts = (decisions) => {
  const out = {};
  for (const c of CONTEXTS) {
    const app = decisions.filter(c.applies);
    out[c.id] = { k: app.filter(c.fired).length, n: app.length };
  }
  return out;
};

/**
 * The price threshold: where does this villain stop calling?
 *
 * Reported as the continue rate in each price band plus the crossing point — the band where
 * continuing drops below half. A single "fold to bet %" cannot express this, which is the
 * whole reason the rule language has thresholds.
 */
export const fitPriceThreshold = (decisions, { street = 'postflop' } = {}) => {
  const pool = decisions.filter(d => (street === 'preflop' ? d.street === 'preflop' : d.street !== 'preflop')
    && d.facing !== 'no bet' && d.potOddsNeeded != null);
  const bands = PRICE_BANDS.map(b => {
    const app = pool.filter(d => d.potOddsNeeded >= b.lo && d.potOddsNeeded < b.hi);
    return { ...b, k: app.filter(d => d.action !== 'fold').length, n: app.length };
  });
  const crossing = bands.find(b => b.n >= 5 && b.k / b.n < 0.5);
  return { bands, crossingBand: crossing ? crossing.id : null };
};

/** What the villain actually showed up with, by context — the hard constraints. */
export const revealedComposition = (decisions) => {
  const shown = decisions.filter(d => d.handKnown && d.handClass);
  const byClass = new Map();
  for (const d of shown) {
    const key = d.handClass.pairClass || d.handClass.category || 'unclassified';
    byClass.set(key, (byClass.get(key) || 0) + 1);
  }
  return { total: shown.length, byClass: [...byClass.entries()].sort((a, b) => b[1] - a[1]) };
};

// ─── archetype membership: sigma, not percentage points ───────────────────────

/** Sampling variance of an observed rate — the part that is NOT behaviour. */
export const samplingVar = (k, n) => {
  if (!n) return Infinity;
  const p = (k + 1) / (n + 2);          // Laplace, so 0/n and n/n do not claim zero variance
  return (p * (1 - p)) / n;
};

/**
 * Behavioural sigma for a rule across a set of members, by method of moments:
 * total observed spread MINUS the sampling spread that any single population would show.
 * Negative excess means the members are tighter than sampling noise, i.e. sigma is 0.
 */
export const behaviouralSigma = (members) => {
  const rates = members.map(m => m.k / m.n).filter(Number.isFinite);
  if (rates.length < 2) return null;
  const mu = rates.reduce((s, r) => s + r, 0) / rates.length;
  const totalVar = rates.reduce((s, r) => s + (r - mu) ** 2, 0) / (rates.length - 1);
  const meanSampVar = members.reduce((s, m) => s + samplingVar(m.k, m.n), 0) / members.length;
  return { mu, sigma: Math.sqrt(Math.max(0, totalVar - meanSampVar)) };
};

/**
 * Does this villain follow this rule, at the stated confidence?
 * z is taken against BOTH sources of spread — the archetype's own behavioural width and
 * this villain's sampling error. A villain with 6 observations is not evidence against an
 * archetype, and this is what stops thin players being spuriously split off.
 */
export const followsRule = (obs, rule, z = 1.96) => {
  if (!obs || !obs.n) return { verdict: 'no-data', z: null };
  const p = obs.k / obs.n;
  const sd = Math.sqrt((rule.sigma ?? 0) ** 2 + samplingVar(obs.k, obs.n));
  if (!(sd > 0)) return { verdict: p === rule.mu ? 'follows' : 'diverges', z: Infinity };
  const zz = Math.abs(p - rule.mu) / sd;
  return { verdict: zz <= z ? 'follows' : 'diverges', z: +zz.toFixed(2), observed: p };
};

export { pct };
