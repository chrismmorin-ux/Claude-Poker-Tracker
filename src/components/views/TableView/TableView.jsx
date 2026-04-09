import React, { useState, useMemo, useRef, useCallback } from 'react';
import { getActionsForSeatOnStreet, getPreflopAggressor } from '../../../utils/sequenceUtils';
import { getSeatContributions } from '../../../utils/potCalculator';
import { CardSlot } from '../../ui/CardSlot';
import { CollapsibleSidebar } from '../../ui/CollapsibleSidebar';
import { buildExploitSummary } from '../../ui/ExploitBadges';
import { analyzeBoardFromStrings } from '../../../utils/pokerCore/boardTexture';
import { generateBoardExploits, enrichExploitsWithEquity, filterDismissed } from '../../../utils/exploitEngine/generateExploits';
import { LAYOUT, LIMITS, SEAT_POSITIONS } from '../../../constants/gameConstants';
import { useGame, useUI, useSession, usePlayer, useCard, useToast, useTendency, useTournament } from '../../../contexts';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useSeatColor } from '../../../hooks/useSeatColor';
import { useSeatUtils } from '../../../hooks/useSeatUtils';
import { useSessionTimer } from '../../../hooks/useSessionTimer';
import { useAutoStreetAdvance } from '../../../hooks/useAutoStreetAdvance';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { GAME_ACTIONS } from '../../../reducers/gameReducer';
import { TableHeader } from './TableHeader';
import { SeatComponent } from './SeatComponent';
import { SeatContextMenu } from './SeatContextMenu';
import { CommandStrip } from './CommandStrip';
import { RangeDetailPanel } from '../../ui/RangeDetailPanel';
import { PotDisplay } from '../../ui/PotDisplay';
import { useLiveEquity } from '../../../hooks/useLiveEquity';
import { useEquityWorker } from '../../../contexts';
import { EquityBadge } from '../../ui/EquityBadge';


/**
 * TableView - Main poker table interface
 * Orchestrates sub-components for the poker table display
 */
export const TableView = ({ scale }) => {
  const tableRef = useRef(null);
  const numSeats = LIMITS.NUM_SEATS;

  // Toast notifications from context
  const { showSuccess } = useToast();

  // Game handlers from hook
  const {
    nextStreet,
    openShowdownScreen,
    handleSetMySeat,
  } = useGameHandlers();

  // Get state and handlers from contexts
  const {
    currentStreet,
    mySeat,
    dealerButtonSeat,
    absentSeats,
    smallBlindSeat,
    bigBlindSeat,
    actionSequence,
    dispatchGame,
    potInfo,
    blinds,
  } = useGame();

  const {
    selectedPlayers,
    contextMenu,
    isDraggingDealer,
    isSidebarCollapsed,
    setCurrentScreen,
    setContextMenu,
    togglePlayerSelection,
    toggleSidebar,
    openCardSelector,
    setSelectedPlayers,
    SCREEN,
    showCardSelector,
    setPendingSeatForPlayerAssignment,
    setAutoOpenNewSession,
    startDraggingDealer,
    stopDraggingDealer,
  } = useUI();

  const {
    currentSession,
    hasActiveSession,
    updateSessionField,
  } = useSession();

  const {
    getSeatPlayerName,
    getSeatPlayer,
    allPlayers,
    assignPlayerToSeat,
    getRecentPlayers,
    clearSeatAssignment,
    isPlayerAssigned,
  } = usePlayer();

  // Card state from CardContext
  const {
    communityCards,
    holeCards,
    holeCardsVisible,
    dispatchCard,
  } = useCard();

  // Seat utils and color
  const { hasSeatFolded, getNextActionSeat, isStreetComplete, activeSeatCount } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, actionSequence, numSeats);
  const getSeatColor = useSeatColor({ hasSeatFolded, selectedPlayers, mySeat, absentSeats, actionSequence, currentStreet, smallBlindSeat, bigBlindSeat });

  // Dealer drag handlers (need tableRef)
  const handleDealerDragStart = useCallback((e) => {
    startDraggingDealer();
    e.preventDefault();
  }, [startDraggingDealer]);

  // Shared drag logic — finds nearest seat from pointer coordinates
  const findNearestSeat = useCallback((clientX, clientY) => {
    if (!tableRef.current) return null;
    const rect = tableRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let closestSeat = 1;
    let minDist = Infinity;
    SEAT_POSITIONS.forEach(({ seat, x: sx, y: sy }) => {
      if (absentSeats.includes(seat)) return;
      const seatX = (sx / 100) * rect.width;
      const seatY = (sy / 100) * rect.height;
      const dist = Math.sqrt((x - seatX) ** 2 + (y - seatY) ** 2);
      if (dist < minDist) { minDist = dist; closestSeat = seat; }
    });
    return closestSeat;
  }, [absentSeats]);

  const handleDealerDrag = useCallback((e) => {
    if (!isDraggingDealer) return;
    e.stopPropagation();
    e.preventDefault();
    const seat = findNearestSeat(e.clientX, e.clientY);
    if (seat) dispatchGame({ type: GAME_ACTIONS.SET_DEALER, payload: seat });
  }, [isDraggingDealer, findNearestSeat, dispatchGame]);

  const handleDealerTouchMove = useCallback((e) => {
    if (!isDraggingDealer) return;
    e.stopPropagation();
    e.preventDefault();
    const touch = e.touches[0];
    const seat = findNearestSeat(touch.clientX, touch.clientY);
    if (seat) dispatchGame({ type: GAME_ACTIONS.SET_DEALER, payload: seat });
  }, [isDraggingDealer, findNearestSeat, dispatchGame]);

  const handleDealerDragEnd = useCallback((e) => {
    if (isDraggingDealer) { e.stopPropagation(); e.preventDefault(); }
    stopDraggingDealer();
  }, [isDraggingDealer, stopDraggingDealer]);

  // Seat right-click handler (needs tableRef + SEAT_POSITIONS)
  const handleSeatRightClick = useCallback((e, seat) => {
    e.preventDefault();
    const seatPos = SEAT_POSITIONS.find(s => s.seat === seat);
    if (!seatPos) return;
    const seatX = (seatPos.x / 100) * LAYOUT.FELT_WIDTH + LAYOUT.TABLE_OFFSET_X;
    const seatY = (seatPos.y / 100) * LAYOUT.FELT_HEIGHT + LAYOUT.TABLE_OFFSET_Y;
    setContextMenu({ x: seatX + LAYOUT.CONTEXT_MENU_OFFSET_X, y: seatY + LAYOUT.CONTEXT_MENU_OFFSET_Y, seat });
  }, [setContextMenu]);

  const setDealerSeat = useCallback((seat) => {
    dispatchGame({ type: GAME_ACTIONS.SET_DEALER, payload: seat });
  }, [dispatchGame]);

  const setCurrentStreet = useCallback((street) => {
    dispatchGame({ type: GAME_ACTIONS.SET_STREET, payload: street });
  }, [dispatchGame]);

  // Auto-advance to next street when all actions are complete
  useAutoStreetAdvance(
    actionSequence, currentStreet, showCardSelector,
    isStreetComplete, nextStreet, activeSeatCount,
    setCurrentStreet, openShowdownScreen
  );

  // Player tendency stats for confidence opacity
  const { tendencyMap } = useTendency();

  // Tournament context (timer lives in TournamentContext — single source of truth)
  const {
    isTournament,
    currentBlinds: tournamentBlinds,
    levelTimeRemaining,
    tournamentState,
    heroMRatio,
    lockoutInfo,
    icmPressure,
    mRatioGuidance,
  } = useTournament();

  // Live equity computation (offloaded to Web Worker when available)
  const { computeEquity } = useEquityWorker();
  const liveEquity = useLiveEquity({
    holeCards,
    communityCards,
    mySeat,
    dealerSeat: dealerButtonSeat,
    actionSequence,
    tendencyMap,
    getSeatPlayer,
    computeEquity,
  });

  // Range detail modal state
  const [rangeDetailSeat, setRangeDetailSeat] = useState(null);
  const rangeDetailPlayerId = rangeDetailSeat ? (getSeatPlayer(rangeDetailSeat)?.playerId || null) : null;
  const rangeDetailTendencies = rangeDetailPlayerId ? tendencyMap[rangeDetailPlayerId] : null;
  const rangeDetailProfile = rangeDetailTendencies?.rangeProfile || null;
  const rangeDetailSummary = rangeDetailTendencies?.rangeSummary || null;

  // Board texture from community cards
  const boardTexture = useMemo(() => {
    const cards = communityCards.filter(c => c && c !== '');
    if (cards.length < 3) return null;
    return analyzeBoardFromStrings(cards);
  }, [communityCards]);

  // Precompute exploit data for all seats (persisted + live suggestions)
  const seatExploitData = useMemo(() => {
    const data = {};
    for (let seat = 1; seat <= numSeats; seat++) {
      const player = getSeatPlayer(seat);
      if (!player) continue;

      const persisted = player.exploits || [];
      const tendencies = tendencyMap[player.playerId];

      let liveSuggestions = [];
      if (tendencies?.exploits) {
        liveSuggestions = filterDismissed(tendencies.exploits, player.dismissedSuggestions);
      }
      // Board-texture rules (ephemeral, computed locally)
      if (boardTexture && tendencies) {
        const boardExploits = generateBoardExploits(tendencies, boardTexture);
        liveSuggestions = [...liveSuggestions, ...boardExploits];
      }

      let combined = [...persisted, ...liveSuggestions];

      // Enrich with live equity for the focused villain
      if (liveEquity.equity != null && liveEquity.villainSeat === seat && combined.length > 0) {
        combined = enrichExploitsWithEquity([...combined], { heroEquity: liveEquity.equity, foldPct: liveEquity.foldPct });
      }

      // Filter briefings: only show accepted on seat badges
      const briefings = tendencies?.briefings || player.exploitBriefings || [];
      const acceptedBriefings = briefings.filter(b => b.reviewStatus === 'accepted');
      const pendingCount = briefings.filter(b =>
        b.reviewStatus === 'pending' || b.reviewStatus === 'stale'
      ).length;

      // Add accepted briefing labels to combined exploits for badge display
      for (const b of acceptedBriefings) {
        if (!combined.some(e => e.id === b.ruleId)) {
          combined.push({
            id: b.ruleId,
            label: b.label,
            category: b.category,
            street: b.street,
            scoring: b.scoring,
            source: 'briefing',
          });
        }
      }

      const weaknessCount = tendencies?.weaknesses?.length || 0;

      if (combined.length > 0 || weaknessCount > 0) {
        data[seat] = {
          summary: buildExploitSummary(combined),
          exploits: combined,
          sampleSize: tendencies?.sampleSize || 0,
          pendingBriefingCount: pendingCount,
          hasStale: briefings.some(b => b.reviewStatus === 'stale'),
          weaknessCount,
        };
      }
    }
    return data;
  }, [numSeats, getSeatPlayer, tendencyMap, boardTexture, liveEquity.equity, liveEquity.villainSeat]);

  // Derived session values
  const handCount = currentSession?.handCount || 0;
  const sessionStartTime = currentSession?.startTime;
  const currentSessionVenue = currentSession?.venue;
  const currentSessionGameType = currentSession?.gameType;

  // Session timer
  const sessionTimeDisplay = useSessionTimer(sessionStartTime);

  // Convert absentSeats array to Set for CollapsibleSidebar
  const absentSeatsSet = useMemo(() => new Set(absentSeats || []), [absentSeats]);

  // Per-seat bet amounts for chip display
  const seatContributions = useMemo(
    () => getSeatContributions(actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat),
    [actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat]
  );

  // Handle seat change from sidebar navigation
  const handleSeatChange = (seat) => {
    setSelectedPlayers([seat]);
  };

  // Handler callbacks for sub-components
  const handleEndSession = () => setCurrentScreen(SCREEN.SESSIONS);

  const handleNewSession = () => {
    setAutoOpenNewSession(true);
    setCurrentScreen(SCREEN.SESSIONS);
  };

  const handleMakeDealer = (seat) => {
    setDealerSeat(seat);
    setContextMenu(null);
  };

  const handleCreateNewPlayer = (seat) => {
    setPendingSeatForPlayerAssignment(seat);
    setContextMenu(null);
    setCurrentScreen(SCREEN.PLAYERS);
  };

  const handleAssignPlayer = (seat, playerId) => {
    assignPlayerToSeat(seat, playerId);
    setContextMenu(null);
    showSuccess(`Player assigned to seat ${seat}`);
  };

  const handleClearPlayer = (seat) => {
    clearSeatAssignment(seat);
    setContextMenu(null);
  };

  const handleHoleCardClick = useCallback((index) => {
    openCardSelector('hole', index);
  }, [openCardSelector]);

  const handleToggleHoleCardsVisibility = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY });
  }, [dispatchCard]);

  // Pot correction handler
  const handlePotCorrection = useCallback((amount) => {
    dispatchGame({ type: GAME_ACTIONS.SET_POT_OVERRIDE, payload: amount });
  }, [dispatchGame]);

  // PFR badge: show on postflop streets
  const pfrSeat = currentStreet !== 'preflop' ? getPreflopAggressor(actionSequence) : null;

  // Next-to-act seat for gold glow indicator (HE-2a)
  const nextToActSeat = selectedPlayers.length === 1 ? selectedPlayers[0] : null;

  return (
    <div className="flex items-center justify-center h-dvh overflow-hidden" style={{ background: '#111318' }}>
      <div style={{
        width: `${LAYOUT.TABLE_WIDTH}px`,
        height: `${LAYOUT.TABLE_HEIGHT}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center'
      }}>
        <div
          className="flex flex-col"
          style={{
            width: `${LAYOUT.TABLE_WIDTH}px`,
            height: `${LAYOUT.TABLE_HEIGHT}px`,
            background: 'radial-gradient(ellipse 70% 60% at 40% 50%, #1a2030 0%, #0d1117 100%)',
          }}
          onClick={() => {
            if (!isDraggingDealer) {
              setContextMenu(null);
            }
          }}
        >
          {/* Collapsible Sidebar */}
          <CollapsibleSidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={toggleSidebar}
            onNavigate={setCurrentScreen}
            onSeatChange={handleSeatChange}
            SCREEN={SCREEN}
            selectedPlayers={selectedPlayers}
            dealerButtonSeat={dealerButtonSeat}
            absentSeats={absentSeatsSet}
            numSeats={numSeats}
            hasActiveSession={hasActiveSession}
            currentSessionVenue={currentSessionVenue}
            currentSessionGameType={currentSessionGameType}
            updateSessionField={updateSessionField}
            isTournament={isTournament}
          />

          {/* Header Bar */}
          <TableHeader
            handCount={handCount}
            sessionTimeDisplay={sessionTimeDisplay}
            hasActiveSession={hasActiveSession}
            isSidebarCollapsed={isSidebarCollapsed}
            onEndSession={handleEndSession}
            onNewSession={handleNewSession}
            isTournament={isTournament}
            tournamentBlinds={isTournament ? tournamentBlinds : null}
            levelTimeRemaining={isTournament ? levelTimeRemaining : null}
            onOpenTournament={() => setCurrentScreen(SCREEN.TOURNAMENT)}
            heroMRatio={heroMRatio}
            lockoutInfo={lockoutInfo}
            playersRemaining={isTournament ? tournamentState.playersRemaining : null}
            currentLevelIndex={isTournament ? tournamentState.currentLevelIndex : null}
            levelDurationMs={isTournament ? tournamentBlinds.durationMinutes * 60 * 1000 : 0}
            icmPressure={icmPressure}
            mRatioGuidance={mRatioGuidance}
          />

          <div className={`flex-1 relative p-4 transition-all duration-300 ${isSidebarCollapsed ? 'ml-14' : 'ml-36'}`}>
            {/* Felt table */}
            <div
              ref={tableRef}
              className="absolute"
              style={{
                top: `${LAYOUT.TABLE_OFFSET_Y}px`,
                left: `${LAYOUT.TABLE_OFFSET_X}px`,
                width: `${LAYOUT.FELT_WIDTH}px`,
                height: `${LAYOUT.FELT_HEIGHT}px`,
                borderRadius: `${LAYOUT.FELT_HEIGHT / 2}px`,
                background: 'linear-gradient(160deg, #5c3a1a 0%, #3d2510 30%, #2a1808 70%, #3d2510 100%)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,200,100,0.08)',
              }}
              onMouseMove={handleDealerDrag}
              onMouseUp={handleDealerDragEnd}
              onMouseLeave={handleDealerDragEnd}
              onTouchMove={handleDealerTouchMove}
              onTouchEnd={handleDealerDragEnd}
            >
              {/* Inner felt with community cards */}
              <div
                className="absolute inset-3"
                style={{
                  borderRadius: `${LAYOUT.FELT_HEIGHT / 2 - 12}px`,
                  background: 'radial-gradient(ellipse 90% 70% at 50% 45%, #228b46 0%, #1a6b3c 40%, #145a30 70%, #0f4d2a 100%)',
                  boxShadow: 'inset 0 2px 40px rgba(0,0,0,0.35), inset 0 0 80px rgba(0,0,0,0.15)',
                  border: '2px solid rgba(0,0,0,0.3)',
                }}
              >
                {/* Community cards */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2 relative w-fit">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <CardSlot
                      key={idx}
                      card={communityCards[idx]}
                      variant="table"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCardSelector('community', idx);
                      }}
                    />
                  ))}
                  <EquityBadge
                    equity={liveEquity.equity}
                    isComputing={liveEquity.isComputing}
                    villainName={liveEquity.villainName}
                  />
                </div>

                {/* Pot display */}
                <PotDisplay
                  potTotal={potInfo.total}
                  isEstimated={potInfo.isEstimated}
                  onCorrect={handlePotCorrection}
                />
              </div>

              {/* Seats */}
              {SEAT_POSITIONS.map(({ seat, x, y }) => (
                <SeatComponent
                  key={seat}
                  seat={seat}
                  x={x}
                  y={y}
                  actionArray={getActionsForSeatOnStreet(actionSequence, seat, currentStreet)}
                  isDealer={dealerButtonSeat === seat}
                  isSmallBlind={smallBlindSeat === seat}
                  isBigBlind={bigBlindSeat === seat}
                  isMySeat={seat === mySeat}
                  isPFR={pfrSeat === seat}
                  playerName={getSeatPlayerName(seat)}
                  exploitSummary={seatExploitData[seat]?.summary || null}
                  exploits={seatExploitData[seat]?.exploits || []}
                  sampleSize={seatExploitData[seat]?.sampleSize || 0}
                  pendingBriefingCount={seatExploitData[seat]?.pendingBriefingCount || 0}
                  weaknessCount={seatExploitData[seat]?.weaknessCount || 0}
                  holeCards={holeCards}
                  holeCardsVisible={holeCardsVisible}
                  getSeatColor={getSeatColor}
                  seatBet={seatContributions[seat] || 0}
                  onSeatClick={togglePlayerSelection}
                  onSeatRightClick={handleSeatRightClick}
                  onDealerDragStart={handleDealerDragStart}
                  onHoleCardClick={handleHoleCardClick}
                  onToggleVisibility={handleToggleHoleCardsVisibility}
                  onOpenRangeDetail={setRangeDetailSeat}
                  isNextToAct={seat === nextToActSeat && currentStreet !== 'showdown'}
                />
              ))}

              {/* Table label */}
              <div
                className="absolute transform -translate-x-1/2 flex items-center justify-center"
                style={{
                  left: '50%',
                  bottom: `${LAYOUT.TABLE_LABEL_BOTTOM}px`,
                  width: `${LAYOUT.TABLE_LABEL_WIDTH}px`,
                  height: `${LAYOUT.TABLE_LABEL_HEIGHT}px`,
                  background: 'linear-gradient(180deg, #3d2510 0%, #2a1808 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(212,168,71,0.3)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontFamily: "'Playfair Display', serif", color: '#d4a847', fontSize: '20px', fontWeight: 700, letterSpacing: '4px' }}>TABLE</div>
              </div>
            </div>

            {/* Context menu */}
            <SeatContextMenu
              contextMenu={contextMenu}
              onMakeMySeat={handleSetMySeat}
              onMakeDealer={handleMakeDealer}
              onCreateNewPlayer={handleCreateNewPlayer}
              onAssignPlayer={handleAssignPlayer}
              onClearPlayer={handleClearPlayer}
              recentPlayers={getRecentPlayers(20, true)}
              getSeatPlayerName={getSeatPlayerName}
            />
          </div>

          {/* Command Strip - unified right panel (CH-2: consumes contexts directly) */}
          <CommandStrip
            liveEquity={liveEquity}
            boardTexture={boardTexture}
          />

        </div>
      </div>

      {/* Range Detail Modal — renders via portal to document.body */}
      <RangeDetailPanel
        rangeProfile={rangeDetailProfile}
        rangeSummary={rangeDetailSummary}
        playerName={rangeDetailSeat ? (getSeatPlayerName(rangeDetailSeat) || `Seat ${rangeDetailSeat}`) : ''}
        onClose={() => setRangeDetailSeat(null)}
        isOpen={rangeDetailSeat !== null}
      />

      {/* Card selector is now inline in CommandStrip */}
    </div>
  );
};


