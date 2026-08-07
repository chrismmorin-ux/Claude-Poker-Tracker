# strategy-of-record/sweep — run evidence (2026-08-07)

Engine: eng-engine (6 personas → orchestrator cross-critique → roundtable-facilitator with
independent verification). Orchestrator: ses-20260807-0535-df53cf18. Repo at HEAD 18f49f22
(scripts/backtest read from clean worktree snapshot). Findings filed as FIND-085..096.

## Facilitator verification verdicts

- **engineDirty universal — CONFIRMED, STRONGER: 16 of 16 cards** (6 committed under docs/ +
  10 under .artifacts/) carry `"engineDirty": true`; zero counterexamples repo-wide.
  `manifest.js:68`'s own docblock: a dirty tree means the commit does not identify the code that
  ran. Nothing refuses a dirty card.
- **check-sor-additive.sh unwired — CONFIRMED with aggravating detail:**
  `scripts/smart-test-runner.sh:16` DOES run the sibling `check-idb-additive.sh`. The wiring
  convention exists and this one file was missed — a one-line fix, and nothing about the
  omission was principled.
- **census/comparisonCensus never validated — CONFIRMED, fix cheaper than assumed:** working
  validators already exist at `coverageCensus.js:384` and `comparisonCensus.js:146`;
  `resultCardProblems` (resultCard.js:119-160) simply never calls them. Two-line wiring gap,
  distinct from WS-434 (metrics only).
- **REFUTATION — "WS-437 closed tonight" ≠ repo has it:** commit b4c38dc1 exists only on
  `night/overnight-20260807`; not an ancestor of HEAD or origin/main. The archived ticket
  reports a fix the checked-out tree does not contain until the night branch merges.
  (Orchestrator note: this skew is by design tonight — the worktree isolation protects the
  other live session — but the facilitator is right that it must be named, and the merge is
  the founder's first morning action.)
- **Cap breach REAL and CURRENT:** re-derived 13 open / 10 max (all backlog, ratio 1.3) — the
  recorded figure is accurate. WS-431/432/433/438 belong to other programs and never counted
  here. **WS-328 status skew:** ticket reads backlog/completion_commit:null while its machinery
  (schemas v2, atom store, both census modules, check-additive.mjs) is demonstrably shipped and
  tested — reconciling WS-328 is the cheapest single unit of cap relief.
- Confirmed in passing: `resolveDealBook` does not exist; `confirmFault`/`flagContaminated`
  zero non-test callers; no component renders any Result Card.

## Findings index (filed 2026-08-07)

| ID | Sev | Subject |
|----|-----|---------|
| FIND-085 | HIGH | Every Result Card on disk (16/16) declares engineDirty:true and nothing refuses one — the standard's central promise failing on 100% of instances |
| FIND-086 | HIGH | Additive gate is dead code while its IDB sibling runs at smart-test-runner.sh:16 — one-line wiring omission |
| FIND-087 | HIGH | A run whose card fails validation still writes output + prints its numbers (run-river-flip-replicate.mjs:439-490); holeMap emits ranked bb/hour claims with no card at all |
| FIND-088 | MEDIUM | Registered sub-schemas (census/comparisonCensus) never invoked by resultCardProblems — validators exist 2 modules away; add standing test over all object-typed fields |
| FIND-089 | MEDIUM | Manifest constants hand-copied; shadowAt line pointers drifted (:563→:661, :783→:983); RIVER_PER_COMBO_MAX_COMBOS stamped as literal against unexported inline constant |
| FIND-090 | LOW | KL_FLOOR documented as manifest-stamped, absent from REQUIRED_CONSTANTS (WS-322 shadow-constant class recurring; extend WS-432's scope) |
| FIND-091 | MEDIUM | Deal Book has no resolve-or-fail path (atom store has one); dealBookHash is decorative; corpus outside git |
| FIND-092 | MEDIUM | Deal Book default identity path+size justified by a false premise (SRC-012 is NOT a git checkout); byte-preserving edits undetectable |
| FIND-093 | MEDIUM | Card corpus ungoverned as a set: two dirs, two naming conventions, contradictory same-instrument cards (0.7111 vs 0.2222) with no supersession marker; buildLadder never run over the on-disk set |
| FIND-094 | MEDIUM | disclaimerRegisterVersion checked for shape never currency — RC-depth-ablation two register-changes stale; the confirmed-fault→contaminated-cards promise cannot fire |
| FIND-095 | MEDIUM | Identity binds by name where ADR-009 requires a hash (surfaceId string only; contentHash optional); no seed ever re-run; extend WS-353's guard |
| FIND-096 | HIGH | Contamination mechanism inert end-to-end: confirmFault zero callers, no persistence, no founder surface; rank-1/rank-2 fault entries structurally unfalsifiable; live surface carries zero population caveats |

Cross-references (NOT filed): WS-329 evidence appended (VOCABULARY.md §AS-711 orphan claim from
run-geometry-ablation.mjs; POKER_THEORY.md:1518-1523 orphan comparative table); WS-431 owns the
decisionRecord false-CI-docblock; WS-434 confirmed not exaggerated (zero common metrics shape
across all 6 cards, not even `n`).

## Tonight-note — what WS-437 (commit b4c38dc1, night branch) does and does not address

Does: §11.9 relabeled with inline Delta-log caveat; 15-number table versioned as tracked data;
teachableArmsProbe emits a validating Result Card; check-figure-currency.mjs added (163 lines).
Does not: it is not merged yet; the lint is heading-scoped + percentage-only (cannot see body
tables, log-loss/bb-100/t-statistic figures — does NOT close WS-329); it is advisory and unwired
even on its own branch (joins the unwired-gate family, FIND-086); its new card will carry
engineDirty:true like the other 16 until FIND-085 is fixed.

## Trend result (stamped)

First sweep after the 2026-08-04 baseline. The standard's shape holds up — manifest validation,
additive guard, loader rejection genuinely well-tested — but almost none of it is actually
invoked: the additive gate never runs while its IDB sibling does, resultCardProblems never calls
the census validators that exist two modules away, and a card whose construction throws still
prints its summary table. All 16 Result Cards carry engineDirty:true and nothing refuses one, so
every replicable-sounding figure the project has published is, by its own manifest, not
reproducible from the commit it names. The WS-330 contamination mechanism is complete, tested on
fixtures, and has zero production callers, no persistence, and no founder surface; its two
highest-ranked fault entries can never flag a card. The Deal Book is the weakest custody link.
Cap-breach: 13/10 real and current — findings floor at priority 20; cheapest relief is
reconciling WS-328, whose machinery is shipped while its ticket reads backlog. Process note: the
night branch's WS-437 closure is a ticket-vs-tree skew until merged — the same skew this program
exists to catch in numbers, now visible in the queue itself.
