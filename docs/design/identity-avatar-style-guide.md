# Identity Avatar — Style Guide (v1)

**Owner:** PIO program (Player Identification v2). **Status:** v1 conventions, captured 2026-05-06 as part of SPR-041 Phase 4.

This guide documents the conventions of the in-house SVG primitive set used by `IdentityAvatar`, `AvatarRenderer`, and `DistinguishingMarkBadge`. It exists so future feature additions stay coherent without re-deriving from scratch, and so consumer code and tests reason against a stable contract.

> **History note.** SPR-041 evaluated DiceBear adoption (lorelei → personas → avataaars) and rolled back to v1 after eye-test exposed structural fidelity loss (build invisible, headwear/facialHair types collapsed, randomized clothing, expressions not neutral). The v1 conventions captured here are what shipped; a future visual-quality workstream (commission-illustrator path) is the most likely successor — see "Future direction" at the bottom.

---

## 1. ViewBox + sizing

- **Authoring viewBox:** `0 0 100 100` (`AVATAR_VIEWBOX` in `src/constants/avatarFeatureConstants.js`).
- **Render size:** controlled by the `size` prop on `<AvatarRenderer />` and `<IdentityAvatar />`. Default is 48px. The SVG scales uniformly; internal coordinates never change.
- **Coordinate landmarks** (used across feature files; do not move silently):
  | y | landmark |
  |---|----------|
  | 16–18 | crown (top of head) |
  | 32–38 | hat brim line (varies by hat: cap=38, beanie/cowboy/fedora=32) |
  | 46 | mid-face (eye line) |
  | 50 | nose / mid-glasses |
  | 56–58 | mouth |
  | 78 | jaw bottom (head ends, neck/shoulders begin) |
  | 84 | base of neck |
  | 100 | bottom edge of viewBox |

- **Hair-clip line when hatted:** `HAIR_CLIP_Y_WHEN_HATTED = 38` in `AvatarRenderer.jsx`. Hair above this line is clipped when any hat layer renders so hair never pokes through the brim. Sideburns (y > 38) remain visible.

## 2. Layer order

`LAYER_ORDER` in `avatarFeatureConstants.js` is the single source of truth. Bottom → top:

1. **skin** — silhouette (head + neck + shoulders), tinted by `var(--skin)`
2. **beard** — beard style (rendered before hair so hair can overlap sideburns)
3. **hair** — scalp hair style (clipped by hat when present)
4. **eyes** — eye shape + iris color
5. **glasses** — frame above eyes
6. **hat** — top layer
7. *(post-layer)* **distinguishing-marks** — overlay group rendered last; never clipped

Adding a new category requires extending `LAYER_ORDER`, `LAYER_TO_COLOR_VAR`, `AVATAR_CATEGORIES`, and `DEFAULT_AVATAR_FEATURES` together. There is no test that catches drift between these four — keep them in lockstep manually.

## 3. Color token graph

All color is applied via CSS custom properties on the root `<svg>` element. Path `fill`/`stroke` references the var (e.g. `fill="var(--skin)"`) so each path is recolored once at the SVG root.

| Token | Source palette | Default | Used by |
|-------|---------------|---------|---------|
| `--skin` | `SKIN_TONES` | `skin.tan` | silhouette layer |
| `--hair` | `HAIR_COLORS` | `color.black` | hair layer |
| `--beard` | `HAIR_COLORS` (shared) | `color.black` | beard layer |
| `--eye` | `EYE_COLORS` | `eye-color.brown` | eyes layer (iris) |
| `--frame` | `EYEWEAR_COLORS` | `frame.black` | glasses layer |
| `--hat`, `--hat-trim` | `CLOTHING_COLORS` | unset → SVG fallback hex | hat layer (only when `hatColor` is set) |

**Hat color is opt-in.** When `avatarFeatures.hatColor` is unset, `--hat`/`--hat-trim` are not declared and the hat SVG falls back to its own hard-coded hex (the original design color). When set, `--hat-trim` is derived via `color-mix(in srgb, --hat 70%, black)`.

## 4. Palette ordering invariant (light → dark)

Every palette in this guide displays lightest → darkest in identification chip rows. Memory rule (2026-05-06): when adding a new color, **insert by luminance** — do not append.

- `SKIN_TONES`: `very-light → ruddy → light → tan → brown → dark`. `ruddy` sits between `very-light` and `light` (flushed/pink-cast variant; owner-confirmed neighbor).
- `HAIR_COLORS`: `white → gray → salt-pepper → red → blonde → light-brown → brown → dark-brown → black`. `red` and `salt-pepper` are non-ladder outliers placed by perceptual category, not strict luminance.
- `CLOTHING_COLORS`: neutrals (white → gray → black) → warm hues → cool hues → metallics (gold + silver).
- `EYEWEAR_COLORS`: black → brown → tortoiseshell → gold → silver → red → blue.

This invariant is for chip-row display ordering only. Render-time lookup is by id (order-independent).

## 5. Stroke conventions

**Current state.** Stroke widths in `src/assets/avatarFeatures/*.js` range from `0.7` to `2.2`. This is wider than ideal — some hair textures (`slick-back` 0.7, `combover` 0.9) lose definition at 24px DPI rendering on the Galaxy A22 (the canonical mobile target).

**Recommended for new features:**
- **≥1.0** for any line that must be legible at 24px display size
- **≥1.4** for primary outlines and overlay elements (e.g. salt-pepper streaks at the crown)
- **strokeLinecap: round** for hair texture overlays (curly, braided, salt-pepper)
- **strokeLinejoin: round** for any path with sharp angles that would alias on the Galaxy A22 DPR

This is a soft rule. Existing thinner strokes are acceptable when the *fill* carries the silhouette and the stroke is a detail accent.

## 6. Sex × build silhouette composition

The `skin` layer is unique: it is composed from `silhouette.{sex}-{build}` variants (`src/assets/avatarFeatures/skin.js`).

- **3 head shapes** (sex): `male`, `female`, `other` — vary in jaw width, brow softness, temple width
- **4 shoulder shapes** (build): `slim`, `average`, `heavy`, `muscular` — vary in shoulder width and slope
- **12 total variants:** `silhouette.male-slim`, …, `silhouette.other-muscular`
- **Legacy fallback:** `skin.shape` (singleton — used when `avatarFeatures.silhouette` is absent on older records)

Shoulder y-coordinates are coupled (jaw=78, neck-base=84, bottom=100). Heavy and muscular variants use wider x-extents (16-100 vs 28-100 for slim) — this is the build's primary visual signal at 48px+; **at 24px the build distinction is not legible** (acknowledged limitation; see §10).

## 7. Salt-pepper overlay pattern

A salt-pepper hair color renders as a **streak overlay** clipped to the underlying shape, *not* as a base-color shift. The base hair color is preserved; white streaks render on top.

Implementation (`AvatarRenderer.jsx`):

```jsx
<defs>
  <clipPath id={hairShapeClipId}>
    {hairLayer.feature.paths.map(...)}  // duplicate of hair shape
  </clipPath>
</defs>
{/* hair layer renders first */}
<g clipPath={`url(#${hairShapeClipId})`}>
  {SALT_PEPPER_HAIR_PATHS.map(...)}     // white streak strokes
</g>
```

Beard salt-pepper mirrors the same pattern via `SALT_PEPPER_BEARD_PATHS`. Treatment toggles are independent: `avatarFeatures.hairTreatment` and `avatarFeatures.beardTreatment` (beard mirrors hair when unset).

If you add a new treatment (e.g. ombre, highlights), follow this same shape: clipPath bound to the underlying feature paths + an overlay group rendered immediately after the layer it modifies.

## 8. Distinguishing-mark badges

Authored at `src/assets/distinguishingMarks/index.js`. Validated at `src/utils/persistence/validation.js`. Persisted in `player.distinguishingMarks` (`[]`-defaulted by IDB v24 migration).

**Schema (per mark):**
```
{
  type: 'tattoo' | 'hearing-aid' | 'bindi' | 'scar' | 'prosthetic',
  location: 'face' | 'arm' | 'ear' | 'neck' | 'hand' | 'other',
  description: string,
  firstSeenAt: number (ms),
  lastSeenAt: number (ms),
}
```

**Location anchors** (centered on the badge — `LOCATION_ANCHORS` in `distinguishingMarks/index.js`):

| location | (cx, cy) | rationale |
|----------|----------|-----------|
| `face`   | (66, 52) | right cheek (clear of eyes/mouth) |
| `ear`    | (86, 50) | right ear, slightly above face anchor |
| `neck`   | (50, 80) | base of neck, centered |
| `arm`    | (82, 92) | right shoulder / upper arm |
| `hand`   | (18, 92) | left lower-corner (hand area) |
| `other`  | (86, 22) | top-right corner — clear of face + clothing |

**Background-circle convention.** Each spec optionally declares `backgroundCircle: { r, fill }` — a small white disc rendered behind the glyph so the mark stays legible against any underlying skin/clothing color. Bindi opts out (no disc — would dilute the red-dot signal). Tattoo/hearing-aid/scar/prosthetic all use `r: 5.5–6, fill: '#fff'` with a soft `rgba(0,0,0,0.15)` ring stroke.

**Adding a new mark type:**
1. Append to `DISTINGUISHING_MARKS` in `src/assets/distinguishingMarks/index.js` with `type`, `label`, `defaultLocation`, optional `backgroundCircle`, and `paths`.
2. Update the schema enum in `src/utils/persistence/validation.js`.
3. Update the test file (`DistinguishingMarkBadge.test.jsx`) — the count assertion at "VALID_MARK_TYPES enumerates exactly N types" is intentionally a tripwire.
4. If a new location anchor is needed, add to `LOCATION_ANCHORS` and update the validation enum to match.

## 9. Adding a new feature (non-mark)

Hair, beard, eyes, glasses, hat all follow the same pattern:

1. Add the feature definition to `src/assets/avatarFeatures/<category>.js`. Use a namespaced id: `<category>.<kebab-name>` (e.g. `hair.short-wavy`).
2. The `paths` array entries should be plain objects with `d` (required) plus optional `fill`/`stroke`/`strokeWidth`/`strokeLinecap`/`strokeLinejoin`/`fillOpacity`/`fillRule`. `fill` defaults to `currentColor`, which the layer's color-var inherits.
3. If the feature does not need to render (e.g. opt-out variants), use the `<category>.none` entry — every category has one. Do not introduce a second "none."
4. Update `src/utils/identityAvatar/avatarMapping.js` if the feature should be selectable from identification fields (otherwise it stays manually-pickable only).
5. Add a test case in the relevant `__tests__/` file. Smart-test-runner gates on the avatar trio (`AvatarRenderer`, `IdentityAvatar`, `DistinguishingMarkBadge`).

## 10. Honest limitations of the v1 set

Documented so consumers don't assume what isn't there:

- **Build is not legible at 24px.** Shoulder-width is the primary build cue; at 24px on the Galaxy A22 DPR, the silhouette-edge difference between `slim` and `heavy` is sub-pixel. Build is recognizable at 48px+ but not at the table-strip recognition size.
- **Headwear types collapse for the colorblind/low-vision axis.** Cap, beanie, fedora, cowboy, visor are visually distinct at 96px but the brim/crown silhouettes converge at 24px. There is no per-type fidelity test in CI.
- **No facial-hair sub-type SVGs for goatee/soul-patch/chops vs mustache.** The current set has 7 beard variants but they trend toward fill-area differences (full beard vs stubble vs chin-strap) — small-line distinctions like a soul patch are at the limit of what the 100×100 grid resolves.
- **Eyes have no expression dimension.** Eyes is shape-only (round/narrow/almond/closed). There is no smile / frown / wink axis; this was an explicit DiceBear-rollback finding (avataaars randomized expressions, breaking neutrality).
- **Distinguishing marks are 5 types, fixed enum.** No "freeform overlay" escape hatch. Adding a 6th type requires the four-step migration above (asset + validation + test + anchors).
- **Stroke widths are inconsistent (0.7–2.2).** v1 was authored under iteration pressure; some hair textures use 0.7-stroke detail that loses at 24px. New work should follow §5 (≥1.0).

## 11. Backward-compatibility surface

The IdentityAvatar primitive is consumed by many surfaces (TableView strip, OnlineView, PlayerProfileView, PlayerEditor, AddSightingModal, ReviewPanel, etc.). The contract is:

- `<IdentityAvatar player={player} size={N} />` always renders something — a default silhouette if `player` is null, the configured silhouette otherwise. **Never returns null at the top level.**
- `mapIdentityToAvatarFeatures(player, opts)` is the single derivation point from identification fields → `avatarFeatures`. Surfaces must not bypass it (no direct AvatarRenderer use with hand-built feature objects in production code; only in tests).
- `headwearOverride` prop is **per-render override** — used by `SightingHistorySection` to show what hat the player wore at this specific session (read from `sighting.attributes.outfit` hat entries). It does NOT mutate `player.headwear`.
- `photoOverlay` + `photoUrl` props add a circular badge bottom-right; the SVG silhouette stays primary so the recognition path that doesn't depend on photo capture continues to work.

If you change the contract (add a prop, rename a field), update **all consumers** in the same change — `IdentityAvatar` is load-bearing for the recognition workflow.

## 12. Future direction

The v1 set is acknowledged engineer-art. Likely successors:

- **Commission-illustrator workstream.** Hire a designer to redraw the 11 hair / 7 beard / 6 hat / 6 glasses / 12 silhouette variants at 24px-native fidelity with a coherent stroke and color language. Highest visual quality; owner cost; deferred from SPR-041.
- **DiceBear adoption v2.** A future style (or a custom DiceBear style commissioned via their authoring workflow) might solve the structural-fidelity problems that caused the 2026-05-06 rollback. Avataaars specifically failed; lorelei/personas were ruled out earlier for hat/beard gaps.
- **Hybrid approach.** Keep v1 silhouettes (which encode build + sex correctly) and replace only the hair/beard/hat layers with library-quality assets. Lower risk than full replacement; preserves the identification-field model that is now correct.

When any of these workstreams open, this style guide is the contract the new system must match — `mapIdentityToAvatarFeatures` shape, layer order, color tokens, distinguishing-mark anchors, palette ordering invariant. The v1 visuals are replaceable; the conventions are not.
