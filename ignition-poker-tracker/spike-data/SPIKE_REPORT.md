# Sprint 1 Spike Report: Ignition Casino Protocol Analysis

**Date**: 2026-03-21
**Conclusion**: **WebSocket is the clear winner.** The protocol is clean, structured JSON. DOM scraping is unnecessary for game state.

## Architecture

- **Poker table**: PixiJS canvas rendering (React + MobX state). No HTML DOM for cards/actions.
- **Lobby**: Angular HTML at `/poker-lobby/`
- **Game client**: React app at `/static/poker-game/`
- **Action buttons**: HTML DOM (outside canvas) — could be used for supplemental capture but WebSocket is sufficient

## WebSocket Connection

- **Game**: `wss://pkscb.ignitioncasino.eu/poker-games/rgs` (Atmosphere v3.1.5)
- **Lobby**: `wss://pkscb.ignitioncasino.eu/ws-gateway/lobby` (Atmosphere v3.1.3)
- **Format**: `<byte_length>|<JSON>` (incoming), raw JSON (outgoing)
- **Game messages wrapped**: `{"seq":<n>,"tDiff":<ms>,"data":{"pid":"<MSG_TYPE>",...}}`

## Card Encoding

**0-51 integer**: `rank = card % 13`, `suit = floor(card / 13)`

**CORRECTED**: Ace-low ordering (rank 0 = Ace, NOT 2)

| Range | Suit | Rank 0-12 maps to |
|-------|------|-------------------|
| 0-12 | Clubs | A,2,3,4,5,6,7,8,9,T,J,Q,K |
| 13-25 | Diamonds | same |
| 26-38 | Hearts | same |
| 39-51 | Spades | same |

**Face-down** = `32896` (0x8080)

## Action Encoding (bitmask)

| btn value | Action |
|-----------|--------|
| 64 (0x40) | CHECK |
| 128 (0x80) | BET |
| 256 (0x100) | CALL |
| 512 (0x200) | RAISE |
| 1024 (0x400) | FOLD |

## Street Transitions (CO_TABLE_STATE)

| Value | Phase |
|-------|-------|
| 2 | New hand setup |
| 4 | Posting blinds |
| 8 | Preflop |
| 16 | Flop |
| 32 | Turn |
| 64 | River |
| 32768 | Showdown |
| 65536 | Results |

## Hand Lifecycle (message sequence)

```
PLAY_STAGE_INFO          → new hand number (stageNo)
PLAY_CLEAR_INFO          → clear table
CO_DEALER_SEAT           → button position
CO_TABLE_STATE(4)        → posting blinds
CO_BLIND_INFO ×N         → blind amounts + stacks
CO_TABLE_STATE(8)        → preflop
CO_CARDTABLE_INFO        → hole cards (hero visible, others 0x8080)

[Per street: CO_TABLE_STATE → board cards → action loop]
  Action loop:
    CO_CURRENT_PLAYER    → seat to act
    PLAY_TIME_INFO       → timer
    CO_SELECT_REQ        → hero prompt (if hero's turn)
    CO_SELECT_RES_V2     → hero's action (outgoing)
    CO_SELECT_INFO       → result of action (all players)

CO_CHIPTABLE_INFO        → pot after each street
CO_TABLE_STATE(32768)    → showdown
CO_PCARD_INFO            → revealed cards
CO_SHOW_INFO             → show/muck
CO_TABLE_STATE(65536)    → results
CO_RESULT_INFO           → final stacks + best hands
CO_POT_INFO              → pot distribution
PLAY_STAGE_END_REQ       → hand complete
```

## Key Message Payloads

### CO_CARDTABLE_INFO (hole cards)
```json
{"seat1":[32896,32896],"seat2":[32896,32896],"seat5":[20,38]}
```

### CO_BCARD3_INFO (flop)
```json
{"bcard":[39,21,13]}
```

### CO_BCARD1_INFO (turn/river)
```json
{"pos":4,"card":6}   // pos=4 turn, pos=5 river
```

### CO_SELECT_INFO (action taken)
```json
{"seat":3,"btn":128,"bet":100,"raise":0,"account":900}
```

### CO_BLIND_INFO
```json
{"seat":9,"account":988,"btn":2,"bet":5,"dead":0}
```
btn: 2=SB, 4=BB, 8=posted blind

### CO_RESULT_INFO
```json
{"account":[458,307,900,1076,1000,875,1627,1720,993],"handHi7":[1,4,0,5,6]}
```

### CO_POT_INFO
```json
{"potNo":0,"returnHi":[0,0,0,0,0,0,119,0,0],"returnLo":[0,0,0,0,0,0,0,0,0]}
```

### CO_PCARD_INFO (showdown reveal)
```json
{"type":0,"seat":9,"card":[51,48]}
```

### CO_SHOW_INFO
```json
{"seat":9,"btn":8192}   // 0x2000 = show
{"seat":8,"btn":32768}  // 0x8000 = muck
```

## Amounts

All monetary values in **cents** (integer). $0.05/$0.10 table: SB=5, BB=10.

## Hero Identification

Hero identified by:
- Receiving `CO_SELECT_REQ` (action prompts only sent to hero)
- Real card values in `CO_CARDTABLE_INFO` (others get 0x8080)
- `CO_SIT_PLAY` seat reference

## Outgoing Messages

Hero actions sent as:
```json
{
  "transparentId": "<trace-uuid>",
  "transactionName": "poker-frontend-game-actions-fold-latency",
  "message": {
    "pid": "CO_SELECT_RES_V2",
    "type": 1,
    "state": 8,
    "btn": 1024,
    "bet": 0,
    "x": 504, "y": 748,
    "time": 45
  }
}
```

## Corrections from Sprint 2 Implementation

- **Card rank ordering**: Ace-low (0=A, 1=2, ..., 12=K), NOT 0=2
- **CO_TABLE_STATE payload key**: `tableState` (not `state`)
- **CO_TABLE_INFO**: Full table snapshot on join/reconnect (dealerSeat, tableState, account[], pcard*, bcard)
- **CO_OPTION_INFO**: Table config (bblind, sblind, gameType, maxSeat)
- **PLAY_STAGE_INFO duplicate**: Fires twice per hand (start + echo after end) — must deduplicate by stageNo
- **Additional PIDs discovered**: CO_TABLE_INFO, CO_OPTION_INFO, PLAY_SEAT_INFO, PLAY_BUYIN_INFO, CO_SHOW_REQ, CO_PRESELECT_BLINDS, SYS_INFO, SYS_MSG_V2, CO_SHOW_BTN, PLAY_ACCOUNT_CASH_RES, PLAY_SEAT_RESERVATION

## Sprint 2 Implications

1. **WebSocket-only capture** — no DOM scraping needed for game state
2. **Filter by URL**: only capture from `wss://pkscb.ignitioncasino.eu/poker-games/rgs`
3. **Parse format**: split on first `|`, parse JSON, extract `data.pid` for routing
4. **Card decoder**: rank = n % 13 with Ace-low ordering [A,2,3,...,K], suit = floor(n / 13)
5. **Action decoder**: bitmask mapping (64→check, 128→bet, etc.)
6. **State machine**: track CO_TABLE_STATE transitions (key: `tableState`, not `state`)
7. **Hero detection**: seat that receives CO_SELECT_REQ or has real cards in CO_CARDTABLE_INFO
8. **Amounts in cents**: divide by 100 for dollar display
