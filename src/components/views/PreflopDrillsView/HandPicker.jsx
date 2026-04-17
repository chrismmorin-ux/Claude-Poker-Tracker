import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

/**
 * HandPicker — selects a preflop hand class via two rank pickers + suitedness toggle.
 * Emits notation strings like "AKs", "77", "JTo".
 *
 * Implementation notes:
 *   - If both ranks equal, suitedness is ignored (it's a pair).
 *   - Notation is always normalized: higher rank first.
 */
export const HandPicker = ({ label, value, onChange }) => {
  const parsed = parseNotation(value);
  const { rankHigh, rankLow, suited, isPair } = parsed;

  const setRankHigh = (r) => onChange(buildNotation(r, rankLow, suited));
  const setRankLow = (r) => onChange(buildNotation(rankHigh, r, suited));
  const toggleSuited = () => onChange(buildNotation(rankHigh, rankLow, !suited));

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <div className="text-sm font-semibold text-gray-300 mb-3">{label}</div>
      <div className="flex items-center gap-3">
        <RankSelect value={rankHigh} onChange={setRankHigh} />
        <div className="text-gray-500 text-lg">—</div>
        <RankSelect value={rankLow} onChange={setRankLow} />
        <button
          onClick={toggleSuited}
          disabled={isPair}
          className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors ${
            isPair
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : suited
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          {isPair ? 'Pair' : suited ? 'Suited' : 'Offsuit'}
        </button>
      </div>
      <div className="mt-3 text-3xl font-bold text-white">
        {buildNotation(rankHigh, rankLow, suited)}
      </div>
    </div>
  );
};

const RankSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="bg-gray-700 border border-gray-600 text-white text-xl font-semibold rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
  >
    {RANKS.map((r) => (
      <option key={r} value={r}>{r}</option>
    ))}
  </select>
);

const parseNotation = (notation) => {
  if (!notation || notation.length < 2) {
    return { rankHigh: 'A', rankLow: 'A', suited: false, isPair: true };
  }
  const normalized = notation.toUpperCase();
  const rankHigh = normalized[0];
  const rankLow = normalized[1];
  const isPair = rankHigh === rankLow;
  const suited = !isPair && normalized.length === 3 && normalized[2] === 'S';
  return { rankHigh, rankLow, suited, isPair };
};

const buildNotation = (rankHigh, rankLow, suited) => {
  const hIdx = RANKS.indexOf(rankHigh);
  const lIdx = RANKS.indexOf(rankLow);
  // Sort so higher rank comes first in notation
  const [high, low] = hIdx <= lIdx ? [rankHigh, rankLow] : [rankLow, rankHigh];
  if (high === low) return `${high}${high}`;
  return `${high}${low}${suited ? 's' : 'o'}`;
};
