# Handoff — Design Compliance Wave 1 Session 2 (Gate 3 Bundled)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Roadmap:** `docs/design/ROADMAP.md` (Wave 1, bundled Gate 3 response)
**Status:** CLOSED — Gate 3 framework gap-fills complete. TableView unblocked for Gate 4 heuristic audit.

---

## Owner directive

> "Optimize everything for the long term. Fill in the gaps that hold us back from higher quality decisions."

Interpreted as: close the framework-level gaps surfaced by the W1-S1 blind-spot audit rather than jumping to code fixes. Framework gaps limit decision quality across every future session; code fixes are local. Prioritized long-term leverage.

## Scope delivered

Gate 3 (Research) per LIFECYCLE.md — expanded to include framework-durability additions surfaced by the audit but beyond the strict Gate 3 minimum. Zero source code touched.

### Framework defect fixes (highest priority — broke traceability)

- ✅ **Phantom JTBD IDs resolved.** `bubble-decision.md` referenced `JTBD-TS-01` + `JTBD-TS-03` which never existed in the atlas. Added both as real Active JTBDs:
  - `TS-43` ICM-adjusted decision at bubble
  - `TS-44` Pay-jump proximity indicator
  Updated `bubble-decision.md` to cite the correct IDs + note the resolution. Updated ATLAS.md TS domain range (TS-35..42 → TS-35..44).

### Missing situational personas (closes Stage A)

- ✅ **`personas/situational/ringmaster-in-hand.md`** — in-flight host mode (distinct from `home-game-settle.md` which is post-session). Maximum cognitive load profile; non-modal-everything requirement; MH-11 pot-validation is acute.
- ✅ **`personas/situational/newcomer-first-hand.md`** — first real-use-of-TableView confusion. Higher help-discoverability need than any other situation. Persona argues for plain-English advice gloss + visible help affordance.

### Missing JTBDs (closes Stage B)

- ✅ **`HE-17` flag-hand-mid-recording** — Active. Between-hands-chris need for single-tap mark; distinct from SR-26 (rich post-session annotation).
- ✅ **`MH-11` validate-pot-before-acting** — Active. `handlePotCorrection` exists; outcome was never named. Acute for ringmaster-in-hand (pot reconstruction across rebuys).
- ✅ **`MH-10` now claimed** in `surfaces/table-view.md` (was served, not documented).

### New framework primitive: contracts/

- ✅ **`docs/design/contracts/README.md`** — new directory for cross-surface invariants that span writers + readers + enforcement. Explains why contracts live in the framework (not only in code).
- ✅ **`docs/design/contracts/persisted-hand-schema.md`** — documents the IDB `hands` store contract: canonical shape, writer list (ShowdownView + imports + dev seeding), reader list (HandReplayView, AnalysisView, stats, villain profile, export), invariants, code enforcement pointer (`validation.js`), known drift (the `HandReplayView` dual-path fallback evidence), change protocol. Prevents future silent schema drift.

### New journey doc

- ✅ **`journeys/briefing-review.md`** — documents the INTENTIONALLY-INCOMPLETE briefing-review loop. Step 2 (seat-badge → review-queue nav edge) is broken; journey captures target times for the intended flow so the gap is measurable.

### Evidence ledger — 4 new entries (grounds all future TableView work)

- ✅ EVID-2026-04-21-TABLE-WINDOW-CONFIRM
- ✅ EVID-2026-04-21-TABLE-TOUCH-TARGET-40PX
- ✅ EVID-2026-04-21-HAND-SCHEMA-DUAL-PATH
- ✅ EVID-2026-04-21-BUBBLE-PHANTOM-JTBD

### Discoveries logged — 4 entries, each with personas, JTBD, tier, effort, WSJF

- ✅ DISC-2026-04-21-push-fold-widget (WSJF ~21 — Pro tier)
- ✅ DISC-2026-04-21-briefing-badge-nav (WSJF ~80 — cheap, high-impact)
- ✅ DISC-2026-04-21-decision-tree-fate (owner decision A/B/C pending)
- ✅ DISC-2026-04-21-sidebar-tournament-parity (may expand Wave 5)
- LOG.md updated: CAPTURED 20 → 24, SCORED 0 → 4.

### Cross-references wired

- `surfaces/table-view.md` updated: JTBD list expanded to include MH-10, MH-11, HE-17, TS-43, TS-44; personas list adds 2 new situationals; Known issues section references audit + 4 discoveries + contract + journey.
- `audits/2026-04-21-blindspot-table-view.md` appended with "Gate 3 resolution" section (per METHODOLOGY.md, audits are immutable once closed — this was appended, not revised).
- BACKLOG: DCOMP-W1 moved NEXT → IN_PROGRESS; S2 scope = Gate 4 heuristic audit.

## Files touched (19 new, 7 edited — all docs)

**Created:**
- `docs/design/personas/situational/ringmaster-in-hand.md`
- `docs/design/personas/situational/newcomer-first-hand.md`
- `docs/design/contracts/README.md`
- `docs/design/contracts/persisted-hand-schema.md`
- `docs/design/journeys/briefing-review.md`
- `docs/design/discoveries/2026-04-21-push-fold-widget.md`
- `docs/design/discoveries/2026-04-21-briefing-badge-nav.md`
- `docs/design/discoveries/2026-04-21-decision-tree-fate.md`
- `docs/design/discoveries/2026-04-21-sidebar-tournament-parity.md`
- `.claude/handoffs/design-compliance-wave1-session2.md` — this file

**Edited:**
- `docs/design/jtbd/ATLAS.md` (domain count updates + 4 new JTBD rows)
- `docs/design/jtbd/domains/hand-entry.md` (+ HE-17)
- `docs/design/jtbd/domains/mid-hand-decision.md` (+ MH-11)
- `docs/design/jtbd/domains/tournament-specific.md` (+ TS-43, TS-44)
- `docs/design/personas/situational/bubble-decision.md` (phantom-ID fix + note)
- `docs/design/evidence/LEDGER.md` (+ 4 entries)
- `docs/design/discoveries/LOG.md` (+ 4-entry section; counts updated)
- `docs/design/surfaces/table-view.md` (JTBD, personas, Known issues, change log)
- `docs/design/audits/2026-04-21-blindspot-table-view.md` (Gate 3 resolution appended)
- `.claude/BACKLOG.md` (W1 → IN_PROGRESS; S1 scope notes)

**No source code touched. No tests run.**

## Long-term quality improvements beyond the audit's immediate scope

1. **`contracts/` directory.** New framework primitive for cross-surface invariants. Closes the "fallback paths hide drift" problem at the framework level, not just for persisted-hand.
2. **Intentionally-incomplete journey pattern.** Documenting a BROKEN loop in `journeys/` so the gap is visible to every future audit. Can be reused for other broken cross-surface flows.
3. **Framework-integrity hygiene note.** The phantom-JTBD defect motivates a periodic integrity lint (is every persona/JTBD reference resolvable?). Flagged in the EVID entry as a candidate for H2 quarterly hygiene.
4. **Feature-inventory product-line tags.** The sidebar-tournament-parity discovery surfaces that `main` vs `sidebar` vs `both` tags don't capture the "main-tagged but persona needs sidebar variant" case. Candidate schema enhancement for INVENTORY.

Items 3 and 4 are not actioned this session but are noted in the relevant discovery files.

## What comes next

W1-S3 = **Gate 4 heuristic audit on TableView.** Scope:
- Full Nielsen 10 + Poker-Live-Table + Mobile-Landscape heuristic walkthrough.
- Formal severity-scored findings against the 5 persona × situation axes (now including ringmaster-in-hand + newcomer-first-hand).
- Carry-forward the 7 candidate findings from the blind-spot audit (C1/E1, C2, C3-to-discovery, C4/E4, E2, E3, E5) as starting points.
- Output: `docs/design/audits/2026-04-22-table-view.md` (or today's date if same-day).

Parallel-able:
- W1 ShowdownView audit (no blind-spot roundtable needed per Gate 2 bypass policy — surface-bound, no new surface/interaction).
- W1 SessionsView audit (same bypass applies).

Blocked on owner decisions:
- DISC-2026-04-21-decision-tree-fate → A/B/C choice (or defer to Wave 2).
- DISC-2026-04-21-sidebar-tournament-parity → fold into Wave 5 or spawn project.

## Closed

7 tasks completed. Gate 3 bundled into W1-S1 (avoided a second session for just-documentation). Framework is materially more capable of supporting quality decisions in Wave 1+ than it was at the start of the session.
