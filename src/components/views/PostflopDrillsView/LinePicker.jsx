/**
 * LinePicker — gallery of authored lines with Study Priority Index sort + filter chips.
 *
 * Phase 4: SPI badges + sort toggle (SPI / Title / Nodes) + filter chips
 * (pot type, multiway, board texture). Click a card to enter the walkthrough.
 * Click the SPI badge to expand a breakdown tooltip for that line.
 */

import React, { useMemo, useState } from 'react';
import { LINES, findLine } from '../../../utils/postflopDrillContent/lines';
import {
  rankLinesBySPI,
  lineMatchesFilters,
  POT_TYPE_FREQ,
} from '../../../utils/postflopDrillContent/studyPriorityIndex';
import { SPIBadge } from './SPIBadge';
import { SPITooltip } from './SPITooltip';

const SORT_OPTIONS = [
  { id: 'spi',   label: 'SPI ↓' },
  { id: 'title', label: 'Title' },
  { id: 'nodes', label: 'Nodes ↓' },
];

const POT_TYPE_OPTIONS = Object.keys(POT_TYPE_FREQ);

const BOARD_TAG_OPTIONS = [
  'dry', 'wet', 'high-card', 'middling', 'low',
  'unpaired-rainbow', 'unpaired-twotone', 'unpaired-monotone', 'paired',
];

export const LinePicker = ({ lines, statsByLineId = {}, onSelect }) => {
  const [sortId, setSortId] = useState('spi');
  const [filters, setFilters] = useState({
    potType: new Set(),
    multiway: null,
    boardTag: new Set(),
  });
  const [expandedTooltip, setExpandedTooltip] = useState(null);

  const rankedEntries = useMemo(() => rankLinesBySPI(LINES), []);
  const spiByLineId = useMemo(() => {
    const out = {};
    for (const e of rankedEntries) out[e.line.id] = e.score;
    return out;
  }, [rankedEntries]);

  const visibleLines = useMemo(() => {
    const filtered = lines.filter((l) => {
      const fullLine = findLine(l.id);
      return fullLine ? lineMatchesFilters(fullLine, filters) : true;
    });
    return sortLines(filtered, sortId, spiByLineId, statsByLineId);
  }, [lines, filters, sortId, spiByLineId, statsByLineId]);

  if (!lines || lines.length === 0) {
    return <EmptyPicker />;
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Line Study</div>
        <h2 className="text-2xl font-bold text-white">Branching hand walkthroughs</h2>
        <p className="text-sm text-gray-400 mt-1">
          Pick a line. Every decision has rationale for every branch. Wrong picks still advance so you see the consequence.
        </p>
      </div>

      <ControlBar
        sortId={sortId}
        onSortChange={setSortId}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {visibleLines.length === 0 ? (
        <div className="text-gray-500 italic py-8 text-center">
          No lines match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {visibleLines.map((line) => (
            <LineCard
              key={line.id}
              line={line}
              stats={statsByLineId[line.id]}
              spi={spiByLineId[line.id] ?? 0}
              expanded={expandedTooltip === line.id}
              onToggleTooltip={() =>
                setExpandedTooltip((prev) => (prev === line.id ? null : line.id))
              }
              onSelect={() => onSelect(line.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Control bar ---------- //

const ControlBar = ({ sortId, onSortChange, filters, onFiltersChange }) => {
  const toggleInSet = (key, value) => {
    onFiltersChange((prev) => {
      const next = new Set(prev[key]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...prev, [key]: next };
    });
  };
  const setMW = (value) => {
    onFiltersChange((prev) => ({ ...prev, multiway: prev.multiway === value ? null : value }));
  };

  return (
    <div className="space-y-2 mb-4">
      {/* Sort toggle */}
      <div className="flex items-center gap-2 text-xs">
        <span className="uppercase tracking-wide text-gray-500">Sort</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSortChange(opt.id)}
            className={`px-2 py-0.5 rounded border ${
              sortId === opt.id
                ? 'bg-teal-900/40 border-teal-600 text-teal-200'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="uppercase tracking-wide text-gray-500">Filter</span>
        <FilterChip active={filters.multiway === 'hu'} onClick={() => setMW('hu')}>HU</FilterChip>
        <FilterChip active={filters.multiway === 'mw'} onClick={() => setMW('mw')}>Multiway</FilterChip>
        <span className="text-gray-700">|</span>
        {POT_TYPE_OPTIONS.filter((p) => !p.includes('way')).map((p) => (
          <FilterChip
            key={p}
            active={filters.potType.has(p)}
            onClick={() => toggleInSet('potType', p)}
          >
            {p}
          </FilterChip>
        ))}
        <span className="text-gray-700">|</span>
        {BOARD_TAG_OPTIONS.slice(0, 5).map((t) => (
          <FilterChip
            key={t}
            active={filters.boardTag.has(t)}
            onClick={() => toggleInSet('boardTag', t)}
          >
            {t}
          </FilterChip>
        ))}
      </div>
    </div>
  );
};

const FilterChip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${
      active
        ? 'bg-teal-900/40 border-teal-600 text-teal-200'
        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
    }`}
  >
    {children}
  </button>
);

// ---------- Line card ---------- //

const LineCard = ({ line, stats, spi, expanded, onToggleTooltip, onSelect }) => (
  <div className="bg-gray-800/70 border border-gray-700 hover:border-teal-600 rounded-lg p-4 transition-colors">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        {(line.tags || []).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-700 text-gray-200 uppercase tracking-wide"
          >
            {tag}
          </span>
        ))}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleTooltip(); }}
        className="flex-none focus:outline-none"
        aria-label="Show SPI breakdown"
      >
        <SPIBadge score={spi} />
      </button>
    </div>

    <button
      onClick={onSelect}
      className="w-full text-left cursor-pointer focus:outline-none hover:text-white"
    >
      <h3 className="text-lg font-bold text-white">{line.title}</h3>
      <p className="text-sm text-gray-400 mt-1">{line.summary}</p>
      {stats && (
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span>
            <span className="text-gray-300 font-semibold">{stats.decisionNodes}</span> decisions
          </span>
          <span>
            <span className="text-gray-300 font-semibold">{stats.branches}</span> branches
          </span>
          <span>
            <span className="text-gray-300 font-semibold">{stats.reachableNodes}</span> nodes
          </span>
        </div>
      )}
    </button>

    {expanded && (
      <SPITooltip
        line={findLine(line.id)}
        onClose={onToggleTooltip}
      />
    )}
  </div>
);

const EmptyPicker = () => (
  <div className="h-full flex items-center justify-center text-gray-500">
    No lines authored yet.
  </div>
);

// ---------- Sort helpers ---------- //

const sortLines = (lines, sortId, spiByLineId, statsByLineId) => {
  const copy = [...lines];
  if (sortId === 'spi') {
    copy.sort((a, b) => (spiByLineId[b.id] ?? 0) - (spiByLineId[a.id] ?? 0));
  } else if (sortId === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortId === 'nodes') {
    copy.sort((a, b) => (statsByLineId[b.id]?.reachableNodes ?? 0) - (statsByLineId[a.id]?.reachableNodes ?? 0));
  }
  return copy;
};
