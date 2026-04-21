/**
 * LineStateTracker — left-pane hand-state display for LineWalkthrough.
 *
 * Shows:
 *   - Setup: hero position, villain position(s), pot type, effective stack
 *   - Live: pot size (bb), board cards
 *   - Action trail: ordered list of actions taken so far (villain + hero)
 */

import React from 'react';

const CARD_SUIT_COLOR = {
  '♠': 'text-gray-100',
  '♣': 'text-emerald-300',
  '♥': 'text-rose-400',
  '♦': 'text-sky-400',
};

const Card = ({ card }) => {
  const suit = card[card.length - 1];
  const rank = card.slice(0, card.length - 1);
  const color = CARD_SUIT_COLOR[suit] || 'text-gray-100';
  return (
    <span className={`inline-flex items-center justify-center min-w-[30px] h-9 px-1.5 bg-gray-900 border border-gray-700 rounded font-mono text-base font-semibold ${color}`}>
      {rank}{suit}
    </span>
  );
};

const formatAction = (action) => {
  if (!action) return '';
  const size = action.size != null
    ? (action.size <= 2 ? ` ${Math.round(action.size * 100)}%` : ` ${action.size}bb`)
    : '';
  return `${action.kind}${size}`;
};

export const LineStateTracker = ({ line, liveState }) => {
  const hero = line.setup?.hero;
  const villains = line.setup?.villains || [];

  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4 overflow-y-auto text-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Setup</div>
      <dl className="space-y-1 mb-4">
        <Row label="Pot">
          <span className="uppercase font-mono text-teal-300">{line.setup?.potType}</span>
        </Row>
        <Row label="Stack">
          <span className="font-mono text-gray-200">{line.setup?.effStack}bb</span>
        </Row>
        <Row label="Hero">
          <span className="font-mono text-gray-200">{hero?.position}</span>
        </Row>
        <Row label={villains.length > 1 ? 'Villains' : 'Villain'}>
          <span className="font-mono text-gray-200">
            {villains.map((v) => v.position).join(', ')}
          </span>
        </Row>
      </dl>

      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Live</div>
      <dl className="space-y-1 mb-4">
        <Row label="Street">
          <span className="uppercase font-mono text-amber-300">{liveState.street}</span>
        </Row>
        <Row label="Pot">
          <span className="font-mono text-gray-200">{liveState.pot}bb</span>
        </Row>
      </dl>

      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Board</div>
      <div className="flex flex-wrap gap-1 mb-4">
        {liveState.board.length === 0 ? (
          <span className="text-gray-500 italic text-xs">—</span>
        ) : (
          liveState.board.map((card, i) => <Card key={i} card={card} />)
        )}
      </div>

      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Action</div>
      {liveState.trail.length === 0 ? (
        <div className="text-gray-500 italic text-xs">No actions yet</div>
      ) : (
        <ol className="space-y-1">
          {liveState.trail.map((a, i) => (
            <li key={i} className="text-xs text-gray-300 flex justify-between gap-2">
              <span>
                <span className="uppercase text-[9px] text-gray-500 mr-1">{a.street}</span>
                <span className={a.side === 'hero' ? 'text-teal-300 font-medium' : 'text-gray-200'}>
                  {a.side}
                </span>
              </span>
              <span className="font-mono text-gray-400">{formatAction(a)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const Row = ({ label, children }) => (
  <div className="flex justify-between text-xs">
    <dt className="text-gray-500">{label}</dt>
    <dd>{children}</dd>
  </div>
);
