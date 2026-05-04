# Player Identification v2 — Asset palettes (PIO-G3-PALETTE)

**Created:** 2026-05-02 (PIO Gate 4 / WS-007 / SPR-021)
**Status:** Initial values authored; owner amends in Gate 4 review or Gate 5 implementation review against actual hand-corpus exposure.
**Implementation:** PIO Gate 5 multi-PR.

**Sibling docs:**
- [Gate 4 audit — `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`](../../design/audits/2026-05-02-gate4-design-player-identification-v2.md) §PIO-G3-PALETTE
- [Gate 3 audit — `docs/design/audits/2026-05-02-gate3-research-player-identification-v2.md`](../../design/audits/2026-05-02-gate3-research-player-identification-v2.md) §PIO-G3-PALETTE
- [`anti-patterns.md`](anti-patterns.md) (AP-PIO-01..05)

---

## Why these palettes exist

Per Gate 3 owner ratification (Decision 2: hybrid attribute palette), 4 net-new attribute categories use closed-enum primary palettes + `'other'` slot with free-text `otherText`. Closed enums drive recognition-search ranking math (deterministic feature comparison per PIO-G4-PVA in Table-Build CandidateColumn); `'other'` free-text captures rare cases without polluting the comparison.

Categories: `wardrobe`, `jewelry`, `logo`, plus extended `hat`. Ethnicity remains `string[]` curated-autocomplete (settled by Table-Build Gate 2; not subject to PIO-G3-PALETTE).

This document enumerates initial palette values. Owner amends in Gate 4 surface review or Gate 5 implementation review based on actual hand-corpus exposure.

---

## Palette: `wardrobe` (12 entries)

```
t-shirt
polo
button-up
hoodie
vest
jacket
sweater
suit
blouse
dress
jersey
robe
other        ← expands to free-text otherText
```

**Notes:**
- Multi-select per Player record (e.g., player wears polo + sweater on cold days).
- `'jersey'` covers sports jerseys (sub-case of t-shirt that is identification-distinctive).
- `'robe'` covers traditional dress (e.g., dishdasha, kaftan) — included for cultural-sensitivity binding (identification utility); cultural-sensitivity-as-reviewing-voice stance permits the entry.
- `'other'` slot expands to free-text input → `otherText` field on per-category schema.

**Recognition-search ranking math:**
- `matchScore(player.wardrobe.palette, query.wardrobe)` = Jaccard similarity of palette sets.
- `'other'` free-text does NOT contribute to ranking math.

---

## Palette: `jewelry` (7 entries)

```
ring
watch
bracelet
necklace
earrings
religious-item       ← cross / crescent / star-of-david / mala / etc.
other
```

**Notes:**
- Multi-select per Player record.
- `'religious-item'` covers identification-distinctive religious jewelry without parsing specific symbol (cultural-sensitivity binding: identification utility binds; specific-symbol granularity deferred to Phase 2+ if identification utility surfaces it).
- `'earrings'` is plural; entry covers any earring presence.

---

## Palette: `logo` (7 entries)

```
sports-team           ← any sports team / college / league
casino-brand          ← MGM / WSOP / Hard Rock / etc.
beer-brand            ← Bud / Coors / craft brewery
fashion-brand         ← Nike / Adidas / luxury
university            ← college / alumni
no-logo               ← explicit "no logo on visible clothing"
other
```

**Notes:**
- Multi-select per Player record (player can wear sports-team hat + casino-brand polo).
- `'no-logo'` is explicit (not absence of selection) — owner deliberately marked the player as wearing unbranded clothing.
- `'other'` covers rare cases (military insignia, custom apparel, etc.).

---

## Palette: `hat` (existing PEO palette + extension)

The hat palette EXISTS in PEO. PIO-G4 extends with `'other'` slot per Gate 3 PALETTE Hat migration nuance.

```
no-hat
baseball-cap
cap-team             ← existing PEO entry: sports-team / brand cap
beanie
fedora
cowboy
visor
headband
beret
turban               ← cultural-sensitivity binding: identification utility
yarmulke             ← cultural-sensitivity binding: identification utility
other
```

**Notes:**
- Single-select (a player wears one hat at a time during a session).
- `'turban'` and `'yarmulke'` included for cultural-sensitivity binding (identification utility binds; cultural-sensitivity is a reviewing voice per memory `feedback_pio_identification_utility_first.md`).
- Hat shape upgrade per PIO-G3-MIG: existing `hat: 'cap-team'` flat-string upgrades to `{ palette: 'cap-team', otherText: '' }` envelope shape via migrate-on-read getter shim (no v22 mutation forced).

---

## `'other'` slot semantics

Each palette includes `'other'` as a closed-enum entry. When owner selects `'other'`, the section UI expands to a free-text input that writes to `otherText` field on the per-category schema:

```
WardrobeSection schema:
  wardrobe: {
    palette: ['polo', 'other'],     ← closed-enum entries (multi-select)
    otherText: 'utility apron'       ← free-text capture for 'other' selection
  }
```

**Ranking math impact:**
- Closed-enum entries contribute to `matchScore(player.wardrobe.palette, query.wardrobe)` via Jaccard similarity.
- `'other'` free-text DOES NOT contribute to ranking math (per Gate 3 owner ratification — rare cases captured without polluting comparison).
- Recognition-search treats `'other'` as a "wildcard" entry: present in player record but doesn't increase or decrease similarity score against query.

---

## `'other'` governance (deferred to Phase 2+)

When an `otherText` value accumulates past threshold (e.g., 5+ distinct players have `otherText: 'trucker hat'` in their hat palette), Gate 5+ may surface a "promote to closed-enum?" workflow:

```
[Notification, deferred Phase 2+]
  "5 players have 'trucker hat' tagged as 'other'.
   Promote to closed-enum entry?
   [ Promote ]   [ Keep as other ]"
```

Promotion writes a new closed-enum entry to the palette + migrates affected player records (palette: ['trucker-hat']; otherText cleared). Phase 2+ feature per Gate 4 Open Question §6.

---

## Anti-pattern compliance

| AP-PIO | Verdict |
|---|---|
| AP-PIO-01 (sighting-log inferences NEVER feed exploit engine) | N/A — palettes are static taxonomy, not inference. |
| AP-PIO-02 (cross-surface contamination) | N/A — taxonomy doc, not surface. |
| AP-PIO-03 (auto-photo-capture refusal) | N/A. |
| AP-PIO-04 (neutral copy) | Compliant. Palette entries are factual ("polo" / "watch" / "sports-team"); no judgmental terms. |
| AP-PIO-05 (no demographic-targeted recommendation) | Compliant. Cultural-sensitivity binding affirmed: cultural identification entries (`'turban'`, `'yarmulke'`, `'religious-item'`, `'robe'`) are present for IDENTIFICATION utility. Cultural-sensitivity is a reviewing voice, not a load-bearing veto per memory. Palette does NOT propose recommendations; it captures observable attributes for cold-read matching. |

---

## Owner amendment paths

1. **Gate 4 review** — owner amends initial palette entries inline before Gate 5 begins.
2. **Gate 5 implementation review** — Gate 5 PR review surfaces palette in `src/utils/playerMatching/palettes.js` constants; owner amends pre-merge.
3. **Phase 2+ promote-from-'other' workflow** — see governance section above.

Each amendment increments `versionLineage` (analog of lesson-card schema versioning per SCF Gate 4); migration-on-read pattern for legacy player records that referenced removed entries (downgrades to `'other'` with otherText capture of the legacy entry name).

---

## Change log

- 2026-05-02 — Created (PIO Gate 4 / WS-007 / SPR-021). Initial palette values authored: wardrobe (12 entries), jewelry (7 entries), logo (7 entries), extended hat (12 entries). Each palette includes `'other'` slot with free-text `otherText`. Cultural-sensitivity binding affirmed (identification utility binds; identification-aiding cultural entries permitted). Recognition-search ranking math binding documented (closed-enum contributes via Jaccard; `'other'` free-text excluded from comparison). Implementation deferred to PIO Gate 5.
