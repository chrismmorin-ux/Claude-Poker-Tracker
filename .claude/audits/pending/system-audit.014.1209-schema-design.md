# TICKET-5.1: Schema Design Document

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

This document defines formal TypeScript interfaces and custom validation schemas for all Poker Tracker state shapes. These schemas serve as the single source of truth for data structure, enable compile-time type checking, and provide runtime validation patterns. The design prioritizes simplicity and incremental adoption over comprehensive type safety.

---

## Design Principles

1. **Incremental Adoption** - Can be added without breaking existing code
2. **Runtime + Compile Time** - Types for IDE, validators for runtime
3. **Self-Documenting** - Schemas serve as documentation
4. **Minimal Dependencies** - No Zod, use custom lightweight validators
5. **Performance Conscious** - Validation only where needed

---

## TypeScript Interfaces

### Game State

```typescript
// src/types/game.ts

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type Seat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Action =
  | 'fold' | 'limp' | 'call' | 'open' | '3bet' | '4bet'
  | 'cbet_ip_small' | 'cbet_ip_large' | 'cbet_oop_small' | 'cbet_oop_large'
  | 'check' | 'fold_to_cr' | 'donk' | 'stab' | 'check_raise' | 'fold_to_cbet'
  | 'mucked' | 'won';

export interface SeatActions {
  [street: string]: {
    [seat: string]: Action[];
  };
}

export interface GameState {
  currentStreet: Street;
  dealerButtonSeat: Seat;
  mySeat: Seat;
  seatActions: SeatActions;
  absentSeats: Seat[];
}
```

### Card State

```typescript
// src/types/card.ts

export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type Suit = '♠' | '♥' | '♦' | '♣';
export type Card = `${Rank}${Suit}` | '';

export type CommunityCards = [Card, Card, Card, Card, Card];
export type HoleCards = [Card, Card];

export interface PlayerCards {
  1: HoleCards;
  2: HoleCards;
  3: HoleCards;
  4: HoleCards;
  5: HoleCards;
  6: HoleCards;
  7: HoleCards;
  8: HoleCards;
  9: HoleCards;
}

export interface CardState {
  communityCards: CommunityCards;
  holeCards: HoleCards;
  holeCardsVisible: boolean;
  allPlayerCards: PlayerCards;
}
```

### Session State

```typescript
// src/types/session.ts

export interface RebuyTransaction {
  timestamp: number;
  amount: number;
}

export interface CurrentSession {
  sessionId: number | null;
  startTime: number | null;
  endTime: number | null;
  isActive: boolean;
  venue: string | null;
  gameType: string | null;
  buyIn: number | null;
  rebuyTransactions: RebuyTransaction[];
  cashOut: number | null;
  reUp: number;
  goal: string | null;
  notes: string | null;
  handCount: number;
}

export interface SessionRecord extends CurrentSession {
  sessionId: number;
  startTime: number;
  version: string;
}

export interface SessionState {
  currentSession: CurrentSession;
  allSessions: SessionRecord[];
  isLoading: boolean;
}
```

### Player State

```typescript
// src/types/player.ts

export interface Player {
  playerId: number;
  name: string;
  nickname?: string;
  ethnicity?: string;
  build?: string;
  gender?: string;
  facialHair?: string;
  hat?: boolean;
  sunglasses?: boolean;
  styleTags?: string[];
  notes?: string;
  avatar?: string;
  createdAt: number;
  lastSeenAt: number;
  handCount: number;
  stats?: object;
}

export interface SeatPlayers {
  [seat: number]: number;  // seat -> playerId
}

export interface PlayerState {
  allPlayers: Player[];
  seatPlayers: SeatPlayers;
  isLoading: boolean;
}
```

### UI State

```typescript
// src/types/ui.ts

export type ScreenType = 'table' | 'stats' | 'history' | 'sessions' | 'players';
export type CardSelectorType = 'community' | 'hole';

export interface ContextMenu {
  x: number;
  y: number;
  seat: Seat;
}

export interface UIState {
  currentView: ScreenType;
  selectedPlayers: Seat[];
  contextMenu: ContextMenu | null;
  isDraggingDealer: boolean;
  isSidebarCollapsed: boolean;
  showCardSelector: boolean;
  cardSelectorType: CardSelectorType;
  highlightedBoardIndex: number | null;
  isShowdownViewOpen: boolean;
  highlightedSeat: Seat | null;
  highlightedHoleSlot: 0 | 1 | null;
}
```

### Persistence Types

```typescript
// src/types/persistence.ts

export interface HandRecord {
  handId: number;
  timestamp: number;
  version: string;
  sessionId: number | null;
  sessionHandNumber: number | null;
  handDisplayId: string;
  gameState: GameState;
  cardState: CardState;
  seatPlayers?: SeatPlayers;
}

export interface ActiveSessionRecord {
  id: 1;
  sessionId: number;
  lastUpdated: number;
}
```

---

## Validation Schemas

### Schema Definition Format

```typescript
// src/utils/schemas.ts

export interface SchemaRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
  length?: number;
  items?: SchemaRule;
  properties?: { [key: string]: SchemaRule };
  custom?: (value: any) => boolean;
}
```

### Game State Schema

```typescript
export const GAME_STATE_SCHEMA: { [key: string]: SchemaRule } = {
  currentStreet: {
    type: 'string',
    required: true,
    enum: ['preflop', 'flop', 'turn', 'river', 'showdown']
  },
  dealerButtonSeat: {
    type: 'number',
    required: true,
    min: 1,
    max: 9
  },
  mySeat: {
    type: 'number',
    required: true,
    min: 1,
    max: 9
  },
  seatActions: {
    type: 'object',
    required: true
  },
  absentSeats: {
    type: 'array',
    required: true,
    items: { type: 'number', min: 1, max: 9 }
  }
};
```

### Card State Schema

```typescript
export const CARD_STATE_SCHEMA: { [key: string]: SchemaRule } = {
  communityCards: {
    type: 'array',
    required: true,
    length: 5,
    items: { type: 'string', custom: isValidCardOrEmpty }
  },
  holeCards: {
    type: 'array',
    required: true,
    length: 2,
    items: { type: 'string', custom: isValidCardOrEmpty }
  },
  holeCardsVisible: {
    type: 'boolean',
    required: true
  },
  allPlayerCards: {
    type: 'object',
    required: true,
    custom: isValidPlayerCards
  }
};
```

### Session State Schema

```typescript
export const CURRENT_SESSION_SCHEMA: { [key: string]: SchemaRule } = {
  sessionId: {
    type: 'number',
    required: false
  },
  startTime: {
    type: 'number',
    required: false
  },
  endTime: {
    type: 'number',
    required: false
  },
  isActive: {
    type: 'boolean',
    required: true
  },
  venue: {
    type: 'string',
    required: false
  },
  gameType: {
    type: 'string',
    required: false
  },
  buyIn: {
    type: 'number',
    required: false,
    min: 0
  },
  rebuyTransactions: {
    type: 'array',
    required: true,
    items: {
      type: 'object',
      properties: {
        timestamp: { type: 'number', required: true },
        amount: { type: 'number', required: true }
      }
    }
  },
  cashOut: {
    type: 'number',
    required: false
  },
  reUp: {
    type: 'number',
    required: true,
    min: 0
  },
  goal: {
    type: 'string',
    required: false
  },
  notes: {
    type: 'string',
    required: false
  },
  handCount: {
    type: 'number',
    required: true,
    min: 0
  }
};
```

---

## Custom Validators

```typescript
// src/utils/validators.ts

import { SUITS, RANKS } from '../constants/gameConstants';

/**
 * Validate card string (empty or Rank+Suit)
 */
export const isValidCardOrEmpty = (value: string): boolean => {
  if (value === '') return true;
  if (typeof value !== 'string' || value.length !== 2) return false;

  const rank = value[0];
  const suit = value[1];
  return RANKS.includes(rank) && SUITS.includes(suit);
};

/**
 * Validate seat number (1-9)
 */
export const isValidSeat = (value: number): boolean => {
  return Number.isInteger(value) && value >= 1 && value <= 9;
};

/**
 * Validate player cards object structure
 */
export const isValidPlayerCards = (value: object): boolean => {
  if (!value || typeof value !== 'object') return false;

  for (let seat = 1; seat <= 9; seat++) {
    const cards = value[seat];
    if (!Array.isArray(cards) || cards.length !== 2) return false;
    if (!cards.every(isValidCardOrEmpty)) return false;
  }
  return true;
};

/**
 * Validate action type
 */
export const isValidAction = (value: string): boolean => {
  return Object.values(ACTIONS).includes(value);
};

/**
 * Validate rebuy transactions array
 */
export const isValidRebuyTransactions = (value: any[]): boolean => {
  if (!Array.isArray(value)) return false;

  return value.every(t =>
    typeof t === 'object' &&
    t !== null &&
    typeof t.timestamp === 'number' &&
    typeof t.amount === 'number' &&
    t.amount >= 0
  );
};

/**
 * Check no duplicate cards across all slots
 */
export const hasNoDuplicateCards = (cardState: CardState): boolean => {
  const allCards: string[] = [
    ...cardState.communityCards.filter(c => c),
    ...cardState.holeCards.filter(c => c),
    ...Object.values(cardState.allPlayerCards).flat().filter(c => c)
  ];

  return new Set(allCards).size === allCards.length;
};
```

---

## Type Guards

```typescript
// src/utils/typeGuards.ts

import { GameState, CardState, CurrentSession } from '../types';

/**
 * Type guard for GameState
 */
export const isGameState = (value: unknown): value is GameState => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.currentStreet === 'string' &&
    ['preflop', 'flop', 'turn', 'river', 'showdown'].includes(obj.currentStreet) &&
    typeof obj.dealerButtonSeat === 'number' &&
    obj.dealerButtonSeat >= 1 && obj.dealerButtonSeat <= 9 &&
    typeof obj.mySeat === 'number' &&
    obj.mySeat >= 1 && obj.mySeat <= 9 &&
    typeof obj.seatActions === 'object' &&
    Array.isArray(obj.absentSeats)
  );
};

/**
 * Type guard for CardState
 */
export const isCardState = (value: unknown): value is CardState => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  return (
    Array.isArray(obj.communityCards) && obj.communityCards.length === 5 &&
    Array.isArray(obj.holeCards) && obj.holeCards.length === 2 &&
    typeof obj.holeCardsVisible === 'boolean' &&
    typeof obj.allPlayerCards === 'object'
  );
};

/**
 * Type guard for CurrentSession
 */
export const isCurrentSession = (value: unknown): value is CurrentSession => {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.isActive === 'boolean' &&
    Array.isArray(obj.rebuyTransactions) &&
    typeof obj.handCount === 'number'
  );
};
```

---

## Integration Examples

### Reducer with Types

```typescript
// src/reducers/gameReducer.ts

import { GameState, Street, Seat, Action } from '../types';

export const initialGameState: GameState = {
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  seatActions: {},
  absentSeats: [],
};

interface RecordActionPayload {
  seats: Seat[];
  action: Action;
}

const rawGameReducer = (state: GameState, action: { type: string; payload?: any }): GameState => {
  switch (action.type) {
    case GAME_ACTIONS.RECORD_ACTION: {
      const { seats, action: playerAction } = action.payload as RecordActionPayload;
      // TypeScript now knows seats is Seat[] and playerAction is Action
      // ...
    }
  }
};
```

### Persistence with Validation

```typescript
// src/utils/persistence/handsStorage.ts

import { HandRecord } from '../types';
import { isGameState, isCardState } from '../utils/typeGuards';

export const saveHand = async (handData: Partial<HandRecord>): Promise<number> => {
  // Validate required fields
  if (!isGameState(handData.gameState)) {
    throw new Error('Invalid gameState');
  }

  if (!isCardState(handData.cardState)) {
    throw new Error('Invalid cardState');
  }

  // Proceed with validated data
  // ...
};
```

### Hydration with Defaults

```typescript
// In reducer

case GAME_ACTIONS.HYDRATE_STATE:
  const payload = action.payload as Partial<GameState>;
  return {
    ...initialGameState,  // TypeScript knows this is GameState
    ...state,
    ...payload            // Only valid fields can be spread
  };
```

---

## File Structure

```
src/
├── types/
│   ├── index.ts          # Re-exports all types
│   ├── game.ts           # GameState types
│   ├── card.ts           # CardState types
│   ├── session.ts        # SessionState types
│   ├── player.ts         # PlayerState types
│   ├── ui.ts             # UIState types
│   └── persistence.ts    # DB record types
│
├── utils/
│   ├── schemas.ts        # Schema definitions
│   ├── validators.ts     # Custom validation functions
│   └── typeGuards.ts     # TypeScript type guards
```

---

## Migration Strategy

### Phase 1: Type Definitions (No Code Changes)

1. Create `src/types/` directory
2. Add TypeScript interfaces
3. No imports needed initially (documentation value)

### Phase 2: Type Guards

1. Create `typeGuards.ts`
2. Use in hydration paths
3. Add to persistence layer

### Phase 3: Validator Integration

1. Create `validators.ts`
2. Integrate with reducers
3. Add to save/load functions

### Phase 4: Full TypeScript (Optional)

1. Convert reducers to `.ts`
2. Add explicit types to dispatches
3. Enable strict mode

---

## Recommendations

### Immediate (This Sprint)

1. Create `src/types/` with interfaces
2. Add type guards for hydration
3. Use in persistence validation

### Next Sprint

4. Add validators to reducers
5. Convert critical files to TypeScript
6. Add schema tests

### Future

7. Full TypeScript migration
8. Strict null checks
9. Discriminated unions for actions

---

## Related Documents

- [TICKET-4.1: Invariant Catalog](./invariant-catalog.md)
- [TICKET-4.2: Validation Layer Proposal](./validation-proposal.md)
- [TICKET-5.2: Implementation Roadmap](./schema-roadmap.md)
