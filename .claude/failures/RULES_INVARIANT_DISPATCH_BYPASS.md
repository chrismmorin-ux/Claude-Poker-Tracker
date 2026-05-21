# RULES_INVARIANT_DISPATCH_BYPASS

**Status:** RESOLVED 2026-05-13 (SPR-075) — primitive-level structural enforcement shipped. CHECK-while-owing is now structurally unrepresentable: no caller passes the `'check'` string into RECORD_PRIMITIVE_ACTION through the WS-182 funnel. Failure pattern preserved as a doctrine reference; see "Implementation status" below for what shipped and "Prevention" for the generalized doctrine derived from the incident.

## Implementation status (2026-05-13, SPR-075)

The primitive-collapse approach defined under "Fix" below was implemented in full:

- `src/utils/recordSeatAction.js` ships as the canonical pure builder. `buildSeatActionPayload(gameStateView, seat, intent)` returns a `RECORD_PRIMITIVE_ACTION` payload where the LABEL is derived from intent + state. `intent ∈ 'fold' | 'match' | { raiseTo: number }`.
- `useGameHandlers.recordSeatAction(seat, intent)` wraps the util with current game-state closure + dispatch. Existing showdown helper renamed `recordShowdownAction` (it dispatches `RECORD_SHOWDOWN_ACTION` for MUCKED/WON — distinct surface).
- Production callers migrated: `useGameHandlers.checkAround/restFold/foldToInvested`, `CommandStrip.handleRecordAction/handleSizeSelected/handleOrbitTap`. No production code passes the `'check'` string anymore.
- Tests: 22 new unit tests in `src/utils/__tests__/recordSeatAction.test.js` pin the (intent, gameState) → label derivation. Anchor test ("IS the WS-182 anchor — CHECK-while-owing is structurally unrepresentable") proves SB on a limped preflop cannot produce a CHECK by any path through the funnel.
- Invariant: **INV-RULES-CONTRIBUTION** added to `system/invariants.md` 2026-05-13.
- Fixture migration: per owner D4 ("Migrate ALL fixtures"), production hook/integration tests now go through the funnel; reducer-internal tests (gameReducer, GameContext recordPrimitiveAction helper, raw-payload integration tests) carry `NEED_BYPASS` headers per accept criterion #7 — they verify reducer robustness against malformed payloads that the funnel refuses to construct by design.
- `GameContext.recordPrimitiveAction` retained as legacy/test-only raw passthrough with a deprecation note pointing at the WS-182 funnel.

## Pattern

The app has two layers that decide whether an action is legal:

1. **UI render layer** — `src/utils/actionUtils.js:103-111` `getValidActions(street, hasBet, isMultiSeat)` returns the legal primitive actions for a given seat-state. `CommandStrip.jsx` consumes this to decide which buttons render. The 47-row Invariant Coverage Program matrix (`actionInvariants.fixture.js`) pins this layer's behavior.

2. **Dispatch layer** — `gameReducer.RECORD_PRIMITIVE_ACTION` is the single funnel for recording any action into game state. The reducer trusts its caller. **There is no validation at the dispatch boundary.**

The UI render layer is correct. The dispatch layer is unprotected.

Any caller that dispatches `RECORD_PRIMITIVE_ACTION` without first routing through `getValidActions` can record an illegal action. The reducer will accept it. Downstream consumers (potCalculator, exploitEngine, rangeEngine, replay) will produce nonsense from poisoned state.

## Symptoms

**Owner-observed 2026-05-11:** SB was allowed to CHECK preflop while owing chips to the pot. This violates the most basic poker rule (no free play when you owe money). The recorded `actionSequence` carried an illegal CHECK; the pot calculator + advisor downstream read that state as if it were valid.

**Confirmed code path:**

`src/hooks/useGameHandlers.js:233-243`:

```js
const checkAround = useCallback(() => {
  const remaining = getRemainingSeats();
  remaining.forEach(seat => {
    dispatchGame({
      type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
      payload: { seat, action: 'check' },
    });
  });
  return remaining.length;
}, [getRemainingSeats, dispatchGame]);
```

`checkAround` records `action: 'check'` for every remaining seat. No per-seat legality check. If SB is in the remaining set on preflop (limped pot routed back to SB), SB's CHECK is dispatched and accepted.

`restFold` (lines 220-231) is structurally identical but safe by accident: FOLD is always legal, so the lack of per-seat check doesn't cause invariant violation. The pattern is the same — only the action constant differs.

## Other surfaces with the same bypass risk

Grep `RECORD_PRIMITIVE_ACTION` — every dispatch site is a potential bypass. Inventory (per WS-182 acceptance criteria):

- `CommandStrip.jsx` primary action recording (routes through `getValidActions` → safe)
- `useGameHandlers.checkAround` → **BUG**
- `useGameHandlers.restFold` → safe (FOLD always legal)
- Future voice / automation paths (WS-181 VCE if it ever dispatches game actions; today it only handles cards)

## Root cause

**The Invariant Coverage Program (ICP) asserts the wrong layer.** The 47-row matrix at `actionInvariants.fixture.js` pins which buttons render — i.e., the UI-render contract. It does not pin which dispatches are legal — i.e., the reducer-input contract. The two contracts are different:

| Layer | Question | Spec | Today |
|-------|----------|------|-------|
| UI render | "For seat S in state X, which buttons appear?" | 47-row matrix | Pinned ✅ |
| Dispatch | "For seat S in state X, which RECORD_PRIMITIVE_ACTION payloads are legal?" | None | Unpinned ❌ |

A composite invariant — "every dispatched action must satisfy the render-layer's legality predicate for the seat's current state" — has never been asserted. Batch paths (`checkAround`, `restFold`) and any future automation that bypasses the button-rendering UI evade the render-layer assertion entirely.

Compare to `.claude/failures/TABLEVIEW_INVARIANT_GAP.md` "Spec without pin = drift" — same pattern, different layer.

## Fix (tracked under WS-182)

**Reframed 2026-05-12** per owner: *"The primitives here are $ in a pot, bets must be matched to be in a hand. A check being available when you haven't matched the bet should be impossible at the primitive level."*

The fix is at the primitive level, not the dispatch boundary. Make illegal payloads structurally **unrepresentable** rather than dispatched-then-rejected.

1. **Collapse the recording API to a single intent-typed funnel.**

   ```js
   recordSeatAction(seat, intent)
   // intent: 'fold' | 'match' | { raiseTo: number }
   ```

   - `'fold'` → always legal except at showdown → emits FOLD label.
   - `'match'` → reads `amountOwed(seat)`. If 0 → emits CHECK. If > 0 → emits CALL with computed amount. **CHECK-while-owing is structurally unrepresentable — there is no `'check'` string to pass; only `'match'`, which always does the right thing.**
   - `{ raiseTo: N }` → asserts `N > currentBet`. Auto-classifies as BET (currentBet=0) or RAISE (currentBet>0). Illegal sizings rejected at the function signature.

2. **PRIMITIVE_ACTIONS string constants are preserved.** They remain in the `actionSequence` records, advisor outputs, hand-history rendering — but they become **derived outputs** of the recording API, not free-floating inputs callable from anywhere. The label is a function of (intent, seatContribution, currentBet); it can't drift from reality.

3. **Migrate every caller of `RECORD_PRIMITIVE_ACTION`.** `useGameHandlers.checkAround` becomes:

   ```js
   remaining.forEach(seat => recordSeatAction(seat, 'match'));
   ```

   SB automatically resolves to CALL because `amountOwed(SB) > 0` preflop in a limped pot. The "match" intent does the right thing for every seat, by construction.

4. **The reducer-level validator I proposed in the prior draft is no longer needed.** With the primitive collapse, illegal payloads cannot be constructed. Defense-in-depth via reducer rejection would be a layer protecting against a payload shape that doesn't exist.

5. **Invariant: INV-RULES-CONTRIBUTION** — "No seat may register a contribution less than `amountOwed(seat)` on any street unless the contribution closes the seat for that street (fold or all-in)." Caught by the primitive's signature; documented in `system/invariants.md`.

6. **The 47-row ICP render-layer matrix stays.** It asserts which buttons render — UI correctness. The dispatch-layer matrix I had proposed in the prior draft is not authored; the primitive collapse makes it unnecessary.

**What's NOT in this fix:** existing `PRIMITIVE_ACTIONS` constant set, the action labels emitted into `actionSequence`, downstream consumers (`potCalculator`, `exploitEngine`, replay). All preserved. Only the recording API shape changes.

## Prevention

- **Prefer unrepresentable to validated.** The first instinct on seeing an illegal payload accepted is to validate-and-reject. The better instinct is to ask whether the illegal payload should be **representable at all**. If callers can pair any action string with any seat, the type system permits the bug. If callers can only express intent (`fold | match | raiseTo:N`) and the recording API derives the label from state, the bug is type-impossible.

- **Labels as outputs, not inputs.** Whenever the same word appears both as a "what the user picked" input AND as a "what gets recorded" output, audit whether the input form needs the same expressiveness as the output form. Often it doesn't — and shrinking the input set eliminates a class of bugs without losing output fidelity. (Parallel to `feedback_first_principles_decisions.md` — labels are derived, not chosen.)

- **The reducer is a funnel, not a guard.** Reducers mutate state from validated inputs. They are not the right place to repair shapes the call site got wrong — that ratchets up complexity at the wrong layer. Shape the inputs at construction time.

- **Audit principle: grep every dispatch funnel.** For each reducer action, list every site that produces it. If multiple call sites can construct the same payload type with different inputs, that's a signal that the payload type may be too expressive. A single typed funnel is usually the right answer.

- **What ICP got right and what it didn't:** The 47-row render-layer matrix is correct and load-bearing for the render contract — keep it. But matrices assert behavior, not representability. A render matrix can show that the right buttons appear; it cannot prevent a non-button code path from constructing an illegal payload. Representability is the type system's job — not the matrix's.

## Related

- WS-182 — fix this class
- WS-001 / WS-002 / WS-003 — Invariant Coverage Program (ICP) origin (render layer)
- `.claude/failures/TABLEVIEW_INVARIANT_GAP.md` — sibling failure pattern (render layer)
- `.claude/context/INVARIANT_MATRIX_PATTERN.md` — pattern doc to be updated
- New memory `feedback_action_dispatch_legality.md` — the doctrine derived from this failure
