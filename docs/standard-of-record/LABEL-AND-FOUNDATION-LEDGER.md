# The Label & Foundation Ledger

> **Prose lives here. Data lives in `src/utils/standardOfRecord/labelLedger.js`.** The ranked
> tables below are checked against `rankLabels()` id-for-id, in exact order, by
> `__tests__/labelLedger.test.js`. There is no generator — per `faultRegister.test.js:466-467`,
> a generator would just move the drift.

---

## 1. What this ledger can honestly say today

A **label-shaped input** is any discrete key standing between raw game data and a numeric engine
parameter: a position label, a style label, a hand-strength bucket, a board-texture category, an
SPR zone, a stack tier, a line tag, a size bucket.

`.claude/context/POKER_THEORY.md` §7.1 and `src/utils/exploitEngine/CLAUDE.md` already forbid
these as decision inputs, in four separately documented forms, with worked examples. **A survey
at HEAD on 2026-08-16 found 49 label families anyway, and an AST harvest found 145 constructs.**
Prose was tried, for months, and it did not work. That is the premise for this ledger being a
mechanism rather than another document.

What it can say today, precisely:

- **145 constructs** over **506 files** are harvested and every one is claimed — by a ledger row
  or by a reasoned exclusion. `node scripts/standardOfRecord/check-label-ledger.mjs` is the
  blocking gate that keeps that true.
- **6 rows are written.** **140 constructs are `EXCLUDED:not-yet-triaged`**, owned by WS-445 and
  expiring 90 days from seeding. That backlog is the honest state, not a finished ledger.
- **2 of 6 rows carry a Result Card.** Every other row states what would measure it and which
  ticket would build that instrument.

What it **cannot** say: that the engine's label surface is understood. It says that the surface
is now *enumerated*, that nothing can be added to it silently, and that the gaps are named.

---

## 2. The four foundations and the five foundation statuses

Two orthogonal axes. Collapsing them is the mistake this vocabulary exists to prevent.

**Foundation** — what kind of thing produced the number:

| Foundation | Meaning |
|---|---|
| `founder-estimate` | Informed judgment. Not a measured dataset. |
| `mined-corpus` | Aggregated from real hands. |
| `fitted-curve` | A parameter fitted by an optimisation with a stated objective. |
| `structural-computation` | Derived from board/pot geometry; has no sample size. |

**Foundation status** — what we currently know about whether it holds:

| Status | Meaning | Standing instance |
|---|---|---|
| `undeclared` | No provenance stated anywhere. | `REALIZATION_TABLE`, `BUCKET_MIDPOINT` |
| `declared-estimate` | Provenance stated, and it says founder estimate. | `populationPriors.js:8-12` |
| **`measured-refuted`** | **Measured, NOT supported, still shipping.** | `FOLD_CURVE_STREET_MODS` |
| `measured-supported` | A Result Card supports it. | `ACTION_TAU_FRACTION` |
| `generated` | Mechanically produced from a corpus. | `handhqReferencePool.js` |

**`measured-refuted` is the status that earns the whole vocabulary.** A four-value set cannot say
*we looked, it failed, it ships*. Collapsing it into `undeclared` erases the measurement;
collapsing it into `measured-supported` launders it.

Note carefully what that status does **not** allege. `FOLD_CURVE_STREET_MODS` is not an
unnoticed defect — POKER_THEORY v2.3 records the null deliberately, and declining to tune on a
~5e-4 effect an order of magnitude below the population-curve correction is a defensible call.
What the ledger adds is that the decision was discoverable only by reading one docblock in one
file. A row makes it rankable against everything else.

---

## 3. The evidence ladder

The ranking currency is absolute EV. Most rows start unmeasured. WS-445's own `decision_flags`
named the failure mode: *the ledger silently becomes a list of unmeasured guesses wearing EV
units.*

| Tier | Carries | Ranked against |
|---|---|---|
| **MEASURED** | `absEvBB100`, a CI, and a `resultCardId` that resolves | other measured and bounded rows, by magnitude |
| **BOUNDED** | `boundBB100` with a direction glyph, a method from a closed set, prose derivation | same list, rendered `≤`/`≥` so it never reads as an estimate |
| **UNMEASURED** | reach (`readSites`, `cellCount`, `primaryPath`) and a named instrument | **only other unmeasured rows, by reach** |

**An UNMEASURED row carries no EV figure and cannot be given one.** This is not a rule someone
enforces — it is a shape. `buildUnmeasuredReach` mints no EV key at all, so `absEvBB100` is
`undefined` rather than `null`: there is no slot to fill, and nothing for a future relaxation to
unlock. `impactProblems` rejects an *extra* key as well as a missing one, so the field cannot be
bolted on by hand. `rankLabels()` returns two arrays and no exported function concatenates them.

An UNMEASURED row must **name the instrument** that would measure it, with a ticket. An entry
with no instrument is a complaint, not a ledger row — the same bar `falsifier` clears in the
fault register, for the same reason: a surface nobody can settle re-emits at rank 1 forever.

---

## 4. The ranked ledger — measured and bounded

<!-- LABEL-LEDGER:BEGIN -->

| # | Label | Site | Foundation | Foundation status | Tier | Abs-EV (bb/100) | Basis |
|---|---|---|---|---|---|---|---|
| 1 | `LBL-action-tau-fraction` | `ACTION_TAU_FRACTION` | fitted-curve | measured-supported | measured | 0.54 | RC-per-player-width-790a6ffd |
| 2 | `LBL-fold-curve-street-mods` | `FOLD_CURVE_STREET_MODS` | founder-estimate | measured-refuted | bounded | ≤ 0.05 | ablation-delta |
| 3 | `LBL-style-collapse` | `STYLE_PRIORS` | founder-estimate | measured-supported | measured | 0 | RC-STYLE-COLLAPSE-2026-08-12 |

<!-- LABEL-LEDGER:END -->

**Read row 3 as the worked example.** `LBL-style-collapse` is the six style labels WS-436
removed. Its measured impact is **0** — the label channel carried no villain-action information
(ΔLL −0.00076 over 10,147 paired decisions, n.s.) and its removal was advice-parity at exactly
n=0 changed decisions. Its lesson is the one the whole ledger is organised around: **the
foundation column matters more than the label column.** The same-source continuous replacement
tried in its place was *refuted* at ΔLL −0.00691, t=−5.64 — a failure the label taxonomy had no
way to express.

---

## 5. The unmeasured surface, ranked by reach

There is **no EV column in this table, and a test asserts there never will be.** That is the
doc-side mirror of the module-side impossibility in §3.

<!-- LABEL-LEDGER-UNMEASURED:BEGIN -->

| # | Label | Site | Foundation | Foundation status | Read sites | Cells | Primary path | Instrument ticket |
|---|---|---|---|---|---|---|---|---|
| 1 | `LBL-handhq-reference-pool` | `HANDHQ_OPENER_FACING_3BET` | mined-corpus | generated | 6 | 12 | yes | WS-445 |
| 2 | `LBL-realization-table` | `REALIZATION_TABLE` | founder-estimate | undeclared | 2 | 30 | yes | WS-407 |
| 3 | `LBL-bucket-midpoint` | `BUCKET_MIDPOINT` | founder-estimate | undeclared | 1 | 5 | yes | WS-445 |

<!-- LABEL-LEDGER-UNMEASURED:END -->

**Read the bottom of this table as carefully as the top.** `LBL-bucket-midpoint` ranks last on
reach — one read site, five cells — and it sits inside the **measurement path**, not the engine.
`scripts/backtest/deviationMap.mjs:61` passes it to `deriveFloor`, so it sets the defensive floor
every deviation cell is scored *against*. A low reach rank means "it touches little code", never
"it would not matter".

**Row 1 is a different shape of problem from rows 2 and 3.** `handhqReferencePool` has the best
foundation in the repo — generated, regeneratable, hand-edits forbidden by its own contract. Its
open question is **transfer, not provenance**: the corpus is online 2009 and the founder's game
is live 9-handed 1/2–1/3, so any live claim resting on it is *transferred, not measured*. The
ledger has to be able to say those two things at once about one row.

**Row 2 is the case for the ledger existing.** `REALIZATION_TABLE` already had **three**
separately-filed instrument tickets — WS-404 (P=28), WS-407 (24), WS-498 (30) — filed by
different analyses at different times, all in `prog-domain-correctness`, none referencing the
others. One row collapses them. The ledger is a deduplicating index over work the queue is
already doing blind, not merely an inventory.

---

## 6. Exclusions

A harvested construct that is not a label-shaped input carries an exclusion reason from the
closed `EXCLUSION_REASONS` set. **The harvest is deliberately over-inclusive**: a false positive
costs one reasoned line here, a false negative costs a row nobody ever writes.

`not-yet-triaged` requires a ticket and expires after 90 days — an exception that never expires
is how an exclusions list quietly becomes the register. `touch-floor.spec.js:80-82` points the
same way with its stale-pin check: *pins may only shrink, never linger.*

Current state: **140 of 145 constructs are `EXCLUDED:not-yet-triaged`, owned by WS-445.** Listing
them is `node scripts/standardOfRecord/check-label-ledger.mjs --unledgered`.

The known false positives are module-level Result Card builders in
`scripts/backtest/emit-*-result-card.mjs` — five constructs that take the
`result-card-artifact` reason.

---

## 7. What the gate catches, and what it provably cannot

The exhaustiveness claim is **bounded and re-runnable**, not asserted: *over these globs, these
three syntactic forms, and this leaf classification, the harvest at HEAD produced 145 constructs
in 506 files; the ledger claims all 145; and the following are outside its reach by
construction.*

**Threshold-as-label is the largest known hole, and it is inherited rather than introduced.**
`getSPRZone` (`src/utils/pokerCore/sprBands.js:49`) manufactures `micro`/`low`/`medium`/`high`/
`deep` from `SPR_BAND_EDGES = [2, 4, 8, 13]`, with no string literal at the decision site. The
harvest sees every *consumer* of `micro` and none of its *manufacture*. The same applies to every
other boundary constant. `exploitEngine/CLAUDE.md` already names threshold-as-label as a fourth
anti-pattern — this gate does not close it.

**Labels that never write their tokens down are invisible.** A label assembled from a template
string, or read from IndexedDB, Firestore, or a persisted user setting, has no literal for the
visitors to see. Measured today: zero JSON data imports in scope. A real future hole with no AST
answer.

**An inlined copy of a table value is undetectable in principle.** A number an author read out of
`POP_CALLING_RATES` and typed into another file has no key and no token.

**`vestigial` is a scoped claim.** The consumer trace resolves identifiers only within the scanned
globs, so it means *no reader in scope* — never *no reader*.

**Precision is not uniform, and it was bought deliberately.** Recall against the survey's named
families is **16 of 17**; the single miss is `STYLE_DESCRIPTIONS`, a label→string display map,
rejected by design. Precision is roughly **94%**. Two recall bugs were found and fixed while
building this — `ACTION_TAU_FRACTION` (three of four values are an identifier, not a literal) and
`PREFLOP_RAISE_SIZES` (values are numeric *arrays*) — and a third, `M_RATIO_ZONES`, was rejected
only because it carries cosmetic `label`/`color` fields beside its thresholds. Each was a case of
the detector being too strict, and each was widened rather than documented as a limitation.

**The family count and the construct count are different numbers, and both stay visible.** The
survey counted **49 families**; the harvest counts **145 constructs**. A family spans several
constructs and the harvest includes non-label constructs headed for exclusion. Neither number is
silently replaced by the other, and the reconciliation between them is the triage backlog in §6.

---

## 8. Adding a row

1. Run the gate. `UNLEDGERED CONSTRUCT` names the `file:line` and the key.
2. **Read the source.** A foundation or a bound *invented* rather than read is
   `FAULT-constants-by-taste` wearing a new hat — the exact fault this ledger exists to expose.
   If the source states no provenance, the honest `provenance` value says so.
3. Write the row in `labelLedger.js`. Pick the impact constructor that matches the evidence you
   actually have. If that is `buildUnmeasuredReach`, name the instrument and its ticket.
4. Point the baseline row's `ledger` field at the new `LBL-` id, and list the harvest key in the
   row's `sites`.
5. Add the row to the table in §4 or §5 in its ranked position. The drift test will tell you if
   the order is wrong.

**`--update` does not do step 3 for you.** It writes new constructs with `ledger: null`, and a
null ledger is itself a violation. It records that a construct exists; it never asserts anyone
thought about it.

---

## 9. The ledger as a work queue

Every UNMEASURED row names an instrument and a ticket, which makes the ledger a ranked build
list rather than a ranked complaint list. The blind-spot rule (`ledgerSelfCheck`) enforces that
reading in the suspicious direction:

- **Zero unmeasured rows fails.** A ledger asserting the engine's entire label surface is
  grounded makes a claim no evidence in this repo supports.
- **Zero open instrument gaps fails.** *A ledger with nothing left to instrument is not a
  finished ledger; it is a ledger that stopped asking.*
- A majority-measured ledger with nothing left to instrument fails — check that "measured" has
  not come to mean "I looked at it".
- Coverage is **reported, never gated**. Forcing a Result Card per row would produce fake cards;
  `registerSelfCheck` makes the same choice for the same reason.

Resolving a row requires recorded evidence **and** a note stating what the resolution does *not*
cover, reusing `clearFalsifierBlocker`'s contract verbatim. Rows are append-only: a deleted
construct moves its row to `resolved` carrying the commit, and never disappears.
