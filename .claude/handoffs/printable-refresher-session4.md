# Session Handoff: printable-refresher-session4
Status: COMPLETE | Written: 2026-04-24

## Backlog Item

Gate 4 Persistence/CI/Selectors batch shipped. 8 of 12 Gate 4 carry-forwards now complete. The 4 remaining (S2 + J + CSS + MIG) are all NEXT-ready. PRF-G4-CI spec is ratified but its test **implementation** (contentDrift.test.js) remains as a Phase 5 prerequisite before any Gate 5 card-authoring PR merges — non-negotiable sequencing.

Backlog IDs closed this session: **PRF-G4-W / PRF-G4-CI / PRF-G4-SL** (3 rows → COMPLETE).

## What I Did This Session

Three persistence/enforcement docs authored in one session covering the complete read/write/validation contract for refresher state.

**PRF-G4-W — `docs/projects/printable-refresher/WRITERS.md`:**
- 3 writers across 2 stores:
  - **W-URC-1** `config-preference-writer` — debounced 400ms; writes `printPreferences.*` + `notifications.staleness` + `lastExportAt` (via W-URC-3 wrapper).
  - **W-URC-2** `card-visibility-writer` — immediate writes for pin/hide chip taps; `SuppressConfirmModal`-gated writes for `suppressedClasses`.
  - **W-URC-3** `print-date-stamp-writer` — append-only `printBatches` record on `PrintConfirmationModal` confirm only.
- **7 cross-store invariants I-WR-1..7:**
  - I-WR-1 Enumeration completeness (CI-grep check every `put(` / `delete(` against the 2 stores)
  - **I-WR-2 Reference-mode write-silence at reducer boundary — LOAD-BEARING** (test target PRF-G5-RI)
  - I-WR-3 Field-ownership segregation (disjoint sets per writer)
  - I-WR-4 Suppression durability across schemaVersion bumps
  - **I-WR-5 `printBatches` append-only** — zero `.delete()` calls allowed except `src/__dev__/printBatchDeleter.js`
  - I-WR-6 `perCardSnapshots` completeness (1:1 with `cardIds` array)
  - I-WR-7 Enrollment-state gating — N/A subsumed by I-WR-2 (refresher has no observation writers)
- CI-grep enforcement sketch at `scripts/check-refresher-writers.sh` mirroring SR-6 + EAL precedent.
- Amendment rule: persona-level review (same as anti-patterns.md + copy-discipline.md).

**PRF-G4-CI — `docs/projects/printable-refresher/content-drift-ci.md`:**
- **Non-negotiable sequencing:** spec is ratified now; the test implementation (`contentDrift.test.js`) must be implemented + green BEFORE any Gate 5 card-authoring PR merges.
- **6 CI checks:**
  1. **contentHash vs recomputation (RT-108 core)** — for each manifest, recompute source-hash + compare to stored `contentHash`. Mismatch + schemaVersion-bumped-in-PR = PASS (intentional re-version); mismatch + schemaVersion-unchanged = FAIL.
  2. **Source-util whitelist/blacklist** — whitelist (`pokerCore/` + `gameTreeConstants.js` + POKER_THEORY.md) / blacklist (`villainDecisionModel` / `villainObservations` / `villainProfileBuilder` / `assumptionEngine/*` / `anchorLibrary/*` / `CalibrationDashboardView/*` / `AnchorLibraryView/*`). F4/F6 enforcement.
  3. **CD forbidden-string grep** — regex patterns from `copy-discipline.md` §CI-lint across 5 categories (imperative tone / self-evaluation / engagement / labels-as-inputs / unqualified assumptions). CD-4 has a whitelist exception for POKER_THEORY citations within 200 characters.
  4. **schemaVersion bump discipline** — monotonic; any diff without schemaVersion bump fails unless `proseOnlyEdit: true` is set (strict rule: prose-only means no numeric/citation/assumption/lineage change; typo fixes only).
  5. **Markdown-vs-generated precedence** — `bodyMarkdown` source of truth for copy; `generatedFields` source of truth for computed numerics; contradiction WARN + manual review.
  6. **Lineage-footer completeness** — all 7 fields present per red line #12 + S1 `LineageModal` spec.
- Manifest shape v1 fully documented with per-field semantics + `atomicityJustification` (≤25 words per H-PM05) + `fidelityChecklist` F1-F6 per-card ratification + `cd5_exempt` opt-out flag.
- Phase 5 implementation checklist 9 items.
- Developer-experience troubleshooting section covers 5 common "why CI fails" scenarios.

**PRF-G4-SL — `docs/projects/printable-refresher/selectors.md`:**
- **6 selectors:**
  - `selectAllCards(inputs)` — full registry with visibility + class-suppression annotations; base for "Show suppressed" view.
  - `selectActiveCards(inputs)` — default catalog filter; excludes hidden + class-suppressed. Base for default catalog render + default print-export + staleness-diff count.
  - `selectPinnedCards(inputs)` — pinned subset; used for "pinned-first" sort option.
  - `selectSuppressedCards(inputs)` — inverse of active relative to all; partition with active covers all cards.
  - `selectCardsForBatchPrint(inputs, selectedIds)` — defense-in-depth filter; if suppressed card is explicitly selected, it's dropped + UI warns.
  - `selectStaleCards(inputs, printBatches)` — compares current contentHash against most-recent batch's `perCardSnapshots[cardId].contentHash`; returns `StaleCard[]` with batch context.
- **4 state-clear-asymmetry roundtrip tests (R-8.1):** pin / hide / suppress / **un-suppress** (canonical zero-data-loss proof: set 3 cards `'pinned'` → suppress class → un-suppress → verify all 3 still `'pinned'`).
- Memoization contract (shallow-eq on cardRegistry + userRefresherConfig + printBatches).
- Renderer coupling rules: direct `cardVisibility[` access outside `selectors.js` prohibited (ESLint rule + grep-check companion to writer-check).
- Filter + sort composition pattern documented (selectors return base set; `useRefresherView` applies filter + sort downstream).

**Relationship to sibling docs:** the three layers together form the persistence + state contract:
- **Writers** produce state (`WRITERS.md`).
- **Selectors** consume state (`selectors.md`).
- **Content-drift CI** validates the content at build (`content-drift-ci.md`).

All three are CI-enforced and amendment-gated via persona-level review. I-WR-5 `printBatches` append-only interacts with `selectStaleCards` — snapshot immutability is the precondition for staleness-diff correctness.

**Governance:**
- BACKLOG: 3 PRF-G4-* rows flipped NEXT → COMPLETE with detailed accept-criteria annotations.
- STATUS.md: new top entry (full detail inline). Parallel EAL Session 8 entry (retirement evaluator Phase 5 Stream E Commit 3) preserved in prior-update stack.
- Charter: status line updated ("8 of 12 complete; 4 NEXT-ready"). Gate 4 closure checklist updated (8 of 12 checked, including PRF-G4-CI marked done with note that test **implementation** remains a Phase 5 prerequisite). Decisions Log gained 2 new entries (persistence/CI/selectors batch shipped + I-WR-2 Reference-mode write-silence load-bearing invariant rationale).

## Files I Own (DO NOT EDIT)

*Session is COMPLETE — no files owned.* All three docs are in a stable, cross-referenceable state. Next session can freely touch any PRF file.

## Uncommitted Changes

Created in this session:
- `docs/projects/printable-refresher/WRITERS.md`
- `docs/projects/printable-refresher/content-drift-ci.md`
- `docs/projects/printable-refresher/selectors.md`

Modified in this session:
- `docs/projects/printable-refresher.project.md` (status line + Gate 4 checklist + 2 Decisions Log entries)
- `.claude/BACKLOG.md` (3 row state changes + section header + section footer)
- `.claude/STATUS.md` (top entry + prior-update preservation of parallel EAL S8 entry)

**NOT modified by this session:**
- CATALOG.md (a parallel Monetization & PMF session added telemetry-consent-panel + evaluator-onboarding rows; no PRF conflict)
- JTBD domain files / persona files / audits / other surface specs — this session's scope is intra-PRF project docs only.

## What's Next

**4 Gate 4 carry-forwards remain, all NEXT-ready.** Recommended next-session batching options:

**Option 1 — Design-side closeout (PRF-G4-J + PRF-G4-S2):**
- **PRF-G4-J** `journeys/refresher-print-and-re-print.md` — 5-variation journey (first-print / stamp-date / engine-changes / in-app-diff / re-print-prompt) with AP-PRF refusals + copy-discipline compliance demos per variation.
- **PRF-G4-S2** `surfaces/printable-refresher-card-templates.md` — per-card-class layout templates (preflop / math / equity / exceptions) with atomicity justification per template per H-PM05. Consumed by `CardDetail` + `PrintPreview`.

**Option 2 — Infrastructure closeout (PRF-G4-CSS + PRF-G4-MIG):**
- **PRF-G4-CSS** — print-CSS doctrine spec. Page sizes (Letter / A4), type scale (body 10pt floor + 8pt table floor), 6-hue deuteranopia-safe palette, layout grid, cross-browser test matrix (Chrome primary / Firefox secondary / Safari tertiary per S1).
- **PRF-G4-MIG** — IDB v18/v19 migration spec. `userRefresherConfig` singleton + `printBatches` UUID-keyed store per S1 §State + WRITERS.md shapes. Dynamic `max(currentVersion + 1, 18)` target per Q6. Additive-only.

My recommendation: **Option 1** (design-side closeout) next — J + S2 close the design-layer cleanly and enable the last-remaining design-review pass. Option 2 can follow as an infrastructure-only session.

After all 12 Gate 4 items ship, Gate 5 unblocks. **Phase 5 prerequisite:** implement `contentDrift.test.js` + related infrastructure (`cardRegistry.js`, `lineage.js`, `stalenessDiff.js`, manifest loader) BEFORE the first card-authoring PR. Phase B (Math Tables) is the clear starting point; Phase A (Preflop) conditional on Q5 differentiation demo; Phase C (Texture-Equity + Exceptions Codex) last per-card fidelity review.

## Gotchas / Context

1. **PRF-G4-CI is "spec shipped, test still required."** The BACKLOG row is COMPLETE because the spec is ratified + comprehensive. But the actual `contentDrift.test.js` file + supporting infrastructure (cardRegistry / lineage / stalenessDiff) cannot be written until Phase 5 (they need the app's new-code scaffolding). Phase 5's first session MUST implement these before any card authoring merges. If a future session gets eager and starts Phase B card authoring before the CI test is green in main, stop + redirect — the non-negotiable sequencing is there precisely to prevent drift from shipping at scale.

2. **I-WR-2 Reference-mode write-silence is the load-bearing invariant for the writer registry.** The three writers W-URC-1/2/3 are the only allowed mutations from refresher surfaces; none mutate skill-state. If a future writer is proposed that would mutate skill-state, it must either (a) be re-classified out of the refresher surface, OR (b) dispatch `currentIntent: 'Deliberate'` first per red line #17 before writing. The test PRF-G5-RI spies on reducer dispatch from `PrintableRefresherView` mounts — any added skill-state dispatch under Reference intent fails CI.

3. **I-WR-5 `printBatches` append-only is enforced at CI-grep.** Zero `.delete()` calls are permitted against the store except from `src/__dev__/printBatchDeleter.js`. If a future UI feature proposes "edit batch" or "delete batch," refuse it — batches are immutable snapshots; editing invalidates staleness-diff. The only legitimate way to "remove" a batch is to print a new one with overlapping cards (which effectively supersedes the old one for staleness-diff of those cards).

4. **CD-4 label-decomposition whitelist is 200 characters.** The regex matches `(vs|against|versus) (fish|nit|lag|tag|station|maniac|whale)` followed by an action verb within 80 characters. Whitelist exception: if a POKER_THEORY citation appears within 200 characters of the match, the lint passes. Glossary / population-annotation cards need the citation to be proximate. If a card authors a longer prose block mentioning the label before citing, the regex might still fire — reviewer-at-PR time resolves.

5. **`proseOnlyEdit: true` is a strict escape hatch for typos.** The field permits prose-only edits (typo fixes / caption polish / grammar) without schemaVersion bump. Strict rule: the change must NOT alter any numeric value, table entry, formula, citation, assumption, or lineage field. CI check #4 validates by diff-analysis; misuse (e.g., changing a number but claiming proseOnlyEdit) fails CI. Reviewer + persona-level-review on amendments enforce at PR-review time. **If unsure, bump schemaVersion.**

6. **Manifest shape v1 includes `fidelityChecklist: { F1..F6: boolean }` per card.** Every card at Gate 5 author time must tick all six F1-F6 flags. A manifest with any `false` fails schema validation (manifestSchema.test.js). The flags are the **author's claim** that the card clears the 6-point fidelity bar — reviewer verifies the claim at PR-review time. This is analogous to EAL's `gtoBaseline` schema field — authors attest to correctness; CI validates shape; reviewer validates substance.

7. **Selector `selectStaleCards` reads **most-recent** batch per card, not all historical batches.** Staleness is about the laminate the owner currently holds, not the full print history. If a card was printed in batches A + B, only B's snapshot is compared against current hash. Rationale: H-PM07 channels staleness through "the laminate in your pocket now." A card never printed is not stale. The batch-level banner on `StalenessBanner` shows count relative to most-recent batch of the set currently active.

8. **Renderer coupling rule bans direct `cardVisibility[` access.** Refresher surfaces must go through selectors. Rationale: direct access bypasses the `classSuppressed` annotation + bypasses default filter logic. ESLint rule or grep-check companion will enforce at Phase 5. Writer validators may read directly (they're at the write-boundary); tests may read directly (for assertion convenience); no other code.

9. **Parallel session coordination.** EAL Session 8 ran between my PRF S3 and S4 (retirement evaluator, Phase 5 Stream E Commit 3, 155 anchorLibrary tests green). A Monetization & PMF session also updated CATALOG.md with telemetry-consent-panel + evaluator-onboarding rows. No file conflicts (EAL touched `src/utils/anchorLibrary/`; MPMF touched CATALOG.md which I did not touch this session; PRF this session touched `docs/projects/printable-refresher/` + governance). STATUS.md top entry re-asserted; EAL S8 preserved in prior-update stack.

10. **When content-drift CI amendment is needed, it's persona-level review.** The CI-lint regex list in `copy-discipline.md` §CI-lint is the source of truth; `content-drift-ci.md` §Check 3 mirrors the patterns for implementation reference but any change to the patterns follows `copy-discipline.md`'s amendment rule. Adding a new CI check (#7+) requires amending `content-drift-ci.md` + persona-level review. Removing a check is essentially forbidden — these checks are the autonomy guarantee.

## System Model Updates Needed

None this session. PRF remains pre-code. When Gate 5 ships actual code (Phase 5 Stream A / B / C), SYSTEM_MODEL.md gains entries from the prior handoffs' cumulative list:
- New view entry `PrintableRefresherView` (~13th top-level view) with 5 sub-views.
- New util namespace `src/utils/printableRefresher/` with modules: index / cardRegistry / selectors / lineage / stalenessDiff / writers / manifests/.
- New IDB version bump (v17 → v18 or v19 per dynamic rule).
- New reducer-boundary invariant for Reference-mode write-silence (red line #11).
- New `currentIntent` UI reducer field + three-intent taxonomy doc pointer.
- New CI-check entries (content-drift CI + writer-registry CI + selector-access CI).
- Potential new program file `.claude/programs/reference-integrity.md` if CC-82/83 + H-PM07 pattern adoption grows.

## Test Status

No tests run (zero code changes). Pre-session test baseline per STATUS.md prior entries: 7238/7239 (155 anchorLibrary + rest of suite; 1 pre-existing precisionAudit flake). No regressions possible — design-doc session only.
