/**
 * LineBranchBreadcrumb — shows path taken so far as a series of pills.
 *
 * Phase 3: past-node pills are clickable — clicking truncates the path back
 * to that node so the user can retry from there. Current node is not
 * clickable (hovering shows it's already where you are).
 */

import React from 'react';

export const LineBranchBreadcrumb = ({ line, path, onRetryFromIndex }) => {
  if (!line || !path) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400 overflow-x-auto">
      <span className="text-gray-500 uppercase tracking-wide mr-1">{line.title}</span>
      {path.map((entry, i) => {
        const node = line.nodes[entry.nodeId];
        const street = node?.street || '?';
        const isCurrent = i === path.length - 1;
        const canRetry = !isCurrent && typeof onRetryFromIndex === 'function';

        const pill = (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium transition-colors ${
              isCurrent
                ? 'bg-teal-800/60 text-teal-200 border border-teal-600'
                : canRetry
                  ? 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200 hover:border-teal-600 cursor-pointer'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
            title={canRetry ? 'Retry line from this node' : undefined}
          >
            {street}
            {entry.branchIndex != null && node?.decision && (
              <>
                {' · '}
                <span className="normal-case text-[10px]">
                  {shortenLabel(node.decision.branches[entry.branchIndex]?.label || '')}
                </span>
              </>
            )}
          </span>
        );

        return (
          <React.Fragment key={`${entry.nodeId}-${i}`}>
            {i > 0 && <span className="text-gray-600">›</span>}
            {canRetry ? (
              <button type="button" onClick={() => onRetryFromIndex(i)} className="focus:outline-none">
                {pill}
              </button>
            ) : (
              pill
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const shortenLabel = (label) => {
  if (label.length <= 18) return label;
  return label.slice(0, 16) + '…';
};
