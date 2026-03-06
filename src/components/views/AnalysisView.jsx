import React, { useState, useMemo, useCallback } from 'react';
import { ScaledContainer } from '../ui/ScaledContainer';
import { RangeGrid } from '../ui/RangeGrid';
import { LAYOUT, RANKS, SUITS } from '../../constants/gameConstants';
import { useUI, usePlayer, useSession } from '../../contexts';
import { useRangeProfile } from '../../hooks/useRangeProfile';
import { useActionAdvisor } from '../../hooks/useActionAdvisor';
import { RANGE_POSITIONS } from '../../utils/rangeEngine';
import { parseBlinds } from '../../utils/parseBlinds';

const MIN_HANDS_THRESHOLD = 20;

const CARD_SLOTS = ['', '', '', '', ''];
const HERO_SLOTS = ['', ''];
const VILLAIN_ACTIONS = ['check', 'bet', 'call', 'raise'];

const SegmentationBar = ({ buckets }) => {
  if (!buckets) return null;
  const colors = {
    nuts: 'bg-red-600', strong: 'bg-orange-500', marginal: 'bg-yellow-400',
    draw: 'bg-blue-400', air: 'bg-gray-300',
  };
  return (
    <div className="flex h-5 rounded overflow-hidden w-full">
      {['nuts', 'strong', 'marginal', 'draw', 'air'].map((b) => {
        const pct = buckets[b]?.pct || 0;
        if (pct < 1) return null;
        return (
          <div
            key={b}
            className={`${colors[b]} flex items-center justify-center text-[9px] font-bold text-white`}
            style={{ width: `${pct}%` }}
            title={`${b}: ${Math.round(pct)}%`}
          >
            {pct >= 8 ? `${Math.round(pct)}%` : ''}
          </div>
        );
      })}
    </div>
  );
};

export const AnalysisView = ({ scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const { allPlayers } = usePlayer();
  const { currentSession } = useSession();

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [gridPosition, setGridPosition] = useState('LATE');
  const [gridAction, setGridAction] = useState('open');

  // Board Equity panel state
  const [boardCards, setBoardCards] = useState([...CARD_SLOTS]);
  const [heroCards, setHeroCards] = useState([...HERO_SLOTS]);
  const [potSize, setPotSize] = useState('');
  const [villainAction, setVillainAction] = useState('check');

  const { rangeProfile, rangeSummary, isLoading } = useRangeProfile(selectedPlayerId);
  const { advice, isComputing, error, compute, clear } = useActionAdvisor();

  const selectedPlayer = useMemo(
    () => allPlayers.find(p => p.playerId === selectedPlayerId) || null,
    [allPlayers, selectedPlayerId]
  );

  const totalHands = rangeProfile?.handsProcessed || 0;
  const hasEnoughData = totalHands >= MIN_HANDS_THRESHOLD;

  const gridShowdownIndices = useMemo(() => {
    const s = new Set();
    if (rangeProfile?.showdownAnchors) {
      for (const a of rangeProfile.showdownAnchors) {
        if (a.position === gridPosition && a.action === gridAction && a.gridIndex != null) {
          s.add(a.gridIndex);
        }
      }
    }
    return s;
  }, [rangeProfile, gridPosition, gridAction]);

  const defaultPot = useMemo(() => {
    const gt = currentSession?.gameType;
    if (!gt) return 6;
    const { bigBlind } = parseBlinds(gt);
    return bigBlind * 3;
  }, [currentSession]);

  const effectivePot = potSize !== '' ? Number(potSize) : defaultPot;

  const villainRange = useMemo(() => {
    return rangeProfile?.ranges?.[gridPosition]?.[gridAction] || null;
  }, [rangeProfile, gridPosition, gridAction]);

  const canAnalyze = useMemo(() => {
    const filledBoard = boardCards.filter(c => c.trim().length >= 2).length;
    const filledHero = heroCards.filter(c => c.trim().length >= 2).length;
    return hasEnoughData && villainRange && filledBoard >= 3 && filledHero === 2 && !isComputing;
  }, [boardCards, heroCards, hasEnoughData, villainRange, isComputing]);

  const handleAnalyze = useCallback(() => {
    if (!canAnalyze || !villainRange) return;
    compute({
      villainRange,
      boardCards: boardCards.filter(c => c.trim().length >= 2),
      heroCardStrings: heroCards,
      potSize: effectivePot,
      villainAction: villainAction !== 'check' ? villainAction : undefined,
    });
  }, [canAnalyze, villainRange, boardCards, heroCards, effectivePot, villainAction, compute]);

  const updateBoardCard = useCallback((idx, val) => {
    setBoardCards(prev => { const next = [...prev]; next[idx] = val; return next; });
    clear();
  }, [clear]);

  const updateHeroCard = useCallback((idx, val) => {
    setHeroCards(prev => { const next = [...prev]; next[idx] = val; return next; });
    clear();
  }, [clear]);

  return (
    <ScaledContainer scale={scale}>
      <div className="bg-gray-50 overflow-y-auto p-6" style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Analysis</h2>
          <button onClick={() => setCurrentScreen(SCREEN.TABLE)} className="bg-green-600 text-white px-4 py-2 rounded-lg">
            Back to Table
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-600">Player</label>
            <select
              value={selectedPlayerId || ''}
              onChange={(e) => { setSelectedPlayerId(e.target.value ? Number(e.target.value) : null); clear(); }}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              <option value="">Select a player...</option>
              {allPlayers.map((p) => (
                <option key={p.playerId} value={p.playerId}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Three-panel grid */}
        {!selectedPlayerId ? (
          <div className="text-center text-gray-400 mt-12 text-lg">Select a player to begin analysis</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Panel 1: Range Estimation */}
            <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
              <h3 className="text-lg font-bold mb-3 text-indigo-700">Range Estimation</h3>
              {isLoading ? (
                <div className="text-center text-gray-400 py-8">Loading range data...</div>
              ) : !hasEnoughData ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="font-semibold">Requires {MIN_HANDS_THRESHOLD}+ hands</div>
                  <div className="text-sm mt-1">{totalHands} hand{totalHands !== 1 ? 's' : ''} recorded</div>
                </div>
              ) : (
                <>
                  {/* Position pills */}
                  <div className="flex gap-1 mb-2">
                    {RANGE_POSITIONS.map((pos) => (
                      <button
                        key={pos}
                        onClick={() => { setGridPosition(pos); clear(); }}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                          gridPosition === pos
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                  {/* Action pills */}
                  <div className="flex gap-1 mb-3">
                    {['open', 'limp', 'coldCall', 'threeBet'].map((act) => (
                      <button
                        key={act}
                        onClick={() => { setGridAction(act); clear(); }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          gridAction === act
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {act === 'coldCall' ? 'Cold-Call' : act === 'threeBet' ? '3-Bet' : act.charAt(0).toUpperCase() + act.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center">
                    <RangeGrid
                      weights={rangeProfile?.ranges?.[gridPosition]?.[gridAction]}
                      showdownIndices={gridShowdownIndices}
                      size="compact"
                      sampleSize={rangeSummary?.[gridPosition]?.hands || 0}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Panel 2: Board Equity */}
            <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
              <h3 className="text-lg font-bold mb-3 text-indigo-700">Board Equity</h3>
              {!hasEnoughData ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="font-semibold">Requires range data</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Board cards */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Board</label>
                    <div className="flex gap-1">
                      {boardCards.map((card, i) => (
                        <input
                          key={i}
                          type="text"
                          value={card}
                          onChange={(e) => updateBoardCard(i, e.target.value)}
                          placeholder={i < 3 ? `${['F1','F2','F3'][i]}` : i === 3 ? 'T' : 'R'}
                          className="w-12 px-1 py-1 border rounded text-center text-sm font-mono"
                          maxLength={3}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">e.g. A{SUITS[0]} K{SUITS[1]} 2{SUITS[2]}</div>
                  </div>

                  {/* Hero cards */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Hero Cards</label>
                    <div className="flex gap-1">
                      {heroCards.map((card, i) => (
                        <input
                          key={i}
                          type="text"
                          value={card}
                          onChange={(e) => updateHeroCard(i, e.target.value)}
                          placeholder={`H${i+1}`}
                          className="w-12 px-1 py-1 border rounded text-center text-sm font-mono"
                          maxLength={3}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Pot + Villain action */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Pot $</label>
                      <input
                        type="number"
                        value={potSize}
                        onChange={(e) => setPotSize(e.target.value)}
                        placeholder={String(defaultPot)}
                        className="w-full px-2 py-1 border rounded text-sm"
                        min="0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">V Action</label>
                      <select
                        value={villainAction}
                        onChange={(e) => { setVillainAction(e.target.value); clear(); }}
                        className="w-full px-2 py-1 border rounded text-sm"
                      >
                        {VILLAIN_ACTIONS.map(a => (
                          <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Analyze button */}
                  <button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze}
                    className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${
                      canAnalyze
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isComputing ? 'Computing...' : 'Analyze'}
                  </button>

                  {/* Error */}
                  {error && <div className="text-red-500 text-xs">{error}</div>}

                  {/* Results */}
                  {advice && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">Hero Equity</span>
                        <span className={`text-lg font-bold ${advice.heroEquity >= 0.5 ? 'text-green-600' : 'text-red-500'}`}>
                          {Math.round(advice.heroEquity * 100)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500">Range Segmentation</span>
                        <SegmentationBar buckets={advice.segmentation?.buckets} />
                        <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                          {['nuts', 'strong', 'marginal', 'draw', 'air'].map(b => (
                            <span key={b}>{b}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel 3: Action Recommendations */}
            <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
              <h3 className="text-lg font-bold mb-3 text-indigo-700">Action Recommendations</h3>
              {!advice ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="font-semibold text-gray-400">Enter board + hero cards</div>
                  <div className="text-sm text-gray-300 mt-1">Click Analyze to get recommendations</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {advice.recommendations.map((rec, i) => {
                    const isPositive = rec.ev > 0;
                    const isTop = i === 0;
                    return (
                      <div
                        key={rec.action}
                        className={`p-2 rounded-lg border ${
                          isTop
                            ? 'border-indigo-400 bg-indigo-50'
                            : isPositive
                              ? 'border-green-200 bg-green-50'
                              : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-bold text-sm uppercase ${isTop ? 'text-indigo-700' : ''}`}>
                            {isTop && '* '}{rec.action}
                          </span>
                          <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                            EV: {rec.ev >= 0 ? '+' : ''}{rec.ev.toFixed(1)}
                          </span>
                        </div>
                        {rec.sizing && (
                          <div className="text-xs text-gray-500 mb-1">
                            Size: {Math.round(rec.sizing.betFraction * 100)}% pot (${rec.sizing.betSize.toFixed(0)})
                            {' '} | Fold%: {Math.round(rec.sizing.foldPct * 100)}%
                          </div>
                        )}
                        <div className="text-xs text-gray-600 italic">{rec.reasoning}</div>
                      </div>
                    );
                  })}

                  {/* Fold equity display */}
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Fold Equity (bet)</span>
                      <span className="font-semibold">{Math.round(advice.foldPct.bet * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Fold Equity (raise)</span>
                      <span className="font-semibold">{Math.round(advice.foldPct.raise * 100)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ScaledContainer>
  );
};
