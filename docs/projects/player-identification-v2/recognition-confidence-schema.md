# Recognition Confidence Schema (PIO-G4-PVA + PIO-G4-DISAMB)

**Status:** v1 shipped 2026-06-09 (WS-164 / SPR-110).
**Source spec:** `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`
§PIO-G4-PVA (recognition-search ranking) + §PIO-G4-DISAMB (confidence bar).
**Implementation:** `src/utils/playerMatching/scorePlayerMatch.js` +
`src/components/views/PlayerProfileView/ConfidenceBar.jsx`.

---

## Purpose

Turn a recognition query (name fragment + selected feature attributes) into a
ranked, confidence-labelled shortlist of candidate players. Replaces the
unranked name-search list that measured **0% first-result accuracy** on
same-name distractors (Gate 4 v2 §5.2).

This is **identification utility only** (AP-PIO-05 / AP-PIO-01): the score
recognizes *who* is at the table. It must never feed the exploit engine /
`tendencyMap` / drill scheduling.

## Score formula (§PIO-G4-PVA)

```
score = 0.35·name + 0.10·age + 0.10·skin + 0.10·ethnicity + 0.10·hair
      + 0.05·jewelry + 0.05·wardrobe + 0.05·hat + 0.05·logo
```

> **Audit arithmetic note:** the audit text labels these weights "= 1.00", but
> the listed per-dim values actually total **0.95**. This v1 keeps the audit's
> literal per-dim weights rather than inventing a different distribution. It has
> **no effect on scores**: the active-dim renormalization (below) divides by the
> sum of *active* dims' weights, so only the relative weighting matters.

`scorePlayerMatch(player, query, options) → { score, confidence, perDim, …highlight fields }`.

### Query → player-field map

| Dim | Weight | Query field | Player field | Match type |
|-----|-------:|-------------|--------------|------------|
| name | 0.35 | `nameQuery` | `name` / `nickname` | prefix (1 or 0) |
| age | 0.10 | `ageDecade` | `ageDecade` | scalar (range-adjacent) |
| skin | 0.10 | `skinTone` | `skinTone` | scalar (range-adjacent) |
| ethnicity | 0.10 | `ethnicityTags` | `ethnicityTags[]` | set overlap |
| hair | 0.10 | `hairColor` | `hairColor` | scalar (range-adjacent) |
| jewelry | 0.05 | `jewelry` | `jewelry[]` | set overlap |
| wardrobe | 0.05 | `wardrobe` | `wardrobe[]` | set overlap |
| hat | 0.05 | `headwear` | `headwear` | scalar (exact) |
| logo | 0.05 | `logo` | `logo[]` | set overlap |

### Per-dim matchScore [0..1]

- **name:** 1.0 if the query is a case-insensitive prefix of `name` or `nickname`, else 0.
- **scalar dims:** exact value → 1.0; **adjacent on a range axis** (via
  `matchesInRange` in `src/utils/playerFilterRange.js`: ageDecade / skinTone /
  hairColor have neighbor maps) → 0.5; else 0. `headwear` is exact-only (no range axis).
- **array dims:** `|query ∩ player| / |query|` (set overlap fraction).

### Active-dim renormalization (v1 design choice)

Only dims with a present query value contribute. The score is renormalized over
the **active** dims' weights:

```
score = Σ_active (weight · matchScore · stability) / Σ_active (weight)   → clamp [0,1]
```

So a name-only query can reach 1.0 (rather than being capped at 0.35). Dims the
user did not query never penalize the score.

### Stability scaling (§PIO-G3-STAB)

When `options.sightings` (a player's sighting history) is supplied, each
non-name dim's contribution is multiplied by `computeStability(sightings, attr).posterior`
(`src/utils/playerMatching/computeStability.js`): `always`≈full weight,
`sometimes`≈half, `today-only`≈near-zero. This prevents a volatile attribute
(e.g. a new beard / today's shirt) from displacing stable matches — the Gate 2
§B critical scenario. When no sightings are supplied (e.g. standalone
PlayersView), stability defaults to 1.0 (full weight).

## Confidence band (§PIO-G4-DISAMB)

| Band | Score | Label |
|------|-------|-------|
| strong | ≥ 0.7 | `strong match` |
| partial | 0.4 – 0.7 | `partial match` |
| weak | < 0.4 | `weak match` |

`ConfidenceBar` renders a 10-segment bar (filled = `round(score·10)`) + the
factual label. Bands are neutral confidence tiers, not a good/bad severity scale.

## AP-PIO-04 copy contract (binding)

Recognition surfaces render **factual labels only**. FORBIDDEN: "are you
sure?", "double-check", "did you mean…", "verify carefully", "this might be
wrong", "caution: low confidence" — any framing implying user error. A weak
match is a normal outcome. Enforced by a DOM-assertion test on `ConfidenceBar`.

## v1 consumer + scope

- **First consumer:** `PlayersView` — when a score-relevant query is active
  (name search, or an age / ethnicity / wardrobe / jewelry / logo filter), rows
  rank by score desc and each renders a `ConfidenceBar`.
- **Deferred:** Table-Build CandidateColumn / PossibleMatchesPanel live re-rank
  (Table-Build Gate 5 not yet ticketed) — the audit's original home surface.
- **Deferred:** corpus-tuned weights/thresholds (ship audit defaults verbatim in v1).
- **Not exposed in PlayersView v1 query:** skin / hair / hat dims (no
  corresponding PlayersView filter input yet) — the scorer supports them for the
  future Table-Build FeatureColumn.
