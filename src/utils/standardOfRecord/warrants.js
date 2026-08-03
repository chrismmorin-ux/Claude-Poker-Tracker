/**
 * warrants.js — WHY a rule says what it says.
 *
 * A Strategy Card rule carries a warrant: the kind of reason standing behind it. Four are
 * legal, and the fourth is the interesting one.
 *
 *   equity     — the rule follows from hand equity against a range. Arithmetic settles it.
 *   structure  — the rule follows from pot odds, SPR, position, or who is left to act.
 *                Also arithmetic, but about the shape of the pot rather than the cards.
 *   read       — the rule claims something about a POPULATION NUMBER. This is the only
 *                warrant that makes a falsifiable empirical claim, so a `read` rule must
 *                name the claim it is making and can be scored against the corpus.
 *   fear       — the author is deviating because of how the spot feels, and says so.
 *
 * WHY `fear` IS LEGAL. The instinct is to disallow it — a strategy justified by fear is a
 * strategy with a leak in it. But the founder's position, and the reason this enum has four
 * entries instead of three, is that YOU CAN ONLY MEASURE WHAT AUTHORS WILL ADMIT TO. Outlaw
 * the warrant and fear does not leave the card; it hides inside an `equity` rule whose
 * arithmetic does not actually support it, where nothing can find it. Make it declarable and
 * it becomes a measurable quantity: how much of this card's EV comes from rules its own
 * author labelled as fear?
 *
 * This is the same doctrine already recorded in POKER_THEORY §11.7 ("fear is game state, not
 * a label") read from the authoring side: fear is a real input to a real human decision, and
 * the honest move is to record it rather than to pretend it was arithmetic.
 *
 * DECLARED, THEN AUDITED (founder decision, 2026-08-02). Declaring invites honesty but
 * catches only the honest. The counterpart is a derived test — an `equity`-warranted rule
 * that deviates toward passive in the MEDIUM strength band with no arithmetic justification
 * is behaving like fear regardless of its label. `derivedVerdict` is the slot that test
 * writes into. WS-322 ships the slot; WS-327 ships the detector. The slot exists now so the
 * schema does not have to change when it does — and so a reader can tell "not yet audited"
 * (null) from "audited and agreed" (a verdict), which are different facts.
 */

/** The four legal warrants. Order is presentational only; nothing keys off it. */
export const WARRANT_CLASSES = Object.freeze(['equity', 'structure', 'read', 'fear']);

/** Warrants whose rules make a falsifiable claim about a population number. */
export const EMPIRICAL_WARRANTS = Object.freeze(['read']);

export const isWarrantClass = (w) => WARRANT_CLASSES.includes(w);

/**
 * Normalize a rule's warrant into the stored shape.
 *
 * Accepts either the shorthand (`warrant: 'equity'`) or the long form
 * (`warrant: { class: 'read', claim: 'BTN opens > 45% here' }`). A `read` warrant SHOULD
 * carry its claim — that is what makes it scoreable — but a missing claim is a warning
 * rather than a load failure, because a card whose reads are unstated is still a better
 * artifact than no card, and WS-327 is where that gets tightened.
 *
 * `derivedVerdict` is always present and always starts null. An absent field and a null
 * field read the same in JavaScript but not to a person auditing the artifact, and this
 * schema is meant to be read by people.
 */
export const normalizeWarrant = (warrant) => {
  const raw = typeof warrant === 'string' ? { class: warrant } : (warrant || {});
  return {
    class: raw.class ?? null,
    claim: raw.claim ?? null,
    derivedVerdict: null,
  };
};

/** Problems with a warrant, as strings. Empty array means acceptable. */
export const warrantProblems = (warrant, { ruleId = '?' } = {}) => {
  const problems = [];
  const w = normalizeWarrant(warrant);
  if (!isWarrantClass(w.class)) {
    problems.push(
      `rule "${ruleId}" has warrant "${w.class}" which is not one of ${WARRANT_CLASSES.join(' | ')}`,
    );
  }
  return problems;
};

/** Warnings — surfaced, never fatal. See the `read`-without-a-claim note above. */
export const warrantWarnings = (warrant, { ruleId = '?' } = {}) => {
  const warnings = [];
  const w = normalizeWarrant(warrant);
  if (EMPIRICAL_WARRANTS.includes(w.class) && !w.claim) {
    warnings.push(
      `rule "${ruleId}" is warranted by a read but states no claim — a read warrant that names no population number cannot be scored`,
    );
  }
  return warnings;
};
