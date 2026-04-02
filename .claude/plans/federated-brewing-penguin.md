# Phase 4A: Contextual Decision Tracking

## Context

Backlog Item 21.4a (P1). The decision accumulator currently builds situation keys as `{street}:{texture}:{posCategory}:{action}` — 4 dimensions. This loses critical context:

- **Who was the aggressor?** A c-bet into a dry board is fundamentally different from a donk bet. The current key treats them identically as `flop:dry:CO:bet`.
- **IP or OOP?** Betting OOP as the aggressor (c-bet) is standard; betting OOP as non-aggressor (donk) is a leak signal.
- **What action was faced?** Calling a bet vs calling a raise are different decisions with different EV implications.

Without this context, the weakness detector produces noisy results — flagging "c-bets unprofitably on wet boards" when the player was actually making a donk bet (different strategy entirely).

Phase 4B (villain decision model) depends on these richer keys.

## Files to Modify

| File | Action | Scope |
|------|--------|-------|
| `src/utils/exploitEngine/decisionAccumulator.js` | MODIFY | Expand key format, derive context per action |
| `src/utils/exploitEngine/weaknessDetector.js` | MODIFY | Update situational rules to use new context fields |

**NOT modified:** `primitiveActions.js` (already has all needed types), `analysisPipeline.js` (no API change), `weaknessDetector.js` preflop rules (aggregate-based, unchanged).

## Key Design: Expanded Situation Keys

### Current (v1)
```
"{street}:{texture}:{posCategory}:{action}"
Example: "flop:wet:CO:bet"
```

### New (v2)
```
"{street}:{texture}:{posCategory}:{isAggressor}:{isIP}:{facingAction}:{contextAction}"
```

**New dimensions:**
- `isAggressor`: `'agg'` | `'def'` — was this player the preflop aggressor (or last street's aggressor)?
- `isIP`: `'ip'` | `'oop'` — relative position vs the primary opponent on this street
- `facingAction`: `'none'` | `'bet'` | `'raise'` — what action was this player responding to?
- `contextAction`: derived meta-action (replaces raw primitive):
  - Aggressor, first to act: `'cbet'` or `'check_give_up'`
  - Non-aggressor, first to act: `'donk'` or `'check'`
  - Checked to (IP): `'stab'` or `'check_back'`
  - Facing a bet: `'call'`, `'raise'`, `'fold'`
  - Facing a raise: `'call_raise'`, `'reraise'`, `'fold_to_raise'`

**Example keys:**
- `"flop:wet:CO:agg:ip:none:cbet"` — CO was PF aggressor, in position, c-bets wet flop
- `"flop:dry:BB:def:oop:bet:call"` — BB defends OOP, calls a bet on dry flop
- `"turn:medium:BTN:agg:ip:raise:fold_to_raise"` — BTN was aggressor, IP, folds to a raise on turn

## Implementation Steps

### Step 1: Add context derivation helpers to `decisionAccumulator.js`

Add two internal helpers above the main function:

**`deriveStreetAggressor(timeline, street, preflopAggSeat)`:**
- For flop: aggressor = preflop raiser (the "PF aggressor" who has c-bet initiative)
- For turn/river: aggressor = last player who bet or raised on the previous street
- Returns seat number or null

**`deriveContextAction(primitiveAction, isAggressor, isFirstToAct, facingAction)`:**
Maps the raw primitive + context to a semantic meta-action:
```
isAggressor + first to act + bet → 'cbet'
isAggressor + first to act + check → 'check_give_up'
!isAggressor + first to act + bet → 'donk'
!isAggressor + first to act + check → 'check'
checked-to (IP) + bet → 'stab'
checked-to (IP) + check → 'check_back'
facing bet + call → 'call'
facing bet + raise → 'raise'
facing bet + fold → 'fold'
facing raise + call → 'call_raise'
facing raise + raise → 'reraise'
facing raise + fold → 'fold_to_raise'
```

### Step 2: Expand the main accumulation loop

Inside the `for (const entry of playerActions)` loop (line 84), BEFORE building the situationKey:

1. **Determine aggressor** — call `deriveStreetAggressor()` for current street
2. **Determine IP/OOP** — scan timeline for primary opponent on this street, call `isInPosition(playerSeat, oppSeat, buttonSeat)`
3. **Determine facingAction** — scan backwards on current street for last bet/raise before this action
4. **Determine isFirstToAct** — check if any non-fold/non-check action happened before this entry on this street
5. **Derive contextAction** — call `deriveContextAction()`
6. **Build expanded key** — `buildSituationKey(street, texture, posCategory, isAgg, isIP, facingAction, contextAction)`

### Step 3: Expand bucket data

Add new fields to each bucket:
```js
{
  ...existingFields,
  isAggressor: 'agg' | 'def',
  isIP: 'ip' | 'oop',
  facingAction: 'none' | 'bet' | 'raise',
  contextAction: string,  // the derived meta-action
}
```

### Step 4: Update `buildSituationKey` signature

```js
export const buildSituationKey = (street, texture, posCategory, isAgg, isIP, facingAction, contextAction) => {
  return `${street}:${texture}:${posCategory}:${isAgg}:${isIP}:${facingAction}:${contextAction}`;
};
```

### Step 5: Update weakness detector rules

The 5 situational rules in `runSituationalRules` need to filter on the new context:

**Rule: C-bets unprofitably on wet boards**
- Old filter: `texture === 'wet' && (action === 'bet' || action === 'raise')`
- New filter: `texture === 'wet' && contextAction === 'cbet'`
- This now correctly targets only c-bets, excluding donk bets and stabs

**Rule: Checks too much on dry boards**
- Old: `texture === 'dry' && action === 'check'`
- New: `texture === 'dry' && isAggressor === 'agg' && contextAction === 'check_give_up'`
- Now only flags aggressor giving up, not defender checking (which is often correct)

**Rule: Over-calls on the river**
- Old: `street === 'river' && action === 'call'`
- New: `street === 'river' && (contextAction === 'call' || contextAction === 'call_raise')`
- No change in behavior, just uses new field name

**Rule: Over-folds on flop/turn**
- Old: `(street === 'flop' || street === 'turn') && action === 'fold'`
- New: `(street === 'flop' || street === 'turn') && (contextAction === 'fold' || contextAction === 'fold_to_raise')`
- Same behavior, new field

**Rule: Never raises with strong hands**
- Old: `action === 'raise'` / `action === 'bet' || action === 'call'`
- New: `contextAction === 'raise' || contextAction === 'reraise'` / corresponding bet/call contexts
- Same detection, more precise filtering

### Step 6: Add new weakness rules (enabled by context)

Two new rules that were impossible without context:

**`sit-donks-without-equity`:** Non-aggressor bets (donk) with air-heavy range
- Filter: `contextAction === 'donk' && occurrences >= MIN_SITUATIONAL_SAMPLE`
- Trigger: `valuePct < 30 && airPct > 40`
- Exploit: "Donk bets without equity — raise to fold them out"

**`sit-never-cbets`:** Aggressor checks every flop (always gives up initiative)
- Filter: `isAggressor === 'agg' && contextAction === 'check_give_up'`
- Aggregate: count check_give_up vs cbet occurrences for aggressor
- Trigger: check_give_up rate > 70% across 8+ actions
- Exploit: "Rarely c-bets — take free cards, bet when they check"

## New Imports Needed

In `decisionAccumulator.js`:
```js
import { isInPosition } from '../positionUtils';
import { findLastRaiser, getStreetTimeline } from '../handAnalysis/handTimeline';
```

## Backward Compatibility

- The `buckets` object shape grows (more keys, new fields per bucket) but the consuming API stays the same
- `weaknessDetector.js` consumes `Object.values(buckets)` and filters — all existing filters still work because the new fields are additive
- `analysisPipeline.js` passes `decisionSummary` through unchanged — no API change
- Tests need updating for new key format and new bucket fields

## Performance

- Each action requires a backward scan of the street's timeline: O(actions_on_street)
- Typical hand has ~8-12 postflop actions across 2-3 streets
- Total cost: O(n × avg_street_actions) ≈ O(n × 4) — negligible
- IP/OOP: O(1) via `isInPosition()`

## Verification

1. `bash scripts/smart-test-runner.sh` — all tests pass
2. Check that existing weakness rules still fire with adequate data
3. Verify new situation keys in debug output contain context dimensions
4. Verify new rules (`sit-donks-without-equity`, `sit-never-cbets`) fire with appropriate test data
