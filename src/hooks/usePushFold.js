/**
 * usePushFold.js — short-stack push/fold + facing-all-in verdict (tournament).
 *
 * Two situations, both binary, computed from $EV via pushFoldEngine (ICM-corrected):
 *  - SHOVE first-in: preflop, hero short (≤15bb). Equity vs a population calling
 *    range (own MC, empty board).
 *  - CALL vs an all-in: ANY depth, ANY street (Consumer #2). Preflop equity is
 *    computed vs a shover range; POSTFLOP reuses the live equity already computed
 *    vs the focused villain (the shover) — no extra MC.
 *
 * Reads inputs from state (never asks the user). Mirrors useLiveEquity for the
 * MC path (debounce + abort + injected equityFn).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { handVsRange as handVsRangeDirect } from '../utils/pokerCore/monteCarloEquity';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { computeShoveVerdict, computeCallVerdict } from '../utils/pushFoldEngine';
import { assessPushFoldSetup } from '../utils/pushFoldEngine/setup';
import { getCallingRange, getShoverRange, estimateJamFoldEquity } from '../utils/pushFoldEngine/ranges';
import { getCurrentBet, getSeatContributions, calculatePot } from '../utils/potCalculator';
import { useAbortControl } from './useAbortControl';

export const usePushFold = ({
  isTournament,
  currentStreet,
  holeCards,
  mySeat,
  dealerSeat,
  heroToAct,
  actionSequence,
  chipStacks,
  bb,
  blinds,
  payouts,
  playersRemaining,
  totalChips,
  smallBlindSeat,
  bigBlindSeat,
  computeEquity,
  // Consumer #2 — postflop facing-all-in reuses the already-computed live equity
  // vs the focused villain (the shover) instead of a new MC.
  liveEquity,   // { equity, villainSeat } from useLiveEquity
}) => {
  const [result, setResult] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const { register, isCurrent } = useAbortControl();
  const debounceRef = useRef(null);

  const heroEncoded = useMemo(() => {
    if (!holeCards || holeCards.length < 2) return null;
    const [a, b] = holeCards;
    if (!a || !b) return null;
    const e0 = parseAndEncode(a), e1 = parseAndEncode(b);
    return (e0 >= 0 && e1 >= 0) ? [e0, e1] : null;
  }, [holeCards]);

  const isPreflop = currentStreet === 'preflop';

  // Pure spot assessment (street-agnostic chip/ICM logic, tested separately).
  const setup = useMemo(() => {
    if (!isTournament || !heroToAct || !heroEncoded) return null;
    const s = assessPushFoldSetup({ chipStacks, mySeat, actionSequence, bb, payouts, playersRemaining, totalChips, dealerSeat });
    if (!s) return null;
    // First-in jams are a preflop short-stack play only.
    if (!s.facingShove && !isPreflop) return null;
    return s;
  }, [isTournament, heroToAct, heroEncoded, isPreflop, chipStacks, mySeat, actionSequence, bb, payouts, playersRemaining, totalChips, dealerSeat]);

  const buildResult = (verdict, setupObj) => ({
    ...verdict,
    situation: setupObj.facingShove ? 'call' : 'shove',
    effBB: setupObj.effBB,
    position: setupObj.position,
    isApproximate: !!setupObj.icm?.isApproximate,
    icmAdjusted: !!verdict.icmAdjusted,
  });

  useEffect(() => {
    if (!setup) { setResult(null); return; }
    const { facingShove, icm } = setup;

    // ── Postflop facing an all-in: reuse live equity vs the shover (no MC) ──
    if (facingShove && !isPreflop) {
      const villainMatches = liveEquity && liveEquity.villainSeat === setup.villainSeat;
      const heroEq = villainMatches ? liveEquity.equity : null;
      if (heroEq == null) { setResult(null); setIsComputing(false); return; }
      // Call cost = current bet owed (capped by hero stack); pot = full pot.
      const contribs = getSeatContributions(actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat);
      const owed = Math.max(0, getCurrentBet(actionSequence, currentStreet) - (contribs[mySeat] || 0));
      const callCost = Math.min(owed, setup.heroChips);
      if (!(callCost > 0)) { setResult(null); setIsComputing(false); return; }
      const potTotal = calculatePot(actionSequence, blinds, { smallBlindSeat, bigBlindSeat }).total;
      const verdict = computeCallVerdict({ heroEq, callCost, pot: potTotal, icm });
      setResult(buildResult(verdict, setup));
      setIsComputing(false);
      return;
    }

    // ── Preflop: compute equity via MC (debounced) ──
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const callId = register();
      setIsComputing(true);
      const equityFn = computeEquity || handVsRangeDirect;
      const { effBB, heroChips, opponents, villainSeat } = setup;
      const { range: villainRange, width } = facingShove ? getShoverRange(effBB) : getCallingRange(effBB);

      equityFn(heroEncoded, villainRange, [], { trials: 1500 })
        .then((eq) => {
          if (!isCurrent(callId)) return;
          const heroEq = eq.equity;
          const sb = blinds?.sb ?? 0;
          const potBB = (sb + bb) / bb;
          let verdict;
          if (facingShove) {
            const cost = Math.min(heroChips, setup.shoveAmount ?? heroChips);
            verdict = computeCallVerdict({ heroEq, callCost: cost, pot: (sb + bb) + cost, icm });
          } else {
            const foldEq = estimateJamFoldEquity(width, opponents.length);
            const winChips = icm ? Math.min(heroChips, chipStacks?.[villainSeat] ?? heroChips) : undefined;
            const icmShove = icm ? { ...icm, riskChips: heroChips, winChips, potChips: sb + bb } : null;
            verdict = computeShoveVerdict({ heroEq, foldEq, effStackBB: effBB, potBB, icm: icmShove });
          }
          setResult(buildResult(verdict, setup));
          setIsComputing(false);
        })
        .catch(() => { if (isCurrent(callId)) { setResult(null); setIsComputing(false); } });
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [setup, isPreflop, heroEncoded, blinds, bb, chipStacks, computeEquity, liveEquity, actionSequence, currentStreet, mySeat, smallBlindSeat, bigBlindSeat]);

  return { pushFold: result, isComputing };
};
