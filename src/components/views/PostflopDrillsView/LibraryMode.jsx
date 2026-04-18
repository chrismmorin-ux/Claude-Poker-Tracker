/**
 * LibraryMode — browse curated scenarios grouped by framework.
 * Phase 3 ships a functional read-only browser; Phase 5 will expand content.
 */

import React, { useMemo, useState } from 'react';
import { SCENARIOS, scenariosByFramework, parseFlopString } from '../../../utils/postflopDrillContent/scenarioLibrary';
import { FRAMEWORKS } from '../../../utils/postflopDrillContent/frameworks';
import { archetypeRangeFor, contextLabel } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseBoard } from '../../../utils/pokerCore/cardParser';
import { RangeFlopBreakdown } from './RangeFlopBreakdown';
import { FRAMEWORK_COLOR } from './RangeFlopBreakdown';

export const LibraryMode = () => {
  const grouped = useMemo(() => scenariosByFramework(), []);
  const [selectedId, setSelectedId] = useState(SCENARIOS[0]?.id || null);
  const selected = SCENARIOS.find((s) => s.id === selectedId);

  const resolved = useMemo(() => {
    if (!selected) return null;
    try {
      const range = archetypeRangeFor(selected.context);
      const opposingRange = selected.opposingContext ? archetypeRangeFor(selected.opposingContext) : null;
      const board = parseBoard(parseFlopString(selected.board));
      return { range, opposingRange, board };
    } catch (e) {
      return { error: e.message || String(e) };
    }
  }, [selected]);

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 h-full overflow-hidden">
      <div className="bg-gray-800/50 border border-gray-800 rounded-lg overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">Library</div>
        {Object.entries(grouped).map(([fwId, entries]) => (
          <div key={fwId} className="border-b border-gray-800/60">
            <div className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${FRAMEWORK_COLOR[fwId] || 'bg-gray-700 text-gray-200'}`}>
              {FRAMEWORKS[Object.keys(FRAMEWORKS).find((k) => FRAMEWORKS[k].id === fwId)]?.name || fwId}
            </div>
            {entries.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-4 py-2 hover:bg-gray-800 transition-colors ${s.id === selectedId ? 'bg-gray-800' : ''}`}
              >
                <div className="text-sm text-gray-200 font-medium">
                  {contextLabel(s.context)}{s.opposingContext ? ` vs ${contextLabel(s.opposingContext)}` : ''}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{s.board} · <span className="text-teal-400">{s.expectedSubcase}</span></div>
                {s.notes && <div className="text-[11px] text-gray-500 mt-0.5 italic">{s.notes}</div>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="overflow-y-auto pr-2">
        {!resolved ? (
          <div className="text-sm text-gray-400">Pick a scenario from the library.</div>
        ) : resolved.error ? (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 text-sm">{resolved.error}</div>
        ) : (
          <RangeFlopBreakdown
            range={resolved.range}
            opposingRange={resolved.opposingRange}
            board={resolved.board}
            context={selected.context}
            opposingContext={selected.opposingContext}
          />
        )}
      </div>
    </div>
  );
};
