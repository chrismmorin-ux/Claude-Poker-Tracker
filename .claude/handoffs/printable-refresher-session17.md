# Session Handoff: printable-refresher-session17
Status: COMPLETE | Written: 2026-04-26

## Backlog Item

**PRF-G5-B CLOSED — Phase B Math Tables 6 of 6 cards shipped.** This session lands the final 2 cards (implied + binomial), closing the Phase B math-tables corpus. The first visible-owner-value milestone is reached: owners can now print all 6 reference math cards.

| Card | Status | Source |
|---|---|---|
| auto-profit | DONE | S1 (commit `6cc45ce`) |
| pot-odds | DONE | S16 (commit `deadb05`) |
| SPR-zones | DONE | S16 (commit `deadb05`) |
| geometric-sizing | DONE | S16 (commit `deadb05`) |
| **implied** | **DONE** | S17 (this commit) |
| **binomial** | **DONE** | S17 (this commit) |

After PRF-G5-B closure → Q5 differentiation demo at design review → conditional PRF-G5-A Phase A Preflop (3 cards) → PRF-G5-C Phase C Equity+Exceptions (4 cards) → PRF-G5-PDF cross-browser snapshots. Phase 1 MVP target: 10-13 cards (now 6 Phase B + up-to 3 Phase A + 4 Phase C).

## What I Did This Session

2 new manifest JSON files. All in `src/utils/printableRefresher/manifests/`. Both pass all 6 content-drift CI checks per-manifest.

**(1) `prf-math-implied.json` — POKER_THEORY §1.5 (Pot Odds and Implied Odds) canonical derivation.**

bodyMarkdown:
- Formula: `required_equity = call_cost / (current_pot + call_cost + expected_future_winnings)`.
- Equivalent multiplier form: `effective_pot_odds_threshold ≈ base_pot_odds_threshold × (current_pot + call_cost) / (current_pot + call_cost + expected_future_winnings)`.
- Set-mining floor citation: "pocket pair flops a set ~1-in-8 (~12% turn-or-river hit). Calling needs ~15:1 implied to break even on the set-mine alone." (matches POKER_THEORY §1.5 example).
- 2 worked examples (rake-agnostic, 100bb effective):
  - 9-out flush draw on flop facing half-pot bet (base 25% threshold; unaided ≈ 35% turn-or-river → already calls; with implied 0.6× pot extra, threshold drops to ~18%).
  - Pocket pair set-mining 100bb-deep (pot 17bb, call 4bb, base 19% threshold; unaided ≈ 12% — needs implied; stack-off potential when set hits adds ~80bb winnings → effective threshold ~6%, set-mine call clearly +EV).
- Reverse implied odds note: "top-pair weak-kicker on draw-heavy boards LOSES bets when hits — invert sign on expected future winnings."
- Theory citation: "POKER_THEORY.md §1.5 (Pot Odds and Implied Odds) — canonical implied-odds + reverse-implied-odds derivation."
- atomicityJustification: 12 words ("Single derivation (implied odds adjustment to pot odds) presented as one card." — note parenthesized phrase parses as 6 words by whitespace split: `(implied`, `odds`, `adjustment`, `to`, `pot`, `odds)`).
- contentHash: `sha256:b6f34cbe71...0d79`.

**(2) `prf-math-binomial.json` — POKER_THEORY §6.6 (Combo Counting) underlying combinatorics.**

bodyMarkdown:
- Formula: `P(at-least-one-hit) = 1 - (47-O)/47 × (46-O)/46` for flop-to-river with O outs.
- 4 worked examples (rake-agnostic, 100bb effective; outs counted vs current draw structure, no blocker adjustment):
  - 9-out flush draw, flop-to-river: `1 - (38/47)(37/46) ≈ 35.0%`.
  - 8-out open-ender, flop-to-river: `1 - (39/47)(38/46) ≈ 31.5%`.
  - 4-out gutshot, flop-to-river: `1 - (43/47)(42/46) ≈ 16.5%`.
  - 15-out flush + open-ender combo, flop-to-river: `1 - (32/47)(31/46) ≈ 54.1%`.
- Runner-runner formula: `P(both) = (out_turn/47) × (out_river/46)` with backdoor flush 4.2% + backdoor straight 1-3% examples.
- Turn-to-river simpler 1-trial form: `P(hit-on-river) = O/46`.
- Blocker-discount + reverse-implied-odds disclaimer: "Discount the raw binomial when blockers reduce the effective out count or when hitting still loses (reverse implied — see PRF-MATH-IMPLIED)."
- Theory citation: "POKER_THEORY.md §6.6 (Combo Counting) — unseen-card combinatorics underlying multi-trial draw probability."
- atomicityJustification: 10 words ("Single derivation (binomial multi-trial draw probability) presented as one card.").
- contentHash: `sha256:54bd0f0c00...d0ae`.

**(3) Hash recomputation workflow (verified twice this session):**
- `node scripts/refresher-compute-hash.js PRF-MATH-IMPLIED` → `sha256:b6f34cbe71...0d79`.
- `node scripts/refresher-compute-hash.js PRF-MATH-BINOMIAL` → `sha256:54bd0f0c00...d0ae`.
- Each stub placeholder overwritten with real recomputed value via Edit tool.
- Subsequent batch dry-run via `node scripts/refresher-recompute-hashes.js` would report "0 drifted" across all 6 cards.

**(4) Cross-card linkages established:**
- The implied card explicitly cross-references the auto-profit + pot-odds cards (it uses pot-odds threshold as its base).
- The binomial card explicitly cross-references the implied card ("see PRF-MATH-IMPLIED" for reverse-implied-odds disclaimer).
- These cross-references are inline references in bodyMarkdown — they don't appear in `sourceUtils[]` (the latter is reserved for engine-util sources, not card-to-card prose links).

**(5) Governance:**
- BACKLOG row PRF-G5-B: IN PROGRESS (4 of 6) → COMPLETE (6 of 6) with full S17 accept-criteria detail per card.
- BACKLOG section header updated: "PRF-G5-B CLOSED 2026-04-26 (6 of 6 cards). Phase 1 MVP target reachable. NEXT: Q5 differentiation demo → conditional PRF-G5-A → PRF-G5-C → PRF-G5-PDF."
- STATUS top entry: pending — will write after handoff body.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S17 commit)

Created in this session:
- `src/utils/printableRefresher/manifests/prf-math-implied.json`
- `src/utils/printableRefresher/manifests/prf-math-binomial.json`
- `.claude/handoffs/printable-refresher-session17.md` (this file)

Modified in this session:
- `.claude/BACKLOG.md` (PRF-G5-B row state-flip + section header update)
- `.claude/STATUS.md` (new top entry pending)

**NOT modified:**
- All 4 prior Phase B manifests (auto-profit / pot-odds / SPR-zones / geometric-sizing) — stable.
- All Gate 4 design docs — stable.
- All PRF infrastructure (CI / MIG / SL / ST / WR / HK / RL / RI / DS / LG / AppRoot) — stable; new manifests automatically exercise per-manifest assertions in `lineageFooterRendering.test.js`, `contentDrift.test.js`, `redLineCompliance.test.js`, and `manifestSchema.test.js` via `describe.each(manifests)` blocks.
- `SYSTEM_MODEL.md` — flagged for update at next session when first UI component lands.

## What's Next

**Phase 5 next deliverables (no specific session-claim — owner picks priority):**

1. **Q5 differentiation demo at design review.** Author one Phase A preflop sample card (e.g., `PRF-PREFLOP-OPEN-CO-100BB-2-5`) + a `PreflopCardTemplate.jsx` component to render it. Owner compares visually to Upswing free pack at design review with the question: "is this differentiated enough from commodity preflop charts to be worth shipping at Phase 1?" If YES → unblocks PRF-G5-A. If NO → Phase A deferred to Phase 2+; PRF-G5-C becomes the next deliverable.
2. **PRF-G5-C Phase C Equity + Exceptions Codex.** 4 reformulated cards. Per-card Voice-3-equivalent fidelity review at PR time per Gate 4 acceptance criteria. Bucket-definition glossary prerequisite (must exist first).
3. **PRF-G5-PDF Playwright cross-browser snapshots.** Once MVP cards exist (6 Phase B already in registry; can run snapshots NOW for math cards even before Phase A/C). Per `print-css-doctrine.md` §Cross-browser test matrix: 4 grid modes × 2 page sizes × 2 color modes = 16 snapshots per MVP card. With 6 cards already → 96 snapshot baseline.
4. **PrintableRefresherView UI components.** The actual catalog / card-detail / lineage-modal / print-preview / print-confirmation / suppression-confirm sub-views. Wired via `useRefresher()` selectors + writer-action helpers already shipped at S14 + AppRoot wiring at S15. Spec at `docs/design/surfaces/printable-refresher.md`.

**Recommended next-session priority:** Either the UI components (highest visible-owner-value next step) OR Q5 differentiation demo (decision gate for PRF-G5-A). The UI components are larger scope (5 sub-views; 4 card-template components per `surfaces/printable-refresher-card-templates.md`); the Q5 demo is a 1-card spike with design review.

## Gotchas / Context

1. **`atomicityJustificationWordCount` for the implied card was tricky.** "Single derivation (implied odds adjustment to pot odds) presented as one card." — I counted on second pass. Whitespace-split tokens: `Single` / `derivation` / `(implied` / `odds` / `adjustment` / `to` / `pot` / `odds)` / `presented` / `as` / `one` / `card.` = 12 tokens. The parenthesized 6-word phrase `(implied odds adjustment to pot odds)` is the largest in any Phase B manifest so far. Pattern: every parenthesized N-word phrase contributes N tokens to the word count.

2. **Cross-card prose references are NOT in `sourceUtils[]`.** The binomial card mentions "see PRF-MATH-IMPLIED" as a prose reference. This is intentional — `sourceUtils[]` is reserved for engine-util sources (per spec §Manifest shape: `path` field is a file path), not card-to-card cross-references. If a future card needs to programmatically link to another card (e.g., for a "see also" UI element), the right mechanism is a separate `seeAlso: ['PRF-MATH-IMPLIED']` field on the manifest — but that would require schema extension + persona-level review per amendment rule.

3. **POKER_THEORY citation discipline matters for fidelity.** Both implied and binomial cite specific sections (§1.5 and §6.6). The contentDrift CI doesn't validate that the cited section actually exists in POKER_THEORY.md — it only validates the citation field is non-empty. A future enhancement could add a Check 7 "theory-citation existence verification" but it's not in spec.

4. **The "set-mining ~15:1 implied" floor in PRF-MATH-IMPLIED is a direct quote from POKER_THEORY §1.5.** I checked the source before writing this prose. Future card authors should verify any heuristic claim by grep'ing POKER_THEORY.md first; cards that contradict POKER_THEORY would be caught at PR review (Voice 3 fidelity check) but ideally never written.

5. **The binomial card's "blocker-discount" disclaimer is a forward-pointing concept.** Phase 1 MVP doesn't have a card on blocker effects. If a Phase 2+ card on blockers ships, this disclaimer can be enriched with a cross-reference. For now it's a placeholder hint that the raw binomial overestimates outs in some practical scenarios.

6. **All 6 Phase B cards have `cd5_exempt: false`.** Each card's bodyMarkdown declares both stakes (`rake-agnostic`) and stack (`100bb effective`) tokens to satisfy CD-5. None require the cd5_exempt bypass. This is the canonical pattern for math-table cards — the rake-agnostic + 100bb-effective combo is universal across the 6 cards because the math itself doesn't depend on stakes/rake/stack (formulas are field-invariant).

7. **All 6 Phase B cards have `tier: 'free'`.** Phase 1 makes all math tables free. The Plus-tier reservation is for Phase C equity-bucket cards (not yet shipped). If a future business-model decision moves any math card to Plus, the tier field is a single-value edit — but the writer's tier validation in W-URC-1 doesn't enforce per-card tier policy yet. That's a Phase 2+ enforcement.

8. **Per-manifest test scaling continues to work linearly.** S15→S16: 1→4 manifests added 129 tests. S16→S17: 4→6 manifests added 86 tests. Linear scaling confirms the test infrastructure is correctly designed — no edits to test files were needed in S17. Future card additions (Phase A, Phase C) will each add ~43 tests per card via the per-manifest describe.each blocks.

9. **The 6-card MVP is now visible-owner-value-ready at the data layer.** Once the UI components ship (next session candidate), owners can use the surface end-to-end:
   - Open the catalog (`useRefresher().getActiveCards()` returns 6 cards).
   - Pin / hide / suppress per card or class.
   - Configure print preferences (Letter/A4, 12/6/4/1-up, color mode, lineage on/off).
   - Print a batch with confirmation modal.
   - View staleness in-app on subsequent opens.
   The infrastructure is fully in place; only the rendering layer is missing.

10. **No backlog of card edits needed.** Each card was authored in one pass with correct word count + correct hash. The atomicityJustificationWordCount lesson from S16 (parenthesized phrases parse as N tokens) was applied successfully in S17 — no schema-test failures on the new 2 cards. This suggests the doctrine choice (mechanically-checked word count) is paying off — authors learn the rule once, future cards comply.

## System Model Updates Needed

Defer until first UI component lands. After that point `SYSTEM_MODEL.md` should grow:
- New view `PrintableRefresherView` in §1 Component Map (with 5 sub-views per `surfaces/printable-refresher.md`).
- Manifest list in §Persistence (or §1 Component Map): 6 Phase B math cards now in registry.
- Note that PRF-G5-B closure is the first visible-owner-value milestone.

UI-side updates (catalog rendering, card-detail modal, lineage modal, print-preview, print-confirmation modal) wait for the actual component implementation.

## Test Status

Full PRF + persistence + reducer + hooks + context scope: **614/614 green across 19 test files** in isolation.

S17 net-add: **86 tests** (no new test functions; +2 manifests in registry × per-manifest describe.each blocks scaling 4→6).

Cumulative scaling validation:
- S15 baseline (1 manifest): 399 tests / 19 files.
- S16 (4 manifests): 528 tests / 19 files (+129).
- S17 (6 manifests): 614 tests / 19 files (+86).

CI smoke tests both green ✅.

Full smart-test-runner not run this session — modifications outside PRF scope are governance docs only. The known precisionAudit flake + parallel-MPMF-G5-B2 broken `migrationV21.test.js` situation remains unchanged. Zero new regressions from S17.
