# Gate 1 Entry Audit — Played-Hand Review Protocol (HRP)

**Date:** 2026-04-23
**Auditor:** Claude (main)
**Working project name:** Played-Hand Review Protocol (HRP)
**Scope at entry:** Narrow / bridge scope per owner directive 2026-04-23 — tag-and-link played hands to existing upper-surface / LSW theoretical analogs, render the theoretical ledger + drill card inline in the replay, surface the already-computed depth-2/3 counterfactual tree. **Not** a new authoring surface for per-hand reasoning artifacts.
**Gate:** 1 (Entry — mandatory per `docs/design/LIFECYCLE.md`)
**Status:** DRAFT — pending owner review

---

## Executive summary

The app has two high-depth theoretical programs (Upper-Surface reasoning artifacts with ~60-row claim-falsifier ledgers, LSW line-study with 7-dim per-node audits) and one low-depth played-hand review surface (`HandReplayView` + `AnalysisView`'s Hand Review tab) that shows equity + segmentation + single-line EV copy without theoretical citation. The narrow HRP scope closes that gap by making the replay surface a **consumer** of the theoretical library rather than a parallel producer: a flagged played decision resolves to its upper-surface analog (via a canonical spot-key), the artifact's ledger + drill card render inline, and the depth-2/3 counterfactual tree already computed in `gameTreeEvaluator.js` is surfaced rather than discarded.

Persona coverage is strong — Post-Session Chris, Apprentice, and Coach-review-session situationals already cover deep review. JTBD coverage has **three confirmed gaps** in the Session Review domain (SR-*), all adjacent to existing proposed JTBDs (SR-26, SR-88). The scope is a **surface-bound augmentation + cross-surface link**, not a new routed view.

**Verdict: YELLOW.** Personas GREEN. JTBD gaps confined to extending an existing domain (no new domain, no new core persona). Gate 2 Blind-Spot Roundtable required, scoped tightly to the three gaps and the one non-trivial technical invariant (spot-key mapping fidelity). No Gate 3 research expected.

---

## 1. Scope classification

Per `docs/design/LIFECYCLE.md` Gate 1 options:

| Classification | Applies? | Evidence |
|---|---|---|
| Surface-bound fix | **Yes** | Augmentations to `HandReplayView/ReviewPanel.jsx`, `HeroCoachingCard.jsx`, `AnalysisView/HandBrowser.jsx` |
| Surface addition | **Partial** | No new routed view. New *inline panel* within existing ReviewPanel ("Theoretical ground-truth" section). A modal overlay for the full ledger is candidate — Gate 4 decides |
| Cross-surface journey change | **Yes** | New link-out from played replay to upper-surface artifact and LSW line node; new flag-driven filter on HandBrowser; hand-schema additions (flag + reviewState) |
| Product-line expansion | No | Main app only. Sidebar is out of scope (live-game cadence doesn't match deep review) |

**Primary classification:** Surface-bound augmentation + cross-surface journey change. Less severe than a surface-addition classification. Per lifecycle worked-examples: "Add new menu action" → Gates 1, 4, 5 (Gate 2 if adds new interaction pattern) — we cross the Gate-2 threshold because flag-and-link is a new interaction pattern on the replay surface.

---

## 2. Personas identified

### 2.1 Existing cast evaluation

**Core personas:**

| Persona | File | Relevance |
|---|---|---|
| Chris (live player) | `personas/core/chris-live-player.md` | Primary identity. Post-session sub-situation is the real fit |
| Apprentice / student | `personas/core/apprentice-student.md` | **Primary** — already cited as primary target of `HeroCoachingCard`. Deep review with citations is exactly this persona's use case |
| Coach | `personas/core/coach.md` | Secondary — citation infrastructure makes coaching reviews easier |
| Rounder | `personas/core/rounder.md` | Plausible — heavy review user |
| Hybrid Semi-Pro | `personas/core/hybrid-semi-pro.md` | Plausible — mix of study + play |
| Scholar (drills-only) | `personas/core/scholar-drills-only.md` | Non-fit — no played hands to review |
| Online MTT Shark / Multi-Tabler | — | Secondary — post-session-only for these |

**Situational personas:**

| Situational | File | Covers this protocol? |
|---|---|---|
| **Post-Session Chris** | `personas/situational/post-session-chris.md` | **Direct fit.** Snapshot explicitly names "occasionally a deeper dive into a specific spot." Constraints GREEN (time plentiful, density acceptable, two-handed). Frustration #3 is literally *"hand replay that doesn't expose what the app 'knew' at decision time vs. in hindsight"* — HRP's ledger addresses that |
| Coach Review Session | `personas/situational/coach-review-session.md` | Direct fit for coach-assisted use |
| Between-Hands Chris | `personas/situational/between-hands-chris.md` | **Non-fit for deep review** (90–180s budget too short for ledger). But "review the hand I just lost" is a candidate adjacent JTBD — Gate 2 Stage C to decide whether HRP has a compressed "single-glance" mode |
| Study Block | `personas/situational/study-block.md` | Partial — study-block typically targets fluency (generic), not specific own-hand review |
| Presession Preparer | `personas/situational/presession-preparer.md` | Non-fit — this is the downstream consumer surface for drills, not the creator |
| First-Principles Learner | `personas/situational/first-principles-learner.md` | Partial — citation ladder serves this, but not specific to played-hand context |

### 2.2 Gap analysis — personas

**No confirmed persona gap.** Post-Session Chris + Apprentice + Coach-review-session collectively cover "hero is at home or in a cafe, picking a specific hand from last night's session and spending 5–15 minutes on it with citation support." The Post-Session Chris artifact (line 12) even foreshadows this protocol.

**Open question for Gate 2 Stage C:** Is there a sub-situation "Between-Hands review of the hand that just ended" that deserves a compressed HRP variant? If yes, we may need a new situational persona or compressed mode; if no (likely — live cadence bans depth), HRP is unambiguously a post-session surface.

### 2.3 Coverage verdict

**GREEN** on persona coverage. Gate 2 Stage C should confirm no compressed-mode persona emerges.

---

## 3. JTBD identified

### 3.1 Existing atlas evaluation

**Session Review (SR-23..27, SR-88)** — `jtbd/domains/session-review.md` — the home domain.

| ID | Title | State | Covers HRP? |
|----|-------|-------|-------------|
| SR-23 | Highlight worst-EV spots | Active | Adjacent — discovery surface, not protocol surface. HandBrowser significance sort serves this today |
| SR-24 | Filter by street/position/opponent-style | Active | Adjacent — HandBrowser filters. HRP adds a *flag* filter (new dimension) |
| SR-25 | Replay at own pace with range overlay | Active | **Covers the baseline** HandReplayView flow — range overlay at each decision. Does **not** cover theoretical-baseline overlay. HRP extends this, doesn't replace it |
| SR-26 | Flag disagreement + add reasoning | **Proposed** | **Near-fit** — but SR-26 is "hero disagrees with app's analysis" (adversarial note). HRP flagging is "hero wants deep review" (study note). Related, not identical |
| SR-27 | Shareable replay link for coach | Proposed | Adjacent — out of scope for HRP narrow |
| SR-88 | Similar-spot search across history | Proposed | Adjacent — HRP's linking mechanism (played spot → upper-surface analog) is the single-target form of similar-spot search. Could inform future SR-88 impl |

**Hand Entry (HE-11..17)**:

| ID | Title | State | Covers HRP? |
|---|---|---|---|
| HE-17 | Flag hand for post-session review mid-recording | **Active** | **Direct fit for the flag-ingest side** — but HE-17 is the *producer* (flagged at recording time). HRP adds the *consumer* (flag-driven queue on HandBrowser). HE-17 is load-bearing but the corresponding "consume the flag" JTBD doesn't exist |

**Mid-Hand Decision (MH-01..13)**:

| ID | Title | State | Notes |
|---|---|---|---|
| MH-10 | Plain-English why for a recommendation | Active | Adjacent — HRP's inline ledger is the post-session, richer form. MH-10 stays live-cadence |
| MH-12 | Cited assumption(s) backing a recommendation | **Proposed** | **Direct conceptual cousin** — HRP is essentially MH-12 in review cadence (hours after the hand, not seconds). Infrastructure shareable. **Coordination with exploit-deviation project Phase 6+ recommended** |

**Drills and Study (DS-43..47)**:

| ID | Title | State | Notes |
|---|---|---|---|
| DS-44 | Correct-answer reasoning (not just score) | Active | Adjacent — DS-44 is correct-answer-reasoning inside drill surfaces; HRP is the same pattern on played hands |
| DS-45 | Custom drill from own hand history | Proposed | Adjacent but distinct — DS-45 *generates drills* from history; HRP *cites theory* against played hands. Shared infrastructure possible (spot-key extraction) |

### 3.2 Gap analysis — JTBD

**Gap 1 — missing JTBD: "Deep-review a flagged hand against the theoretical baseline."**

The core new outcome. SR-25 covers range overlay; SR-26 covers disagreement flagging; neither covers "render the upper-surface ledger (claims + falsifiers + sensitivity flips) inline for the decision point I'm looking at." Proposed ID: **`JTBD-SR-28` — Deep-review a flagged hand against upper-surface theoretical ground-truth**.

**Gap 2 — missing JTBD: "Link the played decision to its theoretical analog."**

The infrastructure JTBD. No existing entry captures the spot-key resolution job ("I am at BTN vs BB, 3BP IP, wet T96 flop, facing a donk of 33% pot — find the upper-surface artifact for this decision, if any exists"). This is distinct from SR-88 (similar-spot search across *own* history) because the corpus is the theoretical library, not played hands. Proposed: **`JTBD-SR-29` — Resolve a played decision to its canonical theoretical analog (upper-surface / LSW node)**.

**Gap 3 — missing JTBD: "See the counterfactual tree — what I could have done — for a past decision."**

The `gameTreeEvaluator.js` depth-2/3 EV tree is already computed and discarded at the UI boundary. HRP surfacing requires a JTBD framing — "for a given past decision, see the branching EV of alternative actions, per runout class, with realization factors visible." Proposed: **`JTBD-SR-30` — See the counterfactual EV tree for a past decision, with runout-class breakdown**.

**Gap 4 — partial coverage: "Flag a hand for deep review later"** — split between HE-17 (producer side, Active) and the missing consumer side ("consume the flag queue on HandBrowser"). Minor. Folding into SR-24 filter expansion may be cleaner than a new JTBD.

### 3.3 Coverage verdict

**YELLOW** on JTBD coverage. Three confirmed gaps, all within the existing Session Review domain. No new domain required. One of the three (SR-29, spot-key resolution) is the non-trivial technical invariant that Gate 2 must stress.

---

## 4. Gap analysis — composite verdict

Per `LIFECYCLE.md` Gate 1 rubric:

- GREEN: all personas + JTBDs exist and fit.
- YELLOW: 1–2 gaps (specific persona or JTBD missing).
- RED: feature targets a persona / outcome space we haven't modeled at all.

This project has:

- **Persona gaps:** 0 confirmed. 1 open question (compressed between-hands variant — likely non-fit).
- **JTBD gaps:** 3 confirmed (SR-28, SR-29, SR-30), all in the Session Review domain, all extensions rather than new domains.
- **Cross-surface impact:** HandReplayView + HandBrowser augmented. Sidebar untouched.
- **New interaction patterns:** Flag gesture, theoretical-ledger inline render, depth-2/3 tree disclosure, upper-surface link-out.
- **Shared infrastructure with exploit-deviation project:** citation / assumption display (MH-12). Coordination opportunity, not a dependency.

**Verdict: YELLOW.**

Three JTBD gaps confined to an existing domain, zero persona gaps, narrow scope, no new routed view, no new core persona, shared infrastructure with an active project. Strictly less ambitious than exploit-deviation's RED.

---

## 5. What this triggers

Per `LIFECYCLE.md`, YELLOW verdict triggers:

1. **Gate 2 (Blind-Spot Roundtable) — required.** Scoped tightly to the three JTBD gaps, the spot-key resolution invariant, and the Between-Hands / compressed-mode persona question.
2. **Gate 3 (Research) — unlikely needed.** Gate 2 will likely produce three JTBD stubs authorable same-session (extensions to existing session-review.md), not a new domain. If Gate 2 uncovers a compressed-mode persona, small Gate 3 effort to author the situational persona file.
3. **Gate 4 (Surface specs) — blocked until Gate 2 closes.** Existing `hand-replay-view.md` surface artifact updated with HRP behavior; `hand-browser` (inline within `analysis-view.md`) updated with flag filter; new inline-panel spec (ledger display) authored.

---

## 6. Proposed Gate 2 scope

The Gate 2 Blind-Spot Roundtable session should cover:

1. **Stage A — Persona sufficiency:** Confirm Post-Session Chris + Apprentice + Coach-review-session is sufficient. Stress-test the compressed "Between-Hands review" hypothesis — does a live-player wanting to understand the hand they just lost belong in HRP or is that a separate surface?

2. **Stage B — JTBD coverage:** Author SR-28, SR-29, SR-30 stubs. Decide whether SR-29 (spot-key resolution) needs a dedicated engine-module JTBD or whether it's a pure infrastructure concern. Decide whether flag-consume (HE-17 consumer side) extends SR-24 or needs its own entry.

3. **Stage C — Situational stress:** Walk Post-Session Chris and Apprentice through the flow:
   - Hero flags hand at recording (HE-17). Hand ends. Next day, hero opens HandBrowser. Does the flag filter surface the hand? Is the flag visible on the hand card?
   - Hero opens flagged hand → HandReplayView. For each decision: does the inline "Theoretical analog" panel resolve? When no analog exists (majority of real-world spots), what's the empty state?
   - Hero clicks into ledger: is the render inline or overlay? At ≥60 rows per upper-surface node, inline may overwhelm ReviewPanel. Modal overlay is the likely answer — stress this.

4. **Stage D — Cross-product / cross-surface:** Sidebar impact — none expected (live cadence bans ledger density). Cross-surface with exploit-deviation's citation UI — shared infrastructure opportunities (assumption-card component reuse).

5. **Stage E — Heuristic pre-check:** Nielsen + poker-live-table + mobile-landscape.
   - Information density: ledger inline vs. modal decision.
   - Recognition > recall: flag icon on hand cards, filter chip persistence.
   - Error prevention: flag toggle undo, accidental-flag protection.
   - Aesthetic minimalism: ledger at ≥60 rows violates minimalism baseline — modal overlay with progressive disclosure is the mitigation.

**Non-trivial technical invariant for Stage B/E stress:** the spot-key resolution. A played decision has ~8 dimensions (position, game-type, SPR bucket, texture class, action sequence, street, PFA, stack depth). Upper-surface artifacts have canonical IDs encoding a subset (e.g. `btn-vs-bb-3bp-ip-wet-t96-flop_root`). Resolution is fuzzy: dry-J63 != dry-T72 although both are "dry, 3bp, IP." Gate 2 must surface this as "how strict is the match? What confidence is the link shown with? What's the 'no analog' UX?" — and route to a Gate 4 spec.

---

## 7. Open questions (non-blocking — routed to Gate 2/4)

1. **Ledger render mode.** Inline section in ReviewPanel vs. modal overlay vs. side-panel. ~60-row ledgers probably force modal overlay with progressive disclosure. Gate 4 decides.
2. **Spot-key mapping strictness.** Exact key match only? Or best-approximate-match with confidence indicator? Missing-analog state: "No theoretical analog exists for this spot — propose one?" (loop-closer to LSW/upper-surface authoring) vs. silent empty-state.
3. **Depth-2/3 counterfactual scope.** Surface the full tree or just the top-3 alternative actions? Tree is expensive to render readable; top-3 may be what Post-Session Chris actually wants.
4. **Flag semantics.** Is HE-17's flag binary ("flagged") or typed ("flag for review," "flag disagreement" matching SR-26, "flag for coach" matching SR-27)? Typed flags future-proof but add UX cost. Gate 2 Stage B decides.
5. **Hero's own notes.** Out of scope per narrow directive, but Gate 4 should note that SR-26 (hero reasoning note) is a natural same-panel add-on.
6. **Shared infra with exploit-deviation.** MH-12 assumption-card component is likely reusable. Coordination point with exploit-deviation project Phase 7 wiring — Gate 4 should cite MH-12's card design if it ships first.

---

## 8. Backlog proposals

For `.claude/BACKLOG.md` when owner approves:

```
- [ ] HRP-G2 — Gate 2 Blind-Spot Roundtable for played-hand review protocol.
      Custom personas: Post-Session Chris, Apprentice, Coach-review-session,
      plus Skeptic (to stress spot-key fidelity) and Information-Architect (to
      decide ledger render mode). Output: GREEN/YELLOW/RED + JTBD stubs +
      Gate 4 blockers list. Ref: docs/design/audits/2026-04-23-entry-played-hand-review-protocol.md.
      Effort: S-M. Priority: P2 (behind active LSW + exploit-deviation work).

- [ ] HRP-G3 — Author SR-28, SR-29, SR-30 JTBD entries in session-review.md.
      If Gate 2 uncovers a compressed-mode persona, author that too.
      Blocks: HRP-G2. Effort: S. Priority: P2.

- [ ] HRP-G4-SPEC — Gate 4 surface spec updates: hand-replay-view.md (ledger
      inline/modal), analysis-view.md (HandBrowser flag filter + flag indicator),
      new ledger-display spec (or reuse exploit-deviation MH-12 assumption-card).
      Blocks: HRP-G3. Effort: M. Priority: P2.

- [ ] HRP-SPOT-KEY — Engine-module feasibility spike: extract canonical spot-key
      from played decision timeline; match to upper-surface artifact corpus and
      LSW line nodes. Outputs match-confidence score + empty-state policy.
      Independent of gates, runnable pre-Gate-4 to de-risk the central
      invariant. Effort: M. Priority: P2.
```

---

## 9. Sign-off

**Auditor:** Claude (main), 2026-04-23.
**Verdict:** **YELLOW.**
**Reason:** 3 JTBD gaps (all session-review domain extensions), 0 persona gaps, narrow cross-surface scope. No new domain, no new core persona, no new routed view.
**Next gate:** Gate 2 Blind-Spot Roundtable, scoped tight to the three gaps + spot-key invariant + ledger-render-mode question.
**Owner review:** Pending. Two decisions invited:
1. Accept YELLOW verdict and the narrow scope as entered?
2. Prioritize HRP-G2 into the P2 queue behind active LSW + exploit-deviation work, or defer until one of those lands?

---

## Change log

- 2026-04-23 — Created as Gate 1 Entry for played-hand review protocol (narrow / bridge scope).
