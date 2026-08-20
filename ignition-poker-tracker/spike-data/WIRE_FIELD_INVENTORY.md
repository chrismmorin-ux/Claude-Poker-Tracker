# Ignition Wire Field Inventory — MEASURED FROM REAL CAPTURES

Generated 2026-08-16 from 4 real capture sessions (25,458 game frames).
Source files: `ignition-poker-tracker/spike-data/captures/*.jsonl` (gitignored — contain unscrubbed hero account id).
Regenerate: `node scripts/wire-inventory.mjs ignition-poker-tracker/spike-data/captures/*.jsonl`

This SUPERSEDES the hand-written field lists in SPIKE_REPORT.md, which were a summary of
fields the author chose to use, not a field dump. The spike never asked the identity question.

## Headline: opponent anonymity is MEASURED, not assumed

Ignition transmits a `nickName` field on `PLAY_SEAT_INFO` for every seat.
Across 25,458 game frames / 4 sessions / 86 PLAY_SEAT_INFO rows, the ONLY populated
value is the hero account id (confirmed identical to `CONNECT_LOGIN_INFO.nickName`).
Every villain seat carries `nickName: ""` in every observed state (16/32/4) and both types.

Therefore: **villain identity is genuinely absent at the source. Not a parsing gap.**
Seat number is the only available handle, which makes seat-turnover detection load-bearing.

## Full inventory

```
game frames parsed: 25458 

=== GAME PIDs (count) — keys ===

PLAY_TIME_INFO  x1477
  pid, time

CO_CURRENT_PLAYER  x1475
  pid, seat

CO_SELECT_INFO  x1380
  account, bet, btn, pid, raise, seat
  >>> IDENTITY-SHAPED: account

CO_TABLE_STATE  x729
  pid, tableState

PONG  x550
  pid, uuid
  >>> IDENTITY-SHAPED: uuid

CO_DEALER_SEAT  x333
  pid, seat

CO_SELECT_SPEED_BTN  x294
  bet, btns, call, pid, raise, selected

CO_CHIPTABLE_INFO  x278
  curPot, curRake, pid, potCount, returnBet, seat

CO_BLIND_INFO  x241
  account, baseStakes, bet, btn, dead, pid, seat
  >>> IDENTITY-SHAPED: account

PLAY_STAGE_INFO  x232
  pid, stageNo

CO_SELECT_REQ  x206
  bet, betPot, btns, halfPot, maxRaise, pid, raise, timeBank

CO_SIT_PLAY  x205
  pid, play, seat

LATENCY_REPORT  x180
  id, nsDuration, pid

CO_SHOW_INFO  x127
  btn, pid, seat

PLAY_STAGE_END_REQ  x112
  pid

CO_RESULT_INFO  x111
  account, handHi1, handHi2, handHi3, handHi4, handHi5, handHi6, handHi7, handHi8, handHi9, pid
  >>> IDENTITY-SHAPED: account

CO_POT_INFO  x111
  kicker, kickerCard, pid, potNo, returnHi, returnLo

PLAY_CLEAR_INFO  x111
  pid

CO_CARDTABLE_INFO  x110
  pid, seat1, seat2, seat3, seat4, seat5, seat6, seat7, seat8, seat9

PLAY_ACCOUNT_INFO  x100
  account, pid
  >>> IDENTITY-SHAPED: account

CO_LAST_HAND_NUMBER  x96
  pid, stageNo

CO_BCARD1_INFO  x94
  card, pid, pos

PLAY_SEAT_INFO  x86
  account, nickName, pid, seat, state, type
  >>> IDENTITY-SHAPED: account, nickName

CO_BCARD3_INFO  x82
  bcard, pid

CO_CARDHAND_INFO  x72
  CardHi, CardLo, bEnableHi, bEnableLo, pid, seat, type

PLAY_ACCOUNT_CASH_RES  x60
  cash, pid, seat, type

CO_PCARD_INFO  x50
  card, pid, seat, type

CO_PRESELECT_BLINDS  x48
  amountToPost, pid

CO_RABBITCARD_INFO  x48
  card, pid, pos

CO_SHOW_BTN  x33
  pid, show

SYS_MSG_V2  x33
  chat, pid, seat

PLAY_SEAT_RESERVATION  x31
  add, pid, seat

SYS_INFO  x23
  data, dwData, pid, type

CO_SHOW_REQ  x20
  btns, pid

CO_OPTION_INFO  x10
  bblind, gameType, gameType2, hiLow, maxSeat, maxStakes, minStakes, pid, real, sblind

CO_TABLE_INFO  x10
  account, bcard, curPot, curRake, currentSeat, dealerSeat, lockSeat, pbet, pcard1, pcard2, pcard3, pcard4, pcard5, pcard6, pcard7, pcard8, pcard9, pid, potCount, seatState, tableState, time, totalpot
  >>> IDENTITY-SHAPED: account

PLAY_BUYIN_INFO  x10
  account, allowedMax, allowedMin, defaultBuyin, displayMax, displayMin, pid, seat, type
  >>> IDENTITY-SHAPED: account

CO_ALLIN_SEAT_INFO  x4
  allinSeats, pid

PLAY_TIMEBANK_USE_RES  x1
  pid, seat, time, type

PLAY_STATUS_INFO  x1
  bData, dwData, pid, status, type

CO_LOCK_INFO  x1
  bLock, pid, seat, time

CO_SELECT_SPEED_INFO  x1
  account, bet, btn, firstSeat, pid, raise
  >>> IDENTITY-SHAPED: account


=== LOBBY/OTHER top-level message types ===
seq: 
tDiff: 
data: 0, 0.nickName, 0.pid, 1, 1.pid, 1.tableNo, 2, 2.pid, gid
TOURNAMENT_ENROLLMENTS_UPDATE: enrollments, timestamp, tournamentId
TOURNAMENT_DELETE: timestamp, tournamentNo
PONG: 
TOURNAMENT_STATUS_UPDATE: status, timestamp, tournamentId
TOURNAMENT_ADD: timestamp, tournament, tournament.buyin, tournament.buyinAmount, tournament.buyinFeeAmount, tournament.buyinMethod, tournament.canUseTicket, tournament.color, tournament.featuredIndex, tournament.gameFormat, tournament.gameType, tournament.isBold, tournament.isFeaturedTournament, tournament.isItalic, tournament.isJackpotSng, tournament.isRegistered, tournament.isShootout, tournament.isSingleTable, tournament.lateRegistrationEnd, tournament.limit, tournament.maxPlayers, tournament.playMode, tournament.players, tournament.pointAmount, tournament.seats, tournament.start, tournament.status, tournament.tournamentId, tournament.tournamentName, tournament.tournamentType
AUTH_RESULT: internalToken, metadata, metadata.traceparent
FEATURED_TOURNAMENTS_FOR_BRAND_UPDATE: featuredTournaments, featuredTournaments[].featuredIdx, featuredTournaments[].tournamentId, timestamp
```

## nickName evidence

```
PLAY_SEAT_INFO rows: 86

distinct nickName values: 2
["<HERO_ACCOUNT_ID_REDACTED>",""]

distinct account values: 21

--- first 30 rows ---
2026-06-14 conn=685001 seat=2 nick="<HERO_ACCOUNT_ID_REDACTED>" acct=0 state=16 type=1
2026-06-14 conn=685001 seat=6 nick="" acct=1657 state=32 type=0
2026-06-14 conn=685001 seat=9 nick="" acct=1962 state=32 type=1
2026-06-14 conn=685001 seat=3 nick="" acct=0 state=16 type=1
2026-06-14 conn=685001 seat=9 nick="" acct=0 state=16 type=0
2026-06-14 conn=685001 seat=5 nick="" acct=0 state=16 type=0
2026-06-15 conn=384001 seat=1 nick="<HERO_ACCOUNT_ID_REDACTED>" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=5 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=7 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=5 nick="" acct=0 state=16 type=0
2026-06-15 conn=384001 seat=4 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=6 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=3 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=5 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=5 nick="" acct=1890 state=32 type=1
2026-06-15 conn=384001 seat=5 nick="" acct=1890 state=32 type=0
2026-06-15 conn=384001 seat=6 nick="" acct=0 state=16 type=0
2026-06-15 conn=384001 seat=6 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=5 nick="" acct=0 state=16 type=0
2026-06-15 conn=384001 seat=3 nick="" acct=0 state=32 type=1
2026-06-15 conn=384001 seat=3 nick="" acct=750 state=32 type=0
2026-06-15 conn=384001 seat=5 nick="" acct=0 state=16 type=1
2026-06-15 conn=384001 seat=1 nick="<HERO_ACCOUNT_ID_REDACTED>" acct=1653 state=4 type=1
2026-06-15 conn=384001 seat=1 nick="<HERO_ACCOUNT_ID_REDACTED>" acct=1653 state=4 type=0
2026-06-15 conn=497001 seat=8 nick="<HERO_ACCOUNT_ID_REDACTED>" acct=0 state=16 type=1
2026-06-15 conn=497001 seat=7 nick="" acct=0 state=16 type=1
2026-06-15 conn=497001 seat=9 nick="" acct=0 state=16 type=0
2026-06-15 conn=497001 seat=1 nick="" acct=0 state=16 type=0
2026-06-15 conn=497001 seat=9 nick="" acct=0 state=16 type=1
2026-06-15 conn=497001 seat=9 nick="" acct=675 state=32 type=1

--- same nick across different seats? ---
"<HERO_ACCOUNT_ID_REDACTED>" -> seats 2,1,8,3,5
"" -> seats 6,9,3,5,7,4,1,2
```
