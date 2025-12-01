import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, RotateCcw, SkipForward } from 'lucide-react';

// =============================================================================
// CONSTANTS - All magic numbers and configuration values
// =============================================================================

// Debug mode - set to false to disable console logging
const DEBUG = true;
const log = (...args) => DEBUG && console.log('[PokerTracker]', ...args);

const CONSTANTS = {
  // Table configuration
  NUM_SEATS: 9,
  
  // Card dimensions (in pixels)
  CARD: {
    SMALL: { width: 40, height: 58 },    // Hole cards on table
    MEDIUM: { width: 50, height: 70 },   // Showdown card slots
    LARGE: { width: 60, height: 85 },    // Card selector slots
    TABLE: { width: 70, height: 100 },   // Community cards on table
  },
  
  // UI element dimensions
  BADGE_SIZE: 24,
  SEAT_SIZE: 60,
  DEALER_BUTTON_SIZE: 45,
  TOGGLE_BUTTON_SIZE: 40,
  
  // Table layout (scaled container)
  TABLE_WIDTH: 1600,
  TABLE_HEIGHT: 720,
  TABLE_SCALE: 0.5,
  FELT_WIDTH: 900,
  FELT_HEIGHT: 450,
};

// Seat positions (percentage-based for responsive layout)
const SEAT_POSITIONS = [
  { seat: 1, x: 33, y: 88 },
  { seat: 2, x: 15, y: 70 },
  { seat: 3, x: 8, y: 45 },
  { seat: 4, x: 18, y: 20 },
  { seat: 5, x: 50, y: 8 },
  { seat: 6, x: 82, y: 20 },
  { seat: 7, x: 92, y: 45 },
  { seat: 8, x: 85, y: 70 },
  { seat: 9, x: 67, y: 88 },
];

// Street definitions
const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];
const BETTING_STREETS = ['preflop', 'flop', 'turn', 'river']; // Streets where betting occurs (excludes showdown)

// Screen/View identifiers
const SCREEN = {
  TABLE: 'table',
  STATS: 'stats',
};

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const SUIT_ABBREV = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };

// Action type constants
const ACTIONS = {
  // Preflop actions
  FOLD: 'fold',
  LIMP: 'limp',
  CALL: 'call',
  OPEN: 'open',
  THREE_BET: '3bet',
  FOUR_BET: '4bet',
  
  // Postflop actions - PFR
  CBET_IP_SMALL: 'cbet_ip_small',
  CBET_IP_LARGE: 'cbet_ip_large',
  CBET_OOP_SMALL: 'cbet_oop_small',
  CBET_OOP_LARGE: 'cbet_oop_large',
  CHECK: 'check',
  FOLD_TO_CR: 'fold_to_cr',
  
  // Postflop actions - PFC
  DONK: 'donk',
  STAB: 'stab',
  CHECK_RAISE: 'check_raise',
  FOLD_TO_CBET: 'fold_to_cbet',
  
  // Showdown actions
  MUCKED: 'mucked',
  WON: 'won',
};

// All actions that count as a fold (for checking fold status)
const FOLD_ACTIONS = [ACTIONS.FOLD, ACTIONS.FOLD_TO_CR, ACTIONS.FOLD_TO_CBET];

// Seat status values (returned by isSeatInactive)
const SEAT_STATUS = {
  FOLDED: 'folded',
  ABSENT: 'absent',
};

// Array of seat numbers for iteration
const SEAT_ARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Helper function: Check if an action is a fold action
const isFoldAction = (action) => FOLD_ACTIONS.includes(action);

// Helper function: Check if a card is red (hearts or diamonds)
const isRedCard = (card) => card && (card.includes('♥') || card.includes('♦'));

// Helper function: Check if a suit is red
const isRedSuit = (suit) => suit === '♥' || suit === '♦';

// Initial empty player cards state
const createEmptyPlayerCards = () => ({
  1: ['', ''],
  2: ['', ''],
  3: ['', ''],
  4: ['', ''],
  5: ['', ''],
  6: ['', ''],
  7: ['', ''],
  8: ['', ''],
  9: ['', '']
});

// Helper function: Get card abbreviation (A♥ -> Ah)
const getCardAbbreviation = (card) => {
  if (!card) return '';
  const rank = card[0];
  const suit = card[1];
  return rank + SUIT_ABBREV[suit];
};

// Helper function: Get hand abbreviation from two cards
const getHandAbbreviation = (cards) => {
  if (!cards || cards.length !== 2) return '';
  const card1 = getCardAbbreviation(cards[0]);
  const card2 = getCardAbbreviation(cards[1]);
  if (!card1 || !card2) return '';
  return card1 + card2;
};

// Helper function: Get display name for an action
const getActionDisplayName = (action) => {
  if (isFoldAction(action)) return 'fold';
  
  switch(action) {
    case ACTIONS.LIMP: return 'limp';
    case ACTIONS.CALL: return 'call';
    case ACTIONS.OPEN: return 'open';
    case ACTIONS.THREE_BET: return '3bet';
    case ACTIONS.FOUR_BET: return '4bet';
    case ACTIONS.CBET_IP_SMALL: return 'cbet IP (S)';
    case ACTIONS.CBET_IP_LARGE: return 'cbet IP (L)';
    case ACTIONS.CBET_OOP_SMALL: return 'cbet OOP (S)';
    case ACTIONS.CBET_OOP_LARGE: return 'cbet OOP (L)';
    case ACTIONS.CHECK: return 'check';
    case ACTIONS.CHECK_RAISE: return 'check-raise';
    case ACTIONS.DONK: return 'donk';
    case ACTIONS.STAB: return 'stab';
    case ACTIONS.MUCKED: return 'muck';
    case ACTIONS.WON: return 'won';
    default: return action || '';
  }
};

// Helper function: Get Tailwind classes for action color (used in showdown summary)
const getActionColor = (action) => {
  if (isFoldAction(action)) {
    return 'bg-red-300 text-red-900';
  }
  
  switch(action) {
    case ACTIONS.LIMP:
      return 'bg-gray-300 text-gray-900';
    case ACTIONS.CALL:
    case ACTIONS.CHECK:
      return 'bg-blue-200 text-blue-900';
    case ACTIONS.OPEN:
      return 'bg-green-300 text-green-900';
    case ACTIONS.THREE_BET:
    case ACTIONS.STAB:
      return 'bg-yellow-300 text-yellow-900';
    case ACTIONS.FOUR_BET:
    case ACTIONS.DONK:
    case ACTIONS.CHECK_RAISE:
      return 'bg-orange-300 text-orange-900';
    case ACTIONS.CBET_IP_SMALL:
    case ACTIONS.CBET_IP_LARGE:
    case ACTIONS.CBET_OOP_SMALL:
    case ACTIONS.CBET_OOP_LARGE:
      return 'bg-green-200 text-green-900';
    case ACTIONS.MUCKED:
      return 'bg-gray-400 text-gray-900';
    case ACTIONS.WON:
      return 'bg-green-400 text-green-900';
    default:
      return 'bg-gray-100 text-gray-900';
  }
};

// Helper function: Get seat background and ring colors based on action (used in table view)
const getSeatActionStyle = (action) => {
  if (isFoldAction(action)) {
    return { bg: 'bg-red-400', ring: 'ring-red-300' };
  }
  
  switch(action) {
    case ACTIONS.LIMP:
      return { bg: 'bg-gray-400', ring: 'ring-gray-300' };
    case ACTIONS.CALL:
    case ACTIONS.CHECK:
      return { bg: 'bg-blue-300', ring: 'ring-blue-200' };
    case ACTIONS.OPEN:
      return { bg: 'bg-green-400', ring: 'ring-green-300' };
    case ACTIONS.THREE_BET:
    case ACTIONS.STAB:
      return { bg: 'bg-yellow-400', ring: 'ring-yellow-300' };
    case ACTIONS.FOUR_BET:
    case ACTIONS.DONK:
    case ACTIONS.CHECK_RAISE:
      return { bg: 'bg-orange-400', ring: 'ring-orange-300' };
    case ACTIONS.CBET_IP_SMALL:
    case ACTIONS.CBET_IP_LARGE:
    case ACTIONS.CBET_OOP_SMALL:
    case ACTIONS.CBET_OOP_LARGE:
      return { bg: 'bg-green-500', ring: 'ring-green-300' };
    default:
      return { bg: 'bg-green-500', ring: 'ring-green-300' };
  }
};

// Helper function: Determine overlay status for showdown view
const getOverlayStatus = (inactiveStatus, isMucked, hasWon) => {
  if (inactiveStatus === SEAT_STATUS.FOLDED) return SEAT_STATUS.FOLDED;
  if (inactiveStatus === SEAT_STATUS.ABSENT) return SEAT_STATUS.ABSENT;
  if (isMucked) return 'mucked';
  if (hasWon) return 'won';
  return null;
};

// =============================================================================
// EXTRACTED UI COMPONENTS
// =============================================================================

// Badge type configurations
const BADGE_CONFIG = {
  dealer: {
    bg: 'bg-white',
    border: 'border-gray-800',
    text: 'text-black',
    label: 'D',
  },
  sb: {
    bg: 'bg-blue-400',
    border: 'border-blue-600',
    text: 'text-white',
    label: 'SB',
  },
  bb: {
    bg: 'bg-red-400',
    border: 'border-red-600',
    text: 'text-white',
    label: 'BB',
  },
  me: {
    bg: 'bg-purple-500',
    border: 'border-purple-700',
    text: 'text-white',
    label: 'ME',
  },
};

// Position Badge Component - D, SB, BB, ME indicators
// size: 'small' (24px) for showdown view, 'large' (45px) for table view
const PositionBadge = ({ type, size = 'small', draggable = false, onDragStart = null }) => {
  const config = BADGE_CONFIG[type];
  if (!config) return null;
  
  const sizeClass = size === 'small' ? 'w-6 h-6' : 'w-[45px] h-[45px]';
  const textSize = size === 'small' ? 'text-xs' : (type === 'dealer' ? 'text-2xl' : 'text-sm');
  const borderWidth = size === 'small' ? 'border-2' : 'border-4';
  
  return (
    <div 
      className={`${config.bg} rounded-full shadow flex items-center justify-center ${borderWidth} ${config.border} ${
        draggable ? 'cursor-move select-none shadow-xl' : ''
      }`}
      style={size === 'small' ? { width: '24px', height: '24px' } : { width: '45px', height: '45px' }}
      onMouseDown={draggable ? onDragStart : undefined}
    >
      <div className={`${textSize} font-bold ${config.text}`}>{config.label}</div>
    </div>
  );
};

// Visibility Toggle Component - Show/hide hole cards button
// size: 'small' (24px) or 'large' (40px)
const VisibilityToggle = ({ visible, onToggle, size = 'small' }) => {
  const sizeStyle = size === 'small' 
    ? { width: '24px', height: '24px' } 
    : { width: '40px', height: '40px' };
  const textSize = size === 'small' ? 'text-xs' : 'text-xl';
  
  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="bg-gray-600 hover:bg-gray-700 rounded shadow flex items-center justify-center cursor-pointer"
      style={sizeStyle}
    >
      <div className={`text-white ${textSize}`}>{visible ? '👁' : '👁‍🗨'}</div>
    </button>
  );
};

// Diagonal Overlay Component - FOLD/ABSENT/MUCK/WON labels
const DiagonalOverlay = ({ status }) => {
  if (!status) return null;
  
  const overlayConfig = {
    [SEAT_STATUS.FOLDED]: { bg: 'bg-red-600', label: 'FOLD' },
    [SEAT_STATUS.ABSENT]: { bg: 'bg-gray-600', label: 'ABSENT' },
    mucked: { bg: 'bg-gray-700', label: 'MUCK' },
    won: { bg: 'bg-green-600', label: 'WON' },
  };
  
  const config = overlayConfig[status];
  if (!config) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className={`transform -rotate-45 text-xs font-bold px-3 py-1 rounded shadow-lg ${config.bg} text-white`}>
        {config.label}
      </div>
    </div>
  );
};

// Card Slot Component - Reusable card display
// variant: 'table' (community cards), 'hole-table' (hole cards on table), 
//          'showdown' (showdown view), 'selector' (card selector)
const CardSlot = ({ 
  card, 
  variant = 'showdown',
  isHighlighted = false,
  isHidden = false,
  status = null, // 'folded', 'absent', 'mucked', 'won'
  onClick = null,
  canInteract = true,
}) => {
  // Size configurations for different variants
  const sizeConfig = {
    'table': { width: 70, height: 100, fontSize: 'text-2xl', plusSize: 'text-4xl' },
    'hole-table': { width: 40, height: 58, fontSize: 'text-xl', plusSize: 'text-2xl' },
    'showdown': { width: 50, height: 70, fontSize: 'text-lg', plusSize: 'text-2xl' },
    'selector': { width: 60, height: 85, fontSize: 'text-xl', plusSize: 'text-3xl' },
  };
  
  const size = sizeConfig[variant] || sizeConfig.showdown;
  
  // Determine background color based on state
  let bgColor = 'bg-gray-300';
  if (isHidden) {
    bgColor = 'bg-gray-700';
  } else if (card) {
    bgColor = 'bg-white';
  } else if (status === 'mucked') {
    bgColor = 'bg-gray-400';
  } else if (status === 'won') {
    bgColor = 'bg-green-200';
  } else if (status === SEAT_STATUS.FOLDED) {
    bgColor = 'bg-red-200';
  } else if (status === SEAT_STATUS.ABSENT) {
    bgColor = 'bg-gray-300';
  } else if (variant === 'table') {
    bgColor = card ? 'bg-white' : 'bg-gray-700';
  }
  
  // Determine opacity
  const opacity = (status && status !== 'won') || isHidden ? 'opacity-60' : '';
  
  // Highlight and interaction styles
  const highlightStyle = isHighlighted ? 'ring-4 ring-yellow-400 scale-110' : '';
  const hoverStyle = canInteract && !isHighlighted && onClick ? 'hover:ring-2 hover:ring-blue-400 cursor-pointer' : '';
  const tableHoverStyle = variant === 'table' && onClick ? 'hover:ring-4 hover:ring-yellow-400 cursor-pointer' : '';
  const cursorStyle = !canInteract ? 'cursor-default' : '';
  
  return (
    <div
      className={`${bgColor} rounded-lg shadow-lg flex items-center justify-center font-bold ${size.fontSize} transition-all ${opacity} ${highlightStyle} ${hoverStyle} ${tableHoverStyle} ${cursorStyle}`}
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
      onClick={canInteract && onClick ? onClick : undefined}
    >
      {!isHidden && card ? (
        <span className={isRedCard(card) ? 'text-red-600' : 'text-black'}>{card}</span>
      ) : (
        <span className={`text-gray-400 ${size.plusSize}`}>{isHidden ? '' : '+'}</span>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const PokerTrackerWireframes = () => {
  // All state variables
  const [currentView, setCurrentScreen] = useState(SCREEN.TABLE);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [currentStreet, setCurrentStreet] = useState('preflop');
  const [mySeat, setMySeat] = useState(5);
  const [dealerButtonSeat, setDealerSeat] = useState(1);
  const [holeCardsVisible, setHoleCardsVisible] = useState(true);
  const [isDraggingDealer, setIsDraggingDealer] = useState(false);
  const [seatActions, setSeatActions] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [absentSeats, setAbsentSeats] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [holeCards, setHoleCards] = useState(['', '']);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [cardSelectorType, setCardSelectorType] = useState('community');
  const [highlightedBoardIndex, setHighlightedCardIndex] = useState(0);
  const [isShowdownViewOpen, setIsShowdownViewOpen] = useState(false);
  const [allPlayerCards, setAllPlayerCards] = useState(createEmptyPlayerCards());
  const [highlightedSeat, setHighlightedSeat] = useState(1);
  const [highlightedHoleSlot, setHighlightedCardSlot] = useState(0);
  const tableRef = useRef(null);

  const advanceDealer = () => {
    setDealerSeat((dealerButtonSeat % CONSTANTS.NUM_SEATS) + 1);
  };

  const getSmallBlindSeat = () => {
    let seat = (dealerButtonSeat % CONSTANTS.NUM_SEATS) + 1;
    let attempts = 0;
    while (absentSeats.includes(seat) && attempts < CONSTANTS.NUM_SEATS) {
      seat = (seat % CONSTANTS.NUM_SEATS) + 1;
      attempts++;
    }
    return seat;
  };

  const getBigBlindSeat = () => {
    const sbSeat = getSmallBlindSeat();
    let seat = (sbSeat % CONSTANTS.NUM_SEATS) + 1;
    let attempts = 0;
    while (absentSeats.includes(seat) && attempts < CONSTANTS.NUM_SEATS) {
      seat = (seat % CONSTANTS.NUM_SEATS) + 1;
      attempts++;
    }
    return seat;
  };

  const handleDealerDragStart = (e) => {
    setIsDraggingDealer(true);
    e.preventDefault();
  };

  const handleDealerDrag = (e) => {
    if (!isDraggingDealer || !tableRef.current) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const rect = tableRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let closestSeat = 1;
    let minDist = Infinity;
    
    SEAT_POSITIONS.forEach(({ seat, x: sx, y: sy }) => {
      // Skip absent seats
      if (absentSeats.includes(seat)) return;
      
      const seatX = (sx / 100) * rect.width;
      const seatY = (sy / 100) * rect.height;
      const dist = Math.sqrt((x - seatX) ** 2 + (y - seatY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestSeat = seat;
      }
    });
    
    setDealerSeat(closestSeat);
  };

  const handleDealerDragEnd = (e) => {
    if (isDraggingDealer) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsDraggingDealer(false);
  };

  const togglePlayerSelection = (seat) => {
    setSelectedPlayers(prev => 
      prev.includes(seat) 
        ? prev.filter(s => s !== seat)
        : [...prev, seat]
    );
  };

  const handleSeatRightClick = (e, seat) => {
    e.preventDefault();
    
    const seatPos = SEAT_POSITIONS.find(s => s.seat === seat);
    if (!seatPos) return;
    
    const tableRect = tableRef.current?.getBoundingClientRect();
    if (!tableRect) return;
    
    const seatX = (seatPos.x / 100) * 900 + 200;
    const seatY = (seatPos.y / 100) * 450 + 50;
    
    setContextMenu({
      x: seatX - 160,
      y: seatY - 20,
      seat: seat
    });
  };

  const handleSetMySeat = (seat) => {
    setMySeat(seat);
    setContextMenu(null);
  };

  const recordAction = (action) => {
    if (selectedPlayers.length === 0) return;
    
    setSeatActions(prev => {
      const newActions = { ...prev };
      if (!newActions[currentStreet]) {
        newActions[currentStreet] = {};
      }
      
      selectedPlayers.forEach(seat => {
        newActions[currentStreet][seat] = action;
        log(`Seat ${seat}: ${action} on ${currentStreet}`);
      });
      
      return newActions;
    });
    
    setAbsentSeats(prev => prev.filter(s => !selectedPlayers.includes(s)));
    
    // Auto-advance to next seat
    const lastSelectedSeat = Math.max(...selectedPlayers);
    const nextSeat = getNextActionSeat(lastSelectedSeat);
    if (nextSeat) {
      setSelectedPlayers([nextSeat]);
    } else {
      setSelectedPlayers([]);
    }
  };

  const recordSeatAction = (seat, action) => {
    setSeatActions(prev => {
      const newActions = { ...prev };
      if (!newActions[currentStreet]) {
        newActions[currentStreet] = {};
      }
      newActions[currentStreet][seat] = action;
      log(`Seat ${seat}: ${action} on ${currentStreet}`);
      return newActions;
    });
  };

  const toggleAbsent = () => {
    if (selectedPlayers.length === 0) return;
    
    setAbsentSeats(prev => {
      const newAbsent = [...prev];
      selectedPlayers.forEach(seat => {
        if (!newAbsent.includes(seat)) {
          newAbsent.push(seat);
          log(`Seat ${seat}: marked as absent`);
        }
      });
      return newAbsent;
    });
    
    setSelectedPlayers([]);
  };

  const clearStreetActions = () => {
    setSeatActions(prev => {
      const newActions = { ...prev };
      delete newActions[currentStreet];
      return newActions;
    });
    // Re-select first action seat
    const firstSeat = getFirstActionSeat();
    setSelectedPlayers([firstSeat]);
  };

  const nextStreet = () => {
    const currentIndex = STREETS.indexOf(currentStreet);
    if (currentIndex < STREETS.length - 1) {
      const nextStreetName = STREETS[currentIndex + 1];
      setCurrentStreet(nextStreetName);
      setSelectedPlayers([]);
      
      // Auto-open card selector for flop, turn, and river
      if (nextStreetName === 'flop') {
        openCardSelector('community', 0);
      } else if (nextStreetName === 'turn') {
        openCardSelector('community', 3);
      } else if (nextStreetName === 'river') {
        openCardSelector('community', 4);
      } else if (nextStreetName === 'showdown') {
        openShowdownScreen();
      }
    }
  };

  const openCardSelector = (type, index) => {
    log('openCardSelector::', type, index);
    setCardSelectorType(type);
    setHighlightedCardIndex(index);
    setShowCardSelector(true);
  };

  const openShowdownScreen = () => {
    // Find first non-folded, non-absent seat
    let firstActiveSeat = 1;
    for (let seat = 1; seat <= CONSTANTS.NUM_SEATS; seat++) {
      const status = isSeatInactive(seat);
      if (status !== SEAT_STATUS.FOLDED && status !== SEAT_STATUS.ABSENT) {
        firstActiveSeat = seat;
        break;
      }
    }
    setHighlightedSeat(firstActiveSeat);
    setHighlightedCardSlot(0);
    setIsShowdownViewOpen(true);
  };

  const isSeatInactive = (seat) => {
    // Check if seat is absent
    if (absentSeats.includes(seat)) return SEAT_STATUS.ABSENT;
    
    // Check if seat folded on any previous street
    for (const street of BETTING_STREETS) {
      const action = seatActions[street]?.[seat];
      if (isFoldAction(action)) {
        return SEAT_STATUS.FOLDED;
      }
    }
    
    return false;
  };

  const getSeatActionSummary = (seat) => {
    const actions = [];
    
    STREETS.forEach(street => {
      const action = seatActions[street]?.[seat];
      if (action) {
        let displayAction = getActionDisplayName(action);
        
        if (street === 'showdown' && action !== ACTIONS.MUCKED) {
          // For showdown, add cards if available
          const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
          const handAbbr = getHandAbbreviation(cards);
          if (handAbbr) {
            displayAction = `show ${handAbbr}`;
          } else {
            displayAction = 'show';
          }
        }
        
        actions.push(`${street} ${displayAction}`);
      }
    });
    
    return actions;
  };

  const allCardsAssigned = () => {
    // Check if all non-folded, non-absent seats have cards assigned
    for (let seat = 1; seat <= CONSTANTS.NUM_SEATS; seat++) {
      const inactiveStatus = isSeatInactive(seat);
      const isMucked = seatActions['showdown']?.[seat] === ACTIONS.MUCKED;
      
      // Skip folded, absent, and mucked seats
      if (inactiveStatus === SEAT_STATUS.FOLDED || inactiveStatus === SEAT_STATUS.ABSENT || isMucked) {
        continue;
      }
      
      // Check if this active seat has both cards
      const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
      if (!cards[0] || !cards[1]) {
        return false;
      }
    }
    return true;
  };

  const getFirstActionSeat = () => {
    if (currentStreet === 'preflop') {
      // First to act preflop is after big blind
      const bbSeat = getBigBlindSeat();
      let seat = (bbSeat % CONSTANTS.NUM_SEATS) + 1;
      let attempts = 0;
      while (absentSeats.includes(seat) && attempts < CONSTANTS.NUM_SEATS) {
        seat = (seat % CONSTANTS.NUM_SEATS) + 1;
        attempts++;
      }
      return seat;
    } else {
      // Postflop, first to act is first non-absent, non-folded seat after dealer
      let seat = (dealerButtonSeat % CONSTANTS.NUM_SEATS) + 1;
      let attempts = 0;
      while (attempts < CONSTANTS.NUM_SEATS) {
        if (!absentSeats.includes(seat) && !hasSeatFolded(seat)) {
          return seat;
        }
        seat = (seat % CONSTANTS.NUM_SEATS) + 1;
        attempts++;
      }
      return 1; // Fallback
    }
  };

  const getNextActionSeat = (currentSeat) => {
    let seat = (currentSeat % CONSTANTS.NUM_SEATS) + 1;
    let attempts = 0;
    while (attempts < CONSTANTS.NUM_SEATS) {
      if (!absentSeats.includes(seat) && !hasSeatFolded(seat)) {
        return seat;
      }
      seat = (seat % CONSTANTS.NUM_SEATS) + 1;
      attempts++;
    }
    return null; // No more seats to act
  };

  const hasSeatFolded = (seat) => {
    // Check all streets up to and including current street
    const currentIndex = STREETS.indexOf(currentStreet);
    
    for (let i = 0; i <= currentIndex; i++) {
      const street = STREETS[i];
      const action = seatActions[street]?.[seat];
      if (isFoldAction(action)) {
        return true;
      }
    }
    return false;
  };

  const selectCardForShowdown = (card) => {
    const seat = highlightedSeat;
    const slot = highlightedHoleSlot;
    
    // For my seat, update holeCards instead of allPlayerCards
    if (seat === mySeat) {
      setHoleCards(prev => {
        const newCards = [...prev];
        
        // Remove card from other slot if it's there
        const existingIndex = newCards.indexOf(card);
        if (existingIndex !== -1 && existingIndex !== slot) {
          newCards[existingIndex] = '';
        }
        
        // Assign to current slot
        newCards[slot] = card;
        return newCards;
      });
    } else {
      setAllPlayerCards(prev => {
        const newCards = { ...prev };
        
        // Remove card from any other player's hand
        Object.keys(newCards).forEach(s => {
          const seatNum = parseInt(s);
          newCards[seatNum] = newCards[seatNum].map(c => c === card ? '' : c);
        });
        
        // Assign to current slot
        newCards[seat][slot] = card;
        
        return newCards;
      });
    }
    
    // Also remove from community cards if it's there
    if (communityCards.includes(card)) {
      setCommunityCards(prev => prev.map(c => c === card ? '' : c));
    }
    
    // Also remove from hole cards if it's there and this isn't my seat
    if (seat !== mySeat && holeCards.includes(card)) {
      setHoleCards(prev => prev.map(c => c === card ? '' : c));
    }
    
    // Auto-advance logic
    if (slot === 0) {
      // Move to second card of same seat
      setHighlightedCardSlot(1);
    } else {
      // Move to first card of next seat, skipping folded/absent/mucked seats
      let nextSeat = seat + 1;
      while (nextSeat <= CONSTANTS.NUM_SEATS) {
        const nextStatus = isSeatInactive(nextSeat);
        const nextMucked = seatActions['showdown']?.[nextSeat] === ACTIONS.MUCKED;
        // Skip folded, absent, and mucked seats
        if (nextStatus !== SEAT_STATUS.FOLDED && nextStatus !== SEAT_STATUS.ABSENT && !nextMucked) {
          setHighlightedSeat(nextSeat);
          setHighlightedCardSlot(0);
          return;
        }
        nextSeat++;
      }
      // No more active seats
      setHighlightedSeat(null);
      setHighlightedCardSlot(null);
    }
  };

  const selectCard = (card) => {
    if (highlightedBoardIndex === null) return;
    
    if (cardSelectorType === 'community') {
      setCommunityCards(prev => {
        const newCards = [...prev];
        
        // Remove the card from any other community card slot
        const existingIndex = newCards.indexOf(card);
        if (existingIndex !== -1 && existingIndex !== highlightedBoardIndex) {
          newCards[existingIndex] = '';
        }
        
        // Assign the card to the highlighted slot
        newCards[highlightedBoardIndex] = card;
        return newCards;
      });
      
      // Check if this was the last card needed for this street
      const shouldAutoClose = 
        (currentStreet === 'flop' && highlightedBoardIndex === 2) ||
        (currentStreet === 'turn' && highlightedBoardIndex === 3) ||
        (currentStreet === 'river' && highlightedBoardIndex === 4);
      
      if (shouldAutoClose) {
        // Close card selector and return to table
        setShowCardSelector(false);
        setHighlightedCardIndex(null);
      } else {
        // Auto-advance to next community card slot
        if (highlightedBoardIndex < 4) {
          setHighlightedCardIndex(highlightedBoardIndex + 1);
        } else {
          setHighlightedCardIndex(null);
        }
      }
    } else if (cardSelectorType === 'hole') {
      setHoleCards(prev => {
        const newCards = [...prev];
        
        // Remove the card from the other hole card slot
        const existingIndex = newCards.indexOf(card);
        if (existingIndex !== -1 && existingIndex !== highlightedBoardIndex) {
          newCards[existingIndex] = '';
        }
        
        // Assign the card to the highlighted slot
        newCards[highlightedBoardIndex] = card;
        return newCards;
      });
      
      // Check if this was the second hole card
      if (highlightedBoardIndex === 1) {
        // Close card selector and return to table (without changing street)
        setShowCardSelector(false);
        setHighlightedCardIndex(null);
      } else {
        // Auto-advance to next hole card slot
        setHighlightedCardIndex(1);
      }
    }
  };

  const clearCards = (type) => {
    if (type === 'community') {
      setCommunityCards([]);
    } else if (type === 'hole') {
      setHoleCards(['', '']);
    }
    setHighlightedCardIndex(null);
  };

  const getCardStreet = (card) => {
    const communityIndex = communityCards.indexOf(card);
    if (communityIndex !== -1) {
      if (communityIndex <= 2) return 'F';
      if (communityIndex === 3) return 'T';
      if (communityIndex === 4) return 'R';
    }
    // Only show "Hole" indicator if hole cards are visible
    if (holeCardsVisible && holeCards.includes(card)) return 'Hole';
    return null;
  };

  const nextHand = () => {
    // Clear all cards
    setCommunityCards([]);
    setHoleCards(['', '']);
    setAllPlayerCards(createEmptyPlayerCards());
    
    // Clear all actions
    setSeatActions({});
    
    // Set street to preflop
    setCurrentStreet('preflop');
    
    // Clear selections
    setSelectedPlayers([]);
    
    // Keep absentSeats as is (don't clear)
    
    // Advance dealer
    setDealerSeat((dealerButtonSeat % CONSTANTS.NUM_SEATS) + 1);
    log('nextHand: dealer advanced, all cards/actions cleared');
  };

  const resetHand = () => {
    setCommunityCards([]);
    setHoleCards(['', '']);
    setSeatActions({});
    setCurrentStreet('preflop');
    setAbsentSeats([]);
    setSelectedPlayers([]);
    setAllPlayerCards(createEmptyPlayerCards());
    log('resetHand: all state cleared including absent seats');
  };

  // Handler: Close showdown view and advance to next hand
  const handleNextHandFromShowdown = () => {
    nextHand();
    setIsShowdownViewOpen(false);
    setHighlightedSeat(null);
    setHighlightedCardSlot(null);
  };

  // Handler: Clear all player cards in showdown view
  const handleClearShowdownCards = () => {
    setAllPlayerCards(createEmptyPlayerCards());
    setSeatActions(prev => {
      const newActions = { ...prev };
      delete newActions['showdown'];
      return newActions;
    });
    // Find first active seat
    let firstActiveSeat = 1;
    for (let seat = 1; seat <= CONSTANTS.NUM_SEATS; seat++) {
      const status = isSeatInactive(seat);
      if (status !== SEAT_STATUS.FOLDED && status !== SEAT_STATUS.ABSENT) {
        firstActiveSeat = seat;
        break;
      }
    }
    setHighlightedSeat(firstActiveSeat);
    setHighlightedCardSlot(0);
    log('handleClearShowdownCards: cards cleared, first active seat selected');
  };

  // Handler: Close showdown view
  const handleCloseShowdown = () => {
    setIsShowdownViewOpen(false);
    setHighlightedSeat(null);
    setHighlightedCardSlot(null);
  };

  // Handler: Close card selector
  const handleCloseCardSelector = () => {
    setShowCardSelector(false);
    setHighlightedCardIndex(null);
  };

  // Helper: Advance to next active seat in showdown (skips folded/absent/mucked/won)
  const advanceToNextActiveSeat = (fromSeat) => {
    let nextSeat = fromSeat + 1;
    while (nextSeat <= CONSTANTS.NUM_SEATS) {
      const nextStatus = isSeatInactive(nextSeat);
      const nextMucked = seatActions['showdown']?.[nextSeat] === ACTIONS.MUCKED;
      const nextWon = seatActions['showdown']?.[nextSeat] === ACTIONS.WON;
      if (nextStatus !== SEAT_STATUS.FOLDED && nextStatus !== SEAT_STATUS.ABSENT && !nextMucked && !nextWon) {
        setHighlightedSeat(nextSeat);
        setHighlightedCardSlot(0);
        return;
      }
      nextSeat++;
    }
    // No more active seats, deselect
    setHighlightedSeat(null);
    setHighlightedCardSlot(null);
  };

  // Handler: Mark seat as mucked and advance
  const handleMuckSeat = (seat) => {
    recordSeatAction(seat, ACTIONS.MUCKED);
    advanceToNextActiveSeat(seat);
  };

  // Handler: Mark seat as winner and advance
  const handleWonSeat = (seat) => {
    recordSeatAction(seat, ACTIONS.WON);
    advanceToNextActiveSeat(seat);
  };

  const getSeatColor = (seat) => {
    const foldedPreviously = hasSeatFolded(seat);
    const isSelected = selectedPlayers.includes(seat);
    const isMySeat = seat === mySeat;
    
    // Helper for ring color based on selection state
    const getSelectionRing = () => {
      if (isMySeat && isSelected) return 'ring-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse';
      if (isMySeat) return 'ring-purple-500';
      if (isSelected) return 'ring-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse';
      return '';
    };
    
    // Absent seats
    if (absentSeats.includes(seat)) {
      const ring = isMySeat ? 'ring-purple-500' : (isSelected ? 'ring-yellow-400' : '');
      return `bg-gray-900 ${ring ? `ring-4 ${ring}` : ''} text-gray-600 opacity-50 ${isSelected ? 'animate-pulse' : ''}`;
    }
    
    // Folded on previous street
    if (foldedPreviously) {
      const ringColor = getSelectionRing() || 'ring-red-300';
      return `bg-red-400 ring-4 ${ringColor} text-white`;
    }
    
    // Get action-based colors
    const action = seatActions[currentStreet]?.[seat];
    let baseColor = 'bg-gray-700';
    let ringColor = getSelectionRing();
    
    if (action) {
      const style = getSeatActionStyle(action);
      baseColor = style.bg;
      if (!ringColor) ringColor = style.ring;
    }
    
    const ring = ringColor ? `ring-4 ${ringColor}` : '';
    const hover = !action && !isSelected && !isMySeat ? 'hover:bg-gray-600' : '';
    return `${baseColor} ${ring} text-white ${hover}`;
  };

  // Auto-select first action seat when street changes or card selector closes
  useEffect(() => {
    if (currentView === SCREEN.TABLE && !showCardSelector && currentStreet !== 'showdown') {
      // Only auto-select if no players are currently selected
      if (selectedPlayers.length === 0) {
        const firstSeat = getFirstActionSeat();
        setSelectedPlayers([firstSeat]);
      }
    }
  }, [currentStreet, showCardSelector, currentView]);

  // Showdown Screen
  if (isShowdownViewOpen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
        <div style={{ width: '1600px', height: '720px', transform: 'scale(0.5)', transformOrigin: 'center center' }}>
          <div 
            className="bg-gradient-to-br from-green-800 to-green-900 flex flex-col"
            style={{ width: '1600px', height: '720px' }}
          >
            <div className="bg-white p-6 flex justify-between items-center">
              <h2 className="text-3xl font-bold">
                Showdown - Click a card slot, then click a card
              </h2>
              <div className="flex items-center gap-4">
                {/* Community Cards Display */}
                <div>
                  <div className="text-sm font-bold mb-2 text-center">BOARD</div>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <CardSlot
                        key={idx}
                        card={communityCards[idx]}
                        variant="selector"
                        canInteract={false}
                      />
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleNextHandFromShowdown}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg text-xl font-bold flex items-center gap-2"
                >
                  <SkipForward size={24} />
                  Next Hand
                </button>
                <button 
                  onClick={handleClearShowdownCards}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
                >
                  Clear Cards
                </button>
                <button 
                  onClick={handleCloseShowdown}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
                >
                  Done
                </button>
              </div>
            </div>

            <div className="bg-gray-100 p-4">
              {allCardsAssigned() ? (
                /* Summary View - Show action history for each seat */
                <>
                  {/* Player Cards Display */}
                  <div className="grid grid-cols-9 gap-2 mb-4">
                    {SEAT_ARRAY.map(seat => {
                      const inactiveStatus = isSeatInactive(seat);
                      const isMucked = seatActions['showdown']?.[seat] === ACTIONS.MUCKED;
                      const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
                      const isDealer = dealerButtonSeat === seat;
                      const isSB = getSmallBlindSeat() === seat;
                      const isBB = getBigBlindSeat() === seat;
                      const isMySeat = mySeat === seat;
                      
                      return (
                        <div key={seat} className="flex flex-col items-center">
                          {/* Seat Number */}
                          <div className="text-sm font-bold mb-1">Seat {seat}</div>
                          
                          {/* Dealer/Blinds/My Seat Indicators with Visibility Toggle */}
                          <div className="flex gap-1 mb-1 items-center" style={{ minHeight: '24px' }}>
                            {isDealer && <PositionBadge type="dealer" size="small" />}
                            {isSB && <PositionBadge type="sb" size="small" />}
                            {isBB && <PositionBadge type="bb" size="small" />}
                            {isMySeat && <PositionBadge type="me" size="small" />}
                            {isMySeat && (
                              <VisibilityToggle 
                                visible={holeCardsVisible} 
                                onToggle={() => setHoleCardsVisible(!holeCardsVisible)} 
                                size="small" 
                              />
                            )}
                          </div>
                          
                          {/* Card Slots */}
                          <div className="flex gap-1 mb-1 relative">
                            {[0, 1].map(cardSlot => {
                              const card = cards[cardSlot];
                              const shouldHideCard = isMySeat && !holeCardsVisible;
                              const hasWon = seatActions['showdown']?.[seat] === ACTIONS.WON;
                              const cardStatus = isMucked ? 'mucked' : hasWon ? 'won' : inactiveStatus || null;
                              
                              return (
                                <CardSlot
                                  key={cardSlot}
                                  card={card}
                                  variant="showdown"
                                  isHidden={shouldHideCard}
                                  status={cardStatus}
                                  canInteract={false}
                                />
                              );
                            })}
                            
                            {/* Diagonal Overlay Label */}
                            <DiagonalOverlay status={getOverlayStatus(inactiveStatus, isMucked, seatActions['showdown']?.[seat] === ACTIONS.WON)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action History Grid - Segmented by Street */}
                  <div className="bg-white rounded shadow p-4">
                    <div className="grid grid-cols-9 gap-2">
                      {/* Headers with Labels buttons */}
                      {SEAT_ARRAY.map(seat => (
                        <div key={seat} className="flex flex-col items-center">
                          <button className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold w-full mb-2">
                            Labels
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Street Sections */}
                    {STREETS.map(street => (
                      <div key={street} className="mb-3">
                        <div className="text-xs font-bold text-gray-700 uppercase mb-1 border-b-2 border-gray-600 pb-1">
                          {street}
                        </div>
                        <div className="grid grid-cols-9 gap-2">
                          {SEAT_ARRAY.map(seat => {
                            const action = seatActions[street]?.[seat];
                            const inactiveStatus = isSeatInactive(seat);
                            const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
                            
                            let displayAction = '';
                            let actionColor = 'bg-gray-100 text-gray-900';
                            
                            // For showdown street, check if player folded on a previous street
                            let effectiveAction = action;
                            if (street === 'showdown' && !action) {
                              // Check all previous streets for fold
                              const hasFolded = BETTING_STREETS.some(prevStreet => {
                                const prevAction = seatActions[prevStreet]?.[seat];
                                return isFoldAction(prevAction);
                              });
                              if (hasFolded) {
                                effectiveAction = ACTIONS.FOLD;
                              }
                            }
                            
                            if (effectiveAction) {
                              actionColor = getActionColor(effectiveAction);
                              displayAction = getActionDisplayName(effectiveAction);
                              
                              // For showdown, add cards if available
                              if (street === 'showdown') {
                                const handAbbr = getHandAbbreviation(cards);
                                
                                if (effectiveAction === ACTIONS.MUCKED) {
                                  // Muck - no cards shown
                                  displayAction = 'muck';
                                } else if (effectiveAction === ACTIONS.WON) {
                                  // Won - show cards if available
                                  if (handAbbr) {
                                    displayAction = `won ${handAbbr}`;
                                  } else {
                                    displayAction = 'won';
                                  }
                                } else if (isFoldAction(effectiveAction)) {
                                  // Folded - show cards if available, otherwise just "fold"
                                  if (handAbbr) {
                                    displayAction = `fold ${handAbbr}`;
                                  } else {
                                    displayAction = 'fold';
                                  }
                                } else if (inactiveStatus === SEAT_STATUS.ABSENT) {
                                  // Absent - no action
                                  displayAction = '';
                                } else {
                                  // Active player who made it to showdown - only show "show" if cards present
                                  if (handAbbr) {
                                    displayAction = `show ${handAbbr}`;
                                  } else {
                                    // No cards assigned and not folded/mucked/won/absent - don't display anything
                                    displayAction = '';
                                  }
                                }
                              }
                            }
                            
                            return (
                              <div key={seat} className="text-center py-1 px-1 text-xs" style={{ minHeight: '24px' }}>
                                {displayAction ? (
                                  <div className={`${actionColor} rounded px-1 py-1 font-semibold`}>
                                    {displayAction}
                                  </div>
                                ) : (
                                  <div className="text-gray-300">—</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* Card Selection View */
                <>
                  <div className="grid grid-cols-9 gap-2 mb-4">
                    {SEAT_ARRAY.map(seat => {
                      const inactiveStatus = isSeatInactive(seat);
                      const isMucked = seatActions['showdown']?.[seat] === ACTIONS.MUCKED;
                      // Use holeCards for my seat, allPlayerCards for others
                      const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
                      const isDealer = dealerButtonSeat === seat;
                      const isSB = getSmallBlindSeat() === seat;
                      const isBB = getBigBlindSeat() === seat;
                      const isMySeat = mySeat === seat;
                      
                      return (
                        <div key={seat} className="flex flex-col items-center">
                          {/* Seat Number - Always at top */}
                          <div className="text-sm font-bold mb-1">Seat {seat}</div>
                          
                          {/* Dealer/Blinds/My Seat Indicators with Visibility Toggle */}
                          <div className="flex gap-1 mb-1 items-center" style={{ minHeight: '24px' }}>
                            {isDealer && <PositionBadge type="dealer" size="small" />}
                            {isSB && <PositionBadge type="sb" size="small" />}
                            {isBB && <PositionBadge type="bb" size="small" />}
                            {isMySeat && <PositionBadge type="me" size="small" />}
                            {isMySeat && (
                              <VisibilityToggle 
                                visible={holeCardsVisible} 
                                onToggle={() => setHoleCardsVisible(!holeCardsVisible)} 
                                size="small" 
                              />
                            )}
                          </div>
                          
                          {/* Card Slots with Overlaid Labels */}
                          <div className="flex gap-1 mb-1 relative">
                            {[0, 1].map(cardSlot => {
                              const card = cards[cardSlot];
                              const isHighlighted = highlightedSeat === seat && highlightedHoleSlot === cardSlot;
                              const shouldHideCard = isMySeat && !holeCardsVisible;
                              const canInteract = inactiveStatus !== SEAT_STATUS.ABSENT && !isMucked;
                              const cardStatus = isMucked ? 'mucked' : inactiveStatus || null;
                              
                              return (
                                <CardSlot
                                  key={cardSlot}
                                  card={card}
                                  variant="showdown"
                                  isHighlighted={isHighlighted}
                                  isHidden={shouldHideCard}
                                  status={cardStatus}
                                  canInteract={canInteract}
                                  onClick={() => {
                                    if (canInteract) {
                                      setHighlightedSeat(seat);
                                      setHighlightedCardSlot(cardSlot);
                                    }
                                  }}
                                />
                              );
                            })}
                            
                            {/* Diagonal Overlay Label for Folded/Absent/Mucked/Won */}
                            <DiagonalOverlay status={getOverlayStatus(inactiveStatus, isMucked, seatActions['showdown']?.[seat] === ACTIONS.WON)} />
                          </div>
                          
                          {/* Muck and Won Buttons - Only for non-folded and non-absent and non-mucked/won hands */}
                          {inactiveStatus !== SEAT_STATUS.FOLDED && inactiveStatus !== SEAT_STATUS.ABSENT && !isMucked && seatActions['showdown']?.[seat] !== ACTIONS.WON && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleMuckSeat(seat)}
                                className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded font-semibold"
                              >
                                Muck
                              </button>
                              {/* Only show Won button if no seat has won yet */}
                              {!Object.values(seatActions['showdown'] || {}).includes(ACTIONS.WON) && (
                                <button
                                  onClick={() => handleWonSeat(seat)}
                                  className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded font-semibold"
                                >
                                  Won
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Card Selection Table */}
                  <div className="flex-1 bg-white p-8 overflow-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="w-16"></th>
                          {RANKS.map(rank => (
                            <th key={rank} className="text-center pb-3">
                              <div className="text-2xl font-bold">{rank}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SUITS.map(suit => (
                          <tr key={suit}>
                            <td className="text-center pr-4">
                              <div className={`text-4xl ${isRedSuit(suit) ? 'text-red-600' : 'text-black'}`}>
                                {suit}
                              </div>
                            </td>
                            {RANKS.map(rank => {
                              const card = `${rank}${suit}`;
                              
                              // Check if card is used in community cards
                              const isInCommunity = communityCards.includes(card);
                              const communityIndex = communityCards.indexOf(card);
                              
                              // Check if card is used in any player's hand
                              let usedBySeat = null;
                              let cardSlotIndex = null;
                              
                              // Check my seat's hole cards
                              if (holeCards.includes(card)) {
                                usedBySeat = mySeat;
                              }
                              
                              // Check all other players
                              Object.entries(allPlayerCards).forEach(([seat, playerHand]) => {
                                const index = playerHand.indexOf(card);
                                if (index !== -1) {
                                  usedBySeat = parseInt(seat);
                                  cardSlotIndex = index;
                                }
                              });
                              
                              const isUsed = isInCommunity || usedBySeat !== null;
                              const canSelect = highlightedSeat !== null && highlightedHoleSlot !== null;
                              
                              // Get street indicator for community cards
                              let streetIndicator = null;
                              if (isInCommunity) {
                                if (communityIndex <= 2) streetIndicator = 'F';
                                else if (communityIndex === 3) streetIndicator = 'T';
                                else if (communityIndex === 4) streetIndicator = 'R';
                              }
                              
                              return (
                                <td key={card} className="p-1 relative">
                                  <button
                                    onClick={() => canSelect && selectCardForShowdown(card)}
                                    disabled={!canSelect}
                                    className={`w-full aspect-[2/3] rounded-lg font-bold text-xl transition-all relative ${
                                      isUsed 
                                        ? 'bg-gray-300 text-gray-400 cursor-not-allowed opacity-40' 
                                        : !canSelect
                                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                          : isRedSuit(suit)
                                            ? 'bg-red-50 hover:bg-red-200 border-4 border-red-400 text-red-600 hover:scale-110'
                                            : 'bg-gray-50 hover:bg-gray-200 border-4 border-gray-800 text-black hover:scale-110'
                                    }`}
                                    style={{ minHeight: '70px' }}
                                  >
                                    <div>{rank}</div>
                                    <div className="text-3xl">{suit}</div>
                                    {streetIndicator && (
                                      <div className="absolute bottom-1 right-1 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                        {streetIndicator}
                                      </div>
                                    )}
                                    {usedBySeat !== null && (
                                      <div className="absolute top-1 left-1 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                        {usedBySeat}
                                      </div>
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card Selector Screen (renders when showCardSelector is true)
  if (showCardSelector) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
        <div style={{ width: '1600px', height: '720px', transform: 'scale(0.5)', transformOrigin: 'center center' }}>
          <div 
            className="bg-gradient-to-br from-green-800 to-green-900 flex flex-col"
            style={{ width: '1600px', height: '720px' }}
          >
            <div className="bg-white p-6 flex justify-between items-center">
              <h2 className="text-3xl font-bold">
                Select Cards - Click a slot below, then click a card
              </h2>
              <button 
                onClick={handleCloseCardSelector}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
              >
                Done
              </button>
            </div>

            <div className="bg-gray-100 p-4 flex justify-center gap-8 items-center">
              <div>
                <div className="text-sm font-bold mb-2">BOARD</div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((idx) => {
                    const isHighlighted = cardSelectorType === 'community' && highlightedBoardIndex === idx;
                    return (
                      <CardSlot
                        key={idx}
                        card={communityCards[idx]}
                        variant="selector"
                        isHighlighted={isHighlighted}
                        onClick={() => {setCardSelectorType('community'); setHighlightedCardIndex(idx);}}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-bold mb-2">HOLE CARDS</div>
                <div className="flex gap-2 items-center">
                  {[0, 1].map((idx) => {
                    const isHighlighted = cardSelectorType === 'hole' && highlightedBoardIndex === idx;
                    return (
                      <CardSlot
                        key={idx}
                        card={holeCards[idx]}
                        variant="selector"
                        isHighlighted={isHighlighted}
                        isHidden={!holeCardsVisible}
                        onClick={() => {setCardSelectorType('hole'); setHighlightedCardIndex(idx);}}
                      />
                    );
                  })}
                  <VisibilityToggle 
                    visible={holeCardsVisible} 
                    onToggle={() => setHoleCardsVisible(!holeCardsVisible)} 
                    size="large" 
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => clearCards('community')}
                  className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                >
                  Clear Board
                </button>
                <button
                  onClick={() => clearCards('hole')}
                  className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                >
                  Clear Hole
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-white p-8 overflow-auto flex flex-col justify-center">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-16"></th>
                    {RANKS.map(rank => (
                      <th key={rank} className="text-center pb-3">
                        <div className="text-2xl font-bold">{rank}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUITS.map(suit => (
                    <tr key={suit}>
                      <td className="text-center pr-4">
                        <div className={`text-4xl ${isRedSuit(suit) ? 'text-red-600' : 'text-black'}`}>
                          {suit}
                        </div>
                      </td>
                      {RANKS.map(rank => {
                        const card = `${rank}${suit}`;
                        const isInCommunity = communityCards.includes(card);
                        const isInHole = holeCards.includes(card);
                        // Only consider it "used" if it's visible
                        const isUsed = isInCommunity || (holeCardsVisible && isInHole);
                        const canSelect = highlightedBoardIndex !== null;
                        const streetIndicator = getCardStreet(card);
                        
                        return (
                          <td key={card} className="p-1 relative">
                            <button
                              onClick={() => canSelect && selectCard(card)}
                              disabled={!canSelect}
                              className={`w-full aspect-[2/3] rounded-lg font-bold text-xl transition-all relative ${
                                isUsed 
                                  ? 'bg-gray-300 text-gray-400 cursor-not-allowed opacity-40' 
                                  : highlightedBoardIndex === null
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : isRedSuit(suit)
                                      ? 'bg-red-50 hover:bg-red-200 border-4 border-red-400 text-red-600 hover:scale-110'
                                      : 'bg-gray-50 hover:bg-gray-200 border-4 border-gray-800 text-black hover:scale-110'
                              }`}
                              style={{ minHeight: '70px' }}
                            >
                              <div>{rank}</div>
                              <div className="text-3xl">{suit}</div>
                              {streetIndicator && (
                                <div className="absolute bottom-1 right-1 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                  {streetIndicator}
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Table Screen (main poker table view)
  if (currentView === SCREEN.TABLE) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
        <div style={{ width: '1600px', height: '720px', transform: 'scale(0.5)', transformOrigin: 'center center' }}>
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
              <div className="flex gap-2">
                <button 
                  onClick={resetHand}
                  className="bg-gray-700 text-white px-3 py-2 rounded flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Reset
                </button>
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
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-3">
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
                      className={`rounded-lg shadow-lg transition-all font-bold text-2xl ${getSeatColor(seat)}`}
                      style={{ width: '60px', height: '60px' }}
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
                  Clear Actions
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
  }

  // Stats Screen
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
      <div style={{ width: '1600px', height: '720px', transform: 'scale(0.5)', transformOrigin: 'center center' }}>
        <div className="bg-gray-50 overflow-y-auto p-6" style={{ width: '1600px', height: '720px' }}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Player Statistics</h2>
            <button onClick={() => setCurrentScreen(SCREEN.TABLE)} className="bg-green-600 text-white px-4 py-2 rounded-lg">⬅ Back to Table</button>
          </div>
          
          <div className="grid grid-cols-5 gap-3 mb-6">
            {SEAT_POSITIONS.map(({seat}) => (
              <button key={seat} className={`p-4 rounded-lg border-2 hover:border-blue-500 text-center ${seat === mySeat ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300'}`}>
                <div className="text-sm text-gray-600">Seat</div>
                <div className="font-bold text-3xl">{seat}</div>
                <div className="text-xs text-gray-500 mt-1">45 hands</div>
              </button>
            ))}
          </div>

          <div className="bg-white p-6 rounded-lg border-2 border-gray-300">
            <h3 className="text-xl font-bold mb-4">Seat {mySeat} Statistics (You)</h3>
            
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-blue-700 mb-3">Preflop</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>VPIP</span><span className="font-bold">32%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>PFR</span><span className="font-bold">18%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>3bet</span><span className="font-bold">8%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Limp</span><span className="font-bold">12%</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-green-700 mb-3">As PFR</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Cbet IP</span><span className="font-bold">65%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Cbet OOP</span><span className="font-bold">45%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Large %</span><span className="font-bold">35%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Fold CR</span><span className="font-bold">40%</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-purple-700 mb-3">As PFC</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Donk</span><span className="font-bold">15%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Stab</span><span className="font-bold">25%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Check-Raise</span><span className="font-bold">12%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Fold Cbet</span><span className="font-bold">55%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PokerTrackerWireframes;
