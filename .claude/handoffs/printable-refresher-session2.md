# Session Handoff: printable-refresher-session2
Status: COMPLETE | Written: 2026-04-24

## Backlog Item

Gate 4 Doctrine Batch (PRF-G4-ACP + PRF-G4-AP + PRF-G4-CD + PRF-G4-H) shipped in one session. 4 of 12 Gate 4 carry-forwards complete. Doctrine batch is now ratified and testable — remaining 8 Gate 4 items (S1 / S2 / J / W / CI / SL / CSS / MIG) can reference red lines + anti-patterns + CD rules + heuristics by ID. Zero code changes.

Backlog IDs closed this session: PRF-G4-ACP / PRF-G4-AP / PRF-G4-CD / PRF-G4-H (4 rows → COMPLETE). Gate 4 progress: 4 of 12 complete; 7 BLOCKED by PRF-G4-S1; 1 P3 independent (PRF-G4-SL). Gate 5 test IDs now have Gate 4 anchors they can assert against (PRF-G5-RL / PRF-G5-RI / PRF-G5-DS / PRF-G5-LG all blocked on PRF-G4-ACP — now unblocked).

## What I Did This Session

**PRF-G4-ACP (charter §Acceptance Criteria expansion):**
- Inlined §Acceptance Criteria in `docs/projects/printable-refresher.project.md` between Gate 2 section and Streams. Replaces the Gate 1 placeholder (the pre-Gate-2 Working Principles at the top of the charter remain as intent; ACP is the Gate-5-testable ratified form).
- 17 autonomy red lines enumerated: 9 inherited (Shape Language 2026-04-23 + EAL 2026-04-24) + 8 new PRF-specific (#10 staleness-surfacing / #11 Reference-mode write-silence at reducer boundary / #12 lineage-mandatory / #13 durable-suppression / #14 no mastery-tracking even digital / #15 no proactive print-output / #16 bidirectional cross-surface segregation / #17 intent-switch mandatory for drill-pairing).
- 11 anti-patterns enumerated by ID with red-line citations (pointer to sibling doc).
- 5 copy-discipline rules enumerated by ID (pointer to sibling doc).
- 6-point poker-fidelity bar F1-F6 inlined with per-gate specification (no archetype-as-input / math visible / scenario declared / source-trail footer / pure-exception provenance unambiguous / prescriptions computed-not-labelled).
- Source-util whitelist (`pokerCore/`, `gameTreeConstants.js`, POKER_THEORY.md) + blacklist (`villainDecisionModel` / `villainObservations` / `villainProfileBuilder` / `assumptionEngine/*` / `anchorLibrary/*` / Calibration + Anchor-Library views). Enforced at build via PRF-G4-CI content-drift CI.
- Personalization posture codified: Phase 1 default OFF structural; Phase 2+ opt-in only (AP-PRF-09 enforces).
- Newcomer gating codified: `CONSTANTS.PRF_UNLOCK_THRESHOLD_SESSIONS = 1`; factual empty-state; surface reachable (red line #6 flat access).
- Gate 4 + Gate 5 closure criteria with checkbox state (4 checked, 8 unchecked for Gate 4; all 11 unchecked for Gate 5 with dependency chain to blockers).
- Every red line + fidelity gate maps to a Gate 5 test ID.

**PRF-G4-AP (`docs/projects/printable-refresher/anti-patterns.md`):**
- 11 PRF-specific anti-patterns authored in EAL-style format: Refused + Why + Red-line-violated + Allowed-alternative per entry.
- AP-PRF-01 card leaderboard / AP-PRF-02 card-of-the-day auto-surface / AP-PRF-03 print-streak / AP-PRF-04 mastery-score / AP-PRF-05 retired-cards-nudges / AP-PRF-06 refresher-accuracy-graded-work / AP-PRF-07 cross-surface contamination / AP-PRF-08 engagement notifications default-on / AP-PRF-09 auto-personalized print pack / AP-PRF-10 watermark-based social engagement / AP-PRF-11 card-view analytics surfaced to owner.
- 9 EAL-inherited anti-patterns (AP-01..09) enumerated with relevance-to-PRF mapping + transitive-inheritance rule for cards intersecting anchor/calibration surfaces.
- Amendment rule: persona-level review required (mirrors anti-patterns.md + copy-discipline.md EAL precedent).
- "Why this list exists" section frames the novel print-medium autonomy risk (printed-advice permanence) that the 9 inherited red lines do not cover.
- Relationship-to-copy-discipline section codifies the feature-layer vs language-layer split.

**PRF-G4-CD (`docs/projects/printable-refresher/copy-discipline.md`):**
- 5 copy-discipline rules authored: CD-1 Factual-not-imperative / CD-2 No-self-evaluation-framing / CD-3 No-engagement-copy / CD-4 Labels-as-outputs-never-inputs / CD-5 Assumptions-explicit.
- Each rule: red-line citation + ✓ Allowed examples + ✗ Forbidden examples + Test pattern.
- CI-linted forbidden-string list enumerated across 5 categories (imperative tone / self-evaluation / engagement / labels-as-inputs / unqualified assumptions) with regex patterns ready for PRF-G4-CI pickup. Whitelisted-context rule for glossary / population-annotation / worked-example cards (`cd5_exempt: true` manifest flag).
- Worked-example reformulation of Q1-RED card "Don't bluff calling stations" → decomposed breakeven-fold bluff-sizing table showing CD-1 + CD-4 + F2 + F3 + F5 + F6 compliance simultaneously. This is the canonical pattern card authors follow when decomposing the three Q1 RED cards at Gate 5.
- Relationship-to-anti-patterns section codifies feature-layer vs language-layer independence.

**PRF-G4-H (`docs/design/heuristics/printable-artifact.md`):**
- 8 paper-medium heuristics H-PM01-08 consolidated from Voice 1 H-PRF01-05 + Voice 5 H-PM01-06. Merging decisions: V1's glanceability (H-PRF01) + V5's readability (H-PM01) → H-PM01 Laminate-scale readability + glanceability. V1's B&W printability (H-PRF04) + V5's color-blind (H-PM02) + V5's ink-budget (H-PM03) → H-PM02 Color-blind + B&W + ink-budget.
- H-PM01 Laminate-scale readability + glanceability / H-PM02 Color-blind + B&W + ink-budget / H-PM03 Finger-pointing row/cell accuracy / H-PM04 Lamination-friendly safe-trim margin / H-PM05 One-idea-per-card atomicity (load-bearing — Gate 5 atomicity justification required) / H-PM06 Print-first no-dynamic-rendering-assumption / H-PM07 Staleness channel is in-app only (first-of-its-kind paper-medium heuristic) / H-PM08 Socially discreet laminate.
- Each heuristic: test procedure + violated-when clauses + implications-for-CSS-or-layout.
- "Applying these alongside Nielsen + H-PLT" section with weight-priorities-by-situation table (mid-hand-chris / stepped-away-from-hand / presession-preparer / post-session-chris).
- Flagged H-PM07 as first-of-its-kind — a heuristic whose entire domain is "this affordance cannot exist on this medium." Future non-refresher paper artifacts inherit the H-PM set.

**Governance:**
- STATUS.md top entry replaced with this session's work (full detail inline); prior Monetization S3a entry pushed to Prior-update stack.
- BACKLOG.md: 4 PRF-G4-* rows flipped NEXT → COMPLETE (ACP / AP / CD / H). PRF project-header status line updated ("Gate 4 IN PROGRESS — doctrine batch shipped; 8 carry-forwards remain"). Section footer updated with new next-kickoff recommendation (PRF-G4-S1 primary surface spec).
- Charter `docs/projects/printable-refresher.project.md`: status line updated to "Gate 4 IN PROGRESS — doctrine batch shipped 2026-04-24 (ACP + AP + CD + H); surface specs + CI + migration remain." Decisions Log gained 4 new entries (doctrine-batch-shipped / ACP-inlined-rationale / H-PM07-first-of-its-kind / reference-integrity-program-candidate).

## Files I Own (DO NOT EDIT)

*Session is COMPLETE — no files owned.* All doctrine-batch work is in a stable, cross-referenceable state. Next session (PRF-G4-S1 or parallel PRF-G4-SL) can freely touch any PRF file.

## Uncommitted Changes

Created in this session:
- `docs/projects/printable-refresher/anti-patterns.md`
- `docs/projects/printable-refresher/copy-discipline.md`
- `docs/design/heuristics/printable-artifact.md`

Modified in this session:
- `docs/projects/printable-refresher.project.md` (status line + inline §Acceptance Criteria section + 4 Decisions Log entries)
- `.claude/BACKLOG.md` (4 rows COMPLETE + section header + section footer)
- `.claude/STATUS.md` (top entry + prior-update preservation)

**NOT modified by this session** (other in-flight projects, no conflict):
- Other JTBD domain files, persona files, surface catalog — doctrine-batch does not touch them. Surface spec authoring in the next session will touch `docs/design/surfaces/CATALOG.md` + surfaces directory.

## What's Next

**PRF-G4-S1 (primary surface spec `docs/design/surfaces/printable-refresher.md`) is the unblocking anchor.** It cascades to S2 / J / W / CI / SL / CSS / MIG. Recommended next-session scope:

1. **PRF-G4-S1** (primary surface spec) — on its own. S1 is a large surface spec covering in-app view + print-preview + filter/sort + stale banner + per-batch print-confirmation modal + Letter/A4 + 12/6/4/1-up selectors + parent-TBD Study Home reference + newcomer-locked empty-state. Reference red lines / anti-patterns / CD rules / heuristics by ID (all four now ratified). Map 17 red-line compliance assertions to test IDs (PRF-G5-RL enumerates).

2. **PRF-G4-CI + PRF-G4-W (parallel after S1)** — content-drift CI spec + WRITERS.md. Non-negotiable: PRF-G4-CI ships BEFORE any Gate 5 card authoring. Use the CI-linted forbidden-string list already enumerated in `copy-discipline.md` §CI-lint as input.

3. **PRF-G4-SL (independent, any time)** — selector-library contract. Small P3 item; can ship as a quick session in parallel with S1.

4. **PRF-G4-S2 + PRF-G4-CSS (after S1)** — card templates + print-CSS doctrine.

5. **PRF-G4-J (after S1)** — refresher-print-and-re-print journey.

6. **PRF-G4-MIG (after S1)** — IDB v18/v19 migration spec. Coordinate with Shape Language `max(currentVersion+1, 18)` rule per Q6.

After Gate 4 closes (12 items complete), Gate 5 can ship **Phase B Math Tables** first (clear market gap, zero anti-pattern risk). Phase A (Preflop) conditional on Q5 differentiation demo at Gate 4 design review; Phase C last.

## Gotchas / Context

1. **ACP is inlined in charter, not by external reference.** Mirrors EAL S3 precedent. Future sessions editing acceptance criteria MUST edit the charter inline — do not move the red-line list to an external `acceptance-criteria.md`. The Decisions Log entry documents why.

2. **The 6-point fidelity bar (F1-F6) is a NEW framework artifact** introduced by PRF that other engine-adjacent projects should inherit. Not yet codified in `.claude/context/POKER_THEORY.md` or `src/utils/exploitEngine/CLAUDE.md` — consider a cross-reference link if adoption grows. Currently scoped to PRF + whatever cards cite POKER_THEORY §9.

3. **CD-4 label-decomposition patterns are CI-linted — but the regex is strict.** The forbidden-string list in `copy-discipline.md` §CI-lint matches `(vs|against|versus) (fish|nit|lag|tag|station|maniac|whale)` followed by action verbs. If a glossary card or population-annotation card legitimately needs this phrasing, it must declare `cd5_exempt: true` with justification in its manifest. Gate 5 card authors may need to add new exemption types — amendments pass through persona-level review.

4. **H-PM07 (staleness channel is in-app only) is the novel paper-medium heuristic.** Reading handoff + anti-patterns.md + copy-discipline.md + heuristics doc side-by-side will reveal the pattern: the 8 new red lines #10-#17 all center on paper's invariants (permanence + no-update + no-animation + visibility-across-table). H-PM07 is the heuristic form of red line #10.

5. **The three Q1 RED cards (#12 per-villain-archetype / #13 56s-vs-deep-fish / #14 don't-bluff-stations) remain load-bearing precedents.** Any future session that sees a card proposal re-introducing labels-as-inputs MUST redirect to POKER_THEORY.md §7 + feedback_first_principles_decisions.md + F1 + F6 + CD-4 + AP-PRF pattern. The decomposed replacement in `copy-discipline.md` §Worked Example shows the acceptable shape. Do not silently ship a labelled card — would regress the Q1 acceptance.

6. **Source-util blacklist (F4/F6) is strict.** No card may source from `villainDecisionModel` / `villainObservations` / `villainProfileBuilder` / `assumptionEngine/*` / `anchorLibrary/*` / Calibration Dashboard state / Anchor Library state. Calibration lives on-screen only; if the blacklist is ever relaxed, the feature fails I-AE-7 signal separation + permanently ships wrong-answer vectors on paper. PRF-G4-CI enforces at build.

7. **Newcomer threshold is `CONSTANTS.PRF_UNLOCK_THRESHOLD_SESSIONS = 1` with flat-access.** The surface is reachable from day one (red line #6); the card content renders a factual empty-state until the threshold is crossed. Empty-state copy must stay factual ("Complete 1 session to enable the printable refresher") — no nudge, no countdown, no engagement pattern. If a future session is tempted to A/B a nudge variant, refuse.

8. **Personalization (Phase 2+ PRF-P2-PE) carries AP-PRF-09 refusal at default.** No "your personalized pack tonight based on villain X" until an explicit Phase 2 Gate 4 design pass authors the opt-in gesture. `userRefresherConfig.printPreferences.includeCodex: false` is structural default at Phase 1.

9. **Amendment rule for all three doctrine docs is persona-level review.** Adding an anti-pattern / adding a copy-discipline rule / adding a heuristic / removing / modifying any entry triggers persona-level review per `chris-live-player.md` §Autonomy constraint. Default answer is no. This rule applies transitively to the CI-linted forbidden-string list (adding or removing strings is amendment-of-doctrine, not style-preference tweak).

10. **Parallel session coordination.** Monetization & PMF Session 3a shipped earlier 2026-04-24 (domain files subscription-account.md / cross-cutting.md / onboarding.md); no file conflicts with this session (doctrine batch does not touch JTBD domains or personas or CATALOG.md). STATUS.md top-entry was Monetization S3a at session start → now this session's PRF Doctrine Batch → Monetization S3a pushed to prior-update stack.

## System Model Updates Needed

None this session. PRF is still pre-code; zero architectural changes. Doctrine batch changes are design docs only. When Gate 5 ships actual code (Phase B Math Tables likely first), SYSTEM_MODEL.md should gain the entries enumerated in the prior session's handoff:
- New view entry `PrintableRefresherView` (~13th view).
- New util namespace `src/utils/printableRefresher/`.
- New IDB version bump (v17 → v18 or v19 per dynamic rule).
- New reducer-boundary invariant for Reference-mode write-silence (red line #11).
- New cross-project doctrine entry for CC-82 / CC-83 if multiple projects adopt.

## Test Status

No tests run (zero code changes). Pre-session test baseline per STATUS.md prior entry: 7205/7206 with 1 pre-existing precisionAudit flake (unrelated to PRF). No regressions possible — doctrine batch is design docs only.
