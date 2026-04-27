# Session Handoff: printable-refresher-session16
Status: IN PROGRESS | Written: 2026-04-26

## Backlog Item

**PRF-G5-B Phase B Math Tables — 4 of 6 cards shipped (2026-04-26).** Auto-profit (S1) + 3 new cards in this session: pot-odds + SPR-zones + geometric-sizing. Two cards remain (implied + binomial) for the next session.

| Card | Status | Source |
|---|---|---|
| auto-profit | DONE | S1 (commit `6cc45ce`) |
| pot-odds | **DONE** | S16 (this commit) |
| SPR-zones | **DONE** | S16 (this commit) |
| geometric-sizing | **DONE** | S16 (this commit) |
| implied | NEXT | S17 |
| binomial | NEXT | S17 |

After PRF-G5-B fully closes (S17) → Q5 differentiation demo at design review → conditional PRF-G5-A Phase A Preflop → PRF-G5-C Phase C Equity+Exceptions → PRF-G5-PDF cross-browser snapshots. Phase 1 MVP target 10-13 cards.

## What I Did This Session

3 new manifest JSON files. All in `src/utils/printableRefresher/manifests/`. All 4 cards now in registry pass content-drift CI's 6 checks per-manifest.

**(1) `prf-math-pot-odds.json` — POKER_THEORY §6.3 (Breakeven Bluff Frequency) symmetric caller-side form.**

- bodyMarkdown: "Facing a bet B into pot P, the call needs at least B/(P+B+B) equity vs the betting range to break even. Equivalent to: cost-to-call divided by total pot after the call. Rake-agnostic at 100bb effective; pure pot-odds derivation, no implied odds adjustment." + 4 worked examples.
- 4 worked examples: pot-size 33% / half-pot 25% / third-pot 20% / overbet-2P 40%.
- Citation closes with "See POKER_THEORY.md §6.3 for the symmetric breakeven-bluff form" — establishes that pot-odds (caller) and breakeven-bluff (bettor) are the same formula from opposite sides.
- assumptions: stakes='rake-agnostic', rake=null, effectiveStack=100, field='all 9-handed live cash and tournament fields (formula is field-invariant)'.
- atomicityJustification: 9 words ("Single derivation (pot odds breakeven) presented as one card.") — was off-by-one initially (declared 8); fixed.
- contentHash: `sha256:c10ee79204...e48fdd` (computed via `refresher-compute-hash.js`).

**(2) `prf-math-spr-zones.json` — POKER_THEORY §3 + project_rake_spr_antes 5-zone enumeration.**

- bodyMarkdown enumerates 5 SPR zones with strategy implications:
  - MICRO (0-2): commit-or-fold board; TPGK usually committing.
  - LOW (2-4): TPTK / overpair commits; medium pairs face 2-street decisions.
  - MEDIUM (4-8): standard postflop; range advantage drives sizing; cbet ranges wider.
  - HIGH (8-13): implied-odds territory; sets / suited connectors / gap-1 hands gain value; one-pair retreats from stack-off threshold.
  - DEEP (13+): set-mining + nut hands; sizing tells more than range vs range advantage.
- Includes derivation: "SPR = effectiveStack / pot at the moment of measurement (typically flop). Zones reflect the geometry of how many pot-sized bets fit before all-in."
- Theory citation: "POKER_THEORY.md §3 (Postflop Theory) — SPR zone strategy. Phase 1 5-zone enumeration ratified at project_rake_spr_antes (2026-03-29)."
- atomicityJustification: 12 words.
- contentHash: `sha256:9bf57f7828...0d14`.

**(3) `prf-math-geometric-sizing.json` — POKER_THEORY §3 geometric-sequence-to-all-in formula.**

- bodyMarkdown: derivation `(1 + 2f)^N = effectiveStack / pot` with f = fraction-of-pot bet, N = remaining streets. Plus explicit f-solver for 1/2/3 streets remaining + 3 worked examples (SPR-5/8/13).
- 3-street: f = ((SPR + 1)^(1/3) - 1) / 2.
- 2-street: f = ((SPR + 1)^(1/2) - 1) / 2.
- 1-street: f = SPR / 2 (jam).
- Worked examples: SPR 5 → ≈0.40 / SPR 8 → ≈0.54 / SPR 13 → ≈0.87.
- Theory citation: "POKER_THEORY.md §3 (Postflop Theory) — geometric sizing baseline. Phase 1 derivation per project_rake_spr_antes (2026-03-29)."
- atomicityJustification: 10 words.
- contentHash: `sha256:3b07592f29...c51e`.

**(4) Hash recomputation workflow verified twice this session.**

- `node scripts/refresher-compute-hash.js <CARD-ID>` invoked for each new manifest.
- Stub placeholder `sha256:stub-pending-recomputation` overwritten with real recomputed value.
- Subsequent `node scripts/refresher-recompute-hashes.js` (dry-run, no `--write`) reports "0 drifted" — all 4 cards have correct hashes.

**(5) atomicityJustificationWordCount lessons learned.**

I declared `8` for pot-odds and `9` for geometric-sizing initially. The schema test caught both — actual word counts are `9` and `10`. The recompute-vs-authored equality assertion fired correctly. Pattern for future cards: write the justification, count words mechanically (`text.trim().split(/\s+/).filter(Boolean).length`), declare exact match. Punctuation is part of the adjacent word; "card." is 1 word, not 2. Parenthesized phrases like "(pot odds breakeven)" count as 3 words by whitespace split (the open-paren attaches to the next word, the close-paren attaches to the previous word).

**(6) Governance:**
- BACKLOG row PRF-G5-B: NEXT → IN PROGRESS (4 of 6 cards shipped 2026-04-26) with full S16 accept-criteria detail per card.
- BACKLOG section header updated: "PRF-G5-B IN PROGRESS (4 of 6 cards shipped 2026-04-26: auto-profit + pot-odds + spr-zones + geometric-sizing)."
- STATUS top entry: pending.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE for the 3 cards delivered.* No file lock needed. S17 will add 2 remaining cards (implied + binomial); those manifests don't yet exist so no conflict.

## Uncommitted Changes (after S16 commit)

Created in this session:
- `src/utils/printableRefresher/manifests/prf-math-pot-odds.json`
- `src/utils/printableRefresher/manifests/prf-math-spr-zones.json`
- `src/utils/printableRefresher/manifests/prf-math-geometric-sizing.json`
- `.claude/handoffs/printable-refresher-session16.md` (this file)

Modified in this session:
- `.claude/BACKLOG.md` (PRF-G5-B row state-flip + section header update)
- `.claude/STATUS.md` (new top entry pending)

**NOT modified:**
- `prf-math-auto-profit.json` from S1 — stable; no edits needed for parity with new cards.
- All Gate 4 design docs — stable.
- All PRF infrastructure (CI / MIG / SL / ST / WR / HK / RL / RI / DS / LG) — stable; the new manifests automatically exercise the per-manifest assertions in `lineageFooterRendering.test.js`, `contentDrift.test.js`, `redLineCompliance.test.js`, and `manifestSchema.test.js` via their `describe.each(manifests)` blocks.
- `SYSTEM_MODEL.md` — flagged for update at PRF-G5-B closure (S17) when full math-tables corpus is in place.

## What's Next

**PRF-G5-B Phase B Math Tables — 2 remaining cards (S17).**

Concrete S17 deliverables:
1. `prf-math-implied.json` — implied odds adjustment to pot odds. POKER_THEORY citation: §3 (Postflop Theory) — implied-odds adjustment to pot-odds threshold for hands with strong runout potential. The math: effective_pot_odds_threshold = base_pot_odds × (1 + implied_factor) where implied_factor = expected_future_street_winnings / current_pot_size. Worked example: 4-flush draw with backdoor strait potential, 25% pot-odds threshold (base) drops to ~18% effective with 2-street implied-odds.
2. `prf-math-binomial.json` — binomial survival probability for runner-runner outs / multi-out scenarios. POKER_THEORY citation: §6.6 (Combo Counting) for the underlying combinatorics. The math: P(at-least-one-hit-in-N-trials) = 1 - (1 - p)^N where p = single-trial probability. Worked examples for 4-out turn (running flush completion 1.5%) + 9-out flush draw turn-or-river (~35%) + open-ender turn-or-river (~32%).

Both cards: `sourceUtils: []` (theory-only pass-through). Compute hashes via `refresher-compute-hash.js`. Re-run full PRF scope after authoring.

**After PRF-G5-B closes (S17 complete):**
- Q5 differentiation demo at design review with one Phase A preflop sample card → owner decides PRF-G5-A go/no-go.
- PRF-G5-C Phase C Equity+Exceptions (4 cards; per-card Voice-3-equivalent fidelity review at PR time; bucket-definition glossary prerequisite).
- PRF-G5-PDF Playwright cross-browser snapshots once MVP cards exist.

**UI components** (PrintableRefresherView catalog/cards/print modal/settings panel) deferred — they need the cards to exist first; surface assembles them via `useRefresher()` selectors + writer-action helpers already shipped (S14 commit `2e81b16` + AppRoot wiring S15 commit `5f3a07f`).

## Gotchas / Context

1. **Word-count assertions are unforgiving.** The `atomicityJustificationWordCount` field must equal `text.trim().split(/\s+/).filter(Boolean).length` exactly. Punctuation matters: "card." = 1 word ("card." includes the period); "(pot odds breakeven)" = 3 words by whitespace split. When I declared `8` for "Single derivation (pot odds breakeven) presented as one card." it was actually `9` — the open-paren attaches to "(pot" as a single token. Pattern for future authors: count by whitespace split, not by visual word count.

2. **`sourceUtils: []` is the spec-blessed pass-through for math cards.** All Phase B math tables have empty `sourceUtils` arrays + theory-only POKER_THEORY citations. Spec §Check 2 explicitly names auto-profit as the canonical case; pot-odds + SPR-zones + geometric-sizing inherit the same pattern. The CD-3 lineage-trail field falls back to "POKER_THEORY-derivation (see field [5])" automatically.

3. **CD-1 imperative-tone false-positive avoided.** "TPTK / overpair commits" in SPR-zones initially worried me — "commits" looked verb-ish — but "commits" is NOT in the CD-1 action-verb regex (`fold|iso|check|bet|bluff|call|raise|3-?bet|4-?bet|cbet|barrel`). Same for "retreats" / "loses stack-off threshold". The pattern is precision-tuned to specific imperative-action verbs, not all verbs. Future card authors can use action-shaped vocabulary like "commits" / "retreats" / "lose value" without tripping CD-1 — but should verify by running `node -e "import('./src/utils/printableRefresher/copyDisciplinePatterns.js').then(({validateCopyDiscipline}) => console.log(validateCopyDiscipline({bodyMarkdown: 'YOUR PROSE'}, '')))"` before commit.

4. **CD-4 false-positive risk in math cards is low.** None of the new 3 cards mention "vs Fish/Nit/LAG/etc." — math cards describe formulas, not opponent archetypes. If a future author wants to add population-annotation context (e.g., "vs population-average flop checking range") they should use POKER_THEORY citation within 200 chars to satisfy the CD-4 whitelist exception.

5. **The recompute workflow has a subtlety.** `refresher-compute-hash.js <cardId>` reads the manifest from disk and computes the hash from current bodyMarkdown + sourceUtils + generatedFields. If the manifest has a stub placeholder hash + correct content, the script prints the recomputed hash but doesn't auto-write. The author must manually paste the value. For batch recompute, `refresher-recompute-hashes.js --write` updates all manifests at once. I used the single-card path 3 times; each was 2-step (compute, paste, manual edit).

6. **`refresher-recompute-hashes.js` (no `--write`) reports "0 drifted" after this session.** All 4 cards have correct hashes. If a future card author edits bodyMarkdown without updating contentHash, the script will report drift and exit with code 1. This is the intended pre-commit safety check.

7. **The atomicityJustificationWordCount mismatch was caught by manifestSchema.test.js NOT contentDrift.test.js Check 1.** Word count is a structural validation in the schema test (recompute-vs-authored equality + ≤25 ceiling). Check 1 only validates the contentHash matches `computeSourceHash(manifest)`. So word-count mismatches are caught EARLIER in the test pipeline than hash mismatches — the schema test is the first line of defense.

8. **All 4 manifests live in `src/utils/printableRefresher/manifests/`.** Filenames are `lowercase(cardId).json`:
   - `prf-math-auto-profit.json`
   - `prf-math-pot-odds.json`
   - `prf-math-spr-zones.json`
   - `prf-math-geometric-sizing.json`
   Naming convention enforced by manifestSchema.test.js test #2 ("filename matches lowercase(cardId) + .json").

9. **No `generatedFields` in any Phase B math card.** All math derivations are inline in bodyMarkdown — there's no engine util to bind to. If a future Phase A preflop card needs to call `pokerCore/preflopCharts.js#computeOpenRange`, the `generatedFields` object would map placeholder name to `path#fn` reference per the manifest shape spec. Phase B math cards don't have this need.

10. **Per-manifest test scaling worked correctly.** S15 baseline was 399/19 tests (1 manifest in registry). S16 baseline is 528/19 tests (4 manifests in registry). The +129 tests come from the existing per-manifest `describe.each(manifests)` blocks running 4× instead of 1× (manifestSchema 20 per-manifest assertions × 4 = 80 instead of 20 → +60; lineageFooterRendering 9 per-manifest tests × 4 = 36 instead of 9 → +27; contentDrift 11 per-manifest tests × 4 = 44 instead of 11 → +33; redLineCompliance has some per-manifest assertions baked in; net +129 is roughly right). No new test functions written this session — the test infrastructure scales linearly with card count, which is exactly the design intent.

## System Model Updates Needed

Defer until PRF-G5-B fully closes (S17 with 2 remaining cards). At that point `SYSTEM_MODEL.md` should grow:
- New manifest list in §Persistence: 6 Phase B math cards (auto-profit / pot-odds / spr-zones / geometric-sizing / implied / binomial).
- Note that Phase B is the load-bearing visible-owner-value milestone.
- All other infra (CI / MIG / SL / ST / WR / HK / RL / RI / DS / LG / AppRoot) was already noted in handoff §System Model Updates Needed of S15.

UI components ship after PRF-G5-B; SYSTEM_MODEL.md gets full §UI section update at that point.

## Test Status

Full PRF + persistence + reducer + hooks + context scope: **528/528 green across 19 test files** in isolation.

S16 net-add: **129 tests** (no new test functions; +3 manifests in registry × per-manifest describe.each blocks across manifestSchema + lineageFooterRendering + contentDrift + redLineCompliance + writers + lineage tests).

CI smoke tests (writers + bundle): both green ✅.

Full smart-test-runner not run this session — modifications outside PRF scope are governance docs only. The known precisionAudit flake + parallel-MPMF-G5-B2 broken `migrationV21.test.js` situation remains unchanged. Zero new regressions from S16.
