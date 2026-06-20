import React from 'react';

/**
 * SidePotAttribution (HE-20b) — awards each pot to one of its eligible seats.
 *
 * Rendered only when a hand split into 2+ pots. Each pot is awarded independently
 * (a seat can win one pot and lose another), so there is NO auto-muck here — the
 * single-pot one-tap flow is untouched. Eligibility is per pot: only the seats
 * that contributed to a pot are selectable for it.
 *
 * @param {Object} props
 * @param {Array<{amount:number, eligibleSeats:number[]}>} props.pots
 * @param {(potIndex:number)=>number|null} props.getWinner - current winner for a pot
 * @param {(potIndex:number, seat:number)=>void} props.onSelect
 * @param {(seat:number)=>string} props.getSeatLabel - e.g. "S4 · BTN — Alex"
 */
export const SidePotAttribution = ({ pots, getWinner, onSelect, getSeatLabel }) => {
  if (!Array.isArray(pots) || pots.length < 2) return null;

  const awarded = pots.filter((_, i) => getWinner(i) != null).length;

  return (
    <div className="bg-white border-2 border-amber-400 rounded-xl p-3 mb-4 shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="font-extrabold text-amber-800" style={{ fontSize: '15px' }}>
          Award each pot
        </div>
        <div className="text-xs font-semibold text-gray-500">
          {awarded}/{pots.length} awarded
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {pots.map((pot, i) => {
          const winner = getWinner(i);
          return (
            <div key={i} className="rounded-lg border border-gray-200 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-gray-800" style={{ fontSize: '14px' }}>
                  {i === 0 ? 'Main Pot' : `Side Pot ${i}`}
                </span>
                <span className="font-extrabold text-amber-700" style={{ fontSize: '15px' }}>
                  ${pot.amount}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pot.eligibleSeats.map((seat) => {
                  const selected = winner === seat;
                  return (
                    <button
                      key={seat}
                      type="button"
                      onClick={() => onSelect(i, seat)}
                      aria-pressed={selected}
                      className={`btn-press rounded-lg font-bold px-3 ${
                        selected
                          ? 'bg-green-600 text-white border-2 border-green-700'
                          : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                      }`}
                      style={{ minHeight: '44px', fontSize: '13px' }}
                    >
                      {selected ? '✓ ' : ''}{getSeatLabel(seat)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
