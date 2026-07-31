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

## Change log

- 2026-07-31 — Created from founder proposal. Physical budget measured; five options; C+E+A recommended.
