/**
 * usePushFold.js — short-stack push/fold verdict for the live table (tournament).
 *
 * Active only when: tournament + preflop + hero to act + effective stack ≤15bb.
 * Assembles inputs from state (never asks the user — persona rule), runs ONE
 * equity MC, and returns a binary SHOVE / FOLD / CALL verdict computed from
 * $EV via pushFoldEngine (ICM-corrected through icmEngine when payouts exist).
 * Mirrors useLiveEquity (debounce + abort + injected equityFn).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { handVsRange as handVsRangeDirect } from '../utils/pokerCore/monteCarloEquity';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { computeShoveVerdict, computeCallVerdict } from '../utils/pushFoldEngine';
import { assessPushFoldSetup } from '../utils/pushFoldEngine/setup';
import {
  getCallingRange, getShoverRange, estimateJamFoldEquity,
} from '../utils/pushFoldEngine/ranges';
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
  computeEquity,
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

  // Static (non-equity) situation assessment — cheap, synchronous. The chip/ICM
  // logic lives in the pure, tested assessPushFoldSetup; the hook adds the
  // tournament/preflop/hero-to-act gates.
  const setup = useMemo(() => {
    if (!isTournament || currentStreet !== 'preflop' || !heroToAct || !heroEncoded) return null;
    return assessPushFoldSetup({ chipStacks, mySeat, actionSequence, bb, payouts, playersRemaining, totalChips, dealerSeat });
  }, [isTournament, currentStreet, heroToAct, heroEncoded, chipStacks, bb, mySeat, actionSequence, payouts, playersRemaining, totalChips, dealerSeat]);

  useEffect(() => {
    if (!setup) { setResult(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const callId = register();
      setIsComputing(true);
      const equityFn = computeEquity || handVsRangeDirect;
      const { facingShove, effBB, heroChips, opponents, icm, villainSeat, position } = setup;

      const { range: villainRange, width } = facingShove ? getShoverRange(effBB) : getCallingRange(effBB);

      equityFn(heroEncoded, villainRange, [], { trials: 1500 })
        .then((eq) => {
          if (!isCurrent(callId)) return;
          const heroEq = eq.equity;
          const sb = blinds?.sb ?? 0;
          const potBB = (sb + bb) / bb; // dead blinds (antes omitted in MVP)
          let verdict;

          if (facingShove) {
            const villainChips = chipStacks?.[villainSeat] ?? heroChips;
            const callCost = Math.min(heroChips, villainChips); // chips hero risks to call
            const pot = (sb + bb) + callCost; // dead blinds + the shover's matched amount
            verdict = computeCallVerdict({ heroEq, callCost, pot, icm });
          } else {
            const foldEq = estimateJamFoldEquity(width, opponents.length);
            const winChips = icm ? Math.min(heroChips, chipStacks?.[villainSeat] ?? heroChips) : undefined;
            const icmShove = icm ? { ...icm, riskChips: heroChips, winChips, potChips: sb + bb } : null;
            verdict = computeShoveVerdict({ heroEq, foldEq, effStackBB: effBB, potBB, icm: icmShove });
          }

          setResult({
            ...verdict,
            situation: facingShove ? 'call' : 'shove',
            effBB,
            position,
            isApproximate: !!icm?.isApproximate,
            icmAdjusted: !!verdict.icmAdjusted,
          });
          setIsComputing(false);
        })
        .catch(() => {
          if (isCurrent(callId)) { setResult(null); setIsComputing(false); }
        });
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [setup, heroEncoded, blinds, bb, chipStacks, computeEquity]);

  return { pushFold: result, isComputing };
};
