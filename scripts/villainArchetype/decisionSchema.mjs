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

export const SCHEMA_VERSION = 12;

/**
 * Every field, in the order it appears in the table.
 * `group` decides who may use it. `blank` is what is printed when the field does not apply,
 * so a row is never ragged — the founder's "each action is identical in its schema".
 */
/** A 0-1 share as whole percent, or '-' when the row has no strength distribution. */
const pctOf = (x) => (x == null ? '-' : Math.round(100 * x));

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
  { name: 'off_button', group: 'situation', get: d => d.offButton ?? '-', describe: 'seats from the button (0 = button) — populated for the blinds too; pair with is_blind' },
  // NOT the same fact as `closes`, and they legitimately disagree on ~2% of rows: a player behind
  // who has already CALLED owes nothing at the current price, so this reads 0, while a raise from
  // me would still reopen the action, so `closes` reads no. That gap IS the squeeze/overcall spot.
  { name: 'to_act_after', group: 'situation', get: d => d.seatsToActAfterMe ?? '-', describe: 'opponents who still OWE a decision at the current price (not: who sits behind me)' },
  { name: 'acted_before', group: 'situation', get: d => d.seatsActedBeforeMe ?? '-', describe: 'live opponents who have already acted and owe nothing at the current price' },
  { name: 'is_blind', group: 'situation', get: d => yn(d.isBlind), describe: 'am I in a blind' },
  { name: 'is_late', group: 'situation', get: d => yn(d.isLate), describe: 'am I on the button or cutoff' },
  { name: 'after_aggr', group: 'situation', get: d => yn(d.actsAfterAggressor), describe: 'do I act after the player applying pressure' },
  { name: 'blind_v_blind', group: 'situation', get: d => yn(d.blindVsBlind), describe: 'only the two blinds are left' },

  // ── the money ──
  { name: 'to_call_bb', group: 'situation', get: d => d.toCallBB, describe: 'what it costs me to continue' },
  { name: 'pot_bb', group: 'situation', get: d => d.potBB ?? '-', describe: 'the pot including the live bet' },
  { name: 'price_pct', group: 'situation', get: d => d.potOddsNeeded == null ? '-' : Math.round(d.potOddsNeeded * 100), describe: 'equity I need to call' },
  // WHAT HE BET AT ME, which is not what I owe. Until v10 the schema carried only my price:
  // `bet_x_pot` computed `toCall/(pot-toCall)` and was algebraically identical to `price_pct`
  // (verified, zero exceptions in 2,829 rows), so two columns held one fact and the aggressor's
  // sizing - the single most informative thing about the action in front of me - was absent.
  { name: 'bet_x_pot', group: 'situation', get: d => d.betFractionOfPot ?? '-', describe: 'the bet facing me as a fraction of the pot BEFORE it (his sizing, not my price)' },
  { name: 'bet_bb', group: 'situation', get: d => d.aggressorBetBB ?? '-', describe: 'how much he actually bet or raised, in big blinds (the increment, not the raise-to)' },
  { name: 'bet_to_bb', group: 'situation', get: d => d.aggressorToBB ?? '-', describe: 'his CUMULATIVE amount for this street — what I must match to continue' },
  { name: 'pot_before_bet', group: 'situation', get: d => d.potBeforeBetBB ?? '-', describe: 'the pot he bet into' },
  { name: 'in_street_bb', group: 'situation', get: d => d.investedThisStreetBB ?? '-', describe: 'what I have already put in on THIS street (his bet minus this is what I owe)' },
  { name: 'stack_bb', group: 'situation', get: d => d.myStackBB ?? '-', describe: 'my stack' },
  { name: 'invested_bb', group: 'situation', get: d => d.investedBB ?? '-', describe: 'what I already put in this hand' },
  { name: 'spr', group: 'situation', get: d => d.spr == null ? '-' : +d.spr.toFixed(1), describe: 'stack to pot ratio' },

  // ── the board and my role ──
  { name: 'board', group: 'situation', get: d => !d.boardTexture ? '-'
    : [d.boardTexture.trips && 'trips', d.boardTexture.paired && 'paired',
       d.boardTexture.monotone && 'mono', d.boardTexture.twoTone && 'twotone',
       d.boardTexture.connected && 'connected']
      .filter(Boolean).join('+') || 'dry', describe: 'board texture' },
  // THE BOARD'S SUITEDNESS AS A COUNT, because the boolean was a trap.
  // `flush_draw` is `maxSuitFreq >= 3` - three to a suit ON THE BOARD. It is `no` on every
  // TWO-TONE flop, which is precisely where a villain holding two of that suit HAS a flush
  // draw. The single most common draw in the game had no representation in the schema at all,
  // so every rule about drawing hands was blind to it. The count is kept instead of a second
  // boolean: 2 = a hand can hold a flush draw, 3 = one card completes it, 4+ = it is there.
  { name: 'flush_draw', group: 'situation', get: d => yn(d.boardTexture?.flushDraw), describe: 'THREE to a suit is on the BOARD (not: he holds a draw)' },
  { name: 'suit_max', group: 'situation', get: d => d.boardTexture?.maxSuitFreq ?? '-', describe: 'most cards of one suit on the board - 2 means he can hold a flush draw' },
  { name: 'straight_poss', group: 'situation', get: d => yn(d.boardTexture?.straightPossible), describe: 'three cards inside a five-rank window' },
  { name: 'broadways', group: 'situation', get: d => d.boardTexture?.broadwayCount ?? '-', describe: 'how many board cards are ten or higher' },
  { name: 'high_card', group: 'situation', get: d => d.boardTexture?.highCard ?? '-', describe: 'highest board card' },
  /**
   * WHAT HIS RANGE CAN MAKE, AND WHAT IT CAN BECOME — over-enumerated on purpose.
   *
   * FOUNDER, 2026-08-19: *"The agents should be able to clearly see the full picture for each
   * position and spot, thrust upon them, overenumerated, back propagated, forced to be precisely
   * labeled. that is the only way we get the organic correlations by the AI that we're looking
   * for is if we give it the right info."*
   *
   * These are not his cards. They are the DISTRIBUTION his range takes on the board in front of
   * him — arithmetic over (range x board), both fixed before he acts, which is why a rule may
   * condition on them where it may never condition on `cards`.
   *
   * `str_pct_*` is the CANONICAL axis (POKER_THEORY 15.1): rank within this board's own combo
   * universe, normalised so it compares across boards even though the underlying order does not.
   * Everything after it is the readable label layer, because a percentile cannot say "flush
   * draw" — it ranks CURRENT showdown strength, so a naked nut-flush draw sits near the bottom
   * of it while being one of the best hands to hold. Draws are a second axis, not a rival.
   */
  { name: 'str_basis', group: 'situation', get: d => d.strength?.basis ?? '-', describe: 'exact (his range is every hand) or assumed (composition filled by equity ordering)' },
  { name: 'str_pct_mean', group: 'situation', get: d => d.strength?.pctMean ?? '-', describe: 'CANONICAL AXIS: mean board-normalised strength percentile of his range' },
  { name: 'str_pct_med', group: 'situation', get: d => d.strength?.pctMedian ?? '-', describe: 'median percentile — where the middle of his range sits on this board' },
  { name: 'str_pct_top10', group: 'situation', get: d => d.strength?.pctTop10 ?? '-', describe: 'the percentile his top decile reaches' },

  { name: 'str_value', group: 'situation', get: d => pctOf(d.strength?.value), describe: '% of his range making TOP PAIR or better' },
  { name: 'str_anypair', group: 'situation', get: d => pctOf(d.strength?.anyPair), describe: '% making ANY pair — bottom pair is a made hand and beats a naked draw at showdown' },
  { name: 'str_air', group: 'situation', get: d => pctOf(d.strength?.air), describe: '% with no pair, no draw and no backdoor' },
  { name: 'str_2pair_up', group: 'situation', get: d => pctOf(d.strength?.made['set-or-two-pair']), describe: '% making two pair or a set' },
  { name: 'str_toppair', group: 'situation', get: d => pctOf(d.strength?.made['top-pair']), describe: '% making exactly top pair' },
  { name: 'str_midpair', group: 'situation', get: d => pctOf(d.strength?.made['middle-pair']), describe: '% making middle pair' },
  { name: 'str_botpair', group: 'situation', get: d => pctOf(d.strength?.made['bottom-pair']), describe: '% making bottom pair' },
  { name: 'str_overpair', group: 'situation', get: d => pctOf(d.strength?.made['overpair']), describe: '% holding an overpair' },

  { name: 'str_draw', group: 'situation', get: d => pctOf(d.strength?.realDraw), describe: '% on a live draw — flush, open-ender, double gutshot or gutshot' },
  { name: 'str_fd', group: 'situation', get: d => pctOf(d.strength?.draw['flush-draw']), describe: '% on a flush draw' },
  { name: 'str_oesd', group: 'situation', get: d => pctOf(d.strength?.draw.oesd), describe: '% on an open-ended straight draw' },
  { name: 'str_dblgut', group: 'situation', get: d => pctOf(d.strength?.draw['double-gutshot']), describe: '% on a double gutshot — same 8 outs, disguised' },
  { name: 'str_gutshot', group: 'situation', get: d => pctOf(d.strength?.draw.gutshot), describe: '% on a gutshot' },
  { name: 'str_bdfd', group: 'situation', get: d => pctOf(d.strength?.draw['backdoor-flush']), describe: '% on a BACKDOOR flush draw — why a hand continues with nothing yet' },
  { name: 'str_runner', group: 'situation', get: d => pctOf(d.strength?.draw['runner-straight']), describe: '% on a runner-runner straight' },
  { name: 'str_nutdraw', group: 'situation', get: d => pctOf(d.strength?.nutDraw), describe: '% drawing to the BEST hand of its type — the nut end, not the idiot end' },

  { name: 'str_hit_clean', group: 'situation', get: d => pctOf(d.strength?.drawClean), describe: '% whose draw completes to a hand nothing on this board beats' },
  { name: 'str_hit_vuln', group: 'situation', get: d => pctOf(d.strength?.drawVulnerable), describe: '% whose draw completes INTO a better possible hand — a straight when a flush also lands' },
  { name: 'str_cooler', group: 'situation', get: d => pctOf(d.strength?.cooler), describe: '% holding the REDRAW — a set when the flush completes, full house over the nut flush' },
  { name: 'str_blocker', group: 'situation', get: d => pctOf(d.strength?.blocker), describe: '% holding the ace of a three-flush board — blocks the nuts, and can bluff as if holding it' },

  // ── BACK-PROPAGATED: what the new card DID to his range ──
  { name: 'str_d_pct', group: 'situation', get: d => d.strengthDelta?.pct ?? '-', describe: 'change in his mean strength percentile since the previous street' },
  { name: 'str_d_value', group: 'situation', get: d => d.strengthDelta ? Math.round(100 * d.strengthDelta.value) : '-', describe: 'change in his top-pair-or-better share — a positive number means the card got there for him' },
  { name: 'str_d_draw', group: 'situation', get: d => d.strengthDelta ? Math.round(100 * d.strengthDelta.draw) : '-', describe: 'change in his live-draw share — strongly negative means his draws either hit or died' },
  { name: 'draw_completed', group: 'situation', get: d => d.strengthDelta ? (d.strengthDelta.completed ? 'yes' : 'no') : '-', describe: 'the new card turned draw into value in HIS range — the nut-changing card' },

  { name: 'i_last_agg_pf', group: 'situation', get: d => d.iAmLastPreflopAggressor ? 'yes' : 'no', describe: 'was I the LAST preflop aggressor (not: did I raise preflop)' },
  { name: 'my_bet_raised_prev', group: 'situation', get: d => yn(d.myBetWasRaisedLastStreet), describe: 'my bet was raised last street and I called - my range is capped by that' },
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
  // Whether raising is LEGAL here. Added v9 after an agent reading one leaf cold pointed out
  // that a mix was being computed over rows where one of its own actions did not exist — he
  // "declined to raise" in 9 spots where raising was impossible, which flattered the call
  // share. It is a situation field, not a filter, because he could see it and the induction
  // should be free to condition on it while keeping every decision covered.
  { name: 'can_raise', group: 'situation', get: d => yn(d.canRaise), describe: 'is raising even available to me' },

  // ── what I did ──
  { name: 'ACTION', group: 'action', get: d => d.action, describe: 'what I did' },
  { name: 'my_raise_to_bb', group: 'action', get: d => d.myRaiseToBB ?? '-', describe: 'the total I raised TO on this street, in big blinds' },
  { name: 'my_bet_x_pot', group: 'action', get: d => d.myBetOverPotBefore ?? '-', describe: 'what my bet COST me, over the pot before it - the fraction a player means' },

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
  // EVERY row sets the width, not the first 500. A value longer than its column shifts every
  // field to its right, and sampling the head meant a long value further down - `board` reading
  // "trips+paired+twotone+connected" (30 chars in a 24-wide column), or `facing` reading
  // "a 5-bet or beyond" - silently corrupted that row for any reader. Measured: 21 such rows for
  // villain 1 and 73 for villain 2. Scanning all rows costs one pass and removes the failure.
  const widths = cols.map(c => Math.max(c.length,
    ...rows.map(r => String(r[c] ?? '-').length)));
  const line = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join('  ');
  const out = [line(cols), widths.map(w => '-'.repeat(w)).join('  ')];
  for (const r of rows.slice(0, max)) out.push(line(cols.map(c => r[c] ?? '-')));
  return out.join('\n');
};

/** The legend an agent needs to read the table without guessing. */
export const legend = () => FIELDS.map(f =>
  `  ${f.name.padEnd(15)} [${f.group}] ${f.describe}`).join('\n');
