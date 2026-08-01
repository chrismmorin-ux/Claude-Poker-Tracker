# Exploration — Action & sizing entry

**Opened:** 2026-07-31, at founder request during TVR Gate 4 prep.
**Status:** Exploration — options for consideration, not a decision. Feeds `WS-313` (Gate 4).
**Prompted by:**

> "I'm tempted to let this be a funnel of states — clicking bet opens up pre-selection of a slider that jumps to common bet sizes (also adjusting to my common bet sizes), but maybe the slider, upon a wiggle of the finger, allows precision around the preselected node. One smooth finger action that definitely captures progressive levels of detail in case of balk or needing to return to the table, that allows for precision as long as the user keeps going, and rough strokes for fast entry. This is only one possible option and I'd like to see the proposed optimizations to at least consider this one."

---

## 1 — The physical budget (measured, `npm run devshot` @ 1170×540, scale 0.695)

Any proposal has to live inside these numbers. They are rendered px on the founder's device, not declared px.

| Element | Declared | **Rendered @0.695** | vs 44px floor |
|---|---|---|---|
| Command column | 450 × 720 | **313 × 500** | — |
| Sizing preset (×4) | 100 × 68 | **69 × 47** | ✅ just clears |
| Action button (Call/Fold) | 213 × 100 | **148 × 69** | ✅ |
| Custom amount input | 330 × 48 | **229 × 33** | ❌ **below floor** |
| GO button | ~65 × 48 | **45 × 33** | ❌ **below floor** |
| **Preset row span** | — | **288 px** | ← the slider travel budget |

**288px is the number that decides whether the founder's concept works.**

### What 288px of travel actually buys

| Scenario | Useful value range | $ per px | @5px finger precision |
|---|---|---|---|
| $1/$3 preflop raise-to | $6 – $60 | $0.19 | ±$1 — **fine** |
| $100 pot, postflop bet (0.25–2.0×) | $25 – $200 | $0.61 | ±$3 — **fine** |
| $600 pot | $150 – $1200 | $3.65 | ±$18 — **marginal** |
| $2000 pot | $500 – $4000 | $12.15 | ±$60 — **unusable** |

**The founder's instinct is confirmed by the arithmetic: a plain linear slider is adequate at small pots and breaks down at large ones.** Progressive precision is not a refinement of the idea — it is a requirement for it. That is the single strongest argument for his proposal over a naive slider.

### What is already there

`getSizingOptions` (`potCalculator.js:481`) emits 4 presets per context, defaults:

```
preflop open      2.5x  4x  5x  10x
preflop raise     2x    3x  4x  5x
postflop bet      1/4   1/2 3/4  pot
postflop raise    2x    3x  4x  5x
```

`settings.customBetSizes[sizingKey]` already overrides these per context — so **"adjusting to my common bet sizes" is half-built**; what is missing is that it is *manually configured*, not *learned*. Selection is 1 tap. Arbitrary amounts require the custom input + GO — both of which measure **below the touch floor** and require a keyboard.

---

## 2 — What the current flow actually costs

| Path | Taps | Notes |
|---|---|---|
| Bet at a preset | **1** | Already optimal. Nothing beats this. |
| Bet at an arbitrary amount | **3 + keyboard** | tap input (33px target) → type → tap GO (45×33). Keyboard occludes the table. |
| Adjust a preset | not possible | You take the preset or you type. There is no "3/4 pot but a bit more." |

**The bottleneck is not the common case — it is that there is nothing between "one of four presets" and "open a keyboard."** That gap is exactly what the founder is describing, and it is real.

---

## 3 — The options

Five, including the founder's. Evaluated against: `HE-23` (orbit throughput), `glance-return-chris` (intermittent attention), `WS-316` (touch floor), `WS-317` (confirm-before-commit), and the never-auto-commit rule.

### Option A — Keep presets, fix the tail *(baseline / cheapest)*

Leave the 4 presets. Replace the sub-floor input+GO with a proper numeric pad sized above the floor.

- ✅ Zero risk to the fast path; fixes two floor violations.
- ❌ Does nothing for "3/4 pot but a bit more." The gap remains.
- **Cost:** S.

### Option B — Founder's concept, literal: tap Bet → slider with snap nodes, wiggle for precision

- ✅ Closes the gap. Continuous range. Presets become snap nodes, so nothing is lost.
- ✅ "Progressive detail on balk" is genuinely elegant — see §4.
- ❌ **The wiggle is the weak part.** It is a mode switch with no affordance: undiscoverable, and false-positives are likely at a live table (hand tremor, phone jostle, rail bumps). A mode you can enter accidentally on a value you are about to commit is a data-integrity risk.
- ❌ **Makes the common case slower.** If most bets are at a preset, replacing 1 tap with press-drag-release is a regression for the majority — directly against `HE-23`.
- **Cost:** M–L.

### Option C — Founder's concept, amended: **tap commits, drag refines; precision by velocity** ← *recommended*

Same funnel, two corrections:

1. **Tap a preset = commit immediately, exactly as today.** Press-and-drag *from* a preset enters the slider, starting at that node. The fast path is untouched; the slider is opt-in per action, with no mode and no delay.
2. **Replace "wiggle" with velocity-adaptive gain.** Move fast → coarse, snapping to nodes. Move slow → fine, resolving to the dollar. This is inverted pointer acceleration, and it is what a "wiggle" *physically is* — a low-velocity movement. So it delivers precisely what the founder described, but as a continuous property of the gesture rather than a mode you toggle into.

- ✅ Nothing to discover, nothing to trigger accidentally, no second axis needed — it fits in the 288px budget.
- ✅ Solves the large-pot precision problem that kills a naive slider.
- ✅ Is the same primitive as `WS-317` (tap commits / hold refines) applied to a continuous value — **one gesture rule across the whole interface instead of two.**
- ⚠️ Velocity curves need tuning, and tuning needs the device.
- **Cost:** M.

### Option D — Radial / arc from the pressed preset

Press a preset, drag outward along an arc; distance = magnitude, angle = fine adjust.

- ✅ Escapes the 288px linear budget — an arc from a corner has more usable travel.
- ❌ Occlusion is severe in a 313px column; the hand covers the arc.
- ❌ No precedent in the app; high learning cost for a persona with sub-second budgets.
- **Verdict:** interesting, poor fit for this canvas.

### Option E — Learned presets, no new gesture

Leave the interaction alone; make the 4 presets *learned* from actual recorded sizings rather than configured.

- ✅ Cheapest real improvement to the common case — if the presets are right more often, the tail matters less.
- ✅ Composable with **any** of the above. Not a competitor.
- ⚠️ **Domain caveat, load-bearing:** these presets record *both* hero and villain actions. "My common bet sizes" is correct only when recording hero. For a villain, the useful prior is what *villains at this stake* do — a different distribution. Learning one blended set would degrade both. Needs to be hero-vs-villain aware, or scoped to hero only.
- **Cost:** M.

---

## 4 — The best part of the founder's idea, stated precisely

> "captures progressive levels of detail in case of balk or needing to return to the table"

This is the strongest element and it deserves an exact definition, because three readings exist and only one is safe:

| On early lift, commit… | Verdict |
|---|---|
| **the nearest snap node** | ✅ **Correct.** A quick flick lands on a preset — the coarse answer, always valid. Sustained drag earns precision. **The gesture degrades gracefully into the current behaviour.** |
| nothing | ❌ Punishes the interruption the founder is designing for. |
| the raw current value | ❌ Silently records an arbitrary mid-drag number. Data-integrity failure. |

Reading 1 is the good one, and it is what makes the concept fit `glance-return-chris`: **the same gesture is fast when you are rushed and precise when you are not, and being interrupted costs you accuracy but never correctness.** That is a real design principle and it should survive into Gate 4 regardless of which option ships.

---

## 5 — Where this does *not* go

- **Not on Fold / Call / Check.** They are discrete; there is nothing to refine. A drag affordance there would tax `HE-23` and collide with `HE-22`'s pre-arm.
- **Not auto-committing.** A villain's bet is recorded, not proposed. The slider must show the value before release and never write on press.
- **Not a replacement for exact entry.** Some amounts need typing. The numeric path stays and must clear the touch floor (Option A is a prerequisite of every other option, not an alternative to them).

---

## 6 — How this connects to the open tickets

The founder's concept is not a fifth idea alongside the redesign — **it lands on three threads already open:**

| Thread | How this touches it |
|---|---|
| `WS-316` touch floor | A drag-refined value **needs no 44px target** — precision comes from the gesture, not the tap. This is the third strategy (remove the need for precision) applied to sizing. |
| `WS-317` confirm-before-commit | Same primitive: tap commits, hold refines, release confirms. Option C makes these **one rule**, not two. |
| `D-1` pre-armed defaults | Option E (learned presets) *is* pre-arming applied to sizing. |

That convergence is the argument for deciding all of them inside one Gate 4 artifact rather than separately.

---

## 7 — Recommendation

**Option C + Option E, with Option A as a prerequisite.**

- **A** first: the custom input (229×33) and GO (45×33) are below the touch floor today. Fix regardless of what else ships.
- **C**: tap commits / drag refines, velocity-adaptive gain, snap-to-node on early lift.
- **E**: learned presets, hero-scoped, as the snap nodes C drags between.

**Open questions for Gate 4 / prototype:**

1. Velocity curve constants — unknowable without hands on the device.
2. Where does the slider render? The column is 313px wide; a horizontal slider fits, but the value readout must not sit under the finger.
3. Does the drag start from the pressed preset, or from the current value? (Preset is more predictable; current is fewer pixels of travel.)
4. Does this replace the preset row visually, or overlay it? Replacing risks violating `glance-return-chris`'s positional-stability contract.
5. **Prototype before spec.** Velocity-adaptive gain is not evaluable on paper — it either feels right or it does not.

---

---

## 8 — Amendment: the non-linear track *(founder, 2026-07-31)*

> "It could be a not-too-scale slider. The 4 most common bet sizes spread equally. If a predominant one is there, it's preselected. User can one-click the most common ones and long-press-drag to anything non-standard, being quickly oriented by the existing slider as to where he should long-press to get the specific dial-in he needs."

**This is better than Option C as I wrote it, and the arithmetic says so.**

### Why it works: the track stops paying for range it never uses

A to-scale slider must cover the whole plausible span (postflop, ~0.25× to 2.0× pot) because any point on it must be reachable. A track with **equally spaced nodes** only has to span node-first to node-last — 0.25× to 1.0× — and everything above the top node moves off the track entirely. The pixels get spent where the bets actually are.

| Postflop bet, 288px of travel | To-scale | **Equal-spaced nodes** | Gain |
|---|---|---|---|
| Range the track must cover | 0.25 – 2.0× pot | **0.25 – 1.0× pot** | — |
| $100 pot | $0.61 /px → ±$3 | **$0.26 /px → ±$1.3** | 2.3× |
| $600 pot | $3.65 /px → ±$18 | **$1.56 /px → ±$8** | 2.3× |
| $2000 pot | $12.15 /px → ±$61 | **$5.21 /px → ±$26** | 2.3× |
| $2000 pot **+ velocity gain** | — | **±$3.9** | 15× |

**2.3× finer everywhere, for free**, purely from refusing to render the axis to scale. Combined with velocity-adaptive gain it turns the worst case ($2000 pot) from unusable into precise. §1 concluded a plain slider breaks down at large pots — this is the fix.

### It is not a competitor to velocity gain — the two are different layers

- **Non-linear track = macro allocation.** Decides which pixels represent which values, by frequency.
- **Velocity gain = micro resolution.** Decides how much value one pixel of movement buys, by intent.

They compose. Neither alone gets a $2000 pot to sub-$5 precision; together they do.

### The part I did not anticipate: it makes spatial memory *stronger*, not weaker

My worry about an adaptive control was that learned/adapting values would break `glance-return-chris`'s positional-stability contract. Equal spacing inverts that:

> **Node *k* is always at pixel position *k* × 96, forever.** What changes with context is the *value* at that position — and it always changes to "the size I'd most likely want in slot *k*."

Muscle memory attaches to position, and position never moves. This is the rare case where the adaptive design is *more* stable than the fixed one — a to-scale track moves its nodes every time the pot changes.

### It also resolves the `WS-317` long-press collision — correctly

"Long-press-drag to anything non-standard" lands directly on the gesture that currently opens the **sizing editor** (`SizingPresetsPanel.jsx:63-67`). Something has to give, and the founder's proposal picks the right winner: *refining the value you are recording* is far more frequent than *editing your preset configuration*. The editor moves to an explicit control; the gesture goes to the frequent job.

That is one of the three collisions `WS-317` has to settle, settled — on this surface, on merit.

### Open questions this raises

1. **Above the top node.** Overbets (1.5×, 2×, all-in) are now off-track by construction. Options: a compressed tail past the last node, an explicit overbet node, or routing to the numeric path. **Must be specified — it is currently undefined.**
2. **Below min-raise.** `getMinRaise` must clamp or grey the invalid region; the track can currently express illegal raises.
3. **Gain discontinuity at node boundaries.** Value-per-px differs per segment, so a constant-speed drag changes value at different rates across the track. May feel sticky or loose. **Only a prototype can answer this.**
4. **Hero vs villain nodes.** Unchanged from §3 Option E — "my common sizes" is the right prior only when recording hero.

### Verdict

**This supersedes Option C's track design.** The recommendation becomes:

> **Non-linear equal-spaced track (founder) + velocity-adaptive gain (amendment) + snap-to-node on early lift + learned hero-scoped nodes, with the sub-floor numeric path fixed underneath.**

---

## 9 — Interactive prototype

Built 2026-07-31 so §8's open question 3 can be answered by feel rather than argument.

**→ [Bet Sizing — Non-Linear Track Prototype](https://claude.ai/code/artifact/fa2e9344-c7a6-4e91-8c82-20cc5b97706b)**

Renders the command column at its true **313 × 500** device size. Tap a node to commit; press and hold to refine; drag slowly for fine control; lift early to snap to the nearest node; drag down to cancel. Toggles for **non-linear vs to-scale** and **velocity gain on/off** make the comparisons in §8 directly feelable, and a live panel reports value-per-px and achieved precision as you drag.

What to check:
- Switch to **to-scale** at a **$2000** pot — the failure §1 predicted.
- Switch back to **non-linear**, then toggle **fixed gain** — isolates what each layer contributes.
- Whether node-boundary gain changes feel sticky (open question 3).
- Whether `HOLD_MS = 180` is right, or whether it fires when you meant to tap.

Nothing here writes to the app. It is a feel test for a Gate 4 decision.

---

## 10 — Amendment 2: readout units, overbets, all-in *(founder, 2026-07-31)*

> "It should support just being clicked as well, if a preset is the one being chosen — the long press is just for precision. We can get creative with how we enable the overbets… maybe the slider scales at overbet scale. We need to also be displaying % of pot as well as the actual amount. Player could remember a previous action as roughly a certain size and capture most of the information. Same thing with common sizing for preflop or 3-bets, and obviously support all in, in which that player has no more actions but others might."

### 10.1 — Tap-commits is ratified

Confirms §8's amendment: tap commits at a node, long-press is *only* for precision. The fast path is untouched, `HE-23` is protected. No further design question here — it is settled and the prototype implements it.

### 10.2 — Ratio must be the primary readout, not the amount *(the strongest point in this round)*

> "Player could remember a previous action as roughly a certain size and capture most of the information."

This is a claim about **what unit human memory stores**, and it is correct. Nobody watches a villain and remembers "$68." They remember *"about two-thirds pot."* The dollar figure is a derived quantity that the player reconstructs from the ratio and the pot — not the other way round.

That inverts the readout hierarchy the current UI uses. `SizingPresetsPanel.jsx:75-76` renders **`$amount` at 20px and the ratio label at 11px** — the derived quantity is nearly twice the size of the remembered one. **The interface leads with the unit the user does not think in.**

Three consequences:

1. **Ratio primary, dollars secondary.** The user is matching a memory, not choosing a number. Show the thing they are matching against, largest.
2. **The ratio is context-native, not always "% of pot."** Postflop → % pot. Preflop open → × bb. 3-bet → × the last raise. The founder said as much ("same thing with common sizing for preflop or 3-bets"); the memory unit changes with the spot, so the readout must too.
3. **Data-quality corollary, and it is the real prize.** Recording *"≈65% pot"* faithfully is **better data** than recording a confident-looking `$137` that was actually a guess. A ratio-led interface lets the player record what they actually observed at the precision they actually observed it. A dollar-led interface invites false precision — and false precision in a read-building tracker is worse than coarse honesty, because downstream models cannot tell the difference.

*(Deliberately not proposed: an explicit confidence field on the sizing. It would capture the same information more expensively and adds a decision to every entry. The ratio-led readout gets most of the benefit for free. Flagging it as considered and rejected so Gate 4 does not re-derive it.)*

### 10.3 — Overbets: trailing tail, not a rescale

The founder offered two mechanisms — capture it "in the trailing space", or have "the slider scale at overbet scale." **The trailing tail is the safer of the two and it is what the prototype implements.**

A mid-drag rescale re-maps every node under a finger that is already moving. Even with eyes on screen it risks the value jumping, and it destroys the property §8 identified as this design's best feature: *node k is always at pixel k × 96.* A fixed trailing tail keeps every node where it was and spends only the unused right-hand space.

Geometry in the prototype:

```
|<----------- nodes, equally spaced ----------->|<- overbet ->| gap |ALL IN|
0%                                             66%           88%   90%  100%
```

The overbet band is compressed by construction — that is correct, because overbets are both rarer and remembered more coarsely ("he jammed like one-and-a-half pot"). Precision follows frequency, which is the same principle that justified the non-linear track in the first place.

**Considered and rejected:** a rolling window that slides nodes leftward as you push into overbet territory. It preserves resolution but moves the nodes, which forfeits positional stability for the rare case in order to serve it. Wrong trade.

### 10.4 — All-in is a latch, not a slider position

> "obviously support all in, in which that player has no more actions but others might"

The clause after the comma is the design constraint, and it is a **state** consequence, not a magnitude one. All-in is not "the biggest bet on the continuum" — it is a categorical action that closes that seat while the hand continues for everyone else.

The codebase already agrees: `handleAllInSubmit` (`CommandStrip.jsx:581-596`) records `{ raiseTo, allIn: true }` or `{ callAmount, allIn: true }` — a **flag**, not just a large number — and `activeSeatCount` / `hasSeatFolded` already drive the hand-decided guards. The side-pot ledger (`calculateSidePots`) depends on that flag being set, not on the amount being large.

So all-in must be reachable from the same gesture but must not be a point on the magnitude scale. The prototype puts it **past a deliberate dead gap** at the track's end: you can drag into it, it latches, and the readout switches to `ALL IN / $X effective / NO FURTHER ACTIONS`. The gap is what stops a fast drag from sliding into it accidentally — which matters, because all-in is the one sizing that cannot be corrected by a slightly-different number later.

**Open for Gate 4:** an all-in *call* (short stack calls off for less than the bet) is a different case that this track does not express — `handleAllInSubmit` already routes it via `callAmount`. Probably belongs on the Call control, not here.

### 10.5 — What changed in the prototype

- Ratio promoted to primary (27px), dollars secondary (15px) — inverting today's hierarchy.
- Context-native ratio unit, with a **3-bet** spot added alongside postflop and preflop.
- Overbet tail (66–88%) and all-in latch (90–100%) with a dead gap between.
- Effective-stack control, so the all-in figure is real.
- Node captions now show dollars, since the ratio is already in the node label.

**→ [Prototype](https://claude.ai/code/artifact/fa2e9344-c7a6-4e91-8c82-20cc5b97706b)** · vendored at `explorations/sizing-track-prototype.html`

Still open and only answerable by feel: whether the node-boundary gain change feels sticky (§8 q3), whether `HOLD_MS = 180` fires when you meant to tap, and whether the dead gap before all-in is wide enough to prevent accidents but narrow enough to reach deliberately.

---

## 11 — Prototype defect: interrupted drag *(founder-reported, 2026-07-31)*

> "I don't have uninterrupted dragging. If I drag off the precise slider area or even as the slider changes when I move it, I sometimes have to reinstate the long press action to continue."

Four separate defects in the prototype, all in the gesture plumbing rather than the design. Worth recording because **three of them are traps any real implementation will hit**, and one was an instance of the exact failure this design is supposed to prevent.

### D1 — Page scroll steals the pointer *(the main cause)*

`touch-action: none` was set only on the track element. The page itself is scrollable, so a drag with any vertical component was claimed by the browser's scroller, which fires `pointercancel` and kills the gesture. This is why it happened "when I drag off the precise slider area."

**Fix:** `touch-action: none` on the whole column, `overscroll-behavior: contain` on the body, and `preventDefault()` on pointerdown/move with `{ passive: false }`.

**Carries to production:** the real command column needs the same treatment, and the felt behind it must not scroll either.

### D2 — Full DOM rebuild on every pointermove *(the "as the slider changes" half)*

`renderNodes()` rewrote `nodes.innerHTML` — tearing down and recreating twelve elements — **on every pointer event**, at up to 120 Hz. That is enough jank on a phone to drop frames and make the drag feel like it is catching.

**Fix:** build node DOM once per context/mode change; per-frame work is now only `classList.toggle` and `transform` writes.

**Carries to production:** React will do this by default if the node list is rebuilt from state each render. The sizing track needs the value in a ref with direct style writes during the drag, not a state update per pointermove.

### D3 — The cancel zone was 16px below the track

Cancel armed at `y > 108px` on a 92px-tall track — sixteen pixels of slack. An ordinary finger drifting downward tripped it, the readout flipped to CANCEL, and releasing there discarded the entry.

**Fix:** cancel now requires **92px clear below the track**, and the zone lights up before it arms.

### D4 — `pointercancel` was committing *(the one that matters)*

`pointercancel` was wired to the same handler as `pointerup`, so a gesture **stolen by the browser silently recorded a value the user never released on.** That is precisely the silent-write failure §4 forbids — sitting in my own prototype.

**Fix:** an interrupted gesture records **nothing** and is logged as `interrupted`. The prototype now counts interruptions in the telemetry panel, so the failure is visible rather than silent.

**Carries to production, and it is the load-bearing lesson:** `pointerup` and `pointercancel` are not the same event. Any drag-to-commit control must treat cancel as *abandon*, never as *commit*. Gate 4 should state this as a rule for the whole surface, since `WS-317`'s press-hold-release card selector has exactly the same exposure.

### Also added

A **hold-threshold control** (instant / 180 ms / 320 ms) so the §8 open question — whether 180 ms fires when you meant to tap — can be answered by trying all three rather than by argument. `instant` removes the hold entirely: press engages refine immediately, and tap-vs-drag is decided purely by whether you moved.

---

## 12 — Are the defaults grounded in the corpus? *(founder, 2026-07-31)*

> "Did we pull the default actions and common sizes from the MDA and make it specific to street? Common cbets are different than common check raises or turn probes or river thin value/bluff and stabs (aggressive action from callers to the preflop raise that isn't a donk)."

**No, and no.** Verified by code read.

### 12.1 — The defaults are convention, not measurement

`potCalculator.js:456-459` — four hardcoded arrays, no comment, no citation, no derivation:

```
DEFAULT_PREFLOP_OPEN   = [2.5, 4, 5, 10]
DEFAULT_POSTFLOP_BET   = [0.25, 0.5, 0.75, 1.0]
```

### 12.2 — Postflop is one bucket for everything

`CommandStrip.jsx:509-515` produces exactly **four** sizing contexts, and postflop collapses to two:

```
preflop  → preflop_open | preflop_raise
postflop → postflop_bet | postflop_raise
```

**A flop c-bet, a turn probe and a river bluff all get the same four buttons.** The distinction the founder is drawing does not exist anywhere in the sizing path.

### 12.3 — But the taxonomy already exists, one layer down

`scripts/backtest/mine-sizing-and-lines.py:71-73, 187-203` already classifies every postflop aggressive action into precisely the vocabulary in the question:

```
flop_cbet   flop_checkraise   flop_donk   flop_checkcall
turn_barrel   turn_checkraise   turn_probe
river_barrel  river_checkraise  river_probe
```

The founder's **"stab"** is the script's **probe** — non-PFA first aggression on turn or river. The script is also right to have no *flop* stab: on the flop a non-PFA first bet **is** a donk, because a stab requires the PFA to have already declined.

**The gap is what the script does with it.** It *counts* lines (for a per-player "has this player ever taken this line" study) and never records the **size**. We built the classifier and throw the number away.

### 12.4 — The delta is about five lines

At the classification point the script already holds `amount` (parsed at :175). What it lacks is a running pot — `committed[]` is zeroed at each street boundary (:146-149) and those chips are discarded rather than accumulated. Carry the pot forward, and every classification point can emit a pot fraction.

### 12.5 — Why this is the cleanest question the corpus can answer

**Sizing is the least-censored quantity in the dataset.** Hand strength is censored brutally — folds are never shown, successful bluffs are never shown — so every strength distribution inherits a correction, and the standing doctrine is to read corpus findings "as shape and bound, not level."

**Sizing is the exception.** Every bet's size is recorded whether or not the hand reached showdown. No censoring correction is needed; the level is directly observed.

### 12.6 — The caveat that limits it

The corpus is **online** play. The founder plays **live $1/$3 9-handed**, and live pools size differently — notably larger preflop opens (live 5–10x vs online 2.5–3x, which is likely why `DEFAULT_PREFLOP_OPEN` already carries a `10`). So the corpus gives a reliable **taxonomy and shape** but the **levels** may be systematically displaced.

**Therefore: corpus as prior, his own recorded hands as the update.** That is the same Bayesian pattern `POKER_THEORY` already mandates for population priors plus per-player updates — and it resolves the hero-vs-villain problem from §3 Option E cleanly: *population prior for villain sizings, the founder's own history for hero sizings, never blended.*

### 12.7 — One category the corpus cannot fully deliver

"River thin value / bluff" **cannot** be split except on shown hands. River bet *sizes* are fully observed; the value-vs-bluff *intent label* needs a showdown. So report the river bet-size distribution unconditionally, and the value/bluff split only with its k/n and censoring direction.

### 12.8 — What this changes for the track

If the cells differ materially, the sizing-context key expands from 4 to ~10 (`street × role`), and **the non-linear track's node values get a grounded prior instead of a convention.** That is the difference between a track whose nodes are where bets actually cluster and one whose nodes are where someone assumed they cluster — and the whole argument for the non-linear track (§8) was that it spends pixels where the density is. **Without this, the design is right but the numbers are guesses.**

If the cells *do not* differ, the current single postflop bucket is defensible and we stop paying for granularity that buys nothing. Both outcomes are cheap and useful.

Filed as `WS-318`.

---

## Change log

- 2026-07-31 — Created from founder proposal. Physical budget measured; five options; C+E+A recommended.
- 2026-07-31 — **§12 (founder): are the defaults corpus-derived and street-specific?** No and no — `potCalculator.js:456-459` is hardcoded convention and `CommandStrip.jsx:509-515` collapses all postflop bets into one context, so a flop c-bet, turn probe and river bluff share four buttons. But `mine-sizing-and-lines.py` already classifies every aggressive action into exactly the founder's taxonomy (cbet/checkraise/donk/barrel/probe per street) and merely discards the size. ~5 lines to carry a running pot converts a line counter into a pool sizing distribution. Sizing is the least-censored quantity in the corpus, so this is the cleanest question it can answer — but it is online data for a live game, so corpus = prior, own hands = update. Filed WS-318; without it the non-linear track's node values remain guesses.
- 2026-07-31 — **§11 prototype defect: interrupted drag** (founder-reported). Four gesture-plumbing bugs: page-scroll stealing the pointer via missing `touch-action`, full DOM rebuild per pointermove, a cancel zone 16px below the track, and — worst — `pointercancel` wired to commit, so a browser-stolen gesture silently recorded a value the user never released on. Three of the four carry directly to production; the `pointerup` ≠ `pointercancel` rule should be a Gate 4 surface-wide constraint since WS-317's card selector has the same exposure. Hold-threshold control added so the 180ms question can be settled by trying it.
- 2026-07-31 — **§10 amendment 2 (founder): readout units, overbets, all-in.** Tap-commits ratified. Ratio promoted to primary readout over dollars — memory stores ratios, not amounts, so a dollar-led UI invites false precision; current `SizingPresetsPanel` has this backwards (amount 20px vs ratio 11px). Overbets resolved as a fixed trailing tail rather than a mid-drag rescale, preserving node positional stability. All-in specified as a categorical latch past a dead gap, not a point on the magnitude scale — consistent with the existing `allIn: true` flag that the side-pot ledger depends on.
- 2026-07-31 — **§8 amendment: non-linear equal-spaced track (founder).** Supersedes Option C's track design — 2.3× finer resolution everywhere by not rendering the axis to scale, composes with velocity gain as a separate layer, strengthens rather than weakens positional stability, and resolves one of WS-317's three long-press collisions on merit. §9 interactive prototype published to answer the gain-discontinuity question by feel.
