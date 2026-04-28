# Domain Heuristics — Poker Live Table

Heuristics specific to *using an app at a real live poker table*. These compose with Nielsen's 10 but are invented specifically for this app's context. They exist because general usability frameworks don't capture the particular constraints of live poker: darkness, one-handedness, social conspicuousness, and time pressure.

Reference IDs: `H-PLT01` through `H-PLT08`.

---

## H-PLT01 — Sub-second glanceability for primary recommendations

The primary recommendation ("fold / call / raise to X") must be readable in the time between peeking at cards and looking back at the dealer. Target: ≤ 500 ms.

**Implications for surfaces:**
- Primary action is visually the largest or most contrasty element.
- Position on screen is consistent across hands — don't move it based on sizing.
- No animation or reflow while the user is looking at it.

**Violated when:**
- The user has to scan multiple cards or lines to find the rec.
- The rec is fresh but the user can't tell because staleness indication is ambiguous.

---

## H-PLT02 — One-handed thumb reachability for in-hand actions

In landscape, one-handed grip puts the thumb in an arc biased toward one side of the screen. All in-hand actions (anything from [Mid-Hand Chris](../personas/situational/mid-hand-chris.md)) must be reachable without re-gripping.

**Implications for surfaces:**
- Primary taps go in the reachable quadrant (right-thumb-biased on right-handed users; mirror symmetry possible).
- Secondary taps can reach the center.
- Left edge of landscape is low-priority real estate for in-hand actions.
- Modal dismissal should accept any corner-of-screen tap or a swipe-down.

**Violated when:**
- A mid-hand action lives on the opposite side of the thumb arc.
- A modal's close button is in the corner farthest from the thumb.

---

## H-PLT03 — Dim-light readable

Poker rooms are often dim. Contrast and font weight must survive low ambient light + screen brightness the user may deliberately lower to be less conspicuous.

**Implications for surfaces:**
- Dark-mode-first design. Light-mode is optional.
- No sub-4.5:1 contrast ratios on primary text.
- Color-only distinctions fail — use shape, weight, and position alongside color.

**Violated when:**
- Badge text relies on a pale color against a slightly-less-pale background.
- State indicators (e.g., active-filter) use only a color change.

---

## H-PLT04 — Socially discreet

Taking notes on opponents is legal but socially delicate. Any visual signature that clearly says "I am tracking you" is a cost. The app should be indistinguishable at a glance from checking a text or a score.

**Implications for surfaces:**
- Avoid flashing or pulsing indicators that draw eyes.
- Player feature picking should not look like a mugshot builder from across the table.
- Batch mode shouldn't produce conspicuous visual state (e.g., a seat-highlight across the whole table UI).
- Audio feedback is off by default.

**Violated when:**
- Bright pulsing "YOU ARE IN BATCH MODE" banner is visible across the table.
- Avatar construction screen has obvious-at-a-glance human features.

---

## H-PLT05 — Phone-sleep-safe

Phones sleep. Users get distracted. Users bring the phone down below the rail to hide the screen. Unlocking and returning should restore exactly the previous state — no progress loss, no confusion.

**Implications for surfaces:**
- Drafts autosave aggressively.
- In-progress modals restore to their exact state post-unlock.
- Advice freshness is re-evaluated on focus — stale becomes stale, fresh stays fresh.
- No timers that reset on unlock (unless the reset is the correct behavior, e.g., a 5s undo window).

**Violated when:**
- A half-entered form clears on unlock.
- State inferred from `document.hidden` events isn't restored.

---

## H-PLT06 — Zero-cost misclick absorption for high-frequency actions

The most common interactions happen dozens of times per session. A misclick rate of 5% on a 30/session action is 1.5 cleanup events per session. High-frequency actions should have zero-cost undo or be ambiguously-destructive-proof by design.

**Implications for surfaces:**
- Clear Player should have undo.
- Tapping the wrong seat's context menu should be cancellable by tapping outside without side effects.
- Bet size inputs that use tap-and-step should accept easy step-down on overshoot.

**Violated when:**
- Clear Player commits without undo.
- A miss-tap on the picker selects the wrong player with no easy back-path to the picker without losing the player-was-assigned state.

---

## H-PLT07 — State-aware primary action

What the primary action *should* be depends on the current state of the target. A seat-context menu opened on an *empty seat* has a different primary action than the same menu on an *occupied seat*.

**Implications for surfaces:**
- Context menus reorder or re-weight actions based on target state.
- Visual primacy (color, position, size) reflects state.
- Don't show actions that don't apply to the current state (PEO-3 correctly hides Clear on empty seats).

**Violated when:**
- Menu order is fixed regardless of target state.
- "Common for setup" actions sit above "common for teardown" actions even on teardown-heavy surfaces.

**This heuristic is the most relevant to the 2026-04-21 context-menu issue.**

---

## H-PLT08 — No-interruption input

The user may be interrupted at any moment by the dealer, another player, or a phone call. Any surface that can be interrupted must preserve its state across interruption.

**Implications for surfaces:**
- Forms autosave.
- Multi-step flows remember where the user was.
- Navigation-away preserves draft / selection / search query.
- Re-entering the surface restores to previous state by default, with an explicit "start over" option.

**Violated when:**
- Leaving the picker and returning resets the search query.
- A partially-filled form clears on navigation.

---

## Session-continuity heuristics (H-SC)

New category 2026-04-24 for Monetization & PMF project. Applies specifically to commerce + session-continuity surfaces that intersect with live-play. Project-specific; only load-bearing when commerce UX is present.

---

## H-SC01 — Paywall never interrupts active work

The most autonomy-critical surface in the app is a live hand in progress. Commerce UX must NEVER interrupt this state. A free-tier user who hits a usage quota (e.g., "3 deep analyses per session") mid-hand completes the hand; the paywall modal fires at hand-end or session-end, never mid-hand.

**Background:** red line #8 (no cross-surface commerce contamination) + MPMF-AP-12 (paywall-mid-hand refusal). Under Q1=A verdict, this heuristic binds commerce UX on live-play surfaces (TableView, LiveAdviceBar, SizingPresetsPanel).

**Implications for surfaces:**
- Paywall modal (Gate 4 MPMF-G4-S2) subscribes to `isHandInProgress()` state; defers modal trigger to hand-end boundary.
- Usage-threshold paywalls (L3) defer to natural session boundary if triggered mid-hand.
- Depth-of-analysis paywalls (L6) defer to post-hand review surface, never during live decision.
- Feature-first-open paywalls (L2) blocked from TableView while any hand is in progress.
- Upgrade CTA placement adapts by context: primary off-table, tertiary or absent during live hand (per H-PLT07 state-aware primary action).

**Violated when:**
- Paywall modal covers the table UI while hero has an active decision.
- Quota-exhaustion alert interrupts hand entry.
- Upgrade banner appears on LiveAdviceBar during active hand.

**Test assertion (Gate 5 MPMF-G5-SC):** mock a mid-hand state + trigger a paywall condition → assert modal does NOT render until hand completes.

---

## H-SC02 — Trial state legible outside settings

A free-tier user unsure which tier they're on must be able to verify in ≤ 2 taps from anywhere in the app. Hiding tier state behind multiple navigation steps violates red line #2 (transparency on demand) and creates evaluation-period anxiety — a returning-evaluator who doesn't know whether their trial is still active is in a worst-case cognitive state.

**Background:** SA-72 JTBD (understand-what's-free-what's-paid-and-why) + red line #2. Distinct from H-PLT01 glanceability (H-PLT01 is about speed; H-SC02 is about discoverability).

**Implications for surfaces:**
- Trial-state indicator (Gate 4 MPMF-G4-S4) lives in a persistent location (top-right nav or Settings-adjacent chip) visible across all main routes.
- Indicator is ≤ 150ms glanceable (inherits H-PLT01 on live-play surfaces).
- Tap on indicator → direct route to BillingSettings surface with current tier, next bill, cancellation path all visible.
- Inline locked-feature badges ("Plus feature") tap → explainer + tier-info, not aggressive upsell.

**Violated when:**
- User must open Settings → scroll → find Billing → tap → see tier (4+ taps).
- Tier state hidden behind account/profile menu nested deeply.
- Locked features have no indication of which tier unlocks them.

**Test assertion (Gate 5):** from any main route, user can reach tier-state info in ≤ 2 taps (measured via UI test harness).

---

## Applying these alongside Nielsen

Nielsen heuristics are broad; these are narrow. In an audit:
1. Run through H-N01…H-N10 first.
2. For each surface, also run through H-PLT01…H-PLT08.
3. For commerce / session-continuity surfaces, run H-SC01 + H-SC02.
4. A finding may cite multiple heuristics — that strengthens severity.

Mid-hand surfaces weight H-PLT01 / H-PLT02 / H-PLT07 / **H-SC01** highest.
Between-hands surfaces weight H-PLT06 / H-PLT08 highest.
Post-session surfaces weight classic Nielsen over these.
Commerce UX surfaces (pricing / paywall / billing / trial / cancellation) weight **H-SC01 + H-SC02** alongside red-line compliance.

---

## Change log

- 2026-04-21 — Created.
- 2026-04-24 — Added H-SC (session-continuity) heuristic category with H-SC01 (paywall-never-interrupts-active-work) + H-SC02 (trial-state-legible-outside-settings). Output of Monetization & PMF Gate 4 Batch 1 authoring. Applies specifically to commerce UX on live-play surfaces (H-SC01) and across the app (H-SC02). Distinct from H-PLT category in that H-SC heuristics only bind when commerce UX is present; not universal. See `docs/projects/monetization-and-pmf.project.md` §Acceptance Criteria red lines #8 + #10 + `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` §Stage E.
