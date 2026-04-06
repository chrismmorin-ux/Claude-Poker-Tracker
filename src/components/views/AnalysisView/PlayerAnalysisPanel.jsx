import React, { useState, useMemo, useCallback } from 'react';
import { Search, User } from 'lucide-react';
import { RangeGrid } from '../../ui/RangeGrid';
import { RangeProvenance } from '../../ui/RangeProvenance';
import { SegmentationBar } from '../../ui/SegmentationBar';
import SeverityBar from '../../ui/SeverityBar';
import { VillainModelCard } from '../../ui/VillainModelCard';
import { VillainProfileModal } from '../../ui/VillainProfileModal';
import { ObservationPanel } from '../../ui/ObservationPanel';
import { RANKS, SUITS } from '../../../constants/gameConstants';
import { usePlayer, useSession, useTendency } from '../../../contexts';
import { useSeatTendency } from '../../../contexts/TendencyContext';
import { useActionAdvisor } from '../../../hooks/useActionAdvisor';
import { RANGE_POSITIONS } from '../../../utils/rangeEngine';
import { parseBlinds } from '../../../utils/potCalculator';

const MIN_HANDS_THRESHOLD = 20;

const CARD_SLOTS = ['', '', '', '', ''];
const HERO_SLOTS = ['', ''];
const VILLAIN_ACTIONS = ['check', 'bet', 'call', 'raise'];

export const PlayerAnalysisPanel = () => {
  const { allPlayers, updatePlayerById } = usePlayer();
  const { currentSession } = useSession();

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [gridPosition, setGridPosition] = useState('LATE');
  const [gridAction, setGridAction] = useState('open');

  const [boardCards, setBoardCards] = useState([...CARD_SLOTS]);
  const [heroCards, setHeroCards] = useState([...HERO_SLOTS]);
  const [potSize, setPotSize] = useState('');
  const [villainAction, setVillainAction] = useState('check');

  const { advice, isComputing, error, compute, clear } = useActionAdvisor();
  const { isLoading } = useTendency();
  const playerTendency = useSeatTendency(selectedPlayerId);
  const rangeProfile = playerTendency?.rangeProfile ?? null;
  const rangeSummary = playerTendency?.rangeSummary ?? null;

  const selectedPlayer = useMemo(
    () => allPlayers.find(p => p.playerId === selectedPlayerId) || null,
    [allPlayers, selectedPlayerId]
  );

  const villainProfile = playerTendency?.villainProfile ?? null;

  const handleNotesChange = useCallback((newNotes) => {
    if (selectedPlayerId && updatePlayerById) {
      updatePlayerById(selectedPlayerId, { notes: newNotes });
    }
  }, [selectedPlayerId, updatePlayerById]);

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
    const { bb } = parseBlinds(gt);
    return bb * 3;
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

  const selectedPlayerStats = useMemo(() => {
    if (!selectedPlayerId || !playerTendency) return undefined;
    return {
      af: playerTendency.af,
      cbet: playerTendency.cbet,
      foldToCbet: playerTendency.foldToCbet,
      vpip: playerTendency.vpip,
      style: playerTendency.style,
      threeBet: playerTendency.threeBet,
    };
  }, [selectedPlayerId, playerTendency]);

  const handleAnalyze = useCallback(() => {
    if (!canAnalyze || !villainRange) return;
    compute({
      villainRange,
      boardCards: boardCards.filter(c => c.trim().length >= 2),
      heroCardStrings: heroCards,
      potSize: effectivePot,
      villainAction: villainAction !== 'check' ? villainAction : undefined,
      playerStats: selectedPlayerStats,
    });
  }, [canAnalyze, villainRange, boardCards, heroCards, effectivePot, villainAction, selectedPlayerStats, compute]);

  const updateBoardCard = useCallback((idx, val) => {
    setBoardCards(prev => { const next = [...prev]; next[idx] = val; return next; });
    clear();
  }, [clear]);

  const updateHeroCard = useCallback((idx, val) => {
    setHeroCards(prev => { const next = [...prev]; next[idx] = val; return next; });
    clear();
  }, [clear]);

  return (
    <>
      {/* Filter bar */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-gray-400">Player</label>
          <select
            value={selectedPlayerId || ''}
            onChange={(e) => { setSelectedPlayerId(e.target.value ? Number(e.target.value) : null); clear(); }}
            className="px-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 text-sm"
          >
            <option value="">Select a player...</option>
            {allPlayers.map((p) => (
              <option key={p.playerId} value={p.playerId}>{p.name}</option>
            ))}
          </select>
          {selectedPlayerId && (
            <button
              onClick={() => setProfileModalOpen(true)}
              className="px-3 py-2 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm flex items-center gap-1.5 transition-colors"
              title="View villain decision profile"
            >
              <User size={14} />
              Profile
            </button>
          )}
        </div>
      </div>

      {/* Villain Profile Modal */}
      <VillainProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        playerName={selectedPlayer?.name}
        villainProfile={villainProfile}
        thoughtAnalysis={playerTendency?.thoughtAnalysis ?? null}
        playerId={selectedPlayerId}
        notes={selectedPlayer?.notes || ''}
        onNotesChange={handleNotesChange}
      />

      {/* Inline Villain Decision Profile */}
      {selectedPlayerId && villainProfile && villainProfile.maturity !== 'unknown' && (
        <div style={{ marginBottom: 12 }}>
          <VillainModelCard
            villainProfile={villainProfile}
            thoughtAnalysis={playerTendency?.thoughtAnalysis ?? null}
            villainStyle={playerTendency?.style}
            onViewFullProfile={() => setProfileModalOpen(true)}
          />
        </div>
      )}

      {/* Three-panel grid */}
      {!selectedPlayerId ? (
        <div className="text-center mt-12 flex flex-col items-center">
          <Search size={48} className="text-gray-600 mb-3" />
          <div className="text-xl font-semibold text-gray-400">Select a Player</div>
          <div className="text-sm text-gray-500">Choose a player to begin analysis</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Panel 1: Range Estimation */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-bold mb-3 text-indigo-400">Range Estimation</h3>
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
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
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
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
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
                    hideConfidence
                  />
                </div>
                <RangeProvenance
                  rangeProfile={rangeProfile}
                  rangeSummary={rangeSummary}
                  position={gridPosition}
                  action={gridAction}
                />
              </>
            )}
          </div>

          {/* Panel 2: Board Equity */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-bold mb-3 text-indigo-400">Board Equity</h3>
            {!hasEnoughData ? (
              <div className="text-center text-gray-400 py-8">
                <div className="font-semibold">Requires range data</div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Board cards */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1 block">Board</label>
                  <div className="flex gap-1">
                    {boardCards.map((card, i) => (
                      <input
                        key={i}
                        type="text"
                        value={card}
                        onChange={(e) => updateBoardCard(i, e.target.value)}
                        placeholder={i < 3 ? `${['F1','F2','F3'][i]}` : i === 3 ? 'T' : 'R'}
                        className="w-12 px-1 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded text-center text-sm font-mono"
                        maxLength={3}
                      />
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">e.g. A{SUITS[0]} K{SUITS[1]} 2{SUITS[2]}</div>
                </div>

                {/* Hero cards */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1 block">Hero Cards</label>
                  <div className="flex gap-1">
                    {heroCards.map((card, i) => (
                      <input
                        key={i}
                        type="text"
                        value={card}
                        onChange={(e) => updateHeroCard(i, e.target.value)}
                        placeholder={`H${i+1}`}
                        className="w-12 px-1 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded text-center text-sm font-mono"
                        maxLength={3}
                      />
                    ))}
                  </div>
                </div>

                {/* Pot + Villain action */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-400 mb-1 block">Pot $</label>
                    <input
                      type="number"
                      value={potSize}
                      onChange={(e) => setPotSize(e.target.value)}
                      placeholder={String(defaultPot)}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded text-sm"
                      min="0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-400 mb-1 block">V Action</label>
                    <select
                      value={villainAction}
                      onChange={(e) => { setVillainAction(e.target.value); clear(); }}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded text-sm"
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
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
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
                      <span className="text-sm font-semibold text-gray-400">Hero Equity</span>
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

          {/* Panel 3: Action Recommendations + Weaknesses */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 overflow-y-auto max-h-[500px]">
            <h3 className="text-lg font-bold mb-3 text-indigo-400">Action Recommendations</h3>
            {!advice ? (
              <div className="text-center text-gray-400 py-8">
                <div className="font-semibold text-gray-400">Enter board + hero cards</div>
                <div className="text-sm text-gray-500 mt-1">Click Analyze to get recommendations</div>
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
                          ? 'border-indigo-500 bg-indigo-900/30'
                          : isPositive
                            ? 'border-green-700 bg-green-900/20'
                            : 'border-red-700 bg-red-900/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`font-bold text-sm uppercase ${isTop ? 'text-indigo-400' : 'text-gray-200'}`}>
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
                      <div className="text-xs text-gray-400 italic">{rec.reasoning}</div>
                    </div>
                  );
                })}

                {/* Fold equity display */}
                <div className="mt-2 pt-2 border-t border-gray-700">
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

            {/* Decision-organized observations */}
            {playerTendency?.observations?.length > 0 && (
              <div className="mt-4 p-3 bg-gray-900 rounded">
                <ObservationPanel observations={playerTendency.observations} />
              </div>
            )}

            {/* Weaknesses Section (legacy, shown below observations) */}
            <WeaknessesSection tendency={playerTendency} />
          </div>
        </div>
      )}
    </>
  );
};

// =============================================================================
// Weaknesses Section
// =============================================================================

const CATEGORY_LABELS = {
  situational: 'Situational',
  preflop: 'Preflop',
  structural: 'Structural',
  sizing: 'Sizing',
};

const CATEGORY_COLORS = {
  situational: 'border-orange-600 bg-orange-900/20',
  preflop: 'border-blue-600 bg-blue-900/20',
  structural: 'border-purple-600 bg-purple-900/20',
  sizing: 'border-yellow-600 bg-yellow-900/20',
};

const ContextBadge = ({ text }) => (
  <span className="px-1.5 py-0.5 rounded bg-gray-600 text-gray-300 text-[9px] font-semibold uppercase">
    {text}
  </span>
);

const WeaknessesSection = ({ tendency }) => {
  const weaknesses = tendency?.weaknesses || [];

  if (!playerId || weaknesses.length === 0) return null;

  // Group by category
  const grouped = {};
  for (const w of weaknesses) {
    const cat = w.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(w);
  }

  return (
    <div className="mt-4 pt-3 border-t border-gray-700">
      <h4 className="text-sm font-bold mb-2 text-amber-400">
        Weaknesses ({weaknesses.length})
      </h4>
      <div className="space-y-2">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">
              {CATEGORY_LABELS[category] || category}
            </div>
            {items.map((w) => (
              <div
                key={w.id}
                className={`p-2 rounded border mb-1.5 ${CATEGORY_COLORS[category] || 'border-gray-600 bg-gray-700/50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-200">{w.label}</span>
                  <SeverityBar severity={w.severity} />
                </div>
                <div className="text-[10px] text-gray-400 mb-1">{w.description}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {w.context && <ContextBadge text={w.context} />}
                  {w.position && <ContextBadge text={w.position} />}
                  {w.street && <ContextBadge text={w.street} />}
                  {w.exploitable && (
                    <span className="px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 text-[9px] font-semibold">
                      Exploitable
                    </span>
                  )}
                </div>
                {w.evidence && (
                  <div className="text-[9px] text-gray-500 mt-1">
                    {w.evidence.metric}: observed {w.evidence.observed}% vs profitable {w.evidence.profitable}%
                    {w.evidence.delta > 0 ? ` (delta: +${w.evidence.delta}%)` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
