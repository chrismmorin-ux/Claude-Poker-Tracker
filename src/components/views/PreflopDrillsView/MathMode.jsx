import React, { useState } from 'react';
import { CALCULATORS } from './LessonCalculators';

/**
 * MathMode — dedicated surface for the combinatorics toolkit.
 *
 * Lists the five interactive calculators (pair-up, flush, straight runs,
 * pot odds, runouts) in a left-side nav rail. Selecting a calculator
 * renders it in the right pane with a prose header explaining what it's
 * for and when to reach for it at the table.
 *
 * The calculators themselves live in LessonCalculators.jsx and are reused
 * here unchanged — this view only adds navigation and teaching framing.
 */

const CATALOG = [
  {
    id: 'flopPair',
    label: 'Pair-up odds',
    tagline: 'Flop a pair / flop a set',
    description:
      "The foundation of every unpaired hand's equity. Know how often AK flops a pair (32.4%) and " +
      "how often a pocket pair flops a set (11.8%). These two numbers explain most preflop equity " +
      "shapes on their own.",
  },
  {
    id: 'flushOuts',
    label: 'Flush completion',
    tagline: 'Live outs and the blocker tax',
    description:
      'Exact completion probability for a flush draw, with a blocker slider so you can see how much ' +
      'equity each same-suit villain card costs you. Compares against the Rule of 4 and 2 so you ' +
      'know when the shortcut overshoots (big combo draws).',
  },
  {
    id: 'straightRuns',
    label: 'Straight coverage',
    tagline: 'Direct runs, single-card runs, coverage score',
    description:
      'Enumerate every 5-card straight your hand participates in. Direct runs use both hole cards; ' +
      "single-card runs use one hole card plus four board cards. The coverage score is the quick " +
      '"how much straight equity does this hand carry" number.',
  },
  {
    id: 'potOdds',
    label: 'Pot odds',
    tagline: 'Bet size → required equity',
    description:
      'Type any pot + bet to get the break-even equity. Memorize the ladder: quarter-pot 17%, ' +
      'half-pot 25%, pot 33%, 2× overbet 40%. At the table you estimate your equity against ' +
      "villain's range, then compare to this threshold.",
  },
  {
    id: 'runouts',
    label: 'Run it twice (or more)',
    tagline: 'Variance without EV change',
    description:
      'Running multiple boards does not change your EV — only the variance of the single all-in. ' +
      'This calculator shows P(win all), P(win exactly one), P(at least one) for any equity and ' +
      'number of runs so you can see the variance collapse as runs increase.',
  },
];

export const MathMode = () => {
  const [activeId, setActiveId] = useState(CATALOG[0].id);
  const active = CATALOG.find((c) => c.id === activeId) || CATALOG[0];
  const Calculator = CALCULATORS[active.id];

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 h-full">
      <CalculatorList active={activeId} onSelect={setActiveId} />
      <CalculatorBody entry={active} Calculator={Calculator} />
    </div>
  );
};

const CalculatorList = ({ active, onSelect }) => (
  <div className="bg-gray-800/50 border border-gray-800 rounded-lg overflow-y-auto">
    <div className="px-4 py-3 border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
      Combinatorics toolkit
    </div>
    <div>
      {CATALOG.map((c) => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-800/60 transition-colors ${
              isActive ? 'bg-purple-900/30 border-l-2 border-l-purple-500' : 'hover:bg-gray-800/60'
            }`}
          >
            <div className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-200'}`}>
              {c.label}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{c.tagline}</div>
          </button>
        );
      })}
    </div>
  </div>
);

const CalculatorBody = ({ entry, Calculator }) => (
  <div className="overflow-y-auto pr-2">
    <div className="mb-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Calculator</div>
      <h2 className="text-2xl font-bold text-white">{entry.label}</h2>
      <p className="text-sm text-gray-400 mt-1">{entry.tagline}</p>
    </div>
    <p className="text-sm text-gray-300 leading-relaxed mb-5">{entry.description}</p>
    {Calculator ? (
      <Calculator />
    ) : (
      <div className="bg-rose-900/30 border border-rose-800 text-rose-200 rounded px-3 py-2 text-xs">
        Unknown calculator: {entry.id}
      </div>
    )}
  </div>
);
