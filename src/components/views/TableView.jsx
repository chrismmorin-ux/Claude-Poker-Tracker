import React from 'react';
import { CardSlot } from '../ui/CardSlot';
import { VisibilityToggle } from '../ui/VisibilityToggle';
import { PositionBadge } from '../ui/PositionBadge';

/**
 * TableView - Main poker table interface
 * Displays the poker table with seats, cards, and action buttons
 */
export const TableView = ({
  scale,
  currentStreet,
  communityCards,
  holeCards,
  holeCardsVisible,
  mySeat,
  dealerButtonSeat,
  selectedPlayers,
  contextMenu,
  isDraggingDealer,
  tableRef,
  SEAT_POSITIONS,
  STREETS,
  ACTIONS,
  SCREEN,
  setContextMenu,
  nextHand,
  setCurrentScreen,
  resetHand,
  openCardSelector,
  togglePlayerSelection,
  handleSeatRightClick,
  getSeatColor,
  handleDealerDragStart,
  handleDealerDrag,
  handleDealerDragEnd,
  getSmallBlindSeat,
  getBigBlindSeat,
  setHoleCardsVisible,
  setCurrentStreet,
  openShowdownScreen,
  nextStreet,
  clearStreetActions,
  handleSetMySeat,
  setDealerSeat,
  recordAction,
  setSelectedPlayers,
  toggleAbsent,
  SkipForward,
  BarChart3,
  RotateCcw,
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
      <div style={{
        width: '1600px',
        height: '720px',
        transform: `scale(${scale})`,
        transformOrigin: 'center center'
      }}>
        <div
          className="bg-gradient-to-br from-green-800 to-green-900 flex flex-col"
          style={{ width: '1600px', height: '720px' }}
          onClick={(e) => {
            if (!isDraggingDealer) {
              setContextMenu(null);
            }
          }}
        >
          <div className="flex justify-between items-center px-4 py-2 bg-black bg-opacity-40">
            <div className="flex items-center gap-4">
              <div className="text-white text-xl font-bold">Hand #47</div>
              <div className="text-green-300 text-base">2h 15m</div>
            </div>
            <div className="flex gap-2 items-center justify-between flex-1">
              <div className="flex gap-2">
                <button
                  onClick={nextHand}
                  className="bg-yellow-600 text-white px-3 py-2 rounded flex items-center gap-2"
                >
                  <SkipForward size={18} />
                  Next Hand
                </button>
                <button
                  onClick={() => setCurrentScreen(SCREEN.STATS)}
                  className="bg-blue-600 text-white px-3 py-2 rounded flex items-center gap-2"
                >
                  <BarChart3 size={18} />
                  Stats
                </button>
              </div>
              <button
                onClick={resetHand}
                className="bg-gray-700 text-white px-3 py-2 rounded flex items-center gap-2"
              >
                <RotateCcw size={18} />
                Reset
              </button>
            </div>
          </div>

          <div className="flex-1 relative p-4">
            <div
              ref={tableRef}
              className="absolute bg-green-700 shadow-2xl"
              style={{
                top: '50px',
                left: '200px',
                width: '900px',
                height: '450px',
                borderRadius: '225px'
              }}
              onMouseMove={handleDealerDrag}
              onMouseUp={handleDealerDragEnd}
              onMouseLeave={handleDealerDragEnd}
            >
              <div className="absolute inset-4 bg-green-600 border-8 border-green-800 shadow-inner" style={{ borderRadius: '217px' }}>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2">
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
                </div>
              </div>

              {SEAT_POSITIONS.map(({ seat, x, y }) => (
                <div key={seat} className="absolute transform -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                  <button
                    onClick={() => togglePlayerSelection(seat)}
                    onContextMenu={(e) => handleSeatRightClick(e, seat)}
                    className={`rounded-lg shadow-lg transition-all font-bold text-lg ${getSeatColor(seat)}`}
                    style={{ width: '40px', height: '40px' }}
                  >
                    {seat}
                  </button>

                  {dealerButtonSeat === seat && (
                    <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2">
                      <PositionBadge type="dealer" size="large" draggable={true} onDragStart={handleDealerDragStart} />
                    </div>
                  )}

                  {getSmallBlindSeat() === seat && (
                    <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2">
                      <PositionBadge type="sb" size="large" />
                    </div>
                  )}

                  {getBigBlindSeat() === seat && (
                    <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2">
                      <PositionBadge type="bb" size="large" />
                    </div>
                  )}

                  {seat === mySeat && (
                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 flex gap-2 items-center">
                      {holeCardsVisible ? (
                        <>
                          <CardSlot
                            card={holeCards[0]}
                            variant="hole-table"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCardSelector('hole', 0);
                            }}
                          />
                          <CardSlot
                            card={holeCards[1]}
                            variant="hole-table"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCardSelector('hole', 1);
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <CardSlot card={null} variant="hole-table" isHidden={true} canInteract={false} />
                          <CardSlot card={null} variant="hole-table" isHidden={true} canInteract={false} />
                        </>
                      )}
                      <VisibilityToggle
                        visible={holeCardsVisible}
                        onToggle={() => setHoleCardsVisible(!holeCardsVisible)}
                        size="large"
                      />
                    </div>
                  )}
                </div>
              ))}

              <div
                className="absolute transform -translate-x-1/2 bg-amber-800 border-4 border-amber-900 rounded-lg shadow-xl flex items-center justify-center"
                style={{ left: '50%', bottom: '-30px', width: '300px', height: '60px' }}
              >
                <div className="text-white font-bold text-2xl">TABLE</div>
              </div>
            </div>

            <div className="absolute bottom-8 left-8 flex gap-2">
              {STREETS.map(street => (
                <button
                  key={street}
                  onClick={() => {
                    setCurrentStreet(street);
                    if (street === 'showdown') {
                      openShowdownScreen();
                    }
                  }}
                  className={`py-3 px-6 rounded-lg text-xl font-bold capitalize ${
                    currentStreet === street
                      ? 'bg-yellow-500 text-black shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {street}
                </button>
              ))}
              <button
                onClick={nextStreet}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-xl"
              >
                Next Street ➡
              </button>
            </div>

            <div className="absolute bottom-8 right-8">
              <button
                onClick={clearStreetActions}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold text-lg"
              >
                Clear Street
              </button>
            </div>

            {contextMenu && (
              <div
                className="absolute bg-white rounded-lg shadow-2xl py-2 z-50"
                style={{
                  left: `${contextMenu.x}px`,
                  top: `${contextMenu.y}px`,
                  minWidth: '150px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleSetMySeat(contextMenu.seat)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold"
                >
                  Make My Seat
                </button>
                <button
                  onClick={() => {setDealerSeat(contextMenu.seat); setContextMenu(null);}}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 font-semibold"
                >
                  Make Dealer
                </button>
              </div>
            )}

            {selectedPlayers.length > 0 && currentStreet !== 'showdown' && (
              <div className="absolute top-50 right-8 bg-white rounded-lg shadow-2xl p-4" style={{ width: '480px', top: '80px' }}>
                <div className="flex justify-between items-center mb-3 pb-2 border-b-2">
                  <h3 className="text-2xl font-bold">
                    {selectedPlayers.length === 1
                      ? `Seat ${selectedPlayers[0]}`
                      : `${selectedPlayers.length} Seats: ${selectedPlayers.sort((a,b) => a-b).join(', ')}`
                    }
                  </h3>
                  <div className="text-base font-semibold text-blue-600 uppercase">{currentStreet}</div>
                </div>

                {currentStreet === 'preflop' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => recordAction(ACTIONS.FOLD)} className="py-4 bg-red-400 hover:bg-red-500 rounded-lg font-bold text-base text-white">Fold</button>
                    <button onClick={() => recordAction(ACTIONS.LIMP)} className="py-4 bg-gray-400 hover:bg-gray-500 rounded-lg font-bold text-base text-white">Limp</button>
                    <button onClick={() => recordAction(ACTIONS.CALL)} className="py-4 bg-blue-300 hover:bg-blue-400 rounded-lg font-bold text-base text-white">Call</button>
                    <button onClick={() => recordAction(ACTIONS.OPEN)} className="py-4 bg-green-400 hover:bg-green-500 rounded-lg font-bold text-base text-white">Open</button>
                    <button onClick={() => recordAction(ACTIONS.THREE_BET)} className="py-4 bg-yellow-400 hover:bg-yellow-500 rounded-lg font-bold text-base">3bet</button>
                    <button onClick={() => recordAction(ACTIONS.FOUR_BET)} className="py-4 bg-orange-400 hover:bg-orange-500 rounded-lg font-bold text-base text-white">4bet</button>
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <div className="text-sm font-bold text-blue-700 mb-2">IF PFR:</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => recordAction(ACTIONS.CBET_IP_SMALL)} className="py-3 bg-green-200 hover:bg-green-300 rounded font-semibold text-sm">Cbet IP (S)</button>
                        <button onClick={() => recordAction(ACTIONS.CBET_IP_LARGE)} className="py-3 bg-green-300 hover:bg-green-400 rounded font-semibold text-sm">Cbet IP (L)</button>
                        <button onClick={() => recordAction(ACTIONS.CHECK)} className="py-3 bg-blue-200 hover:bg-blue-300 rounded font-semibold text-sm">Check</button>
                        <button onClick={() => recordAction(ACTIONS.CBET_OOP_SMALL)} className="py-3 bg-green-200 hover:bg-green-300 rounded font-semibold text-sm">Cbet OOP (S)</button>
                        <button onClick={() => recordAction(ACTIONS.CBET_OOP_LARGE)} className="py-3 bg-green-300 hover:bg-green-400 rounded font-semibold text-sm">Cbet OOP (L)</button>
                        <button onClick={() => recordAction(ACTIONS.FOLD_TO_CR)} className="py-3 bg-red-200 hover:bg-red-300 rounded font-semibold text-sm">Fold to CR</button>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-purple-700 mb-2">IF PFC:</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => recordAction(ACTIONS.DONK)} className="py-3 bg-orange-200 hover:bg-orange-300 rounded font-semibold text-sm">Donk</button>
                        <button onClick={() => recordAction(ACTIONS.STAB)} className="py-3 bg-yellow-200 hover:bg-yellow-300 rounded font-semibold text-sm">Stab</button>
                        <button onClick={() => recordAction(ACTIONS.CHECK)} className="py-3 bg-blue-200 hover:bg-blue-300 rounded font-semibold text-sm">Check</button>
                        <button onClick={() => recordAction(ACTIONS.CHECK_RAISE)} className="py-3 bg-orange-200 hover:bg-orange-300 rounded font-semibold text-sm">Check-Raise</button>
                        <button onClick={() => recordAction(ACTIONS.FOLD_TO_CBET)} className="py-3 bg-red-200 hover:bg-red-300 rounded font-semibold text-sm">Fold to Cbet</button>
                      </div>
                    </div>
                  </>
                )}

                <button onClick={() => setSelectedPlayers([])} className="mt-3 w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold">Clear Selection</button>
                <button onClick={toggleAbsent} className="mt-2 w-full py-2 bg-gray-800 hover:bg-gray-900 text-white rounded font-semibold">Mark as Absent</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
