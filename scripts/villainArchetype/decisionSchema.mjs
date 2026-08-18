/**
 * decisionSchema — ONE record shape for every decision, used by every consumer.
 *
 * FOUNDER, 2026-08-18: "Maybe the answer is to standardize the dataset provided to our agents
 * for the rule making. Each action is identical in its schema. That forces correlation to
 * emerge and we can easily add other elements like that."
 *
 * WHY THIS IS THE FIX AND NOT JUST A TIDY-UP. Position was present in the prose dossier the
 * agents read and ABSENT from the labelled record the code induced rules from. The agents
 * therefore proposed positional rules the verifier could not test, and the omission was
 * invisible because the two representations were never required to agree. One schema removes
 * that entire class of error: there is no second representation to drift from.
 *
 * It also does what the founder says it does — a uniform row FORCES comparison. Prose lets a
 * reader attend to whatever a hand made vivid; a table of identical rows makes the reader
 * notice that the same column differs. Correlation emerges because nothing else can.
 *
 * THE THREE GROUPS, and the boundary that matters:
 *
 *   SITUATION — what the villain could see when he acted. These are the ONLY fields a rule
 *               may condition on.
 *   ACTION    — what he did. The thing being predicted.
 *   OUTCOME   — what happened afterwards, including whether his cards were ever revealed.
 *               NEVER available to a rule. `handKnown` lives here, not in SITUATION: whether
 *               a hand reached showdown is a fact about the future, and conditioning on it
 *               leaks. An earlier induction used it as a feature and had to be corrected.
 *
 * Adding a feature means adding one entry here. Every consumer picks it up, and the schema
 * version changes so a stale table cannot be mistaken for a current one.
 */

const yn = (v) => v == null ? '-' : (v ? 'yes' : 'no');

export const SCHEMA_VERSION = 8;

/**
 * Every field, in the order it appears in the table.
 * `group` decides who may use it. `blank` is what is printed when the field does not apply,
 * so a row is never ragged — the founder's "each action is identical in its schema".
 */
export const FIELDS = [
  // ── identity ──
  { name: 'hand', group: 'id', get: d => d.handId, describe: 'which hand this decision came from' },
  { name: 'street', group: 'situation', get: d => d.street, describe: 'preflop / flop / turn / river' },
  { name: 'seat_pos', group: 'situation', get: d => d.position, describe: 'my seat relative to the button' },
  { name: 'players', group: 'situation', get: d => d.seatsDealt, describe: 'how many were dealt in' },

  // ── what is in front of me ──
  { name: 'facing', group: 'situation', get: d => d.facing, describe: 'what action stands in front of me' },
  { name: 'aggressor', group: 'situation', get: d => d.aggressorPosition ?? '-', describe: 'who bet or raised into me' },
  { name: 'raises_in', group: 'situation', get: d => d.raisesFaced, describe: 'raises already in this street' },
  { name: 'limpers', group: 'situation', get: d => d.limpersAhead ?? '-', describe: 'limpers ahead of me (blank when a raise is already in)' },
  { name: 'opps_live', group: 'situation', get: d => d.opponentsLive ?? '-', describe: 'opponents still in the hand' },
  { name: 'closes', group: 'situation', get: d => d.closesAction == null ? '-' : (d.closesAction ? 'yes' : 'no'), describe: 'does my decision close the action' },
  { name: 'in_pos', group: 'situation', get: d => d.inPosition == null ? '-' : (d.inPosition ? 'yes' : 'no'), describe: 'do I act last on this street (postflop only)' },

  // ── position, OVER-ENUMERATED (founder 2026-08-18: "this is how to unaggregate") ──
  // The same fact in several framings, because which framing governs a rule is exactly what
  // we do not know in advance. The seat NAME is rarely the one that matters; the relationship
  // to the player applying pressure usually is.
  { name: 'off_button', group: 'situation', get: d => d.offButton ?? '-', describe: 'seats from the button (0 = button)' },
  { name: 'to_act_after', group: 'situation', get: d => d.seatsToActAfterMe ?? '-', describe: 'live players still to act behind me' },
  { name: 'acted_before', group: 'situation', get: d => d.seatsActedBeforeMe ?? '-', describe: 'live players who acted before me' },
  { name: 'is_blind', group: 'situation', get: d => yn(d.isBlind), describe: 'am I in a blind' },
  { name: 'is_late', group: 'situation', get: d => yn(d.isLate), describe: 'am I on the button or cutoff' },
  { name: 'after_aggr', group: 'situation', get: d => yn(d.actsAfterAggressor), describe: 'do I act after the player applying pressure' },
  { name: 'blind_v_blind', group: 'situation', get: d => yn(d.blindVsBlind), describe: 'only the two blinds are left' },

  // ── the money ──
  { name: 'to_call_bb', group: 'situation', get: d => d.toCallBB, describe: 'what it costs me to continue' },
  { name: 'pot_bb', group: 'situation', get: d => d.potBB ?? '-', describe: 'the pot including the live bet' },
  { name: 'price_pct', group: 'situation', get: d => d.potOddsNeeded == null ? '-' : Math.round(d.potOddsNeeded * 100), describe: 'equity I need to call' },
  { name: 'bet_x_pot', group: 'situation', get: d => d.betFractionOfPot ?? '-', describe: 'the bet as a fraction of the pot before it' },
  { name: 'stack_bb', group: 'situation', get: d => d.myStackBB ?? '-', describe: 'my stack' },
  { name: 'invested_bb', group: 'situation', get: d => d.investedBB ?? '-', describe: 'what I already put in this hand' },
  { name: 'spr', group: 'situation', get: d => d.spr == null ? '-' : +d.spr.toFixed(1), describe: 'stack to pot ratio' },

  // ── the board and my role ──
  { name: 'board', group: 'situation', get: d => !d.boardTexture ? '-'
    : [d.boardTexture.trips && 'trips', d.boardTexture.paired && 'paired',
       d.boardTexture.monotone && 'mono', d.boardTexture.twoTone && 'twotone',
       d.boardTexture.connected && 'connected']
      .filter(Boolean).join('+') || 'dry', describe: 'board texture' },
  { name: 'flush_draw', group: 'situation', get: d => yn(d.boardTexture?.flushDraw), describe: 'three to a suit is out' },
  { name: 'straight_poss', group: 'situation', get: d => yn(d.boardTexture?.straightPossible), describe: 'three cards inside a five-rank window' },
  { name: 'broadways', group: 'situation', get: d => d.boardTexture?.broadwayCount ?? '-', describe: 'how many board cards are ten or higher' },
  { name: 'high_card', group: 'situation', get: d => d.boardTexture?.highCard ?? '-', describe: 'highest board card' },
  { name: 'i_raised_pf', group: 'situation', get: d => d.iAmPreflopAggressor ? 'yes' : 'no', describe: 'was I the preflop raiser' },
  { name: 'first_in', group: 'situation', get: d => d.street === 'preflop' ? (d.firstIn ? 'yes' : 'no') : '-', describe: 'nobody had entered when I acted (preflop only)' },

  // ── derived binaries (founder 2026-08-18: inferable, and likely correlated) ──
  // These are the SEQUENCE facts a per-node view cannot hold. A player who called a bet and
  // now faces another is in a different decision from one seeing a first bet, even when
  // price, board and position are identical.
  { name: 'faced_agg_prev', group: 'situation', get: d => yn(d.facedAggressionLastStreet), describe: 'did I face a bet or raise on the previous street' },
  { name: 'i_bet_prev', group: 'situation', get: d => yn(d.iBetLastStreet), describe: 'was I the bettor on the previous street' },
  { name: 'i_called_prev', group: 'situation', get: d => yn(d.iCalledLastStreet), describe: 'did I call on the previous street' },
  { name: 'prev_checked', group: 'situation', get: d => yn(d.lastStreetCheckedThrough), describe: 'did the previous street check through' },
  { name: 'initiative', group: 'situation', get: d => yn(d.iHaveInitiative), describe: 'was I the last player to show aggression in this hand' },
  { name: 'same_aggressor', group: 'situation', get: d => yn(d.facingSameAggressorAgain), describe: 'is the same player betting into me again' },
  { name: 'multiway', group: 'situation', get: d => yn(d.multiway), describe: 'two or more opponents still in' },
  { name: 'board_paired_now', group: 'situation', get: d => yn(d.boardPairedThisCard), describe: 'did the newest card pair the board' },
  { name: 'overcard_now', group: 'situation', get: d => yn(d.overcardArrived), describe: 'did a card higher than the board arrive' },
  { name: 'flush_card_now', group: 'situation', get: d => yn(d.flushCardArrived), describe: 'did the newest card bring a third card of one suit' },
  { name: 'pot_committed', group: 'situation', get: d => yn(d.potCommitted), describe: 'have I already put in a third of my stack' },

  // ── the pot's history and within-street aggression ──
  { name: 'pf_pot_type', group: 'situation', get: d => d.preflopPotType ?? '-', describe: 'was this a limped, single-raised, 3-bet or 4-bet pot' },
  { name: 'barrels', group: 'situation', get: d => d.barrelsSoFar ?? '-', describe: 'consecutive streets the aggressor has bet' },
  { name: 'i_bet_street', group: 'situation', get: d => yn(d.iBetThisStreet), describe: 'did I already bet on this street' },
  { name: 'raised_over_me', group: 'situation', get: d => yn(d.raisedOverMyBet), describe: 'was my own bet raised' },
  { name: 'callers_ahead', group: 'situation', get: d => d.callersAhead ?? '-', describe: 'opponents who already called the live bet' },
  { name: 'facing_allin', group: 'situation', get: d => yn(d.facingAllIn), describe: 'is the bet I face an all-in' },
  { name: 'call_is_allin', group: 'situation', get: d => yn(d.callingIsAllIn), describe: 'would calling put me all in' },

  // ── what I did ──
  { name: 'ACTION', group: 'action', get: d => d.action, describe: 'what I did' },
  { name: 'my_size_x_pot', group: 'action', get: d => d.raiseToFractionOfPot ?? '-', describe: 'my bet or raise as a fraction of the pot' },

  // ── after the fact — NEVER a rule condition ──
  { name: 'cards', group: 'outcome', get: d => d.handKnown ? d.holeCards.join('') : '-', describe: 'only if the hand reached showdown' },
  { name: 'made_hand', group: 'outcome', get: d => d.handClass
    ? ([d.handClass.pairClass, d.handClass.kicker && d.handClass.kicker + 'kick'].filter(Boolean).join('/') || d.handClass.category)
    : '-', describe: 'what I actually held, when shown' },
];

/** The fields a rule may condition on. Anything else is either the answer or the future. */
export const SITUATION_FIELDS = FIELDS.filter(f => f.group === 'situation').map(f => f.name);

export const toRow = (d) => {
  const row = {};
  for (const f of FIELDS) {
    const v = f.get(d);
    row[f.name] = (v === null || v === undefined || v === '') ? '-' : v;
  }
  return row;
};

export const header = () => FIELDS.map(f => f.name);

/** A fixed-width table. Every row identical, so a difference between rows is visible. */
export const renderTable = (rows, { max = Infinity } = {}) => {
  const cols = header();
  const widths = cols.map(c => Math.max(c.length,
    ...rows.slice(0, 500).map(r => String(r[c] ?? '-').length)));
  const line = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join('  ');
  const out = [line(cols), widths.map(w => '-'.repeat(w)).join('  ')];
  for (const r of rows.slice(0, max)) out.push(line(cols.map(c => r[c] ?? '-')));
  return out.join('\n');
};

/** The legend an agent needs to read the table without guessing. */
export const legend = () => FIELDS.map(f =>
  `  ${f.name.padEnd(15)} [${f.group}] ${f.describe}`).join('\n');
