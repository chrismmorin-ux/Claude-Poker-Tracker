/**
 * LineWalkthrough — 3-pane runner for a selected line.
 *
 *  ┌────────────────────────────────────────────────────────────────┐
 *  │ Breadcrumb · back to picker                                    │
 *  ├──────────────┬─────────────────────────────────────────────────┤
 *  │ STATE TRACK  │ NODE RENDERER (sections + decision)             │
 *  │ Hero         │   prose / why / adjust / mismatch / formula /   │
 *  │ Villain(s)   │   example / compute                             │
 *  │ Pot          │                                                 │
 *  │ Board        │   Decision UI:                                  │
 *  │ Action trail │     branches → reveal rationale → advance        │
 *  └──────────────┴─────────────────────────────────────────────────┘
 *
 * State model: `path` is the list of {nodeId, branchIndex|null} entries.
 * Advancing = append. No backtracking in Phase 2 (Phase 3 adds retry-from-node).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { LineStateTracker } from './LineStateTracker';
import { LineNodeRenderer } from './LineNodeRenderer';
import { LineBranchBreadcrumb } from './LineBranchBreadcrumb';
import { listKnownArchetypes } from '../../../utils/postflopDrillContent/archetypeRangeBuilder';
import { resolveBranchCorrect } from '../../../utils/postflopDrillContent/lineSchema';

const ARCHETYPE_LABELS = { fish: 'Fish', reg: 'Reg', pro: 'Pro' };

export const LineWalkthrough = ({ line, onExit, onAttempt }) => {
  const [path, setPath] = useState([{ nodeId: line.rootId, branchIndex: null }]);
  const [revealedAt, setRevealedAt] = useState({}); // nodeId -> branchIndex chosen
  // Archetype state lives at the walkthrough level so the toggle drives both
  // the BucketEVPanel recompute AND the per-branch correctness badge in
  // LineNodeRenderer. Default 'reg' is the archetype-agnostic baseline;
  // students opting into fish/pro see how the answer changes.
  const [archetype, setArchetype] = useState('reg');

  const currentEntry = path[path.length - 1];
  const currentNode = line.nodes[currentEntry.nodeId];

  const handleSelectBranch = useCallback(
    (branchIndex) => {
      if (!currentNode || !currentNode.decision) return;
      if (revealedAt[currentNode.id] !== undefined) return;

      const branch = currentNode.decision.branches[branchIndex];
      setRevealedAt((prev) => ({ ...prev, [currentNode.id]: branchIndex }));

      // Archetype-aware correctness: use correctByArchetype[archetype] when
      // available, else fall back to the flat `correct`. `correctLabels` lists
      // branches currently considered correct under the active archetype, so
      // the UI's reveal feedback matches the toggle.
      const correct = resolveBranchCorrect(branch, archetype);
      const correctLabels = currentNode.decision.branches
        .filter((b) => resolveBranchCorrect(b, archetype))
        .map((b) => b.label);

      if (onAttempt) {
        onAttempt({
          lineId: line.id,
          nodeId: currentNode.id,
          branchLabel: branch.label,
          correct,
          correctLabels,
          frameworks: currentNode.frameworks || [],
          board: currentNode.board,
          setup: line.setup,
          // RT-114 — attempt records carry archetype so per-archetype
          // accuracy stats can be computed via drillAnalytics.
          archetypeId: archetype,
        });
      }
    },
    [currentNode, revealedAt, onAttempt, line.id, line.setup, archetype],
  );

  const handleAdvance = useCallback(() => {
    if (!currentNode || !currentNode.decision) return;
    const branchIndex = revealedAt[currentNode.id];
    if (branchIndex === undefined) return;
    const branch = currentNode.decision.branches[branchIndex];
    if (!branch.nextId) return; // terminal branch
    setPath((prev) => [
      ...prev.map((p) => (p.nodeId === currentNode.id ? { ...p, branchIndex } : p)),
      { nodeId: branch.nextId, branchIndex: null },
    ]);
  }, [currentNode, revealedAt]);

  const handleRestart = useCallback(() => {
    setPath([{ nodeId: line.rootId, branchIndex: null }]);
    setRevealedAt({});
  }, [line.rootId]);

  const handleRetryFromIndex = useCallback(
    (index) => {
      if (index < 0 || index >= path.length) return;
      const truncated = path.slice(0, index + 1).map((p, i) =>
        i === index ? { ...p, branchIndex: null } : p,
      );
      setPath(truncated);
      setRevealedAt((prev) => {
        const next = {};
        for (const p of truncated.slice(0, -1)) {
          if (p.branchIndex != null) next[p.nodeId] = prev[p.nodeId];
        }
        // Clear reveal for the node we're retrying
        return next;
      });
    },
    [path],
  );

  const stateForTracker = useMemo(
    () => buildLiveState(line, path),
    [line, path],
  );

  const selectedBranchIndex = revealedAt[currentNode?.id];
  const isRevealed = selectedBranchIndex !== undefined;
  const selectedBranch = isRevealed && currentNode?.decision
    ? currentNode.decision.branches[selectedBranchIndex]
    : null;
  const isTerminal = !currentNode?.decision;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Breadcrumb + archetype toggle + exit */}
      <div className="flex items-center justify-between mb-3 flex-none">
        <LineBranchBreadcrumb line={line} path={path} onRetryFromIndex={handleRetryFromIndex} />
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 pr-2 mr-1 border-r border-gray-700"
            title="Villain archetype — shifts bucket EV + which branch is correct for this archetype"
          >
            <span className="text-[10px] uppercase tracking-wide text-gray-500 mr-1">Villain:</span>
            {listKnownArchetypes().map((a) => {
              const active = a === archetype;
              return (
                <button
                  key={a}
                  onClick={() => setArchetype(a)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                    active
                      ? 'bg-teal-700/40 border-teal-600 text-teal-100'
                      : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {ARCHETYPE_LABELS[a] || a}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleRestart}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
          >
            Restart line
          </button>
          <button
            onClick={onExit}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
          >
            ← Back to picker
          </button>
        </div>
      </div>

      {/* 3-pane body */}
      <div className="grid grid-cols-[280px_1fr] gap-6 flex-1 overflow-hidden">
        <LineStateTracker line={line} liveState={stateForTracker} />
        <div className="overflow-y-auto pr-2">
          {currentNode ? (
            <LineNodeRenderer
              node={currentNode}
              line={line}
              archetype={archetype}
              revealed={isRevealed}
              selectedBranchIndex={selectedBranchIndex}
              onSelectBranch={handleSelectBranch}
              onAdvance={handleAdvance}
              canAdvance={isRevealed && selectedBranch && !!selectedBranch.nextId}
              isTerminal={isTerminal}
            />
          ) : (
            <div className="text-gray-500">Node not found: {currentEntry.nodeId}</div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compute the current live hand state from the authored path. Pulls the
 * terminal node's pot/board/villainAction as the primary surface; builds
 * the action trail by walking the path.
 */
const buildLiveState = (line, path) => {
  const trail = [];
  for (const entry of path) {
    const node = line.nodes[entry.nodeId];
    if (!node) continue;
    if (node.villainAction) {
      trail.push({
        side: 'villain',
        street: node.street,
        kind: node.villainAction.kind,
        size: node.villainAction.size ?? null,
      });
    }
    if (entry.branchIndex != null && node.decision) {
      const branch = node.decision.branches[entry.branchIndex];
      if (branch) {
        trail.push({
          side: 'hero',
          street: node.street,
          kind: branch.label,
          size: null,
        });
      }
    }
  }
  const current = line.nodes[path[path.length - 1]?.nodeId];
  return {
    street: current?.street || 'flop',
    board: current?.board || [],
    pot: current?.pot ?? 0,
    trail,
  };
};
