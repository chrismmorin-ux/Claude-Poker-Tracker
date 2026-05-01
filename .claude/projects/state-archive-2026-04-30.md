
---
<!-- Migrated from .claude/STATUS.md by CWOS /adopt -->

# Project Status

Last updated: 2026-04-30 by Claude (**MASTER PLAN 2026-04-30 RATIFIED — 5-workstream program orchestrating direction set by owner this session.** Charter at `.claude/projects/master-plan-2026-04-30.md`. Owner statement of vision: "most accurate predictive decisions ever in the moment new data arrives" + "full study section beginner to pro." **The 5 workstreams:** **B+E (TIA)** TableView Invariant Audit + Straddle — owner reported two action-availability bugs ("check" appearing for seat that shouldn't have it; next-to-act losing bet ability after fold) which are symptoms of an unauthored invariant matrix; framed as audit-first (matrix authoring, NO fixes), then straddle wired into matrix, then bounded fix wave. **A (PIO)** Player Identification v2 — sighting log + wardrobe/jewelry/age/logo entities + dynamic recognition search ("is that the guy?" with red-hoodie evidence accumulation) + phone-camera-capture + crop + downscale via web-native `<input capture>`. PIO absorbs PlayersView scaling + persistence audit + PhysicalSection rework (no separate tickets — fix-twice waste avoided). PIO reuses PEO infra (avatar features, draft autosave, retro-link, picker primitives) per inventory at Gate 1. PIO is its own program, not a PEO patch (schema additions large, search UX net-new). **C (engine maturation)** EAL Stream B-matcher → C → B-expand → Tier 1 + game-tree 26.x continuing — runs parallel; new touchpoint will be A's recognition-confidence schema feeding villain identity input. **D (SCF)** Self-Coach Foundation — leak-detection-to-lesson loop ("user folds to flop 3-bets at 78% but 3-bet range justifies 60% — distill at user's tier"); existing infra ~70% (weaknessDetector, decisionAccumulator, range engine, EAL anchors); MISSING skill assessment + lesson authoring framework + curriculum spine. Authoring is the long pole (indefinite). D Gate 1 opens parallel with B Phase 1. **F (continuation)** SHC Gate 5 V-color-tokens §V + DCOMP-W4-A3-F4 — background. **Dependency graph:** A absorbs (PlayersView scaling, persistence, PhysicalSection); A produces (recognition-confidence schema → C); B+E share code surface (bundled); B foundational to demo trust; D draws on C output (EAL anchors as teaching primitives); F independent. No hard cross-stream dependencies. **Sequencing:** Phase 1 = B+E (~5 sessions), Phase 2 parallel = A Gates 1-2 + D Gate 1 + C + F, Phase 3 = A Gates 3-4 while C+F continue, Phase 4 = A Gate 5 implementation + D Gates 2-4 design, Phase 5 = D Gate 5 + ongoing authoring. Estimated total ~25-30 sessions over 2-3 months + indefinite ongoing for D authoring + C engine work. **Owner ratifications logged:** 8 binding decisions captured in charter §"Owner ratification log". **Open operational questions before Phase 1 begins (non-blocking):** straddle scope (live-only vs Mississippi, UTG-only vs any-position, re-straddle); D Gate 1 skill ladder (suggested 6 tiers: novice/live-rec/studied-amateur/part-time-grinder/serious-grinder/pro); A Gate 1 timing (recommend parallel with B). **Audits/refactors woven into owning workstreams, not deferred:** TableView invariant matrix in B (not future test-health sprint); PlayersView scaling/persistence/PhysicalSection in A (not separate tickets); skill-assessment module in D (not separate project); mirror-lock test in F V-color-tokens migration (not follow-on). **In-flight uncommitted work:** none — tree clean. NEXT: owner answers 3 operational questions, then Phase 1 of B+E begins (invariant matrix authoring session, audit-only, no fixes). All prior NEXT items below now slot under workstream F. Memory updated with master plan entry.

---

**Prior update (superseded, kept for provenance — 2026-04-30 SHC Gate 5 PR-17 V-3 §II rejection wiring close):** (**SHC Gate 5 — 17 PRs shipped; V-status §I + V-affordance §IV + V-3 §II FULLY CLOSED (module + wiring + REJECTED tier) + V-density §VI FULLY CLOSED (ladder + sweep + tail).** This session continued by shipping PR-17. **PR-17 `49bb4e8`** V-3 §II RT-68/69 rejection wiring closes the last V-3 behavioral gap: REJECTED was the only one of 5 freshness tiers classifyFreshness could return but production never set. New perHand state slot `lastRejectionAt` set on three rejection events: (1) RT-68 cross-hand contamination at handleAdvice line 603 (locked-hand guard), (2) RT-68 stale-earlier-street at handleAdvice line 631 (with new advice_rejected logPipelineEvent call for parity with cross-hand path), (3) RT-69 _pendingAdvice force-clear at hand-new boundary (using new `hadPendingAtEntry` flag to capture pre-attempt state since promotion block nulls _pendingAdvice regardless of outcome). Cleared on accept / hand-new (UNLESS RT-69 just stamped) / table-switch. computeAdviceStaleness threads `rejected: coordinator.get('lastRejectionAt') != null` into coordState; classifyFreshness's existing branch resolves REJECTED tier; updateStaleAdviceBadge renders `class="stale-badge fresh-tier-rejected"` + text "Rejected". FRESH_SIGNAL_REGISTRY.STALE_ADVICE.visibleRejection promoted false → true to align with INV-FRESH-5 ("rejection is visible"). renderKey gains boolean `lastRejectionAt` projection. STATE_FIELD_SCOPES.md updated with perHand declaration. freshness-signal-registry.test.js +9 PR-17 tests across 8-transition state machine + visibleRejection alignment (62 → 71 tests in file). 2240 → 2249 extension tests (+9); build clean. V-3 §II behavioral surface now FULLY COMPLETE across 4 PRs (PR-4 + PR-13 + PR-14 + PR-17). The §II.1 "brief inline text marker" polish is the only remaining surface detail — deferred unless owner directs.)

---

**Prior update (superseded, kept for provenance — 2026-04-30 V-density §VI fully closed):** (**SHC Gate 5 — 16 PRs shipped; V-status §I + V-affordance §IV + V-3 §II module-API+wiring + V-density §VI FULLY CLOSED (ladder + sweep + tail).** This session continued by shipping PR-16. **PR-16 `84c74c6`** V-density §VI px literal tail closes the §VI.2 grandfathered allowlist: 5 remaining px-literal font-size sites migrated to the 3-tier ladder. .invariant-badge 10px → --type-meta-stat (11px, +10% intentional WCAG-floor bump; FM-DENSITY-2 closure paralleling FM-DENSITY-1); .seat-sample-unknown 11px → --type-meta-stat (exact); .ab-action-word 24px → --type-display (exact, PRIMARY attention-budget tier); .pp-toggle .affordance-chevron 10px override DELETED (canonical class owns chevron font-size for every context now — Plan-toggle chevron grows 10→11px); #pipeline-msg-counters inline 10px → --type-meta-stat. After PR-16, sidebar source files contain ZERO `font-size: <N>px` declarations — every consumer on `--type-*` ladder per §VI.2 rem mandate (px ignores user OS-level font + browser zoom; rem respects per WCAG 2.1 SC 1.4.4 AA). density-tokens.test.js +6 regression assertions (11 → 17). 2234 → 2240 extension tests (+6); build clean. Visual verification at 420×900 via Playwright MCP confirmed token resolution + render integrity. **V-density §VI is fully closed: ladder authored (PR-1), 175-site sweep (PR-15), grandfathered allowlist closed (PR-16). Remaining tail is the legacy --font-* deprecation alias removal — deferred until a fixture-diff verification across the SHC milestone confirms no out-of-tree consumer regressed.** **What's left on Gate 5 across other V-decisions:** V-color-tokens §V Layer-1/Layer-2 graph migration (~46 hex literals + 51 `--m-*` rename + STYLE_COLORS consolidation + `shared/design-tokens.meta.js` + `shared/tier-thresholds.js` extraction + mirror-lock test enablement); V-3 §II RT-68/69 SW-replay-rejection production wiring (REJECTED tier surface). **In-flight uncommitted work:** none — tree clean. NEXT (open path, owner directs): V-color-tokens §V (largest remaining; multi-PR; biggest infrastructure payoff — unblocks mirror-lock); V-3 RT-68/69 rejection wiring (smaller); legacy --font-* alias removal (cleanup); OR DCOMP-W4-A3-F4 (only formal P0 NEXT). Memory unchanged this session.

---

**Prior update (superseded, kept for provenance — 2026-04-30 V-density §VI sweep):** (**SHC Gate 5 — 15 PRs shipped; V-status §I + V-affordance §IV + V-3 §II module-API+wiring + V-density §VI typography sweep CLOSED.** This session continued by shipping PR-15. **PR-15 `a0ca2af`** V-density §VI typography ladder sweep: 175 sidebar render-path consumers migrated from legacy 6-name `--font-{micro,xs,sm,base,md,lg}` (collapsed to 2 effective sizes 11px/14px) to canonical 3-tier `--type-{display,body,meta-stat}` ladder. Mapping is value-preserving at root 16px (rem-based; closes V-1 (c) accessibility gap per WCAG 2.1 SC 1.4.4). Files swept: side-panel.html 138 + render-tiers.js 9 + render-street-card.js 28 + side-panel.js 7 + render-orchestrator.js 1. Legacy `--font-*` tokens stay defined as deprecation aliases. density-tokens.test.js +5 sweep regression assertions (6 → 11). 2229 → 2234 extension tests (+5); build clean. Visual verification at 420×900 via Playwright MCP confirmed token resolution (11px/14px) + flopWithAdvice fixture renders identically to pre-sweep baseline. **What's left on V-density §VI:** px literal migration of the 5 grandfathered sites (10px invariant-badge / 11px seat-sample / 14px body / 24px action-word / pp-toggle 10px override) — these have visual implications warranting focused review; legacy `--font-*` token removal after milestone fixture-diff verification. **What's left on Gate 5 across other V-decisions:** V-color-tokens §V Layer-1/Layer-2 graph migration (~46 hex literals + 51 `--m-*` rename + STYLE_COLORS consolidation + design-tokens.meta.js + mirror-lock test enablement); V-3 §II RT-68/69 SW-replay-rejection production wiring (REJECTED tier surface). **In-flight uncommitted work:** none — tree clean. NEXT (open path, owner directs): V-color-tokens §V (infrastructure, multi-PR — biggest remaining); V-density §VI px literal migration (smaller, +1px size shifts); V-3 RT-68/69 rejection wiring (smaller); OR DCOMP-W4-A3-F4 (only formal P0 NEXT). Memory unchanged this session.

---

**Prior update (superseded, kept for provenance — 2026-04-30 V-3 §II module+wiring):** (**SHC Gate 5 — 14 PRs shipped, V-status §I + V-affordance §IV + V-3 §II module-API + production-wiring CLOSED.** This session shipped PRs 13+14 closing V-3 §II.7 module API contract + §II.9 co-shipping #2 R-2.3 fix. **PR-13 `a5cac87`** added 3 missing `shared/render-staleness.js` exports: `classifyFreshness` composed pure classifier integrating §II.1 conditions in priority order (rejected → unknown → street-mismatch → staleContext → age-based) with caller-defined thresholds + injected `now` + `coordState`; `renderFreshnessDot` AGING/UNKNOWN/REJECTED tier dot emission with `data-fresh-{tier,mechanism,scope}` attrs + ARIA polite-status; `renderConfidenceForFreshness` V-2.4 carry-forward gate forcing `conf-tier-unknown` when freshness ∈ {STALE, REJECTED, UNKNOWN}. 31 → 62 freshness tests (+31). **PR-14 `0b3ca18`** wires production: 1Hz `adviceAgeBadge` timer body replaced with `coordinator.tickAdviceAge()` (bumps new monotonic `adviceAgeTickCount` field + scheduleRender) — closes the R-2.3 violation flagged by §II.10 forbidden #8 (timer-driven DOM mutation outside render path). `computeAdviceStaleness` migrated to delegate classification to `classifyFreshness`, becoming a thin tier→legacy `{isStale, ageMs, reason}` adapter so call sites stay stable; REJECTED tier now mapped to `reason: 'rejected'` for future SW-replay-rejection wiring. STATE_FIELD_SCOPES.md updated for `adviceAgeTickCount` monotonic. z2-decision.test.js SR-6.12 §2.10 pins updated for new architecture (forbidden-pattern guards on the timer block ensure no regression). 2229 extension tests green; build clean. **What's left on V-3 §II:** RT-68/69 SW-replay-rejection signal wiring to surface REJECTED tier in production (deferred — needs coordinator state slot + service-worker rejection event surface); per-zone freshness consumers (Z3 cards-strip + future zones) — additive. **What's left on Gate 5 across other V-decisions:** V-color-tokens §V Layer-1/Layer-2 graph migration (~132 inline px sites + ~50+ color literals; required before mirror-lock test enablement); V-density §VI typography ladder migration tail (~131 inline font-size px sites). **In-flight uncommitted work:** none — tree clean. NEXT (open path, owner directs): V-color-tokens §V (infrastructure, unblocks mirror-lock); V-density §VI tail (mostly mechanical sweep); V-3 §II RT-68/69 rejection surface + per-zone consumers; OR DCOMP-W4-A3-F4 (only formal P0 NEXT in BACKLOG.md). Memory unchanged this session.)

---

**Prior update (superseded, kept for provenance — 2026-04-30 V-affordance §IV close):** (**SHC Gate 5 — 12 PRs shipped, V-status §I + V-affordance §IV FULLY CLOSED.** This session shipped PRs 11+12 closing the V-affordance §IV.10 co-shipping list end-to-end. **PR-11 `0d6eadc`** chevron-class collapse + click-wiring consolidation: 4 legacy chevron CSS classes (.deep-chevron / .collapsible-chevron / .pp-chevron / .tourney-bar-chevron) deleted from side-panel.html; pp-toggle / more-analysis / model-audit migrated to data-affordance attrs + delegated registry; 3 per-element addEventListener blocks removed; aria-expanded sync added per §IV.6 ARIA contract; harness.js parity update; affordance-registry.test.js +15 source-grep regression assertions (22 → 37 affordance tests). **PR-12 `9d54897`** §IV.10 polish trio: (#6) tourney-log-show + diag-show buttons declare role="link" per navigate-semantic shape; (#7) render-orchestrator.js pinned-villain 4 substitutions migrated `||` → `??` closing the FM "sampleSize=0 collapses to global advice fallback" bug; (#8) `.seat-circle.hero` CSS drops gold ring/gradient/text color (V-1 (c) compliance) + uses 4px border-width as distinct ring weight; ★ glyph stands as sole canonical hero indicator per §IV.5 closed registry. New v-affordance-polish.test.js 9 tests. 2189 → 2198 extension tests (+9), build clean. Visual verification at 420×900 via Playwright MCP confirmed: zero legacy chevron classes in rendered DOM (11 canonical .affordance-chevron sites), hero seat shows `★C $6` text + 4px border + neutral color rgb(55,65,81)=`--border-subtle` (NOT gold). **V-affordance §IV is fully shipped — co-shipping items #1-#8 closed across PR-2 (vocabulary + listener + tourney-bar) + PR-11 (chevron collapse + consolidation) + PR-12 (polish trio).** Prior SHC sessions: V-status §I (PRs 5-10), V-2 §III (PR-3), V-3 §II (PR-4 partial), V-affordance §IV (PR-2 vocabulary), V-density §VI (PR-1 partial). **What's left on Gate 5:** V-3 staleness §II implementation (no longer blocked — PR-11's click-wiring consolidation closed the failure-engineer Q-2 prereq); V-color-tokens §V Layer-1/Layer-2 graph migration (~132 inline px sites + ~50+ color literals; required before mirror-lock test enablement); V-density §VI typography ladder migration tail (~131 inline font-size px sites). **In-flight uncommitted work:** none — tree clean. NEXT (open path, owner directs): V-3 staleness §II (now-unblocked); V-density tail (largest scope, mostly mechanical); V-color-tokens (infrastructure, unblocks mirror-lock); OR DCOMP-W4-A3-F4 (the only formal P0 NEXT in BACKLOG.md). Memory unchanged this session.)

---

**Prior update (superseded, kept for provenance — 2026-04-29 SHC Gate 5 PR-9+10):** (**SHC Gate 5 — 10 PRs shipped, V-status §I FULLY CLOSED.** This session shipped PRs 9 + 10 in sequence, completing the V-status §I tail and finishing all 5 INV-STATUS-* invariants. **Gate 5 PR ledger (10):** PR-1 `4c1b772` FM-DENSITY-1 9px stale-badge → typography ladder. PR-2 `fc856b3` V-affordance vocabulary + delegated listener. PR-3 `0378618` V-2 §III confidence. PR-4 `852b76d` V-3 §II freshness. PR-5 `639dc49` V-status §I axis-1 vocabulary (FM-STATUS-1+2 closure). PR-6 `62178da` V-status §I axis-1 writer consolidation + legacy CSS deletion. PR-7 `34a2db4` V-status §I axis-2. PR-8 `3b1e91e` V-status §I axis-3. **PR-9 `909471b` V-status §I INV-STATUS-4 connected-waiting 30s timer (this session)** — RenderCoordinator gains 2 perTable fields (`connectedWaitingExpired` + `connectedWaitingTimerActive`) + 3 methods (start / clear / evaluate). Timer registered through `scheduleTimer('connectedWaitingTimeout')` per RT-60 contract. Driver wired in side-panel.js from every input-mutation site (port-state callbacks + handlePipelineStatus + handleHandsUpdated). buildStatusBar gains optional `connectedWaitingExpired` param; on expiry text becomes "Tracking — no hands in 30s; reload may help" while tier remains DEGRADED yellow per spec §I.8. STATE_FIELD_SCOPES.md updated; state-clear-symmetry.test.js allowlist extended. 16-test connected-waiting-timer.test.js + 6 buildStatusBar assertions added. Closes FM-STATUS-3. **PR-10 `31d858f` V-status §I INV-STATUS-5 + pipeline visibility-gating verification — closes V-status §I (this session)** — RenderCoordinator gains `clearForAppDisconnect` method nulling the 4-field app-bridge cohort (lastGoodExploits / lastGoodWeaknesses / lastGoodBriefings / lastGoodObservations) coherently. Driver in handlePipelineStatus reads `prevAppConnected` BEFORE writing the new pipeline value, then invokes clear on the `true → false` transition. STATE_FIELD_SCOPES.md cohort row declares both clearing paths per spec §I.9 invariant. New 7-test app-disconnect-clearing.test.js + 3-test pipeline-visibility-gating.test.js (regression pins for both !hasTableHands branches in renderAll + the hasHands lastHandCount > 0 derive). shared/render-status.js header tail scrubbed — V-status §I is fully closed. Closes FM-STATUS-5. 2178/2178 extension tests green (+32 across PR-9+PR-10) + build clean. **What's left on Gate 5 across other V-decisions:** V-3 staleness §II implementation (blocked on click-wiring `data-affordance` consolidation per Q-2 handler-on-detached-element race); V-color-tokens §V Layer-1/Layer-2 graph migration (~132 inline px sites onto the 3-tier ladder; ~50+ color literals onto categorical hues; required before mirror-lock test enablement); V-affordance §IV shape/glyph implementation (closed 6-shape + 4-glyph registries authored, render-side migration pending); V-density §VI ladder migration tail (~131 inline font-size px sites remaining). **In-flight uncommitted work:** none — tree clean. NEXT (open path, owner directs): pick a different V-decision (V-density tail typography migration is largest; V-affordance render migration is largest UX-visible payoff; V-color-tokens migration unblocks mirror-lock testing) OR DCOMP-W4-A3-F4 (the only formal P0 NEXT item — `OnlineView.jsx:79` silent reload, requires extension handshake). Memory unchanged this session.)

---

**Prior update (superseded, kept for provenance — 2026-04-29 SHC Gate 4 close):** (**Sidebar Holistic Coherence (SHC) — Gate 4 COMPLETE.** All 5 Gate 4 deliverables CLOSED across 3 sessions (2026-04-27 → 2026-04-29). Shell spec `docs/design/surfaces/sidebar-shell-spec.md` is RESOLVED across all 6 sections (§I status / §II freshness / §III confidence / §IV affordance / §V color tokens / §VI density). Doctrine `docs/SIDEBAR_DESIGN_PRINCIPLES.md` evolved v3 → v8 — added 7 binding rules (R-1.6 cross-zone treatment-type / R-1.7 staleness shape-class / R-1.8 freshness mechanism declaration / R-1.9 color-token concept-class isolation / R-1.10 affordance vocabulary / R-1.11 status-vocabulary discipline / R-1.12 density-rhythm + attention-budget) plus R-1.5 text amended to cite shell-spec §IV explicitly. 25 INV-* binding behavioral invariants across 5 categories (INV-FRESH/TOKEN/AFFORD/STATUS/DENSITY-1..5). 5 D-class forensics + 12 FM-* forensics resolved by doctrine. 6 V-decisions resolved via 5-specialist parallel roundtables. All sub-decisions long-term-aggressive per `feedback_long_term_over_transition.md`. **Bugs surfaced + bound by doctrine for Gate 5 remediation:** FM-DENSITY-1 (9px stale-badge font — sub-WCAG); FM-STATUS-1 (silent severity downgrade); FM-STATUS-2 (versionMismatch silent persistence); 5-writer race for `#status-dot`. **Gate 4 deliverable #5 (per-zone artifact cross-references) shipped 2026-04-29:** `sidebar-zone-0.md` through `sidebar-zone-4.md` each carry SHC Shell-Spec Cross-References sections; umbrella `sidebar-zones-overview.md` got §0 consolidating all 6 registers + 8 binding rules + 25 INV-* invariants + 10-item Gate 5 implementation roadmap. **Gate 4 status:** APPROVED 2026-04-29 (owner ratification of full SHC Gates 1-4 + doctrine v8 + shell-spec §I-§VI resolutions). NEXT was: Gate 5 first PR — FM-DENSITY-1 9px font fix as starting point. **All three Gate 5 highest-priority remediations are now CLOSED — see current update entry.**)

---

**Prior update (superseded, kept for provenance — 2026-04-28 EAL S21):** (**Exploit Anchor Library (EAL) — Phase 6 — S21 ships Anchor Retirement journey wiring (Variations A/B/C/F/G).** Replaces S20 toast stubs with real `ANCHOR_OVERRIDDEN` reducer dispatch via the existing `dispatchAnchorLibrary` exposed on `AnchorLibraryContext`. New `src/utils/anchorLibrary/retirementCopy.js` (deterministic per-action copy bundle generator + `validateRetirementCopy` AP-06 forbidden-pattern enforcer with 12 forbidden phrases including "your accuracy" / "you misjudged" / "grade your" / "score your" / "this anchor underperformed" / "giving up on this" / "reconsider retired"; CI-grep target). New `RetirementConfirmModal.jsx` (pure-props shared modal — single source of truth across anchor-library + future calibration-dashboard per journey §Observations; renders title + subText + (destructive-only) "I understand…" checkbox + Cancel/Confirm buttons; ≥44×44 tap targets; aria-labelledby + aria-describedby + aria-modal=true; Cancel gets initial focus; backdrop+Escape close; Reset variant: confirm `aria-disabled=true` until checkbox tick + red destructive button). New `useAnchorRetirement.js` orchestrator hook returning `{ pendingCopy, beginRetirement, cancelRetirement, confirmRetirement }`; co-exports `buildOverridePayload(priorAnchor, copy, timestamp)` pure helper. On confirm: builds W-EA-3 payload (status update for retire/suppress; `operator.calibrationResetAt` stamp for reset — status unchanged); dispatches `ANCHOR_OVERRIDDEN`; fires success toast (12s, success variant) with `Undo` action button. Undo callback closes over the `priorAnchor` + dispatch via lexical scope; reverse-dispatches the prior anchor record + fires "restored" info toast (3s). Error path: try/catch around dispatch fires error toast + bails. `AnchorLibraryView.jsx` rewired: `handleOverrideAction` toast stub replaced with `beginRetirement(action, anchor)` (anchor looked up by id from existing `allAnchors` memo); `<RetirementConfirmModal>` mounted at view root. **Tests: 80 new across 3 new files** (retirementCopy 33 + RetirementConfirmModal 19 + useAnchorRetirement 24 + AnchorLibraryView +4 net after replacing 3 stub-toast tests with 7 journey tests). **Full EAL slice 893/36 green** (S20 baseline 813/33 + 80/3). **Visual verification at 1600×720 via Playwright MCP COMPLETE:** Reset modal renders with destructive checkbox + red confirm button; 2-tap gating verified (`aria-disabled=true` blocks click, tick enables); Reset confirm dispatches + closes modal + fires success toast "Fish Overcall (S21 reset) calibration reset." with Undo button; Reset doesn't change status (correct — operator.calibrationResetAt stamped instead). Retire modal renders with NO destructive checkbox + blue (non-destructive) confirm button; Cancel closes modal without dispatching; Confirm flips card data-status active→retired + status chip ●→○ + fires success toast with Undo button. Undo end-to-end verified: Suppress dispatched (status active→suppressed), Undo button tapped within 12s window, status reverted to prior + "Nit Over-Fold (S21 retire) restored." info toast (3s, blue variant) appears. 9 screenshots archived under `.playwright-mcp/eal-s21-*.png`. **Doctrine choices established:** (a) AP-06 enforced at generator+bundle layer via deterministic `retirementCopy.js` + `validateRetirementCopyBundle` CI-grep target — runtime UI text guaranteed clean by construction; (b) single shared `RetirementConfirmModal` per journey §Observations (anchor-library + future calibration-dashboard both compose the same orchestrator hook; no drift); (c) modal pure-props, hook owns state — testable + Storybook-composable; (d) Reset stamps `operator.calibrationResetAt` not status — actual posterior reset is Phase 8 matcher hook concern; (e) Undo dispatches with reference-equality on prior anchor record (toBe, not toEqual) — perfect bit-for-bit reversal; (f) Reset 2-tap uses `aria-disabled` not native `disabled` so explicit no-op handler runs (defense in depth); (g) Cancel button gets initial focus (less destructive default per H-N02 reversibility); (h) destructive checkbox state resets on `(action, anchorId)` change so reopen for different anchor doesn't carry stale state; (i) Calibration Dashboard deep-link STILL fires toast stub — surface deferred to S22+; (j) no bulk retirement (per journey §Observations — adds dangerous-action multiplier for no clear JTBD). **NEXT (S22+):** S22+ — Calibration Dashboard surface authoring (3-tab cross-project: predicates + anchors + primitives per `surfaces/calibration-dashboard.md`); S22+ — sidebar nav entry placement decision; S23 — un-retirement Variation E (re-enable button on retired anchor's panel); S24+ — Tier 3 auto-retirement banner (Variation D). Handoff: `.claude/handoffs/exploit-anchor-library-session21.md`.)

---

**Prior update (superseded, kept for provenance — 2026-04-28 EAL S20):** (**Exploit Anchor Library (EAL) — Phase 6 — S20 ships AnchorCard long-press transparency panel + first-run discovery tooltip + S19 side-finding fix.** New `src/hooks/useAnchorCardLongPress.js` hook (400ms threshold, 10px motion-cancel, pointer-up/leave/cancel teardown, secondary-button rejection, fake-timer-friendly cleanup-on-unmount; co-exports `useLongPressTooltipState` with `eal:longPressTooltip:dismissed` localStorage gate). New `AnchorDetailPanel.jsx` (pure-props panel rendering all 6 spec sections — Observed rate / Model's predicted rate / Perception model bullet list with PP-NN name resolution from `PERCEPTION_PRIMITIVE_SEEDS` / Status full-text mapping / Last fired relative-time / Calibration Dashboard deep-link STUB / 3 override action STUBS — Retire/Suppress/Reset) with AP-06 copy discipline DOM-asserted (no "your accuracy" / "you misjudged" / "grade your" / "score your" patterns; `formatRelativeTime` exported pure helper). New `AnchorLongPressTooltip.jsx` (banner with "Got it" dismiss button; `role=status`; render-gated by `show` prop). `AnchorCard.jsx` rewired: replaced inert `onInfoTap` with `isExpanded` + `onToggleExpand(anchorId)` + `onOverrideAction` + `onOpenDashboard` + `onLongPressFire` props; `useAnchorCardLongPress` press handlers spread onto article element; renders `<AnchorDetailPanel>` inline when expanded; dynamic `aria-expanded` + `data-expanded` + `data-pressing` attributes; `userSelect:none` + `WebkitTouchCallout:none` + `touchAction:pan-y` to suppress iOS native long-press menu without blocking vertical scroll. `useAnchorLibraryView.js` extended with session-scoped (NOT persisted) `expandedCardIds: Set<string>` + `toggleCardExpansion` / `expandCard` / `collapseCard` / `collapseAllCards` helpers. `AnchorLibraryView.jsx` wires it all up: mounts `useLongPressTooltipState`, `useToast` for stub-action toasts, threads `expandedCardIds.has(anchor.id)` to each card, fires `toast.showInfo()` with deferred-feature copy on override + deep-link taps. **Side-finding from S19 verification fixed inline:** `useEffect(() => loadAllSessions?.(), [loadAllSessions])` on mount so handsSeen reflects archived sessions for returning owners (not just in-flight `currentSession`). **Tests: 99 new across 3 new files** (useAnchorCardLongPress 19 + AnchorDetailPanel 42 + AnchorLongPressTooltip 7 + view-hook +9 + AnchorCard +10 + AnchorLibraryView +12). **Full EAL slice 813/33 green** (S19 baseline 714/30 + 99/3). **Visual verification at 1600×720 via Playwright MCP COMPLETE:** route renders, tooltip auto-shows on first visit, ⓘ-tap expands inline panel showing observed-vs-predicted (calibrationGap-driven) + perception bullets + status full-text + relative time, override Retire/Suppress/Reset buttons fire toast "Retire: retirement journey ships in a future session.", ▲ Collapse button hides panel + flips `data-expanded`, `pointerdown` + 400ms wait fires expansion + auto-dismisses tooltip + writes localStorage key, 30px motion-cancel during press correctly aborts, multi-anchor expansion confirmed (2 cards expanded simultaneously, each independent). 13 screenshots archived under `.playwright-mcp/eal-s20-*.png`. **NEXT (S21+):** S21 — wire override action buttons to `ANCHOR_OVERRIDDEN` reducer dispatch + retirement journey navigation (replaces toast stubs); S22+ — Calibration Dashboard route + sidebar nav entry placement decision. Handoff: `.claude/handoffs/exploit-anchor-library-session20.md`.)

---

*Older updates archived to `.claude/STATUS_ARCHIVE.md` to keep this file working-size.*


---
<!-- Migrated from .claude/context/SYSTEM_MODEL.md by CWOS /adopt -->

---
last-verified-against-code: 2026-04-06
verified-by: governance-overhaul
staleness-threshold-days: 30
---

# System Model — Poker Tracker
**Version**: 1.9.3 | **Updated**: 2026-04-21 | **Owner**: Line Study Bucket-Teaching Roundtable (RT-106..118 findings)

Single source of truth for system understanding, invariants, risks, and cross-cutting concerns.
Read this before any multi-file change. Update after any architectural shift.

---

## 1. System Architecture

### 1.1 Components & Responsibilities

| Component | Responsibility | Boundary |
|-----------|---------------|----------|
| `PokerTracker.jsx` | State orchestration, context providers, view routing | Owns all reducer dispatches; views receive only `scale` prop |
| 8 Reducers (`game`, `ui`, `card`, `session`, `player`, `settings`, `auth`, `tournament`) | State transitions | Pure functions, no side effects, no async |
| 13 Context Providers | Cross-component state distribution | Each wraps one reducer + optional persistence hook |
| 34 Hooks | Business logic, side effects, computed values | May read multiple contexts; never dispatch to foreign reducers |
| 14 Views + Showdown | UI rendering | Receive `scale` only; pull state from contexts |
| 40 UI Components | Reusable visual elements | Stateless or locally stateful; no context access |
| `pokerCore/` (5 modules) | Shared poker primitives (cards, ranges, hand eval, board texture, exact preflop equity) | Imported by both engines; imports from neither |
| `rangeEngine/` (9 modules) | Bayesian range estimation | Reads player stats; writes range profiles to IndexedDB |
| `exploitEngine/` (41 modules) | Exploit generation, weakness detection, game tree EV, villain modeling | Reads ranges + stats; produces recommendations |
| `handAnalysis/` (7 modules) | Post-hand review, replay, hero analysis | Reads completed hand data; produces analysis objects |
| `tournamentEngine/` (4 modules) | Blind levels, blind-out calc, dropout prediction | Reads tournament config; produces scheduling/projection data |
| `drillContent/` (4 modules) | Preflop-drill frameworks, matchup library, scheduler, combo counting | Pure data + predicates powering the Preflop Drills view |
| `postflopDrillContent/` (11 modules) | Postflop-drill frameworks, scenario library, hand-type breakdown, line walkthrough DAG | Pure data + predicates powering Postflop Drills view. **MAY import from exploitEngine/ + pokerCore/** (INV-08.a exception, 2026-04-21 RT-109). Future live-engine consumption must route via `drillModeEngine` wrapper (RT-111). |
| `persistence/` (12 modules) | IndexedDB v15, 9 stores, migrations | Sole interface to IndexedDB; all access through exported functions |
| Ignition Extension | Chrome MV3, WebSocket capture, side panel HUD | Separate codebase (`ignition-poker-tracker/`), communicates via message passing |

### 1.2 Dependency Graph (Layers)

```
Views → Hooks → Contexts → Reducers
                    ↓
              Persistence (IndexedDB)
                    ↑
Hooks → exploitEngine → rangeEngine → pokerCore
        exploitEngine → handAnalysis
        tournamentEngine (standalone)
```

**Hard rule**: No upward dependency. `pokerCore` never imports from `rangeEngine`. `rangeEngine` never imports from `exploitEngine`. Views never call stateful engine APIs or write to persistence directly. Read-only imports of pure functions and constants from utils are acceptable; hooks mediate all stateful access.

**Resolved (RT-35, R5)**: `monteCarloEquity.js` moved to `pokerCore/` (pure MC equity math). 4 remaining exploitEngine symbols injected via `deps` parameter in `replayAnalysis.analyzeTimelineAction()`. `handAnalysis/` now imports zero symbols from `exploitEngine/`.

### 1.3 Extension ↔ App Boundary

| Direction | Mechanism | Data |
|-----------|-----------|------|
| Extension → App | `chrome.runtime.sendMessage` | Captured hand history, table state |
| App → Extension | IndexedDB shared reads (same origin) | Player profiles, range profiles |
| Extension internal | `SyncBridgeContext` + `OnlineSessionContext` | Real-time table sync |

**Resolved (RT-11, 2026-04-04):** `chrome.storage.session` downgraded from `TRUSTED_AND_UNTRUSTED_CONTEXTS` to trusted-only. App-bridge refactored to receive data via port pushes from service worker. Casino page scripts can no longer read session storage.

---

## 2. Data Flow

### 2.1 Hand Recording Flow (Critical Path)

```
User taps action → useGameHandlers dispatch → gameReducer updates actionSequence
    → Street auto-advance (if all active seats acted)
    → Showdown entry (manual or auto)
    → usePersistence.saveHand() (1.5s debounce)
    → IndexedDB `hands` store
    → usePlayerTendencies recalculates (next render)
    → rangeEngine.bayesianUpdater runs on profile
    → exploitEngine.generateExploits produces new recommendations
```

### 2.2 Analysis Pipeline (3-Layer)

```
Layer 1: Session Stats (useSessionStats)
  Input: actionSequence[] across hands
  Output: VPIP, PFR, AF, C-Bet per player per position

Layer 2: Player Tendencies (usePlayerTendencies + analysisPipeline.js)
  Input: cross-session aggregated stats + decision accumulator
  Output: style classification, weakness detection, decision summaries

Layer 3: Exploit Generation (exploitEngine pipeline)
  Input: tendencies + range profiles + game state
  Output: ranked exploit suggestions with EV estimates + confidence
```

### 2.3 Game Tree Evaluation Flow

```
useLiveActionAdvisor → gameTreeEvaluator.evaluateGameTree()
  → villainDecisionModel.buildVillainModel() (style-conditioned priors)
  → gameTreeDepth2.evaluateDepth2() (bet/check/raise branches)
  → foldEquityCalculator (blocker-aware, fold curve fit)
  → preflopFlopEV (stratified flop sampling, archetype-weighted)
  → Produces: { bestAction, ev, reasoning, flopBreakdown, confidence }
```

### 2.4 Range Profile Lifecycle

```
New player observed → populationPriors.js creates default profile
  → Each hand: bayesianUpdater.js updates (prior × likelihood)
  → Showdown: anchor confirmed hands (weight=1.0, semantic boost)
  → Profile cached in IndexedDB `rangeProfiles` store
  → Queried by exploitEngine for villain range in EV calcs
```

---

## 3. State Model

### 3.1 State Classification

| Type | Location | Lifecycle | Examples |
|------|----------|-----------|---------|
| **Ephemeral** | Reducers (game, ui, card) | Current hand only | `actionSequence`, `communityCards`, `currentStreet` |
| **Session** | sessionReducer + activeSession store | One poker session | `currentSession`, `handCount`, `buyIn` |
| **Persistent** | IndexedDB stores | Permanent | `allPlayers`, `allSessions`, all hands, range profiles |
| **Derived** | Hooks (memoized) | Recomputed on dependency change | Session stats, tendencies, exploit suggestions, game tree EV |
| **Configuration** | settingsReducer + settings store | User-scoped permanent | Theme, venues, game types |

### 3.2 State Ownership

| State | Owner | Readers | Mutators |
|-------|-------|---------|----------|
| Game state | `gameReducer` | All views, hooks | `useGameHandlers` only |
| UI state | `uiReducer` | Views, navigation hooks | Any view via `useUI().dispatch` |
| Card state | `cardReducer` | TableView, ShowdownView, hooks | `useCardSelection`, `useShowdownCardSelection` |
| Player data | `playerReducer` + IndexedDB | Stats views, exploit engine | `usePlayerPersistence` |
| Session data | `sessionReducer` + IndexedDB | History, stats | `useSessionPersistence` |
| Range profiles | IndexedDB only | `rangeEngine`, `exploitEngine` | `bayesianUpdater` via `saveRangeProfile()` |

### 3.3 Consistency Guarantees

- **actionSequence is the sole source of truth** for all actions in a hand. No `seatActions`, no `showdownActions` — query via `sequenceUtils.js` helpers.
- **Reducer state leads, IndexedDB follows**. If they diverge, reducer wins (IndexedDB is persistence, not authority during a session).
- **Range profiles are eventually consistent**. Updated after each hand save, not during hand recording.
- **Player tendencies are derived state**. Never persisted directly — always recomputed from stored hands + showdowns.

---

## 4. System Invariants

**Full catalog with verification dates and test coverage: see `.claude/context/INVARIANTS.md`**

13 MUST-be-true invariants (INV-01 through INV-13) and 11 MUST-never-happen anti-invariants (NEV-01 through NEV-11). Key examples: actionSequence ordering (INV-01), style-labels-as-outputs (INV-07), no circular imports (INV-08), stableSoftmax for all Math.exp (INV-13), no position-label inputs (NEV-03), no innerHTML without escapeHtml (NEV-11).

### 4.1 Sidebar-Specific Invariants (SRT-2 2026-04-15, STP-1 2026-04-16)

| ID | Rule | Description | Enforcement |
|----|------|-------------|-------------|
| I-INV-PRE | R-7.2 | Pre-dispatch invariant gate: `StateInvariantChecker.check(snap)` runs before `_renderFn`. On violation: render skipped, last-known-good frame persists, `lastViolationAt` stamped, "!" badge surfaces. | `render-coordinator.js:_executeRender`, `render-coordinator.test.js` RT-70 tests |
| I-FSM-EXCL | R-5.6 | FSM-output exclusivity: when a FSM is registered for a slot, the slot's renderer reads `snap.panels.<fsmId>` as visibility authority. Raw coordinator state (e.g. `modeAExpired`) must NOT be read for slot-ownership. Content classifiers supplement, not replace. | `zx-overrides.test.js` RT-72 source pins, `SIDEBAR_DESIGN_PRINCIPLES.md` R-5.6 |
| I-OBS-HONEST | R-7.3 | Observability honesty: every user-surfaced string that references coordinator state must equal the state value it claims to report. Labels and numbers may not drift apart from their source (pre-STP-1 the RT-66 badge read `lastViolationCount` but the tooltip promised "in the last 30s" — the counter was lifetime). | `side-panel/__tests__/rendered-text-contract.test.js` |
| I-OBS-COMPLETE | R-7.4 | Observability completeness: every "see X for details" affordance must have a completeness test asserting X actually contains the referenced details. Applies to `runDiagnostics` (RT-66 badge points at "copy diagnostics for details"), future copy/export paths, and any "open the log" surface. | `side-panel/__tests__/diagnostics-dump.test.js` |
| I-STATE-SYM | R-8.1 | State-clear symmetry: every `this._state.X = Y` write outside the `RenderCoordinator` constructor must have a matching clear in the lifecycle path that owns its declared scope (table-switch / hand-new / stale-timeout). Scope declared in `side-panel/STATE_FIELD_SCOPES.md`. | `side-panel/__tests__/state-clear-symmetry.test.js` |
| I-INV-PAYLOAD | R-10.1 | Payload-level invariants: every incoming wire message has a schema validator that checks topology, not just field types. For `push_live_context`: `activeSeatNumbers ∩ foldedSeats = ∅`, `heroSeat ∈ active ∪ folded`, all seats integer in `[1..9]`. R11 (seat-disjoint) and R12 (hero-in-set) are the coordinator-level equivalents for defense in depth. | `shared/__tests__/wire-schemas.test.js`, `state-invariants.test.js` R11/R12, `side-panel/__tests__/payload-fuzz.test.js` |

### 4.2 Sidebar Failure Modes

**SW Reanimation Replay.** MV3 service workers are evicted after ~30 s of inactivity. On reanimation, `pushFullStateToSidePanel` replays cached data. If cached `actionAdvice` is replayed without a companion `push_live_context`, the side panel's `_pendingAdvice` buffer may promote stale cross-hand advice when the next live context push coincidentally matches the same street. This is not a transport bug — it is a render-input event at the MV3 lifecycle layer. See `.claude/failures/SW_REANIMATION_REPLAY.md`.

**State-Clear Asymmetry.** `RenderCoordinator._state` fields have scopes (session / perTable / perHand / derived / monotonic); each scope has an owning lifecycle reset path (`clearForTableSwitch`, hand-new block in `handleLiveContext`, stale-timeout). New fields added to `_state` without a matching clear silently survive the lifecycle boundary and may arm invariant violations on subsequent renders — observed in production as 213 R5 violations in ~500 s, traced to `advicePendingForStreet` not being nulled in `clearForTableSwitch`. Audit surfaced 10 additional asymmetries of the same class. Structural fix via `STATE_FIELD_SCOPES.md` registry, `state-clear-symmetry.test.js`, and doctrine R-8.1 gates the class of bug. See `.claude/failures/STATE_CLEAR_ASYMMETRY.md`.

---

## 5. Failure Surfaces

### 5.1 High-Risk Areas

| Area | Risk | Likelihood | Impact | Mitigation |
|------|------|-----------|--------|------------|
| IndexedDB migrations (`database.js`, `migrations.js`) | Schema change drops/corrupts data | Medium | **Critical** — permanent data loss | Versioned migrations, backup before destructive ops |
| `bayesianUpdater.js` | Numerical instability (underflow/overflow in log-likelihood) | Low | High — corrupted range profiles | Clamping, normalization after each update |
| `gameTreeEvaluator.js` | Combinatorial explosion in depth-2/3 branches | Medium | Medium — UI freeze or timeout | Time budget (`timeBudgetMs`), depth bailout, combo limit |
| `gameTreeEvaluator.js` | Softmax overflow in mixed strategy (Math.exp on small temperature) | Low | Medium — NaN mixFrequency, corrupted recommendations | Resolved RT-12: `stableSoftmax()` in `mathUtils.js` |
| `popup.js` | innerHTML without escaping (connId, state fields) | Low | Medium — XSS in extension context | Resolved RT-15: all values wrapped in `escapeHtml()` |
| `useShowdownCardSelection.js` | Auto-advance logic with multiple players + partial card entry | High | Medium — wrong card assignments | Extensive edge case tests |
| `useSessionPersistence.js` | Hydration race condition (load before DB init) | Low | High — lost session data | `isInitialized` guard, retry logic |
| `foldEquityCalculator.js` | 8 multiplicative adjustments compounding to extreme values | Medium | Medium — absurd fold% predictions | Intermediate sanity clamp [0.10, 0.85] (INV 26.2) |
| Extension WebSocket capture | Ignition protocol changes without notice | High | High — extension stops working | Message validation, graceful degradation |
| `usePlayerTendencies` | Full all-player recompute on any playerReducer dispatch; identity instability causes cascading re-renders | High | High — UI freeze at 50+ players, stale exploits during recompute | Per-player memoization (RT-28) |
| `service-worker.js` onMessage/onConnect | sender.id validation resolved (RT-21, 2026-04-07) | — | — | Resolved |
| `useEquityWorker.js` | Dual Worker instantiation (TableView + OnlineAnalysisContext each spawn one) | High | Medium — wasted mobile resources, no shared crash recovery | RT-27: singleton EquityWorkerContext |
| `useEquityWorker.js` | `isWorkerReady` always returns false (ref read at render time, not reactive) | High | Low — functional impact nil since computeEquity works via ref | RT-29: reactive state |
| `useLiveActionAdvisor.js` | `computeAllVillainRanges` called twice per cycle (lines 354, 436) — doubled range lookups | High | Low — ~5-10ms waste per compute cycle | RT-30: cache first call |
| `preflopAdvisor.js` | Preflop MC path bypasses Worker — `handVsRange` called directly, not through `equityFn` | High | Medium — most frequent computation stays on main thread | RT-31: thread equityFn |
| `gameTreeEquity.js` adjustedRealization | Double-discount when opponentModels present + uncapped multiway (`0.85^7 = 0.32`) | Medium | Medium — systematic "check" bias in multiway pots | RT-38: remove blanket 0.85 when models present, add floor 0.30 |
| `handsStorage.js` saveHand | TOCTOU race: separate read/write transactions allow duplicate `sessionHandNumber` | Low | Low — duplicate display IDs in search/replay | RT-39: atomic single transaction |
| `side-panel.js` render coordination | 4+ independent render entry points bypass debounce, produce partial-state display (recurring) | High | High — user sees inconsistent advice/exploits/tournament data | RT-43: unified render scheduler |
| `side-panel.js` STREET_RANK guard | `STREET_RANK[undefined] ?? -1` accepts stale advice when liveContext is null | Medium | High — stale advice displayed as current after SW restart | RT-45: reject advice when liveContext null |
| `side-panel.js` renderPidSummary | Unescaped PID strings in innerHTML (XSS in extension context) | Low | Medium — arbitrary HTML/JS in side panel | RT-46: escapeHtml wrapper |
| `side-panel.js` handlePipelineStatus | Async handler yields to event loop; sync handlers mutate shared state during yield | Medium | Medium — inconsistent state at render time | RT-47: snapshot or re-read pattern |
| `side-panel.js` dual state ownership | Module vars (lines 48-78) and `RenderCoordinator._state` diverge between sync calls; any async yield or forgotten sync creates stale render | High | **High** — wrong advice/exploits displayed; root cause of recurring display-thrashing | RT-43 expanded: single-owner state store |
| `render-coordinator.js` advice guard | No hand-number binding; SW restart sends cached advice from previous hand that passes street-rank check (`0 <= 3` = true) | Medium | **High** — confidently wrong advice from prior hand | RT-45 expanded: hand-number binding |
| `side-panel.js` tournament timer | `setInterval` captures DOM reference; `renderAll` replaces element via `innerHTML`; timer writes to detached node; countdown freezes | High | Medium — frozen tournament countdown | RT-52: stable DOM reference |
| `side-panel.js` `_contextStale` | Two-phase stale detection computed in state but no render function reads it; visual no-op | Certain | Medium — users never see stale warning | RT-53: render the indicator |
| `side-panel.js` `_receivedAt` | `push_pipeline_status` sets `currentLiveContext` without `_receivedAt`; stale timeout math produces `NaN`; context never times out | Medium | Medium — infinite stale context | RT-56: set `_receivedAt` on all liveContext write paths |
| ~~`side-panel.js` renderRawTournamentInfo~~ | ~~Unescaped innerHTML for level/blinds~~ | — | — | **Resolved RT-57 (2026-04-12)**: Number() coerce + escapeHtml on every interpolation |
| `side-panel.js` dead render functions | `renderBriefingPanel` (:1671), `renderObservationPanel` (:1822), `computeFocusedVillain` wrapper (:899), diagnostic-dump block (:2400-2421) reference bare `currentLiveContext`/`currentTableState`/`lastHandCount`/`exploitPushCount`/`advicePushCount` — all deleted by RT-43. Strict-mode ReferenceError if triggered (briefing-item click handler may reach them; diag copy button certainly does). | Medium | High — sidebar crash during user action | RT-58: delete dead fns, fix diag dump to read coordinator |
| `side-panel.js` handlePipelineStatus | Direct `coordinator.set('currentLiveContext', ...)` at :244 bypasses `handleLiveContext()` — skips position lock, `_receivedAt` injection, pending-advice promotion; two write paths have divergent semantics | Medium | High — invariant drift (position lock loss, stale guards) | RT-59: route all liveContext writes through handleLiveContext |
| `side-panel.js` `_planPanelAutoExpandTimer` | Module-level setTimeout at :983 mutates `coordinator.planPanelOpen` and writes DOM class outside scheduler; not cleared by `clearForTableSwitch`; re-introduces the RT-43 anti-pattern | High | Medium — stale-table mutation, render inconsistency | RT-60 (timer registration contract) + RT-61 (route through scheduler) |
| `state-invariants.js` Rule 10 | Checks `snap.pipelineEvents` but `pipelineEvents` explicitly excluded from `buildSnapshot` — invariant silently never fires regardless of ring-buffer state | Certain | Low — dead safety net | RT-66: include in snapshot or read coordinator directly |
| `render-coordinator.js` violation reporting | Violations logged to `pipelineEvents` only; pipelineEvents not in renderKey and not rendered in any UI; `throwOnViolation=false` in production; violations invisible to user | Certain | Medium — governance theatre | RT-66: surface via diagnostics badge |
| ~~`render-orchestrator.js` Zone 3 scary runouts~~ | ~~Rendered count not card names~~ | — | — | **Resolved RT-62 (2026-04-12)**: gameTreeDepth2.js now emits scaryCardRanks array; Zone 3 renders "Watch: A, K on turn" |
| ~~`render-orchestrator.js` Mode A coaching~~ | ~~Audit-claimed fold-correctness bug~~ | — | — | **Resolved RT-63 (2026-04-12)**: verified not-a-bug; fold EV implicit at 0, ev>0 equivalent to ev>fold.ev; test coverage added |
| ~~`render-orchestrator.js` multiway pot odds~~ | ~~slice(-1) on actionSequence~~ | — | — | **Resolved RT-64 (2026-04-12)**: added findFacedBet() backward walk for the bet hero actually faces |
| ~~`background/service-worker.js` capture port~~ | ~~validateMessage gate missing~~ | — | — | **Resolved RT-65 (2026-04-12)**: gate applied; 5 new validators added to message-schemas.js |

### 5.1c Additional Failure Modes (Line Study Bucket-Teaching Roundtable 2026-04-21)

**FM-Bucket-False-Precision.** Bucket aggregator (e.g., `handTypeBreakdown.js:96-103` pattern) computes per-bucket mean equity/EV with no minimum-N gate. On monotone or paired boards after range narrowing, a bucket may contain 1-2 combos. Output renders "betEV: 2.41 bb" with full numeric precision. Feature would teach confidence in statistical noise. Detector: RT-115 — `sampleSize` field + `lowConfidence` flag attached to aggregator output; UI renders caveat badge when `lowConfidence`.

**FM-Archetype-Correctness-Contradiction.** Current `Decision.branches[].correct: boolean` (`lineSchema.js:134`) collapses across archetypes. If archetype becomes a UI toggle (fish/reg/pro) without schema change, the authored-correct branch stays green even when wrong for the current archetype — the displayed engine output contradicts the displayed "correct" badge. Erodes trust in all authored line content. Detector: RT-107 — `correctByArchetype?: { [id]: boolean }` with validator enforcing ≥1 correct branch per declared archetype.

**FM-Engine-Drift-Silent-Invalidation.** Engine constants (`FOLD_CURVE_PARAMS`, `STYLE_STEEPNESS_MULT`, `POP_CALLING_RATES` in `gameTreeConstants.js` / `villainModelData.js`) have been revised across Items 25, 26, 27 (~30 accuracy changes). Any authored EV number or EV-relative claim in `lines.js` silently invalidates on engine update — existing tests assert schema/structure, zero EV correctness assertions. Authored content ages into being wrong with no CI signal. Detector: RT-108 — fixed-seed snapshot of `evaluateGameTree` over each authored line's boards; any output drift fails CI.

**FM-Drill-Layer-Synthetic-Input-Epistemics.** `gameTreeEvaluator` is calibrated against observed real-hand data via `villainModel`, style priors, fold-curve fitting. In drill-mode context there are no observed hands — synthetic archetype stubs fall back to `POPULATION_PRIORS` + style steepness modifier. Output is numerically precise but epistemically ungrounded; "fish donk on JT6" is mathematically near-identical to "population donk on JT6" with a small style modifier. Treating drill-mode EV numbers as ground-truth misleads learners about what the numbers mean. Detector: RT-111 — `drillModeEngine` wrapper returns `caveats[]` including `'synthetic-range'` when no observed data underlies the computation.

### 5.1b Additional Failure Modes (Drills Consolidation Roundtable 2026-04-20)

**FM-Implicit-Height-Contract.** Mode components under `src/components/views/(Preflop|Postflop)DrillsView/` use `h-full overflow-hidden` on their outermost `div`, relying on their parent container's `flex-1` + `1600×720` chrome to resolve. Deleting or restructuring the parent silently breaks layout; no import graph catches it. Repro: remove outer `h-full overflow-hidden` wrapper; `ShapeMode` `LaneRow` scroll vanishes. Relevant for any view restructuring proposal, including drills-consolidation Phase 7.

**FM-Hoisted-Persistence-Hook-Race.** Mounting multiple persistence-hook-owning children under a single parent without hoisting the hook to the parent produces read-order-dependent state desync. Canonical example: a drill picker that mounts Recipe + Framework + Line modes simultaneously to display streak stats — each calls `usePostflopDrillsPersistence()` independently, each fires its own IDB load, each holds its own `drills` array copy, and `recordAttempt` in one instance doesn't propagate to siblings. Scheduler accuracy silently drifts.

### 5.2 Complexity Hotspots (Cyclomatic)

| File | Reason | Refactor Priority |
|------|--------|------------------|
| `gameTreeDepth2.js` | Nested bet/check/raise/call branches, time budgeting | Low (working, well-tested) |
| `villainDecisionModel.js` | 5-layer priority hierarchy, style conditioning | Low (recently overhauled) |
| `comboActionProbabilities` | 6→2 renormalization layers, blocker effects | Medium (fragile to new layers) |
| `generateExploits.js` | Orchestrates all rule modules, trait application, supersedes dedup | Medium |
| `preflopAdvisor.js` | Multiple EV paths (call/raise/limp), flop rollout integration | Low |

---

## 6. Hidden Coupling

### 6.1 Implicit Dependencies

| Dependency | From | To | Why Hidden |
|-----------|------|-----|-----------|
| Action constant values | `gameConstants.js` ACTIONS | `actionUtils.js`, `designTokens.js`, all rule modules | String matching; adding an action requires updates in 3+ files |
| Seat numbering convention | `SEAT_ARRAY` [1-9] | Every component that iterates seats | Off-by-one if anyone uses 0-indexed |
| `actionSequence` shape | `sequenceUtils.js` | `gameReducer`, `usePersistence`, `handAnalysis/*` | Schema change breaks persistence + analysis |
| Range profile `profileKey` format | `rangeProfilesStorage.js` | `bayesianUpdater.js`, `rangeEngine/index.js` | Key format (`{playerId}_{position}`) is implicitly shared |
| Board texture classification | `pokerCore/boardTexture.js` | `exploitEngine/boardTextureRules.js`, `rangeEngine/postflopNarrowing.js` | Both engines depend on same texture enum values |
| Villain model confidence threshold (0.3) | `villainDecisionModel.js` | `comboActionProbabilities`, `gameTreeEvaluator.js` | Magic number gates which data source is used |
| Toast context availability | `ToastContext` | Any hook calling `useToast()` | Silent failure if provider missing from tree |
| Scale factor | `useScale` hook | All views via `scale` prop | CSS calculations break if scale is NaN/0 |
| `validateTournament` shape contract | `wire-schemas.js` | `render-tiers.js`, `side-panel.js` | Accepts any object; rendering code assumes specific fields exist; malformed object causes silent display corruption |
| Worker instance count | `useEquityWorker` (hook, not context) | Every call site | Each `useEquityWorker()` call creates a new Worker; no singleton enforcement. Adding a consumer silently adds another thread. |
| Analysis utility layer | `handAnalysis/replayAnalysis.js` | `exploitEngine/` (5 modules) | Violates documented dependency direction (INV-08); `handAnalysis` should not import from `exploitEngine` (RT-35) |
| Render entry point count | `side-panel.js` push handlers | `renderUI` debounce intent | Adding a new push handler that calls a render function directly silently creates a new bypass of the coordinated render path |
| STREET_RANK completeness | `handleAdvicePush` guard | Chrome MV3 SW lifecycle | SW restart nulls liveContext, making `STREET_RANK[undefined]=-1`, defeating the staleness guard; any new FSM state not in STREET_RANK bypasses the filter |
| Tournament timer DOM reference | `renderTournamentPanel` setInterval | `renderAll` innerHTML rewrite | Timer holds closure reference to DOM node that renderAll replaces; timer silently writes to detached node; countdown freezes |
| `_receivedAt` timestamp | Stale context timeout math | `push_pipeline_status` handler | Handler sets `currentLiveContext` directly without `_receivedAt`; timeout computes `Date.now() - undefined = NaN`; context never expires via this path |
| Advice hand identity | `handleAdvicePush` street-rank guard | SW cached advice lifecycle | Guard checks street rank only; SW caches and replays advice across hand boundaries with no hand identifier |
| `render-street-card.js` module state | `_prevStreet`, `_transitionTimer` | Table switch handlers | Module-level mutable state persists across table switches; same-table reconnect inherits stale transition state |
| ~~`STREET_RANK` duplicate definition~~ | — | — | **Resolved RT-67 (2026-04-12)**: single export from shared/constants.js |
| `currentLiveContext` write paths | `handleLiveContext()` (canonical) | `handlePipelineStatus` direct `.set()` | Divergent semantics — position lock, `_receivedAt`, pending-advice promotion only run on canonical path (RT-59) |
| Module-level timer ownership | `_planPanelAutoExpandTimer`, `tourneyTimerInterval`, staleContext interval, `_transitionTimer` | `clearForTableSwitch` / `destroy` | Timers owned by IIFE, not coordinator — unreachable from lifecycle hooks; orphan-fire after table switch (RT-60) |
| Dead-function closures over deleted vars | `renderBriefingPanel`, `renderObservationPanel`, `computeFocusedVillain` wrapper | Deleted module vars (`currentLiveContext`, `currentTableState`, `lastHandCount` etc.) | Strict-mode ReferenceError if any click path reaches them (RT-58) |
| C-14: `postflopDrillContent/` consumes `exploitEngine/` | `handTypeBreakdown.js:32` (`classifyComboFull` from `postflopNarrower`), `rangeVsBoard.js:17` (`computeAdvantage` from `rangeSegmenter`) | Live-advisor modules calibrated on observed hands | Synthetic archetype inputs produce numerically precise but epistemically ungrounded output. Drill consumers must route via `drillModeEngine` wrapper post-RT-111 (carries `caveats[]`, `sampleSize`, `bailedOut`). Direct imports of `gameTreeEvaluator` from `drillContent/` forbidden after RT-111 lands. (RT-109 — permitted exception under INV-08.a) |

### 6.2 Cross-Module Interactions

| Interaction | Modules | Risk |
|-------------|---------|------|
| Showdown anchors affect range profiles which affect exploit EV | `cardReducer` → `rangeEngine` → `exploitEngine` | A wrong showdown card propagates through entire analysis |
| Session end triggers tendency recalc which triggers exploit regen | `sessionReducer` → `usePlayerTendencies` → `generateExploits` | Stale tendency data if recalc is slow |
| Tournament blind level affects SPR which affects game tree sizing | `tournamentReducer` → `potCalculator` → `gameTreeEvaluator` | Wrong SPR zone = wrong strategic advice |
| Rake config varies by game type, threads through entire EV pipeline | `GAME_TYPES` → `potCalculator` → `foldEquityCalc` → `gameTree` → `preflopAdvisor` | Missing rake = systematically optimistic EV |

---

## 7. Scaling & Performance

### 7.1 Current Assumptions

| Dimension | Current | 10× | 100× | Bottleneck |
|-----------|---------|-----|------|-----------|
| Hands per session | ~50 | 500 | 5,000 | IndexedDB writes (debounced) |
| Total stored hands | ~2,000 | 20,000 | 200,000 | `getAllHands()` full scan; needs cursor pagination |
| Players tracked | ~50 | 500 | 5,000 | `usePlayerTendencies` iterates all; needs lazy loading |
| Range profile size | ~200 KB per player | 2 MB total | 20 MB total | IndexedDB storage OK; memory if all loaded |
| Game tree eval time | ~50ms (depth-2) | N/A (per-hand) | N/A | Time budget caps at configurable ms |
| Concurrent sessions | 1 | 1 | 1 | Architecture assumes single active session |

### 7.2 Known Bottlenecks

- **`getAllHands(userId)` full table scan**: No pagination. At 100K+ hands, initial load will be slow. Mitigation: index on `userId_timestamp`, use cursor with limit.
- **`usePlayerTendencies` recomputes all players**: No incremental update. At 500+ players, this blocks UI. Mitigation: memoize per-player, invalidate only on new hand for that player.
- **Monte Carlo equity calculations**: `enrichWithEquity` runs 300 MC simulations per call. Skipped when `comboDistribution` available (Item 26.4). But falls back to MC for unknown distributions.
- **Extension message passing**: Chrome's `runtime.sendMessage` is async but single-threaded. Burst hand imports from Ignition may queue.
- **Zero React.memo across component tree**: Every gameReducer dispatch re-renders all mounted components including all 9 SeatComponents. On target device (Helio G80), adds measurable jank during rapid action recording. Mitigation: RT-36.

---

## 8. Security Boundaries

### 8.1 Trust Zones

| Zone | Trust Level | Boundary |
|------|------------|----------|
| Local app (same-origin) | Fully trusted | All state, all IndexedDB |
| Firebase Auth | Trusted for identity | `uid` scopes all data; no server-side validation of hand data |
| Ignition Extension | Semi-trusted | Message validation required; sender.id validation active (RT-21, resolved 2026-04-07) |
| User input (card selection, notes, player names) | Untrusted | Rendered in React (XSS-safe by default); stored as-is in IndexedDB |

### 8.2 Data Exposure Risks

| Risk | Severity | Status |
|------|----------|--------|
| IndexedDB readable by any same-origin script | Medium | Mitigated by Chrome extension isolation |
| Player notes stored unencrypted | Low | Acceptable for local app; risk if cloud sync added |
| Firebase credentials in environment | Medium | `.env` excluded from git; risk if accidentally committed |
| No rate limiting on analysis computations | Low | Local-only; no server cost. Risk if exposed as API |

### 8.3 Input Validation

- **Card input**: Validated by `cardParser.js` (rank + suit enum). Invalid cards rejected at entry.
- **Action input**: Constrained to `ACTIONS.*` constants. Free-form actions impossible.
- **Player names**: Free-text, sanitized by React rendering. No SQL/NoSQL injection surface (IndexedDB is key-value).
- **Session data**: Schema validated by `persistence/validation.js` before write.

---

## 9. Constraints & Assumptions

### 9.1 Hard Constraints (Cannot Change)

| ID | Constraint | Source | Impact |
|----|-----------|--------|--------|
| HC-01 | Single active session assumption | Architecture design | No multi-user, no concurrent editing sessions |
| HC-02 | IndexedDB only (no server) | Local-first design | No cloud sync without Firebase; all data on-device |
| HC-03 | Chrome MV3 for extension | Browser requirement | No MV2 APIs, service worker lifecycle constraints |
| HC-04 | Mobile-first 1600x720 | Target device (Samsung Galaxy A22 landscape) | All UI must fit this viewport; scale factor applied |
| HC-05 | React + Vite + Tailwind stack | Established architecture | No server-side rendering, no SSR, client-only |
| HC-06 | 9-handed game format | Poker game rules | CONSTANTS.NUM_SEATS = 9, SEAT_ARRAY = [1..9] |

### 9.2 Soft Constraints (Could Change with Effort)

| ID | Constraint | Effort to Change | Trigger to Revisit |
|----|-----------|-----------------|-------------------|
| SC-01 | 9-seat max | Medium (CONSTANTS.NUM_SEATS propagates widely) | If 6-max or heads-up tables needed |
| SC-02 | Ignition-only extension | Large (protocol-specific WebSocket parsing) | If supporting PokerStars, GGPoker, etc. |
| SC-03 | English-only UI | Medium (no i18n framework) | If non-English markets are a priority |
| SC-04 | No server/API backend | Large (requires auth, hosting, data migration) | If multi-device sync or social features needed |
| SC-05 | Bayesian-only analysis | Medium (analysis pipeline assumes Beta-Binomial) | If ML-based player modeling is explored |

### 9.3 Assumptions (Believed True, Not Proven)

| ID | Assumption | Risk if Wrong | How to Validate |
|----|-----------|---------------|----------------|
| A-01 | Users have < 500 tracked opponents | Performance degrades — getAllHands/usePlayerTendencies do full scans | Check largest IndexedDB player count in production |
| A-02 | Game tree depth-2 is sufficient for most decisions | Sub-optimal advice in complex multi-street spots | Compare depth-2 vs depth-3 EV on benchmark hands |
| A-03 | Population priors from Bayesian engine are reasonable starting points | Wrong initial range estimates for first ~10 hands vs a new player | Track showdown prediction accuracy over time |
| A-04 | Users record actions during live play (not retrospectively) | UI optimized for real-time entry may frustrate post-session review | User behavior observation |
| A-05 | Mobile Chrome on Android is the primary runtime | Desktop browser differences (viewport, touch, memory) may cause issues | Track user agent distribution if analytics added |
| A-06 | IndexedDB quota (~50MB minimum guaranteed) is sufficient | Data loss if quota exceeded with no warning | Monitor via `navigator.storage.estimate()` |
| A-07 | Game tree eval < 100ms on target device | UI jank during live play if evaluation is slow | RT-7 (physical device profiling) will validate |

*Update when: new constraint discovered, assumption validated/invalidated, or soft constraint becomes hard/irrelevant.*

---

## 10. Observability Gaps

### 9.1 What We Cannot Currently See

| Gap | Impact | Recommended Fix |
|-----|--------|----------------|
| No performance metrics for game tree evaluation | Can't detect slow evaluations or regressions | Add timing telemetry to `evaluateGameTree()` |
| No error tracking beyond console.log | Silent failures in production | Structured error logging with context |
| No usage analytics (which features used, which ignored) | Can't prioritize development | Optional anonymous telemetry |
| Range profile accuracy unknown | Can't validate Bayesian updates are improving | Track prediction accuracy vs showdown outcomes |
| No regression detection for EV calculations | EV drift from code changes goes unnoticed | Benchmark suite with known-answer hands |
| Extension ↔ app sync status invisible | User doesn't know if extension is connected | Connection status indicator in UI |
| IndexedDB storage usage unknown | No warning before hitting quota | `navigator.storage.estimate()` check |
| Villain model confidence distribution | Don't know how many players have usable models | Aggregate confidence histogram in stats view |
| No SW restart counter in diagnostics | Cannot measure frequency of sidebar 5-step flicker sequence | Add `sw_restart_count` to pipeline diagnostics |
| No stale advice detection/logging | Cannot tell if user acted on stale data | Log advice age at render time; flag renders where age > 10s |
| No render-cause tracing in side panel | Cannot debug which push handler triggered a specific render | Add render-reason tag to `scheduleRender()` calls |
| No coordinator-vs-module state divergence detection | Cannot detect root cause of "wrong state" bugs at runtime | Debug-mode assertion comparing coordinator._state to module vars (or eliminate dual state via RT-43) |
| No message-sequence test coverage | State race conditions invisible to test suite; temporal harness tests render layer only | RT-51: message-level integration harness |
| `_contextStale` computed but never rendered | Two-phase stale detection invisible to users; visual no-op | RT-53: render the indicator |
| Community cards absent from renderKey | Turn/river card arrival may not trigger re-render if no other tracked field changes | RT-54: include card content hash |

### 9.2 What We Can See

- Test suite: ~5,400+ tests catch functional regressions
- Manual visual verification via dev server
- Git history for change tracking
- `smart-test-runner.sh` for pre-commit validation
- Extension visual harness (`localhost:3333`) for sidebar scenarios

---

## 11. Technical Debt Register

| ID | Debt | Severity | Origin | Resolution Path |
|----|------|----------|--------|----------------|
| TD-01 | `getAllHands()` full scan (no pagination) | Medium | Original design | Add cursor-based pagination with limit param |
| TD-02 | `usePlayerTendencies` recomputes all players on any hand change | Medium | Hook architecture | Per-player memoization with selective invalidation |
| TD-03 | Magic number `0.3` for villain model confidence threshold | Low | Rapid iteration | Extract to named constant in config |
| TD-04 | Monte Carlo fallback when combo distribution unavailable | Low | Legacy path | Expand combo distribution coverage |
| TD-05 | No incremental range profile updates (full rewrite per hand) | Medium | Bayesian updater design | Delta updates to changed buckets only |
| TD-06 | Layer boundary: 9 views import directly from engine utils | Low | Organic growth | Rule amended to allow pure/constant imports; prohibit stateful access |
| TD-07 | `useEquityWorker` is a hook, not a context — every call site spawns a new Worker | Medium | RT-10 initial implementation | RT-27: extract to EquityWorkerContext |
| TD-08 | Preflop MC path bypasses Worker (`handVsRange` called directly in `preflopAdvisor`) | Medium | RT-10 incomplete threading | RT-31: inject equityFn into preflop path |
| TD-09 | ~~`handAnalysis` reverse-imports from `exploitEngine`~~ | ~~High~~ | Resolved RT-35 | monteCarloEquity moved to pokerCore, 4 symbols injected via deps |
| TD-10 | ~~No React.memo anywhere in component tree~~ | ~~Medium~~ | Resolved RT-36 | SeatComponent wrapped in React.memo with custom comparator |
| TD-11 | Cross-tab sibling imports across drill views (10+ files consume `RangeFlopBreakdown`, `MatchupBreakdown`, `HandPicker`, `LessonCalculators`, `FRAMEWORK_COLOR` via `./` relative paths). Blocks any future view restructuring. | Medium | Drills-consolidation roundtable 2026-04-20 | RT-94: migrate helpers into `src/components/_shared/drillInternals/` barrel |
| TD-12 | INV-08 violation: `src/utils/drillContent/__tests__/lessons.test.js` imports from `src/components/views/PreflopDrillsView/LessonCalculators`. Utils-layer test pulls from UI layer. | Medium | Roundtable surfaced 2026-04-20 | RT-95: extract pure calculators to `src/utils/drillContent/` or similar |
| TD-13 | `aggregateFrameworkAccuracy` at `preflopDrillsStorage.js:108` uses `const out = {}`; tampered IDB record with `frameworks: ['__proto__']` would attempt prototype write. Low severity in single-user context; trivial fix. | Low-Medium | Roundtable surfaced 2026-04-20 | RT-96: `Object.create(null)` + shape guard on IDB read |
| TD-14 | SCREEN enum lifecycle is ad-hoc. `editorContext.prevScreen` carries SCREEN strings; bulk deletion (e.g., Phase 7 of drills-consolidation) risks stranded values. No default case in `PokerTracker.jsx` routing switch. | Medium | Roundtable surfaced 2026-04-20 | RT-102: two-step deprecation protocol + default fallback case |

---

## 12. Decision Log

Historical decisions (pre-2026) are in `docs/adr/ADR-001` through `ADR-004`. This log captures decisions from 2026 onward. New decisions go here, not as new ADR files.

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2024 | useReducer for state management | Complex interdependent state; avoids Redux boilerplate | Redux (rejected: overkill), useState (rejected: too simple). See `docs/adr/ADR-001` |
| 2024 | IndexedDB for persistence | Large datasets, structured data, no server needed | localStorage (rejected: 5MB limit), SQLite (rejected: no browser support). See `docs/adr/ADR-002` |
| 2024 | Context API for cross-component state | Avoids prop drilling; fits reducer pattern | Redux (rejected: redundant with useReducer), Zustand (rejected: extra dep). See `docs/adr/ADR-003` |
| 2024 | Vitest for testing | Fast, Vite-native, ESM support | Jest (rejected: slow transforms), Playwright (rejected: different scope). See `docs/adr/ADR-004` |
| 2026-03-08 | Bayesian over frequentist for all poker analysis | Small samples, non-normal distributions, informative priors available | z-tests (rejected: wrong assumptions) |
| 2026-03-24 | 3-layer analysis pipeline (stats → tendencies → exploits) | Separation of concerns; each layer testable independently | Monolithic analyzer (rejected: untestable) |
| 2026-03-24 | Game tree evaluator as sole source of hero recommendations | Ensures EV-backed advice; prevents weakness→action shortcuts | WEAKNESS_EXPLOIT_MAP (removed: theoretically unsound) |
| 2026-03-27 | Villain model 5-layer priority hierarchy | Higher-fidelity data supersedes lower; prevents double-counting | Flat weighted average (rejected: double-counts) |
| 2026-03-29 | Rake threaded through entire EV pipeline | Rake changes EV materially at low stakes; can't be bolted on | Post-hoc rake adjustment (rejected: wrong EV) |
| 2026-03-31 | Stratified flop sampling replaces flat realization constants | 0.70/0.85 was too coarse; archetype-weighted is calibratable | Per-hand exact rollout (rejected: too slow) |
| 2026-04-04 | Confirmed circular import: foldEquityCalculator ↔ villainDecisionModel | fitFoldCurveParams creates bidirectional dependency; RT-16 to extract into standalone module | Leave as-is (rejected: fragile init order) |
| 2026-04-06 | Amend "views never import utils" rule to allow read-only pure function/constant imports | 9 existing violations are all read-only; strict mediation adds indirection for no safety benefit. Real invariant is no stateful engine access from views. | Strict ESLint enforcement (rejected: solo dev overhead exceeds benefit for read-only imports) |
| 2026-04-07 | EquityWorker must be a singleton context, not a per-component hook | Multiple instantiations waste mobile threads; crash recovery and backpressure require centralized state | Keep as hook with dedup logic (rejected: fragile, no enforcement) |
| 2026-04-07 | handAnalysis must not import from exploitEngine (R5 roundtable) | Bidirectional coupling violates dependency layers; shared utilities should live in pokerCore or a shared layer | Leave as-is (rejected: silent breakage path) |
| 2026-04-11 | Dual state in side-panel.js must converge to single-owner (coordinator) | Sync-based dual-state is the root cause of every recurring sidebar display bug; adding more sync points does not fix the architectural problem | Keep dual state with more sync calls (rejected: same class of bugs recurs); make module vars authoritative and remove coordinator (rejected: coordinator provides scheduling/snapshot benefits) |
| 2026-04-11 | Advice guard must include hand-number binding, not just street-rank | SW restart sends cached advice from prior hand; street-rank check passes across hand boundaries; hand-number comparison is the only reliable cross-hand guard | Street-rank only (rejected: cross-hand contamination); clear all caches on SW restart (rejected: loses valid state on transient restart) |
| 2026-04-15 | Sidebar Rebuild Program (SR-0 → SR-7) closed: 5 user symptoms (S1–S5) decomposed to 8 root mechanisms (M1–M8), all fixed; 4 blocking deltas closed; doctrine v2 (33 rules) + 6-zone shell + 5 declarative FSMs + freshness sidecar + computeAdviceStaleness as single source of truth for stale surface. Failure-mode register entries from RT-43 through RT-66 (lines ~180–199) are now resolved by the rebuild, not patched in place. | Recurring sidebar display bugs had structural cause; symptom-by-symptom fixes kept regressing. Spec-first program produced a stable architecture with explicit invariants under automated lint gates (R-2.3 dom-mutation, RT-60 timer, R-7.2 cross-panel coverage). | Continue patching individual symptoms (rejected: 3 weeks of recurrence proved the pattern); rebuild without doctrine first (rejected: would have produced different bugs, not fewer). Post-mortem: `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`. |
| 2026-04-20 | Drills-consolidation proposal (`docs/projects/drills-consolidation.project.md`) held pending three preconditions: (a) Line Study closure (LS-4..6), (b) design-doc defect fixes (RT-93), (c) `src/components/_shared/drillInternals/` barrel creation (RT-94). Effort revised 2–3 → 5–7 sessions. Learn tab scope split into search vs. schema normalization. | 6-expert roundtable found: sibling `./` imports across 10+ files invalidate "zero internal changes" claim; `ViewRouter.jsx` reference was factual error (route wiring is inline in `PokerTracker.jsx:109-110`); file-move tally omits ~7 helpers; Learn unified-search collides with two lesson schemas; Phase 1 scaffolding collides with active Line Study handoff. | Execute as written (rejected: factual errors + scope undercounting); descope to rename-only (rejected: doesn't serve the JTBD framing); roundtable the revised proposal after defect fixes (accepted). Peer-tab-vs-nested for Line Study deferred to owner content-roadmap decision (not an engineering call). |

---

---

## 13. Roundtable Persona Reference

Seven personas analyze this system model during structured roundtables.
Full persona definitions, reasoning rules, write permissions, and section assignments: see `SYSTEM_MODEL_PROTOCOL.md` §4.

---

*Next update trigger*: Any change to component boundaries, new invariant discovery, or architectural decision.
