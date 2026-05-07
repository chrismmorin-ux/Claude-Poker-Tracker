/**
 * @file useSelfCoachMastery — React hook that loads per-concept mastery
 * once, then derives composite scores + descriptor reactively when the
 * user's signal toggles / weights change in settings.
 *
 * Whitelisted consumer of the SCF infrastructure per
 * `src/utils/skillAssessment/CLAUDE.md` source-util-policy:
 *   - SelfCoachView only.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../contexts';
import { listAllConceptMastery } from '../utils/skillAssessment/conceptMastery';
import {
  computeComposites,
  DEFAULT_WEIGHTS,
  DEFAULT_TOGGLES,
} from '../utils/skillAssessment/composite';
import { describeLearningState } from '../utils/skillAssessment/learningStateDescriber';

/**
 * @param {string} userId
 * @returns {{
 *   loading: boolean,
 *   masteries: Array<object>,
 *   composites: Array<{conceptId, compositeScore, breakdown}>,
 *   compositesByConceptId: Object<string, {compositeScore, breakdown}>,
 *   descriptor: {summary, focusConcepts, composition},
 *   nextTeachable: {conceptId, compositeScore, breakdown}|null,
 *   weights: object,
 *   toggles: object,
 * }}
 */
export const useSelfCoachMastery = (userId) => {
  const { settings } = useSettings();
  const [masteries, setMasteries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pull user-tunable signal weights + toggles from settings; fall back to
  // defaults if any field is missing (graceful degradation across reloads).
  const weights = useMemo(
    () => ({ ...DEFAULT_WEIGHTS, ...(settings?.selfCoach?.signalWeights || {}) }),
    [settings?.selfCoach?.signalWeights],
  );
  const toggles = useMemo(
    () => ({ ...DEFAULT_TOGGLES, ...(settings?.selfCoach?.signalToggles || {}) }),
    [settings?.selfCoach?.signalToggles],
  );

  // Load mastery once per userId. The underlying signal data
  // (heroLeaks / drill stores) doesn't update from this surface — leak
  // fires + drill attempts come from HandReplay + drill engine. Re-fetch
  // would be wasteful per SelfCoachView session.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    listAllConceptMastery(userId)
      .then((rows) => {
        if (cancelled) return;
        setMasteries(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Composites + descriptor recompute synchronously on settings changes
  // (no async work required — just numeric aggregation).
  const composites = useMemo(
    () => computeComposites(masteries, { weights, toggles }),
    [masteries, weights, toggles],
  );

  const compositesByConceptId = useMemo(() => {
    const out = {};
    for (const c of composites) out[c.conceptId] = c;
    return out;
  }, [composites]);

  const descriptor = useMemo(
    () => describeLearningState(masteries, { granularity: 'general', weights, toggles }),
    [masteries, weights, toggles],
  );

  const nextTeachable = useMemo(() => {
    if (composites.length === 0) return null;
    const sorted = [...composites].sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
      return a.conceptId.localeCompare(b.conceptId);
    });
    return sorted[0].compositeScore > 0 ? sorted[0] : null;
  }, [composites]);

  const masteriesByConceptId = useMemo(() => {
    const out = {};
    for (const m of masteries) out[m.conceptId] = m;
    return out;
  }, [masteries]);

  return {
    loading,
    masteries,
    masteriesByConceptId,
    composites,
    compositesByConceptId,
    descriptor,
    nextTeachable,
    weights,
    toggles,
  };
};
