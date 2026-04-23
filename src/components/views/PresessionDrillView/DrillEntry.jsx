/**
 * DrillEntry.jsx — Presession Drill entry surface
 *
 * Per surface spec `docs/design/surfaces/presession-drill.md` §Anatomy Mode 1.
 * Time-budget selector (5/15/30 min) + villain list with actionable-pattern badges + Start Drill CTA.
 *
 * Design rules from Gate 2 Stage C+E applied:
 *   - Supportive tone, not anxiety-inducing
 *   - ≥ 44 DOM-px touch targets at 1600×720 scale
 *   - State-aware primary action: "Start drill" in this mode
 */

import React from 'react';

const TIME_BUDGETS = [
  { minutes: 5, cards: 3, label: '5 min', sub: '3 cards' },
  { minutes: 15, cards: 5, label: '15 min', sub: '5–7 cards' },
  { minutes: 30, cards: 10, label: '30 min', sub: '10–15 cards' },
];

export const DrillEntry = ({
  timeBudget,
  onTimeBudgetChange,
  availableVillains,
  selectedVillainIds,
  onToggleVillain,
  onStartDrill,
  onBack,
}) => {
  const canStart = selectedVillainIds.length > 0
    && availableVillains.some((v) =>
      selectedVillainIds.includes(v.villainId) && v.actionableCount > 0);

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col" style={{ width: 1600, height: 720 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-white">Prepare for tonight's session</h1>
          <p className="text-sm text-gray-400 mt-1">
            Rehearse the most exploitable patterns for the players you expect to face.
          </p>
        </div>
        <div className="flex gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded"
              data-testid="drill-entry-back"
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-8 py-6 overflow-y-auto">
        {/* Time budget section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">How much time do you have?</h2>
          <div className="flex gap-4" role="radiogroup" aria-label="Time budget">
            {TIME_BUDGETS.map((tb) => {
              const selected = timeBudget === tb.minutes;
              return (
                <button
                  key={tb.minutes}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onTimeBudgetChange(tb.minutes)}
                  className={`px-6 py-4 rounded-lg border-2 transition-colors text-left min-w-[140px] ${
                    selected
                      ? 'border-amber-500 bg-amber-900/30 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                  }`}
                  style={{ minHeight: 72 }}
                  data-testid={`drill-entry-time-${tb.minutes}`}
                >
                  <div className="text-lg font-bold">{tb.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{tb.sub}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Villain section */}
        <section className="mb-8 flex-1">
          <h2 className="text-lg font-semibold text-white mb-3">
            Tonight's opponents
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({availableVillains.length} with data)
            </span>
          </h2>

          {availableVillains.length === 0 ? (
            <div className="p-6 rounded bg-gray-800 border border-gray-700">
              <p className="text-gray-400 text-sm">
                No actionable patterns yet. Play a few hands with your opponents to build up data.
              </p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="drill-entry-villain-list">
              {availableVillains.map((v) => {
                const selected = selectedVillainIds.includes(v.villainId);
                const hasPatterns = v.actionableCount > 0;
                return (
                  <label
                    key={v.villainId}
                    className={`flex items-center gap-3 px-4 py-3 rounded border cursor-pointer transition-colors ${
                      selected
                        ? 'border-amber-500 bg-amber-900/20'
                        : hasPatterns
                        ? 'border-gray-700 bg-gray-800 hover:border-gray-500'
                        : 'border-gray-800 bg-gray-800/50 cursor-not-allowed opacity-60'
                    }`}
                    style={{ minHeight: 48 }}
                    data-testid={`drill-entry-villain-${v.villainId}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!hasPatterns}
                      onChange={() => hasPatterns && onToggleVillain(v.villainId)}
                      className="w-5 h-5 accent-amber-500"
                    />
                    <span className="flex-1 text-white font-medium">{v.villainId}</span>
                    <span className="text-sm text-gray-400">
                      {v.actionableCount === 0
                        ? 'No patterns ready'
                        : `${v.actionableCount} pattern${v.actionableCount === 1 ? '' : 's'} ready`}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Footer / CTA */}
      <div className="px-8 py-4 border-t border-gray-800 flex items-center justify-end gap-4">
        <span className="text-sm text-gray-500">
          {canStart
            ? `Ready — approximately ${TIME_BUDGETS.find((t) => t.minutes === timeBudget)?.cards ?? 5} cards`
            : 'Select at least one opponent with patterns ready'}
        </span>
        <button
          type="button"
          onClick={onStartDrill}
          disabled={!canStart}
          className={`px-6 py-3 rounded font-semibold transition-colors ${
            canStart
              ? 'bg-amber-500 hover:bg-amber-400 text-gray-900'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          style={{ minHeight: 48, minWidth: 160 }}
          data-testid="drill-entry-start"
        >
          Start drill →
        </button>
      </div>
    </div>
  );
};
