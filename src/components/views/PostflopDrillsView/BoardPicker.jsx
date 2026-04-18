/**
 * BoardPicker.jsx — 3-card flop selector.
 *
 * Three rank-dropdowns + three suit-buttons. Emits a 3-element array of
 * card strings like ['K♠', '7♥', '2♦'] that parseBoard() can consume.
 *
 * Validates that no duplicate cards are selected.
 */

import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = { '♠': 'text-gray-200', '♥': 'text-red-400', '♦': 'text-red-400', '♣': 'text-gray-200' };

const CardInput = ({ value, onChange }) => {
  const rank = value?.[0] || '';
  const suit = value?.slice(1) || '';
  return (
    <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-md p-1">
      <select
        value={rank}
        onChange={(e) => onChange(e.target.value + (suit || '♠'))}
        className="bg-transparent text-gray-200 text-sm font-semibold px-1 focus:outline-none"
      >
        <option value="" disabled>—</option>
        {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <div className="flex items-center">
        {SUITS.map((s) => (
          <button
            key={s}
            onClick={() => onChange((rank || 'A') + s)}
            className={`px-1.5 text-lg leading-none ${s === suit ? 'bg-gray-700 rounded' : ''} ${SUIT_COLOR[s]}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

export const BoardPicker = ({ label = 'Flop', value = ['K♠', '7♥', '2♦'], onChange }) => {
  const setCard = (i, v) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const hasDupes = value.length !== new Set(value).size;
  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{label}</div>
      <div className="flex items-center gap-2">
        {value.map((c, i) => (
          <CardInput key={i} value={c} onChange={(v) => setCard(i, v)} />
        ))}
      </div>
      {hasDupes && <div className="mt-2 text-xs text-red-400">Duplicate cards — adjust selection.</div>}
    </div>
  );
};
