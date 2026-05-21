# Blind-Spot Roundtable — 2026-05-20 — Range Lab

**Date:** 2026-05-20
**Project:** Range Lab (RL) — design framework Gate 2
**Facilitator:** Claude (main)
**Format:** Per `docs/design/ROUNDTABLES.md` — five stages, custom 6-voice persona set for RL's blind-spot space.
**Preceded by:** Gate 1 Entry audit 2026-04-22 (`2026-04-22-entry-range-lab.md`), verdict 🟡 YELLOW.
**WS ticket:** WS-053. **Sprint:** SPR-093.

**Authority claim:** this Gate 2 verdict supersedes Gate 1 YELLOW. Three of four Gate-1 owner questions are resolved inline per founder ratification 2026-05-20 (bundle into Gate 2 stage outputs, not fork to Gate 3). The fourth (Q3 Drills Consolidation) was already moot — Drills Consolidation REJECTED 2026-04-22 (see `drills-consolidation.project.md` status: rejected).

---

## Feature summary

Range Lab is an expansion of Explorer mode inside `PostflopDrillsView` (per Gate 1 — no new routed view). It adds a 13×13 paintable range grid with per-combo weights, turn/river board support, subrange filter toggles, equity distribution histogram, range comparison overlay, and hand-history paste-to-analyze flow. Phase 3+ adds AI-native differentiators: archetype-conditioned overlays, tendency-auto-populated ranges, multi-street dynamic narrowing, weakness annotations, and EV overlays — capabilities Flopzilla cannot offer because they require our Bayesian/tendency pipeline.

Primary persona: Chris-as-author (validated). Secondary: Scholar + Coach + study-block + first-principles-learner + post-session-chris (study mode). Out of scope: live-play personas (mid-hand, between-hands), multi-tabler, newcomer. Drills Consolidation REJECTED 2026-04-22 → "stay inside ExplorerMode" is permanent, not conditional.

---

## Finding 0 — Drills Consolidation is moot (Gate-1 Q3 resolution)

Gate 1's Q3 asked whether Drills Consolidation should be decided before Gate 2 runs. The decision was already made: `docs/projects/drills-consolidation.project.md` status `rejected` (2026-04-22). "Stay inside ExplorerMode" is now a permanent architectural constraint, not a conditional assumption. This roundtable proceeds without Q3 as an open question.

---

## Custom personas for this roundtable

Six voices, each with a narrow mandate inside RL's blind-spot space. Six is justified by RL's cross-cutting nature (engine + interaction + cross-surface). Skipped voices documented below with reasons.

| Voice | Mandate |
|---|---|
| **Range-Paint Interaction Designer** | Tap targets, drag, multi-touch, undo for 13×13 grid; per-combo weight primitives; scale-aware ergonomics. |
| **Solver/GTO Theorist** | Flopzilla parity bar; AI-native differentiator opportunities; per-combo equity correctness; published-solver baseline comparison. |
| **Engine-Performance Skeptic** | Interactive latency for equity histogram + subrange filter + multi-street narrowing; cache strategy; Monte Carlo variance vs exact enumeration. |
| **Surface-Boundary Architect** | Explorer-extension scope creep risk; is RL a feature inside ExplorerMode or a different mode? Mode-bar discipline; tab budget. |
| **Cross-Surface Architect** | LSW + HandReplay cross-link affordances; restoreContext shape; cross-link source-label visibility. |
| **First-Principles Auditor** | Label-shortcut anti-pattern guard. RL is the most exposed engine surface for this — must derive from equity/SPR/pot-odds, not from bucket-label heuristics. Enforces `feedback_first_principles_decisions.md`. |

**Skipped voices (with reason):**
- ✗ **Mobile-Context Skeptic** — RL is study-only and explicitly desktop-biased. Gate 1 Q4 scope-deferred mobile to v2. Stage C still addresses mobile via Engine-Performance + Range-Paint Designer wearing those hats.
- ✗ **Autonomy Auditor** — RL is study-only opt-in surface, no graded outputs, no engagement-pressure surfaces in scope (lower urgency than PSD/SCF where Autonomy Auditor was load-bearing). Stage E enforces neutral-chrome discipline via First-Principles Auditor.
- ✗ **Behavioral Psychologist** — relevant for PSD (mood-coloring pre-game) but RL has no analogous live-session pre-game mood surface. Off-table study cognition is covered by Solver/GTO Theorist's "what does productive study look like" lens.

---

## Stage A — Persona sufficiency

**Question:** Who would plausibly use Range Lab who we have NOT modeled in `personas/`?

### Voices

**Surface-Boundary Architect:** Gate 1 flagged "line-audit author" as a possible situation worth a persona. Looking at the actual workflow:
- Studying ranges to learn = exploratory, low time pressure, can go down rabbit holes (Scholar / Chris in study-block).
- Authoring line audits = task-driven, validation-mode, needs to match a specific theoretical claim within a budget (Chris-as-author).
These are different *cognitive modes* of using the same feature, not different *personas*. Chris does both. The right fix is to elevate the situational-persona awareness — `study-block` already exists but doesn't distinguish exploratory study from validation-mode authoring. Recommend: extend `study-block` Snapshot to acknowledge both modes, OR explicitly cite DS-55 (validate authored drill content) as the JTBD that distinguishes validation-mode use.

**Cross-Surface Architect:** Gate 1 explicitly excluded live-play personas (mid-hand, between-hands), multi-tabler, newcomer. Range Lab is study-only. No cross-surface persona creep — sidebar product line does not need a counterpart (✅ confirmed at Stage D below).

**Solver/GTO Theorist:** Probing for a missing persona: "I want to compare my paint against a published GTO solver baseline (e.g., PioSolver export, GTOWizard export)." Is this a Scholar feature or a separate Solver-User persona? Coach + Scholar already cover the validation-against-external-standard situation; no new persona needed. Flag for Gate 3: should the JTBD list include "compare painted range against an imported solver export"? Likely yes (Phase 3+ feature, see DS-53 extension).

**Engine-Performance Skeptic:** RL's interactive-latency tolerance varies by persona. Scholar in a 2-hour study block tolerates 200ms per paint stroke; Coach building a teaching range demos in front of a student does not. Persona-sufficiency: ✅ — same persona, different tolerance windows. Gate 4 perf budget must serve the lower-tolerance situation.

**Range-Paint Interaction Designer:** 13×13 paint requires sustained focus. Apprentice persona (`apprentice-student`) is listed as in-scope; their cognitive load tolerance for arbitrary-range authoring is lower than Scholar's. May need a "guided range paint" mode (templates + tweak) vs "blank-canvas paint" (free authoring) for Apprentice — but this is a Gate 4 design decision, not a persona-sufficiency gap.

**First-Principles Auditor:** No persona red lines. RL's study-only-opt-in nature keeps autonomy concerns minimal.

### Q2 — Coach weighting (Gate-1 open question bundled)

Gate 1 Q2 asked: should Coach be cited as primary or secondary design target? Coach is core persona but PROTO-unverified. The LSW-author argument (RL accelerates line-audit work) is strong **regardless of Coach-as-external-persona** because Chris-as-author is the validated user.

**Resolution:** **Cite Coach as secondary; Chris-as-author is primary validated user.** Coach gets mentioned in JTBD persona-attribution (DS-52/53/55) but is not load-bearing for prioritization. When Coach gets validated (PROTO → core), revisit the prioritization weighting; until then, treat as Scholar's expert-user variant.

### Output: ⚠️ **Patch needed (minor)**

- **Resolved (no change required):**
  - Persona cast covers RL adequately; no new core persona.
  - No new situational persona (line-audit-author is a *cognitive mode*, not a persona).
  - Sidebar product line does not need a counterpart (✅ confirmed at Stage D).
- **Patch required (Gate 3):**
  - **A-R1** Extend `study-block.md` Snapshot to acknowledge two cognitive modes: exploratory study vs validation-mode authoring. Cite DS-55 (validate authored drill content) as the JTBD that distinguishes the modes.
  - **A-R2** Cite Coach as **secondary** in `surfaces/postflop-drills.md` Range Lab section (forthcoming Gate 4 deliverable). Chris-as-author is the primary validated user for DS-55 specifically.
  - **A-R3** Gate 4 design must consider Apprentice's "blank-canvas" tolerance — possible "guided range paint" mode in Phase 3+ (defer authoring until Phase 3 scope opens).
- **Q2 Coach weighting (Gate-1 open question):** ✅ **RESOLVED — Coach secondary, Chris-as-author primary.**

---

## Stage B — JTBD coverage

**Question:** What outcomes would RL users want that are NOT in our JTBD atlas?

### Voices

**Solver/GTO Theorist:** Gate 1 proposed DS-52/53/54/55. All four are well-shaped:
- **DS-52** (paint custom range from scratch) — foundational. Without this, every other JTBD is parameterized on pre-built archetypes only.
- **DS-53** (compare two ranges on the same board with delta) — differentiator vs Flopzilla. Standard Flopzilla doesn't natively compare; users overlay manually. DS-53 makes this a first-class interaction.
- **DS-54** (per-street range evolution) — true AI-native differentiator. Computes turn/river narrowing from villain-action profile + per-combo equity update, not from label heuristics. Flopzilla cannot do this because it lacks the action-profile pipeline.
- **DS-55** (validate authored drill content) — load-bearing for LSW line-audit workflow + Chris-as-author validation-mode.

But two extensions surfaced during voice work:
- **DS-52 extension:** "Compare painted range against an imported solver export" — solver-baseline comparison. Useful in Phase 3+ when external-solver imports land. Flag as a future JTBD, not Phase 0-2 scope.
- **DS-53 generalization:** "Compare N ranges (not just 2) on same board" — multi-overlay. Phase 3+ stretch. Not authored in Gate 3.

**First-Principles Auditor:** Critical guardrail on DS-54. The per-street range narrowing MUST be computed from first principles — per-combo equity update conditional on villain's action profile + board card revealed — NOT from "narrow by hand-class bucket." Label-shortcut anti-pattern risk:
- ❌ Wrong: "On the turn, narrow to TPGK+ since villain bet again."
- ✅ Right: "On the turn, recompute each remaining combo's equity vs hero's range conditional on villain's bet-bet line, weight by villain's bet-bet frequency for that combo, surface the resulting per-combo posterior."
This is a Phase 3+ implementation discipline binding; Gate 4 surface spec must document the algorithmic constraint explicitly. **Flag as AP-RL-01 (anti-pattern, RL-specific):** No bucket-label-driven range narrowing. All narrowing computed per-combo.

**Engine-Performance Skeptic:** DS-54 is the highest-cost JTBD. 47 turn cards × 46 river cards × ~1000 combos × per-combo posterior recompute = expensive if naive. With pre-computed flop equity cached as Float64Array per combo, turn/river is a filter+weight not a recompute → tractable. Flag for Stage C: caching strategy is engineering-Phase-0 prerequisite (similar to WS-198 for PSD).

**Range-Paint Interaction Designer:** DS-52 (paint) primitive choice shapes everything downstream. Three primitive options:
1. **Tap-to-toggle** — each cell binary in/out; per-combo weights via long-press slider.
2. **Tap-and-hold for weight** — tap = include @ 100%; hold = weight slider in-place.
3. **Slider-per-cell** — every cell shows a slider; tap = full; drag = partial weight.
Stage E heuristic check addresses choice criteria; Gate 4 ADR records the decision.

**Surface-Boundary Architect:** All four DS-52/53/54/55 land in `drills-and-study.md`. No new domain. **Phase split (Q1 phasing resolution):**
- **Phase 0** (engineering prereq): `rangeToString()` reverse-serializer + equity-precompute caching layer at flop.
- **Phases 1-2** (parity-with-Flopzilla, foundational): DS-52 (paint) + DS-53 (compare) + paint UX + filter toggles + histogram + turn/river support + hand-history paste.
- **Phases 3+** (AI-native differentiator): DS-54 (per-street evolution) + DS-55 (validate authored content) + archetype overlays + tendency-auto-populate + weakness annotations + EV overlay.

**Cross-Surface Architect:** DS-55 implies a cross-link from LSW line-walkthrough → RL with restoreContext payload. New surface contract; flag for Stage D.

### Q1 — Phasing preference (Gate-1 open question bundled)

Gate 1 Q1 asked: Gate 2 stress-tests all phases (0-5) or Phases 0-2 first with differentiator phases roundtabled later?

**Resolution:** **Bundle Phases 0-2 in this Gate 2.** Stress-tested above (DS-52 + DS-53 parity work). DS-54 + DS-55 are also stress-tested in this audit BUT are flagged as Phase 3+ — meaning the surface contract is established here but implementation is deferred. The Gate 2 verdict applies to the full feature ambition; Phase 3+ implementation will not require a re-run of Gate 2 unless scope changes.

### Output: ⚠️ **Expansion needed**

- **Gate 3 JTBD work:**
  - **B-G1** Author **DS-52** (paint custom range) in `drills-and-study.md`. Phase 1-2 scope.
  - **B-G2** Author **DS-53** (compare two ranges with delta highlighting) in `drills-and-study.md`. Phase 1-2 scope.
  - **B-G3** Author **DS-54** (per-street range evolution) in `drills-and-study.md` with **AP-RL-01 binding** (no bucket-label-driven narrowing; all narrowing per-combo). Phase 3+ scope.
  - **B-G4** Author **DS-55** (validate authored drill content) in `drills-and-study.md` with **LSW-RL equity-parity invariant binding** (see Stage D). Phase 3+ scope.
  - **B-G5** Defer "compare painted range against imported solver export" extension to a future Phase 3+ revisit; not authored at Gate 3.
  - **B-G6** Defer "compare N ranges (>2) on same board" extension to a future Phase 3+ revisit; not authored at Gate 3.
- **Q1 phasing (Gate-1 open question):** ✅ **RESOLVED — Phases 0-2 bundled as v1; Phase 3+ surface-contracted but implementation-deferred.**
- **Anti-pattern flag:**
  - **AP-RL-01** (RL-specific): No bucket-label-driven range narrowing in DS-54 implementation. All per-street narrowing computed per-combo from first-principles equity update conditional on villain action profile + board card. Bind in Gate 4 surface spec + `domain-correctness` program scope.

---

## Stage C — Situational stress test

**Question:** Does RL survive the situations its users are in?

### Voices

**Engine-Performance Skeptic:** Worst-case latency situations:
- **Multi-stroke paint** — user drags across 30 cells in 2 seconds. Equity histogram recompute on every stroke = 30 recomputes × ~100ms = visible lag. Mitigation: debounce histogram recompute by 200ms after stroke ends; show "computing…" affordance.
- **Multi-street narrowing (DS-54)** — flop equity precompute at paint-finalize is O(combo × 1326 hero combos × 50 boards) = ~60M operations. Caching Float64Array per combo at flop makes turn/river a filter operation → ~10ms per turn card render. **Phase 0 engineering prerequisite: equity precompute caching layer.**
- **Range comparison (DS-53)** — two Float64Arrays subtracted cell-by-cell = O(169) cells. Trivial; no perf concern.

**Range-Paint Interaction Designer:** Touch-input situations:
- **13×13 grid at 1.0 scale on 1600×720 landscape** — cells ~30px wide. Below H-ML06 floor of 44 DOM-px. Tap is workable but drag-to-paint is imprecise.
- **Same grid at 0.5 scale (smaller landscape device)** — cells ~15px. Failing. Need scale-aware ergonomics: at small scales, force long-press-required for paint or grid-zoom modal.
- **Mobile-portrait (Q4 scope)** — cells compress further. Not viable for tap-to-paint; would need either grid-zoom or row-paint modal. **Defer to v2 per Gate 1 Q4.**

**Q4 — Mobile scope (Gate-1 open question bundled)**

Gate 1 Q4 asked: is mobile-parity a hard requirement or later stretch?

**Resolution:** **Landscape v1 (1600×720 baseline); mobile-portrait deferred to v2.** Range Lab is study-only; the persona file lists desktop + tablet-landscape as primary contexts (per `study-block.md`). Mobile-portrait paint at 13×13 fails H-ML06 even with grid-zoom. Document mobile-portrait variant as **WS-208** (new follow-up ticket) sequenced after Phase 1-2 ship. Founder ratification: landscape v1 first.

**Surface-Boundary Architect:** Inside ExplorerMode means RL inherits existing scaling system (`scale` prop forwarded via `ScaledContainer`). No new edge cases in landscape; mobile-portrait would require its own variant per persona-context discipline ([[feedback_portrait_mode_player_screens]] applies to PIO surfaces; RL is study, so landscape stays primary but mobile-portrait gets a variant).

**First-Principles Auditor:** Long study-session situations (Scholar 2hr study block) demand deterministic results. Two implications:
- **Monte Carlo equity** has variance — at N=10000 samples, ±0.5% variance per combo. For DS-53 (range comparison) the variance noise floor masks true differences smaller than ±0.5%. Recommend: **exact enumeration for ≤5-card boards** (flop = 3 cards on board + 2 hero = 5; turn = 6; river = 7). Flop is exact; turn/river fall back to Monte Carlo with higher sample counts or precomputed.
- **DS-54 multi-street narrowing** must produce deterministic output for a given input (paint + villain action profile). No "varies each render" behavior — would make DS-55 (validate authored content) untestable. Engineering ticket: deterministic seed for any Monte Carlo path in RL.

**Cross-Surface Architect:** study-block × off-table situational walkthrough doesn't introduce new failure modes vs Explorer today. Phone-sleep mid-paint should preserve in-progress paint state (similar to PSD C-A5). Not a fundamental mismatch — engineering ticket: paint state persistence to local storage on visibility-change.

**Solver/GTO Theorist:** Coach demoing in front of a student — different latency tolerance than Scholar in a 2hr block. Worth flagging: Gate 4 perf budget should target Coach's lower tolerance (≤100ms per paint stroke histogram), not Scholar's higher tolerance (200-300ms).

### Output: ⚠️ **Adjust**

- **C-A1** **Equity precompute caching layer** (engineering Phase 0): cache Float64Array per combo at flop-paint-finalize. Required by DS-54 perf. New ticket WS-206.
- **C-A2** **Histogram recompute debouncing**: 200ms after stroke-end; show "computing…" affordance during gap. Gate 4 surface spec binding.
- **C-A3** **Scale-aware touch ergonomics**: at `scale * cellWidth < 44`, force long-press-required for paint OR offer grid-zoom modal. Gate 4 interaction ADR.
- **C-A4** **Exact enumeration for ≤5-card boards** (flop boards). Monte Carlo only for turn/river when precompute miss. New invariant: INV-RL-DETERMINISM (deterministic seed for any Monte Carlo path).
- **C-A5** **Paint state persistence**: visibility-change handler saves in-progress paint to localStorage; restore on resume. Same pattern as session-recovery.
- **C-A6** **Coach perf-budget target** ≤100ms per paint stroke (vs Scholar's 200-300ms tolerance). Gate 4 perf budget binding.
- **Q4 mobile scope (Gate-1 open question):** ✅ **RESOLVED — landscape v1; mobile-portrait variant deferred to WS-208 follow-up.**

---

## Stage D — Cross-product / cross-surface

**Question:** Does RL have ripples beyond ExplorerMode?

### Voices

**Cross-Surface Architect:** Three direct ripples:
- **Direct 1 — LSW line-walkthrough → RL.** Adds "Inspect this node in Range Lab" cross-link from `LineNodeRenderer`. Cross-link writes a `restoreContext` to ExplorerMode containing: preflop context (position / pot type / aggressor) + flop board + villain range archetype OR painted range. New surface contract on ExplorerMode: accept `restoreContext` prop. Cross-link source-label visibility (Stage E H-N02): show source on RL ("Inspected from: LSW line `btn-vs-bb-3bp-ip-wet-t96` step 4") with affordance to return.
- **Direct 2 — HandReplay → RL.** Adds "Inspect ranges at this decision in Range Lab" affordance per decision step (likely in ReviewPanel overflow menu — same pattern as PSD Gate 4 wire SPR-092). `restoreContext` payload similar to LSW but anchored on hero's decision-point board + villain range from hand record.
- **Direct 3 — Hand-history paste flow (DS-54 dependency).** Hand-history paste in RL produces a per-street evolution view. Reverse direction: paste a hand, see how villain's range narrowed turn → river. This is DS-54's primary entry path. New paste-parser utility OR reuse existing hand-import parsing. Engineering decision: bundle into Phase 1-2 or defer to Phase 3+.

**Surface-Boundary Architect:** Does any of this push toward RL becoming its own routed view? **No.** Cross-link via restoreContext path-through ExplorerMode is the right pattern. RL stays as a *mode* of ExplorerMode (per Drills Consolidation REJECTED finality). The cross-link affordance lives in source surfaces (LSW, HandReplay), not as a new route.

**Engine-Performance Skeptic:** Cross-link via restoreContext is a read at mount time; no perf concern. Initial paint state restored from serialized range (DS-52 dependency on `rangeToString()` / `parseRangeString()` round-trip). `rangeToString()` is the listed Gate-1 follow-up (Phase 0 prereq); doesn't block cross-link affordance authoring at Gate 4.

**First-Principles Auditor:** **CRITICAL — LSW-RL equity-parity invariant.** When LSW invokes RL via cross-link, the equity numbers RL surfaces MUST match the equity numbers LSW asserted in its line-audit. If they differ, the line-audit had stale assumptions OR RL has a computation bug. RL is the validator of LSW content. New invariant authoring at `system/invariants.md`: **INV-LSW-RL-EQUITY-PARITY** — for the same input (preflop context + board + villain range archetype + hero combo), LSW's asserted equity AND RL's computed equity MUST agree to ±0.5% (Monte Carlo variance floor) OR within exact-enumeration tolerance. CI test: pick 3 random LSW nodes, recompute equity in RL, assert parity.

**Range-Paint Interaction Designer:** After cross-link, what's the user's tap path back? Need explicit "Back to LSW line" / "Back to HandReplay decision" affordance at RL. Browser back button works but is non-obvious in a SPA. **Gate 4 surface spec: cross-link source-label is an interactive chip with "back to source" action.**

**Solver/GTO Theorist:** Sidebar (Online / Ignition) is study-irrelevant. ✅ **No sidebar counterpart needed.** RL is desktop-app-only by design; the sidebar's in-game lens has no use for paintable arbitrary ranges.

### Output: ⚠️ **Partner surfaces need updates**

- **D-P1** **LSW line-walkthrough** (`surfaces/postflop-drills.md` Line Mode subsection): add "Inspect in Range Lab" affordance per `LineNodeRenderer`. Cross-link writes `restoreContext` to ExplorerMode. Authored at Gate 4 alongside RL surface spec.
- **D-P2** **HandReplayView** (`surfaces/hand-replay-view.md`): add "Inspect ranges in Range Lab" overflow-menu item (per-step ⋮ menu — same pattern as PSD Gate 4 wire). Authored at Gate 4.
- **D-P3** **Hand-history paste flow**: bundle paste-parser into Phase 1-2 scope (parity-with-Flopzilla). DS-54 multi-street evolution becomes a Phase 3+ overlay on top of the paste flow.
- **D-P4** **No sidebar counterpart needed** — RL is desktop-app-only by design.
- **D-P5** **Cross-link source-label affordance**: visible label + "back to source" action on RL when entered via cross-link. Gate 4 surface spec binding.
- **D-P6** **LSW-RL equity-parity invariant**: new system/invariants.md entry **INV-LSW-RL-EQUITY-PARITY** with CI test (sample 3 LSW nodes, recompute in RL, assert ±0.5% / exact-tolerance). New ticket WS-207.

---

## Stage E — Heuristic pre-check

**Question:** Against Nielsen 10 + Poker-Live-Table + Mobile-Landscape, does the proposed RL design obviously violate anything?

### Voices

**Range-Paint Interaction Designer:**
- **H-N03 (undo):** Paint actions destructive (overwrite per-combo weight). Need undo stack per session. Two design options: (a) per-stroke (each cell tap = one entry, can undo individual cells); (b) per-paint-session (each "Start paint" → "Finalize paint" = one entry). Recommend (a) per-stroke for granular control, with explicit "Clear all" as a separate confirm-required destructive action. **Gate 4 ADR: undo-stack design (per-stroke vs per-session).**
- **H-N05 (error prevention):** "Clear all" requires confirmation. Long-press to start drag-paint prevents accidental drag-paint from a single tap.
- **H-PLT06 (misclick absorption):** Single accidental tap should be reversible via undo (per-stroke undo stack handles this).
- **H-ML06 (touch target ≥44 DOM-px):** At 1.0 scale, cells ~30px — below floor. Scale-aware: at `scale * cellWidth < 44`, switch to long-press-required mode or grid-zoom (per C-A3).
- **Primitive choice:** tap-to-toggle vs tap-and-hold-for-weight vs slider-per-cell. Recommend **tap-to-toggle for in/out + long-press for weight slider** (option 1 from Stage B). Reasons: matches existing app gesture vocabulary (tap = primary, long-press = secondary); doesn't visually clutter the grid with sliders; granular weight is opt-in for users who want it. **Gate 4 ADR: paint-primitive ADR.**

**Surface-Boundary Architect:**
- **H-PLT07 (state-aware primary action):** ExplorerMode primary action shifts based on active sub-mode (Paint vs Filter vs Compare vs Inspect-from-cross-link). Generic "Save" must become specific (e.g., "Save Range" in Paint mode, "Compare with…" in Compare mode). Gate 4 surface spec.
- **H-N02 (system status visible):** Cross-link source label visibility (per D-P5) ties to this — user must see where they came from at all times in cross-link sessions.

**Solver/GTO Theorist:**
- **H-N09 (help and documentation):** Range-paint primitives need a first-use inline hint (not a tutorial — a 2-line state hint that fades). "Tap to include; long-press for weight." Persists until first paint completed; never reappears.
- **H-N04 (consistency):** Range paint primitives establish a new pattern; `ContextPicker` has tile UI but not paint-on-grid. Range Lab's paint becomes the codebase's canonical 13×13 paint primitive. Future PIO-line surfaces or other range-display surfaces would inherit this vocabulary if they need painting.

**Engine-Performance Skeptic:**
- **H-N06 (loading state):** Equity histogram recompute during multi-stroke paint needs debouncing (per C-A2) + loading affordance.
- **H-N01 (visibility of system status):** Show paint-state-dirty indicator ("• Range not saved") in mode header until user explicitly saves.

**First-Principles Auditor:**
- **Forbidden patterns:** Equity values rounded to whole percentages would mislead. RL must show fractional equity (e.g., 38.2%, not 38%) to surface fine-grained range differences. DS-53 range comparison specifically depends on this fidelity. Gate 4 surface spec: **equity values render to 1 decimal place minimum.**
- **No label-shortcut narrowing surfaces** (AP-RL-01 binding). DS-54 implementation discipline binds at Gate 4.

**Cross-Surface Architect:**
- **H-N02 (system status):** Cross-link source label MUST be visible when entered via cross-link (per D-P5).
- **H-N03 (undo):** Cross-link entry should not destroy unsaved paint work. Gate 4 surface spec: "Inspect in Range Lab" cross-link warns about unsaved paint state OR auto-saves before navigating.

### Output: ⚠️ **Specific adjustments needed**

- **E-A1** **Paint primitive ADR** (new Gate-4 ADR): tap-to-toggle for in/out + long-press for weight slider. Recommended choice + alternatives considered + heuristic compliance.
- **E-A2** **Undo stack design ADR** (new Gate-4 ADR): per-stroke (each cell = one entry) vs per-session. Recommended per-stroke.
- **E-A3** **"Clear all" destructive confirmation**: confirmation modal before discarding paint state.
- **E-A4** **State-aware primary action labels**: "Save Range" / "Compare with…" / etc. based on active sub-mode.
- **E-A5** **First-use inline hint**: 2-line state hint, fades after first paint completed, never reappears.
- **E-A6** **Equity fractional display**: equity values render to 1 decimal place minimum (e.g., 38.2%, not 38%).
- **E-A7** **Paint-state-dirty indicator**: "• Range not saved" in mode header until save.
- **E-A8** **Cross-link unsaved-paint warning**: warn before navigating, OR auto-save before navigating.
- **E-A9** **Scale-aware touch ergonomics**: long-press-required mode or grid-zoom modal at small scales (per C-A3).
- **E-A10** **Equity histogram debounce + loading affordance**: 200ms debounce + "computing…" pattern.
- **E-A11** **AP-RL-01 enforcement**: no bucket-label-driven narrowing surfaces (bind in Gate 4 surface spec; CI lint pattern similar to PSD's neutral-chrome grep).

---

## Overall verdict

🟡 **YELLOW** — supersedes Gate 1 YELLOW.

**Rationale.** The four Gate-1 dimensions that drove YELLOW (1 GREEN + 4 YELLOW) are now: 1 GREEN (personas) + 1 RESOLVED-YELLOW (surface structure — Drills Consolidation REJECTED finalizes "stay in ExplorerMode") + 2 STILL-YELLOW (JTBD expansion + interaction pattern) + 1 GREEN-CONFIRMED (cross-surface — at Stage D). All three Gate-1 owner questions absorbed into this audit are RESOLVED. Two new YELLOW conditions surfaced (AP-RL-01 binding + equity-parity invariant) — neither is RED.

**Gate-1 owner question resolutions (bundled):**
- ✅ **Q1 Phasing:** Phases 0-2 bundled as v1 (parity); Phase 3+ surface-contracted but implementation-deferred.
- ✅ **Q2 Coach weighting:** Coach secondary, Chris-as-author primary validated user for DS-55.
- ✅ **Q3 Drills Consolidation:** Already moot per 2026-04-22 REJECTED status (Finding 0).
- ✅ **Q4 Mobile scope:** Landscape v1; mobile-portrait variant deferred to WS-208 follow-up.

**YELLOW conditions to clear before Gate 4:**

1. **JTBD canonicalization** (B-G1..B-G6). Author DS-52/53/54/55 in `drills-and-study.md`; defer N-range + solver-import extensions; bind AP-RL-01 on DS-54.
2. **Paint primitive ADR** (E-A1, new Gate-4 ADR). Tap-to-toggle + long-press-for-weight recommended.
3. **Undo stack design ADR** (E-A2, new Gate-4 ADR). Per-stroke recommended.
4. **Engineering Phase 0 prerequisites** (C-A1 + listed Gate-1 follow-up): `rangeToString()` reverse-serializer + equity-precompute caching layer at flop. Two engineering tickets (WS-206 caching layer + Gate-1's listed `rangeToString()` work as a sibling).
5. **LSW-RL equity-parity invariant authoring** (D-P6). New `system/invariants.md` entry INV-LSW-RL-EQUITY-PARITY + CI test.
6. **Mobile-portrait variant ticket** (Q4 resolution → WS-208 follow-up). Doesn't block landscape v1 Gate 4.

When all six clear, Gate 4 can begin. None requires src/ code — they are design / decision / invariant artifacts (except WS-206 caching layer which IS engineering work but doesn't block Gate 4 surface authoring — caching can land in parallel with surface spec).

**Implicit Gate 3 (Research) authority** to address: A-R1 (study-block dual-mode acknowledgment), A-R2 (Coach secondary citation), A-R3 (Apprentice blank-canvas tolerance deferred to Phase 3+), B-G1..B-G6 (JTBD authoring).

**Founder-ratified scope confirmations (2026-05-20 plan-mode):**
- Voice set: 6 RL-native voices (Range-Paint Interaction Designer + Solver/GTO Theorist + Engine-Performance Skeptic + Surface-Boundary Architect + Cross-Surface Architect + First-Principles Auditor).
- Gate-1 follow-up scope: bundle into Gate 2 stage outputs (this audit), not fork to Gate 3.

---

## Required follow-ups

### Existing tickets (status carry-forward)

- [ ] **WS-054 (Gate 3 Research)** — scope per A-R1..A-R3 + B-G1..B-G4. Pure JTBD canonicalization + persona-file extensions; no outstanding owner-decision residue (resolved here). **Program: design. Priority: P2.**
- [ ] **WS-055 (Gate 4 Design surfaces)** — surface update to `surfaces/postflop-drills.md` documenting Range Lab Explorer-mode expansion (per Gate 1, NOT a new `surfaces/range-lab.md`). Consumes new Paint Primitive ADR + Undo Stack ADR. Cross-link affordances added to LSW + HandReplay surface specs. **Program: design. Priority: P2. Blocked by WS-054 + WS-204 + WS-205.**
- [ ] **WS-056 (Phase 1)** — Phase 0 engineering prereqs + Phase 1 implementation (parity foundation). **Program: engineering. Priority: P2.**
- [ ] **WS-057 (Phase 2)** — Phase 2 implementation (parity continuation). **Program: engineering. Priority: P2.**

### New tickets (authored as follow-ups of this audit)

- [ ] **WS-202 (Range Lab Paint Primitive ADR)** — Gate-4 ADR documenting the paint primitive decision (tap-to-toggle + long-press-for-weight recommended; alternatives considered: tap-and-hold-for-weight, slider-per-cell). Heuristic compliance verified inline. **Program: design. Priority: P2. Blocks WS-055.**
- [ ] **WS-203 (Range Lab Undo Stack ADR)** — Gate-4 ADR documenting undo-stack design (per-stroke recommended; alternatives considered: per-session). **Program: design. Priority: P2. Blocks WS-055.**
- [ ] **WS-204 (Range Lab — `rangeToString()` reverse-serializer)** — engineering Phase 0 prerequisite per Gate 1 follow-ups. ~100 LOC + tests in `src/utils/pokerCore/rangeMatrix.js`. **Program: engineering. Priority: P2. Independent of gate ceremony.**
- [ ] **WS-205 (Range Lab — equity-precompute caching layer at flop)** — engineering Phase 0 prerequisite per C-A1. Cache `Float64Array` per combo at flop-paint-finalize; turn/river narrowing becomes a filter op, not a recompute. **Program: engineering. Priority: P2. Independent of gate ceremony.**
- [ ] **WS-206 (Range Lab — LSW-RL equity-parity invariant)** — author **INV-LSW-RL-EQUITY-PARITY** in `system/invariants.md` + CI test (sample 3 random LSW nodes, recompute equity in RL, assert ±0.5% Monte Carlo / exact-tolerance match). **Program: domain-correctness. Priority: P2. Blocks Phase 3+ DS-55 implementation.**
- [ ] **WS-207 (Range Lab — AP-RL-01 binding)** — author anti-pattern **AP-RL-01** (no bucket-label-driven range narrowing in DS-54 implementation) in domain-correctness program scope. CI lint pattern + per-combo-equity-derivation assertion in Phase 3+ narrowing implementation. **Program: domain-correctness. Priority: P2. Blocks Phase 3+ DS-54 implementation.**
- [ ] **WS-208 (Range Lab — mobile-portrait surface variant)** — separate Gate-4 surface deliverable per Q4 resolution. 13×13 paint on mobile-portrait requires grid-zoom modal OR row-paint modal. **Program: design. Priority: P3. Sequenced after Phases 1-2 ship.**

---

## Links

- Gate 1 audit: [`./2026-04-22-entry-range-lab.md`](./2026-04-22-entry-range-lab.md)
- Roundtable template: [`../ROUNDTABLES.md`](../ROUNDTABLES.md)
- Surface this expands: [`../surfaces/postflop-drills.md`](../surfaces/postflop-drills.md)
- JTBD domain: [`../jtbd/domains/drills-and-study.md`](../jtbd/domains/drills-and-study.md)
- Project charter: [`../../projects/range-lab.project.md`](../../projects/range-lab.project.md)
- Drills Consolidation REJECTED status: [`../../projects/drills-consolidation.project.md`](../../projects/drills-consolidation.project.md)
- Adjacent precedent (PSD Gate 2): [`./2026-05-19-blindspot-pre-session-drill.md`](./2026-05-19-blindspot-pre-session-drill.md)
- Anti-pattern doctrine: [[feedback_first_principles_decisions]] (AP-RL-01 derives from this)
- Sprint: SPR-093. Ticket: WS-053.

---

## Change log

- 2026-05-20 — Created. Supersedes Gate 1 YELLOW per founder D3 ratification pattern. Verdict YELLOW with 6 conditions for Gate 4 entry. All 3 still-open Gate-1 owner questions resolved inline per founder ratification 2026-05-20 plan-mode (bundle into Gate 2 stage outputs, not fork to Gate 3). 6 RL-native voices seated per founder ratification 2026-05-20 plan-mode. 7 new follow-up tickets authored (WS-202..WS-208).
