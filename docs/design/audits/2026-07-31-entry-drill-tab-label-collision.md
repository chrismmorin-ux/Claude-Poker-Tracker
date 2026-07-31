# Gate 1 Entry — 2026-07-31 — Drill tab label collision

**Surface working name:** Tab labels in `PreflopDrillsView` and `PostflopDrillsView`.
**Proposed by:** Founder, 2026-07-31 — "let's fix that item", closing the residual raised at [`2026-07-31-blindspot-study-home-v1.md`](./2026-07-31-blindspot-study-home-v1.md) Stage E and logged in `surfaces/study-home.md` §Known issues.
**Gate:** 1 (Entry) — surface-bound fix. Visible copy on existing controls; no new surface, route, interaction, or behavior.
**Next gate:** 4 (Design) — amend `surfaces/preflop-drills.md` + `surfaces/postflop-drills.md`, same session.
**Status:** GREEN.

---

## The defect

Four tab labels appear **verbatim in both drill views**: `Estimate Drill`, `Framework Drill`, `Library`, `Lessons`. "Open the Framework Drill" is ambiguous by construction, and a user who half-remembers where they saw something has no label to navigate by.

There is direct precedent: WS-231 F-DRILL-03 renamed postflop `Explorer` → `Range Explorer` to resolve exactly this class of cross-view false friend against preflop's `Equity Lookup`. That fix named the tab by **the object it operates on**. This audit applies the same rule to the remaining collisions.

## The rule adopted

> **A tab label names its OBJECT. The street comes from the view the tab lives in.**

This is the F-DRILL-03 rule made explicit. It has a useful consequence: a collision is a defect **only when the two tabs operate on different objects** — that's a name withholding information. When two tabs genuinely do the same thing to the same kind of object and differ only by street, the shared label is *correct*, and prefixing it with the street would restate the page header.

## Do the objects actually differ? (evidence, not assertion)

Checked against each mode's own module docs and the vocabulary its code uses:

| Tab | Preflop object | Postflop object | Differ? |
|---|---|---|---|
| Estimate Drill | **Equity** of a hand-vs-hand matchup (`"guess equity ±5%"`) | **Composition of a range** on a board (`"what % of BB's range is top-pair-or-better?"`) | **Yes** — different quantities |
| Framework Drill | Matchup lenses — `domination`, `pair_over_pair`, `race` | Range-vs-board lenses — `range_advantage`, `board_tilt`, `nut_advantage`, `whiff_rate` | **Yes** — disjoint vocabularies |
| Library | Curated **matchups** (`MATCHUP`, `matchup` throughout `LibraryMode.jsx`) | Curated **scenarios** (`SCENARIOS`, `scenariosByFramework`) | **Yes** — the code already names them differently |
| Lessons | Curated lesson content, preflop | Curated lesson content, postflop | **No** — same object, street differs |

Three of the four collisions are names withholding information. The fourth is not.

## Renames

| Current | Preflop → | Postflop → |
|---|---|---|
| `Estimate Drill` | **`Equity Estimate`** | **`Range Estimate`** |
| `Framework Drill` | **`Matchup Frameworks`** | **`Board Frameworks`** |
| `Library` | **`Matchup Library`** | **`Scenario Library`** |
| `Lessons` | `Lessons` *(unchanged)* | `Lessons` *(unchanged)* |

`Equity Estimate` deliberately sits next to preflop's existing `Equity Lookup`. They share a prefix because they share a quantity, and the pairing carries the reference-vs-drill distinction: Lookup gives you the number, Estimate tests whether you knew it.

**Internal tab `id`s are unchanged** (`estimate`, `framework`, `library`, `lessons`) — the same discipline WS-231 applied. Persisted drill records, the `openDrills` deep-link contract, and Study Home's routing all key on `id`, so this change cannot touch stored data or break a link.

## Output 1 — Scope classification

Surface-bound fix — visible copy on existing controls. No new surface, route, interaction primitive, or behavior. No engine, reducer, or persistence change.

**Gate 2 triggers:** none. Not a new surface; not a new interaction; not an underserved persona; not cross-product (main-app only). **Gate 2 NOT required** (LIFECYCLE.md — surface-bound fix → Gates 1, 4, 5).

## Output 2 — Personas served

- **[apprentice-student](../personas/core/apprentice-student.md)** — primary beneficiary. Least able to infer from a bare `Library` which library it is; most helped by a label carrying the object.
- **[scholar-drills-only](../personas/core/scholar-drills-only.md)** — moves between both views constantly; the collision costs this persona most often.
- **[study-block](../personas/situational/study-block.md)** — the situation in which tabs get chosen.
- **[chris-live-player](../personas/core/chris-live-player.md)** — the founder, who reported it.

No new persona. ✅

## Output 3 — JTBD identified

- **DS-69** — *route-to-the-right-study-surface* (authored earlier today). Study Home fixed routing *between* surfaces; this fixes naming *within* them. Same job, one level down.
- **DS-43**, **DS-48/49**, **DS-51** — unchanged; the tabs serving them keep their behavior and their `id`s.

No new JTBD. ✅

## Output 4 — Gap analysis

**Ready:** labels are string literals in two `TABS` arrays; `id`s are already the routing/persistence key; Study Home already routes by `id`; F-DRILL-03 established the rule and the precedent for leaving `id`s alone.

**Missing (the work):** the six label strings; Study Home's two `meta` strings that enumerate tab names; the two surface-doc anatomy diagrams; the `study-home.md` §Known issues entry (resolve it rather than leave it stale); tests.

**At risk:**
- **Silent drift between hub copy and tab labels.** Study Home's Postflop card lists `Range Explorer · Estimate · Framework` — stale the moment this lands. *Mitigation:* updated in the same change, and a test asserts each drill view's own `TABS` labels are unique so a future addition cannot reintroduce a within-view collision.
- **Stale docs.** `preflop-drills.md` already describes Estimate/Framework/Library/Lessons as "WIP / stubs (F-W2)", which `postflop-drills.md` records as STALE for its own equivalents. Corrected while editing the anatomy.
- **Muscle memory.** Minor and one-way: labels gain words rather than changing meaning, and positions are unchanged.

## Output 5 — Verdict

**GREEN.** Surface-bound copy fix applying an established rule (F-DRILL-03) to the remaining collisions, with the object-difference verified against each mode's own code rather than assumed. One collision is deliberately kept and the reason recorded, so a future reader does not "finish the job" by adding a redundant street prefix.

Gate 4 obligation: amend both drill surface artifacts + resolve the `study-home.md` known issue.
