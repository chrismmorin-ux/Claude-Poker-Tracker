import React, { useState, useMemo } from 'react';
import { MatchupBreakdown } from './MatchupBreakdown';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { classifyMatchup, FRAMEWORKS } from '../../../utils/drillContent/frameworks';
import { MATCHUPS_BY_FRAMEWORK } from '../../../utils/drillContent/matchupLibrary';

/**
 * LibraryMode — browse curated matchups grouped by primary framework.
 * Click any card to compute exact equity + see the framework breakdown.
 */
export const LibraryMode = () => {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [frameworkMatches, setFrameworkMatches] = useState(null);
  const [loading, setLoading] = useState(false);

  const groups = useMemo(() => {
    return Object.entries(MATCHUPS_BY_FRAMEWORK).map(([fwId, matchups]) => {
      const fw = Object.values(FRAMEWORKS).find((f) => f.id === fwId);
      return { id: fwId, name: fw?.name || fwId, matchups };
    });
  }, []);

  const openMatchup = (m) => {
    setSelected(m);
    setLoading(true);
    setResult(null);
    setFrameworkMatches(null);
    setTimeout(() => {
      try {
        const r = computeHandVsHand(m.a, m.b);
        const matches = classifyMatchup(parseHandClass(m.a), parseHandClass(m.b));
        setResult(r);
        setFrameworkMatches(matches);
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="overflow-y-auto pr-2">
        {groups.map((g) => (
          <div key={g.id} className="mb-5">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{g.name}</div>
            <div className="grid grid-cols-2 gap-2">
              {g.matchups.map((m) => (
                <button
                  key={m.id}
                  onClick={() => openMatchup(m)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selected?.id === m.id
                      ? 'bg-purple-900/40 border-purple-600'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{m.a} vs {m.b}</div>
                  {m.tags?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.tags.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-y-auto">
        {selected ? (
          <MatchupBreakdown
            handALabel={selected.a}
            handBLabel={selected.b}
            result={result}
            frameworkMatches={frameworkMatches}
            loading={loading}
          />
        ) : (
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-6 min-h-[400px] flex items-center justify-center text-sm text-gray-500">
            Pick any matchup from the library to compute its equity and frameworks.
          </div>
        )}
      </div>
    </div>
  );
};
