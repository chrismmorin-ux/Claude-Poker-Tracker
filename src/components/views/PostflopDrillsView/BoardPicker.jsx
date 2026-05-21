/**
 * BoardPicker.jsx — board selector for 3–5 cards (flop / turn / river).
 *
 * Three rank-dropdowns + suit-buttons per card. Emits an N-element array of
 * card strings like ['K♠', '7♥', '2♦', 'Q♣'] that parseBoard() can consume.
 *
 * Defaults to a 3-card flop (backward-compatible: existing callers pass nothing
 * but `value`/`onChange` and get the original flop picker). Range Lab passes
 * maxCards=5 to enable turn/river. Validates that no duplicate cards are selected.
 */

import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = { '♠': 'text-gray-200', '♥': 'text-red-400', '♦': 'text-red-400', '♣': 'text-gray-200' };

// Street label for a card position (0-2 flop, 3 turn, 4 river).
const STREET_FOR_INDEX = (i) => (i < 3 ? 'Flop' : i === 3 ? 'Turn' : 'River');
// Show the street label only on the first card of each street segment (0=flop, 3=turn, 4=river).
const STREET_LABEL_AT = (i) => (i === 0 || i === 3 || i === 4 ? STREET_FOR_INDEX(i) : '');

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

/** First rank+suit combo not already on the board (so Add… never starts as a dupe). */
const firstFreeCard = (used) => {
  const taken = new Set(used);
  for (const r of RANKS) {
    for (const s of SUITS) {
      if (!taken.has(r + s)) return r + s;
    }
  }
  return 'A♠';
};

export const BoardPicker = ({
  label = 'Flop',
  value = ['K♠', '7♥', '2♦'],
  onChange,
  minCards = 3,
  maxCards = 3,
}) => {
  const setCard = (i, v) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const addCard = () => onChange([...value, firstFreeCard(value)]);
  const removeLast = () => onChange(value.slice(0, -1));

  const hasDupes = value.length !== new Set(value).size;
  const canAdd = value.length < maxCards;
  const canRemove = value.length > minCards;
  const extensible = maxCards > minCards;

  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{label}</div>
      <div className="flex items-end gap-2 flex-wrap">
        {value.map((c, i) => (
          <div key={i} className="flex flex-col gap-1">
            {extensible && (
              <span className="text-[10px] uppercase tracking-wide text-gray-600 h-3">{STREET_LABEL_AT(i)}</span>
            )}
            <CardInput value={c} onChange={(v) => setCard(i, v)} />
          </div>
        ))}
      </div>

      {extensible && (
        <div className="flex items-center gap-2 mt-3">
          {canAdd && (
            <button
              type="button"
              onClick={addCard}
              className="text-xs font-semibold text-teal-300 bg-teal-900/30 border border-teal-800/50 rounded px-2 py-1 hover:bg-teal-900/50"
            >
              + {value.length === 3 ? 'Turn' : 'River'}
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={removeLast}
              className="text-xs font-semibold text-gray-400 bg-gray-800 border border-gray-700 rounded px-2 py-1 hover:bg-gray-700"
            >
              − {STREET_FOR_INDEX(value.length - 1)}
            </button>
          )}
        </div>
      )}

      {hasDupes && <div className="mt-2 text-xs text-red-400">Duplicate cards — adjust selection.</div>}
    </div>
  );
};
