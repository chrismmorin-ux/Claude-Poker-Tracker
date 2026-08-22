/**
 * handDossier — every fact about one hand, laid next to every other fact.
 *
 * Founder, 2026-08-18: "If you put all the hand context next to each other, and force
 * yourself to answer, what happened here, and why the villain called an all-in with bottom
 * pair, then I believe you will be able to generate the rule that villain followed. As long
 * as you have all options available to you. Even if it's an unreasonable one."
 *
 * The design constraint is therefore WITHHOLD NOTHING. A dossier that pre-selects the
 * "relevant" fields has already decided what the explanation may be, and the explanations
 * are the input to rule induction, so that pre-selection would propagate into every rule.
 * Everything observable goes in: every seat's action in order with amounts, the pot and the
 * price at each decision, stack depth and SPR, the board street by street, who showed what,
 * position relative to the button, and — explicitly marked — what was NEVER observable.
 *
 * WHY THIS DOES NOT DRIFT. The dossier is a record of a thing that happened. An explanation
 * anchored to it can be wrong but cannot be fictional: every claim it makes is checkable
 * against the sequence. That is the founder's "rooted in truth, a thing that DID happen, so
 * it can't drift too far", and it is the reason explanation-first induction is safe here
 * where it would not be on a hypothetical.
 *
 * UNKNOWNS ARE PRINTED AS UNKNOWNS. The villain's cards are absent in ~95% of hands. The
 * dossier says so in the same place it would have said the cards, so an explainer cannot
 * quietly assume a holding it was never given.
 */

import { decisionGeometryFull } from '../backtest/decisionGeometry.mjs';
import { analyzeBoardFromStrings } from '../../src/utils/pokerCore/boardTexture.js';
import { classifyMadeHand } from './decisionLabeler.mjs';

const POSTED = new Set(['postSmallBlind', 'postBigBlind', 'post', 'ante', 'straddle']);
const STREET_CARDS = { preflop: 0, flop: 3, turn: 4, river: 5 };

/** Seat order starting after the button — how a player would describe who acts when. */
const positionName = (seat, button, occupied) => {
  const ring = [...occupied].map(Number).sort((a, b) => a - b);
  const bi = ring.indexOf(Number(button));
  if (bi < 0) return 'unknown';
  const order = [...ring.slice(bi + 1), ...ring.slice(0, bi + 1)]; // SB first ... BTN last
  const i = order.indexOf(Number(seat));
  const n = order.length;
  if (i === n - 1) return 'BTN';
  if (i === 0) return 'SB';
  if (i === 1) return 'BB';
  const fromEnd = n - 1 - i;
  if (fromEnd === 1) return 'CO';
  if (fromEnd === 2) return 'HJ';
  return `EP+${i - 2}`;
};

/**
 * A complete, human-readable dossier for one hand from one seat's point of view.
 * @returns {{text: string, facts: Object}}
 */
export const buildDossier = (hand, seat) => {
  const s = String(seat);
  const g = hand.gameState || {};
  const bt = hand._backtest || {};
  const bb = bt.bb || 1;
  const community = g.communityCards || [];
  const occupied = Object.keys(hand.seatPlayers || {});
  const button = g.dealerButtonSeat;
  const seq = [...(g.actionSequence || [])].sort((a, b) => a.order - b.order);
  const showdown = g.showdownCards || {};
  const villainCards = showdown[s] || null;

  const L = [];
  L.push(`HAND ${hand.handId}`);
  L.push(`Stakes: ${(bt.stakeLabel || 'unknown')}  ·  big blind = ${bb}  ·  ${occupied.length} players dealt in`);
  L.push(`The player we are studying sits in seat ${s} (${positionName(s, button, occupied)}). Button is seat ${button}.`);

  const stacks = bt.stackBeforeByOrder || {};
  const firstOrder = seq.length ? seq[0].order : null;
  if (firstOrder != null && stacks[firstOrder] != null) {
    L.push(`Effective stack at the first decision: ${(stacks[firstOrder] / bb).toFixed(1)}bb.`);
  }

  L.push('');
  L.push('SEATS AND POSITIONS');
  for (const o of occupied) {
    const tag = o === s ? '  <-- THE PLAYER WE ARE STUDYING' : '';
    const shown = showdown[o] ? `  showed ${showdown[o].join('')}` : '';
    L.push(`  seat ${o}  ${positionName(o, button, occupied).padEnd(6)}${shown}${tag}`);
  }

  L.push('');
  L.push('WHAT THE PLAYER HELD');
  L.push(villainCards
    ? `  ${villainCards.join('')} — revealed at showdown.`
    : '  UNKNOWN. This hand never reached a showdown for this player, so the cards were '
      + 'never observable. Do not assume a holding; infer what range is consistent with the actions.');

  L.push('');
  L.push('THE ACTION, IN ORDER');
  // ─────────────────────────────────────────────────────────────────────────────────────
  // THE SAME WALK, KEPT AS DATA (WS-624)
  // ─────────────────────────────────────────────────────────────────────────────────────
  //
  // Everything a reader needs to see the hand — seat, street, board, texture, geometry — is
  // computed here and was previously flattened into prose and thrown away, leaving any
  // consumer that wanted to put the ANALYSIS beside the ACTION no option but to re-parse the
  // text. Joining a priced decision to its moment in the hand by regex over `>>> STUDIED
  // PLAYER` is exactly the kind of second representation that WS-291 is about. `order` is the
  // join key, and it is the same key the pricer stamps.
  const actions = [];
  let cur = null;
  let curBoard = [];
  let curTex = '';
  for (const e of seq) {
    if (e.street !== cur) {
      cur = e.street;
      const board = community.slice(0, STREET_CARDS[cur] ?? 0);
      const tex = board.length >= 3 ? analyzeBoardFromStrings(board) : null;
      const texWords = tex ? [
        tex.paired && 'paired', tex.monotone && 'monotone', tex.twoTone && 'two-tone',
        (tex.connected || tex.straighty) && 'connected',
      ].filter(Boolean).join(', ') || 'dry / disconnected' : '';
      L.push(`  --- ${cur.toUpperCase()}${board.length ? '  ' + board.join(' ') : ''}${texWords ? `   (${texWords})` : ''}`);
      curBoard = board;
      curTex = texWords;
    }
    const me = String(e.seat) === s;
    const geo = me && !POSTED.has(e.action) ? decisionGeometryFull(hand, e.order, e.street, s) : null;
    const amt = Number.isFinite(e.amount) ? ` ${(e.amount / bb).toFixed(2)}bb` : '';
    const who = me ? '>>> STUDIED PLAYER' : `    seat ${e.seat} (${positionName(e.seat, button, occupied)})`;
    L.push(`  ${who.padEnd(28)} ${e.action}${amt}`);
    const madeHand = me && villainCards && STREET_CARDS[e.street] >= 3
      ? classifyMadeHand(villainCards, community.slice(0, STREET_CARDS[e.street])) : null;
    actions.push({
      order: e.order,
      street: e.street,
      seat: String(e.seat),
      isHero: me,
      position: positionName(e.seat, button, occupied),
      action: e.action,
      amountBB: Number.isFinite(e.amount) ? e.amount / bb : null,
      board: curBoard.slice(),
      texture: curTex || null,
      // Present only on hero's own non-posted actions, because that is the only place
      // `decisionGeometryFull` is computed. A null here means not-applicable, never zero.
      geo: geo ? {
        potBB: geo.potBB,
        facingBetBB: geo.facingBetBB,
        equityNeededPct: geo.facingBetBB > 0
          ? (geo.facingBetBB / (geo.potBB + geo.facingBetBB)) * 100 : null,
        spr: geo.spr ?? null,
        liveOpponents: geo.liveOpponents,
        closesAction: geo.closesAction,
        madeHand: madeHand
          ? ([madeHand.pairClass, madeHand.kicker && `${madeHand.kicker} kicker`]
            .filter(Boolean).join(', ') || madeHand.category)
          : null,
      } : null,
    });
    if (geo) {
      const facing = geo.facingBetBB;
      const price = facing > 0 ? `${((facing / (geo.potBB + facing)) * 100).toFixed(0)}% equity needed to call` : 'nothing to call';
      const hc = villainCards && STREET_CARDS[e.street] >= 3
        ? classifyMadeHand(villainCards, community.slice(0, STREET_CARDS[e.street])) : null;
      const hcTxt = hc ? `; holding = ${[hc.pairClass, hc.kicker && hc.kicker + ' kicker'].filter(Boolean).join(', ') || hc.category}` : '';
      L.push(`        [pot ${geo.potBB.toFixed(1)}bb before this action; facing ${facing.toFixed(2)}bb; `
        + `${price}; SPR ${geo.spr != null ? geo.spr.toFixed(1) : '?'}; `
        + `${geo.liveOpponents} opponent(s) still in; ${geo.closesAction ? 'this closes the action' : 'players still to act behind'}${hcTxt}]`);
    }
  }

  L.push('');
  L.push('HOW IT ENDED');
  const showedAny = Object.keys(showdown).length;
  L.push(showedAny
    ? `  Showdown. ${Object.entries(showdown).map(([k, v]) => `seat ${k} showed ${v.join('')}`).join('; ')}.`
    : '  No showdown was recorded — everyone folded before cards were compared, or the cards were not captured.');
  if (community.length) L.push(`  Final board: ${community.join(' ')}`);

  L.push('');
  L.push('WHAT IS NOT KNOWN');
  const unknown = occupied.filter(o => !showdown[o]);
  L.push(`  Hole cards were never observable for seat(s): ${unknown.join(', ') || 'none — everyone showed'}.`);
  L.push('  Stack sizes for opponents, timing, chat, and table history are not in this record.');

  return {
    text: L.join('\n'),
    actions,
    facts: {
      handId: hand.handId, seat: s, villainCards, board: community,
      position: positionName(s, button, occupied), players: occupied.length,
      showdown: Object.keys(showdown).length > 0,
      stakeLabel: bt.stakeLabel ?? null,
      button: button ?? null,
      seats: occupied.map((o) => ({
        seat: o,
        position: positionName(o, button, occupied),
        isHero: o === s,
        shown: showdown[o] ?? null,
      })),
      effectiveStackBB: (firstOrder != null && stacks[firstOrder] != null)
        ? stacks[firstOrder] / bb : null,
    },
  };
};
