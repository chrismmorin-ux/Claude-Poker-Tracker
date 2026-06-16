/**
 * LineMode — branching hand walkthroughs.
 *
 * Entry point: picker (list of lines) → walkthrough (3-pane when a line is
 * selected). Each walkthrough threads a DAG of authored nodes; at every
 * decision the user picks a branch, sees the rationale for every branch,
 * and advances along the chosen branch's nextId.
 *
 * Phase 2 scope: end-to-end walk of Line 1 with state tracker, breadcrumb,
 * section dispatcher, and decision UI. No SPI sort, no filter chips, no
 * retry-from-node — those ship in Phase 3/4.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { LINES, findLine, listLines } from '../../../utils/postflopDrillContent/lines';
import { lineStats } from '../../../utils/postflopDrillContent/lineSchema';
import { usePostflopDrillsPersistence } from '../../../hooks/usePostflopDrillsPersistence';
import { LinePicker } from './LinePicker';
import { LineWalkthrough } from './LineWalkthrough';
import { useDrillProgress } from '../drillCommon/DrillTabGuard';

export const LineMode = () => {
  const [activeLineId, setActiveLineId] = useState(null);
  const { recordAttempt } = usePostflopDrillsPersistence();

  const summary = useMemo(() => listLines(), []);
  const statsByLineId = useMemo(() => {
    const out = {};
    for (const l of LINES) out[l.id] = lineStats(l);
    return out;
  }, []);
  const activeLine = useMemo(
    () => (activeLineId ? findLine(activeLineId) : null),
    [activeLineId],
  );

  // Report unsaved progress to the tab-switch guard (WS-229 F-DRILL-02): a line is
  // selected and being walked, so switching tabs would discard the walkthrough
  // position. The picker (no active line) carries no progress.
  const reportProgress = useDrillProgress();
  useEffect(() => {
    reportProgress(!!activeLine);
    return () => reportProgress(false);
  }, [activeLine, reportProgress]);

  const handleAttempt = useCallback(
    (payload) => {
      recordAttempt({
        drillType: 'line',
        scenarioKey: `${payload.lineId}:${payload.nodeId}`,
        context: payload.setup?.hero || null,
        opposingContext: payload.setup?.villains?.[0] || null,
        board: (payload.board || []).join(' '),
        userAnswer: { branchLabel: payload.branchLabel },
        truth: {
          correctLabels: payload.correctLabels,
          frameworks: payload.frameworks || [],
        },
        correct: payload.correct,
        delta: null,
      }).catch(() => { /* persistence is best-effort */ });
    },
    [recordAttempt],
  );

  if (activeLine) {
    return (
      <LineWalkthrough
        line={activeLine}
        onExit={() => setActiveLineId(null)}
        onAttempt={handleAttempt}
      />
    );
  }

  return (
    <LinePicker
      lines={summary}
      onSelect={setActiveLineId}
      statsByLineId={statsByLineId}
    />
  );
};
