/**
 * EngineCtxBridge.jsx — PMC Phase 5a-2 (WS-178 / SPR-070).
 *
 * Bridges TendencyContext + exploitEngine.evaluateGameTree into a ref-getter
 * that usePersistence can read at hand-save time. Solves the architectural
 * wall: usePersistence runs ABOVE the provider tree (in useAppState), so it
 * cannot directly call useTendency(). This bridge lives INSIDE
 * <TendencyProvider/> and writes a closure into a ref that usePersistence
 * reads.
 *
 * Founder ratification (D1=A, 2026-05-10): ref-getter bridge over prop-drill
 * or context-relocation.
 *
 * Renders nothing.
 */

import { useEffect } from 'react';
import { useTendency } from '../contexts/TendencyContext';
import { evaluateGameTree } from '../utils/exploitEngine/gameTreeEvaluator';

export const EngineCtxBridge = ({ engineCtxGetterRef }) => {
  const { tendencyMap } = useTendency();

  useEffect(() => {
    if (!engineCtxGetterRef) return;
    engineCtxGetterRef.current = () => ({
      getRangeProfile: (playerId) => tendencyMap?.[playerId]?.rangeProfile ?? null,
      evaluateGameTree,
    });
    // Don't null on unmount — keep the last-known getter alive so debounced
    // saves mid-unmount still see engine context. The closure captures
    // whatever tendencyMap was current when the effect last ran.
  }, [engineCtxGetterRef, tendencyMap]);

  return null;
};

export default EngineCtxBridge;
