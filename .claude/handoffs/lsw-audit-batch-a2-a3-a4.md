# Handoff — LSW Audit Batch: A2 + A3 + A4

**Session:** 2026-04-22, Claude (main)
**Claims:** LSW-A2 + LSW-A3 + LSW-A4 — all marked COMPLETE (DRAFT — awaits owner review)
**Duration:** single continuous session; 3 full audits shipped consecutively under the "continue the slice" directive
**Prior handoff (still valid for A2 specifics):** `.claude/handoffs/lsw-a2-btn-vs-bb-srp-dry-q72r.md`

## Session arc

1. Owner entered plan mode for "the next batch of line study work" → plan approved (`C:\Users\chris\.claude\plans\warm-inventing-shell.md`): single-batch LSW-A2 audit of Q72r + same-session F2 if ≥3 category-B P0/P1 findings.
2. A2 Q72r executed → GREEN(light), 6 findings all P2/P3 → F2 deferred per plan (no ≥3-P1 trigger).
3. Owner directive: *"continue the slice"* → extended to A3 + A4 back-to-back.
4. A3 K77 → YELLOW, 4 findings (1 P1 position mismatch + 3 P3) → F3 filed.
5. A4 T98 → YELLOW, 6 findings (2 P1 + 2 P2 + 2 P3) → F4 filed.

## Deliverables

**3 new audit files:**
- `docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md` (~650 lines, 6 findings, GREEN-light)
- `docs/design/audits/line-audits/co-vs-bb-srp-oop-paired-k77.md` (~450 lines, 4 findings, YELLOW)
- `docs/design/audits/line-audits/sb-vs-btn-3bp-oop-wet-t98.md` (~500 lines, 6 findings, YELLOW)

**3 new BACKLOG entries (Stream F content-fix backlog):**
- LSW-F2 (P2, NEXT) — Q72r polish; 6 items, no blocker
- LSW-F3 (P1, NEXT, **blocks B1/B2 on K77**) — 4 items including 1 P1 position rename
- LSW-F4 (P1, NEXT, **blocks B1 on T98**) — 6 items including 2 P1 schema + pedagogy

**3 BACKLOG updates (LSW-A2/A3/A4 marked COMPLETE (DRAFT)).**

**1 POKER_THEORY.md §9 entry queued** (D2 SB-flat-3bet divergence from A4; ships with LSW-F4).

## Verdicts summary

| Line | Verdict | Findings | P1 | P2 | P3 | Blocks B1/B2? | F-batch |
|------|---------|----------|----|----|----|---------------|---------|
| A1 JT6 (prior) | YELLOW | 10 | 3 | 3 | 4 | YES — F1 shipped | LSW-F1 ✓ done 2026-04-22 |
| A2 Q72r | GREEN(light) | 6 | 0 | 1 | 5 | NO | LSW-F2 filed, NEXT |
| A3 K77 | YELLOW | 4 | 1 | 0 | 3 | YES | LSW-F3 filed, NEXT |
| A4 T98 | YELLOW | 6 | 2 | 2 | 2 | YES | LSW-F4 filed, NEXT |
| A5..A8 | — | — | — | — | — | — | Pending audits |

Cumulative: **26 findings** across 4 audits. **6 P1 blockers** (3 in A1-fixed + 3 split across F3/F4).

## External validation

**17 total web-research queries** across 12 decision nodes over A2/A3/A4 (≥1 per decision node per charter). Source distribution: 11 GTO Wizard, 6 Upswing, 2 SplitSuit, 3 PokerCoaching, 2 888 Poker, plus Somuchpoker, PokerListings, Getcoach, Pokertube, Pokerdeals, Betting Data Lab, New Game Network.

**Categorization across batch:** ~11 A (no disagreement), ~4 B (our content wrong), 2 D (intentional live-pool divergence).

**Strongest externally-validated finding:** Q72r `river_after_turn_checkback` CALL answer — [GTO Wizard — Calling Down Over-Bluffed Lines](https://blog.gtowizard.com/calling-down-the-over-bluffed-lines-in-lower-limits/) directly quotes *"close your eyes and call again, even with bottom pair"* for the exact capped-IP-checked-turn spot.

## Key themes surfaced across the batch

1. **Setup/schema declaration errors are a recurring pattern.** A3 (position mismatch: CO declared but line action flow is OOP) and A4 (action mismatch: fourBet declared but pot/copy show 3BP flat) are the same *class* of bug — authored content disagrees with schema declarations. Both block v3 migration. Consider adding a `validateLine` invariant: *"if `hero.action` + `villain.action` + `potType` + authored `pot` don't cross-reconcile, reject at schema level."* Would catch both issues automatically.
2. **BB 3bet range assumptions need line-by-line labeling.** Multiple lines implicitly target a live-pool pool (SB flats 3bets in A4; BB flats QQ in A2), but labeling this varies. POKER_THEORY.md §9.1 (A1 live-pool donk) + §9.2 (A2 BB flat range) + §9.3 pending (A4 SB flat 3bet) is becoming the canonical "live-pool divergences" index — fine, but authors should label in-line as they author new lines.
3. **Shared terminal pot drift is a systemic pattern.** A1 (`terminal_flop_overfold` reached from correct + wrong paths), A2 (`terminal_bluff_catch_win` 16.0 doesn't reconcile), A3 (`terminal_checkback_paired` flop/river drift), A4 (`terminal_raise_wet_aa` turn/river drift). Four of four audited lines have this. Suggests a schema-level rule: *"terminals reached from multiple decision nodes must either have per-parent pot metadata or null pot."* Candidate for schema evolution post-F2/F3/F4.
4. **AA/overpair teaching is subtle and easy to misframe.** A4 shows that teaching "AA on wet boards is a bluff-catcher" is a common mental shortcut, but it overstates the defensiveness and teaches the wrong mental model. Any future lines teaching overpair-discipline should use "strong-but-vulnerable / equity-realization via pot-control" framing, not "bluff-catcher."

## Bucket-teaching queue (cumulative across A1-A4)

**HIGH-leverage widening targets for LSW-B2 (prioritized by student-value):**

1. **A2 `river_after_turn_checkback`** (Q72r) — canonical polar-bluff-catch archetype flip. Strongest external validation.
2. **A2 `river_after_barrel`** (Q72r) — thin-value sizing flip by archetype.
3. **A4 `river_after_turn_call`** (T98) — scary-runout overpair fold discipline. Blocked on F4.
4. **A4 `flop_root`** (T98) — overpair bet/check-by-archetype. Blocked on F4 + G4-TD-3.
5. **A2 `turn_checked_back`** (Q72r) — call-vs-probe archetype flip.
6. **A3 `river_after_barrel`** (K77) — thin-value flip on paired-board brick runout. Blocked on F3.
7. **A1 `river_brick_v_calls`** (JT6) — fish-thin-value flip. Blocked on LSW-F1 already shipped.
8. **A1 `river_checkback`** (JT6) — bluff-catch flip. Also unblocked post-F1.

8 HIGH-leverage targets across 4 audited lines. Clear pattern: **river nodes dominate** the high-leverage queue — river is where archetype flips most cleanly affect the answer.

## Charter compliance

Charter rule: *"Audits must have ≥1 external-validation web query per decision node. Zero-query audits fail review."*
- A1: 11 queries / 5 decision nodes ✓ (prior session, already closed)
- A2: 10 queries / 6 decision nodes ✓
- A3: 3 queries / 3 decision nodes ✓
- A4: 3 queries / 3 decision nodes ✓

All 4 audits satisfy the charter. Queries-per-node ratio lower on A3/A4 than on A1/A2 because the teaching concepts on A3 (paired-board cbet) and A4 (overpair discipline) are more widely documented in training content, reducing the need for multiple sources per claim.

## What did NOT ship

- **No code changes.** All 3 audits deferred their F-batches to owner-approved sessions per plan rules.
- **F2, F3, F4 entries are now in NEXT status** but not claimed/shipped.
- **Tests not re-run** — audit-only session, no code state changed.
- **Visual verification not performed** — audit-only, no UI changes.

## Owner review requests

1. **Review the 3 audit files in order** — A2 is cleanest and sets the methodology reference; A3 + A4 surface schema-declaration-vs-copy mismatches that need option-choice decisions.
2. **A3 (K77) Option A vs B decision** — my recommendation is Option A (rename hero CO → SB, preserve action flow). If owner rejects and prefers Option B (keep CO, flip to IP action flow), file that as the F3-A1 resolution.
3. **A4 (T98) — schema resolve decision** — recommend resolving to 3BP (change `hero.action` 'fourBet' → 'call') rather than rewriting the line as a 4BP. The copy and pot already match 3BP; the 'fourBet' declaration is an orphan.
4. **A4 (T98) — AA framing rewrite** — approve the new "strong-but-vulnerable" rationale text I drafted in the audit's L-flop_root-F1 fix section. This is the pedagogically most important change across the batch.
5. **Scheduling decision for F batches** — F2/F3/F4 are all S-effort bundleable. Options: (a) ship each F batch when claiming B-stream widening for its line, (b) ship all three F batches in one consolidated commit, (c) continue audit stream (A5-A8) before shipping any F batches. **Recommend (b)** — one consolidated F-batch commit is ~45 min of edits total and unblocks 3 lines for B-widening simultaneously.

## Suggested next batch

**Charter order continues: LSW-A5** (`co-vs-btn-bb-srp-mw-oop`) — 3-way SRP, hero CO sandwiched OOP. **Note:** this is a MW line, which was deferred on LSW-G6 blocking. Confirm G6 status before auditing — if G6 is still deferred, skip to **LSW-A6** (`btn-vs-bb-sb-srp-mw-j85`) — wait, A6 is also MW. 

MW lines (A5, A6) are gated on LSW-G6 engine completion for widening purposes; audits themselves may still run without G6 (audits are content review, not engine work). Worth a follow-up session.

**Alternative next batch:** skip MW audits pending G6, jump to **LSW-A7** (`utg-vs-btn-squeeze-mp-caller`) which is 2 nodes (1 decision) — smallest in the roster, very fast audit. Or **LSW-A8** (`utg-vs-btn-4bp-deep`) — 3 nodes (1 decision), rarest spot, good to audit last per charter but can jump order if desired.

**Or:** ship F2+F3+F4 consolidated batch now to clear the content-fix debt and unblock B-widening.

## Verification trail

- All 3 audit files are structurally complete (executive summary + scope + cross-node + per-node 7-dim + prioritized fix list + bucket-teaching queue + category-C + divergences + verdict + sign-off + sources)
- External-validation query logs present for every decision node in every audit
- Severity/category assigned per finding per charter rubric
- BACKLOG status updates present for A2/A3/A4 + F2/F3/F4
- Bucket-teaching queue distinguishes HIGH / PARTIAL / NONE per node
- Cross-audit patterns identified in this handoff (setup-error class, BB-range-labeling class, terminal-pot-drift class, overpair-framing class)

No code changes; no tests to run. Build state preserved from prior session.
