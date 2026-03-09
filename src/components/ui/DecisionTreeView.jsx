/**
 * DecisionTreeView.jsx - Collapsible nested decision tree renderer
 *
 * Renders a DecisionNode as an indented tree with EV badges.
 * Compact mobile-friendly layout.
 */

import React, { useState } from 'react';

const EvBadge = ({ ev }) => {
  if (ev == null) return null;
  const isPositive = ev >= 0;
  const color = isPositive ? 'bg-green-600 text-white' : 'bg-red-600 text-white';
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${color}`}>
      {isPositive ? '+' : ''}{ev.toFixed(1)} BB
    </span>
  );
};

const TreeNode = ({ node, depth = 0 }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 12;

  return (
    <div style={{ marginLeft: indent }}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={`w-full text-left py-1 ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start gap-1.5">
          {hasChildren && (
            <span className="text-[10px] text-gray-400 mt-0.5 flex-shrink-0">
              {expanded ? '▾' : '▸'}
            </span>
          )}
          {!hasChildren && <span className="text-[10px] text-gray-500 mt-0.5 flex-shrink-0">-</span>}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-gray-300">{node.situation}</div>
            <div className="text-[11px] font-semibold text-white">{node.heroAction}</div>
            <div className="text-[10px] text-gray-500 italic">{node.reasoning}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <EvBadge ev={node.ev} />
              {node.frequency && (
                <span className="text-[9px] text-gray-500">{node.frequency}</span>
              )}
            </div>
          </div>
        </div>
      </button>

      {expanded && hasChildren && (
        <div className="border-l border-gray-700 ml-2">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * DecisionTreeView - Renders a decision tree from a DecisionNode root.
 *
 * @param {{ tree: Object }} props
 */
export const DecisionTreeView = ({ tree }) => {
  if (!tree) return null;

  return (
    <div className="space-y-0.5">
      <TreeNode node={tree} depth={0} />
    </div>
  );
};

export default DecisionTreeView;
