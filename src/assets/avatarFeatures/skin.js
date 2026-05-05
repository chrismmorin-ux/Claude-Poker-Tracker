/**
 * skin.js — Silhouette variants by sex × build (Phase 1.6)
 *
 * The skin layer is the body silhouette — head, neck, and shoulders as one
 * filled shape tinted by --skin CSS custom property.
 *
 * Phase 1.6 adds 12 variants composed from:
 *   3 head shapes (male / female / androgynous): jaw width, brow softness,
 *     temple width vary
 *   4 shoulder shapes (slim / average / heavy / muscular): width and slope
 *     of the shoulder line, optional trap definition
 *
 * Variant ID convention:  silhouette.{sex}-{build}
 *   e.g., silhouette.male-muscular, silhouette.female-slim
 *
 * Backward compat:
 *   skin.shape (the original singleton) is preserved as the legacy fallback.
 *   AvatarRenderer prefers avatarFeatures.silhouette when present, else falls
 *   through to skin.shape.
 *
 * All paths render against the 100×100 AVATAR_VIEWBOX.
 */

// =============================================================================
// HEAD SHAPES (3 — by sex)
// =============================================================================
//
// Each ends at y=78 (jaw bottom) and connects to a neck that begins at y=78.
// Crown (top of head) is at y=18 for all.
// Differences:
//   male: square jaw (less taper from temple to chin), brow shelf
//   female: narrower face, softer pointed chin, longer neck appearance
//   androgynous: midpoint
//
// Each head path leaves the cursor at the jaw bottom-left (x=40, y=78) so the
// neck/shoulder path can continue from there without an explicit Move.

const HEAD_MALE = `
  M 50 18
  C 32 18, 25 30, 25 46
  C 25 56, 28 65, 34 72
  C 36 76, 40 78, 40 78
`;

const HEAD_FEMALE = `
  M 50 16
  C 35 16, 28 28, 28 46
  C 28 58, 32 68, 38 75
  C 39 77, 40 78, 40 78
`;

const HEAD_ANDROGYNOUS = `
  M 50 17
  C 33 17, 26 30, 26 46
  C 26 58, 30 67, 36 73
  C 38 76, 40 78, 40 78
`;

// =============================================================================
// HEAD-RIGHT-SIDE (mirror of the left curves above)
// =============================================================================
//
// Continues from the right jaw point (x=60, y=78) UP through right cheek to
// crown. Each completes the head outline by tracing back to where HEAD_X
// started at (50, 18ish).

const HEAD_MALE_RIGHT = `
  L 60 78
  C 60 78, 64 76, 66 72
  C 72 65, 75 56, 75 46
  C 75 30, 68 18, 50 18
`;

const HEAD_FEMALE_RIGHT = `
  L 60 78
  C 60 78, 61 77, 62 75
  C 68 68, 72 58, 72 46
  C 72 28, 65 16, 50 16
`;

const HEAD_ANDROGYNOUS_RIGHT = `
  L 60 78
  C 60 78, 62 76, 64 73
  C 70 67, 74 58, 74 46
  C 74 30, 67 17, 50 17
`;

// =============================================================================
// SHOULDER SHAPES (4 — by build)
// =============================================================================
//
// Each starts at the right-jaw side (we pick up at x=60, y=78), descends down
// the right neck, sweeps out to right shoulder, across to left shoulder, up
// the left neck, and closes back to the left-jaw start point (x=40, y=78).
//
// Width of shoulders varies. Heavy adds a slight outward curve (rounded);
// muscular adds an inward indent at the neckline (defined traps).

const SHOULDERS_SLIM = `
  L 60 84
  C 65 87, 70 90, 72 100
  L 28 100
  C 30 90, 35 87, 40 84
  Z
`;

const SHOULDERS_AVERAGE = `
  L 60 84
  C 66 87, 72 92, 76 100
  L 24 100
  C 28 92, 34 87, 40 84
  Z
`;

const SHOULDERS_HEAVY = `
  L 62 84
  C 70 87, 80 93, 84 100
  L 16 100
  C 20 93, 30 87, 38 84
  Z
`;

const SHOULDERS_MUSCULAR = `
  L 60 84
  C 64 86, 68 88, 72 88
  C 78 90, 84 95, 86 100
  L 14 100
  C 16 95, 22 90, 28 88
  C 32 88, 36 86, 40 84
  Z
`;

// =============================================================================
// COMPOSITION: 12 variants (3 sex × 4 build)
// =============================================================================

const HEADS = {
  male: HEAD_MALE + HEAD_MALE_RIGHT,
  female: HEAD_FEMALE + HEAD_FEMALE_RIGHT,
  other: HEAD_ANDROGYNOUS + HEAD_ANDROGYNOUS_RIGHT,
};

const SHOULDERS = {
  slim: SHOULDERS_SLIM,
  average: SHOULDERS_AVERAGE,
  heavy: SHOULDERS_HEAVY,
  muscular: SHOULDERS_MUSCULAR,
};

// Build the head-only path (no shoulders) to compose with shoulder fragments.
// Heads end at right-jaw (60, 78). The shoulder path picks up there with the
// `L 60 84` step, sweeps around and back, ends with Z at the start of head.
const buildSilhouette = (sex, build) => {
  const headPath = HEADS[sex];
  const shouldersPath = SHOULDERS[build];
  // Replace the trailing 'C ... 50 18' (head closing back to crown) with a
  // shoulder loop. The shoulder loop goes from (60, 78) DOWN through the
  // shoulders and back to (40, 78), then we need a final L 50 18-ish close.
  // Simpler: drop the last 'C ... 50 18' segment of the head, append shoulders
  // that start at (60, 78), then L 50 18 to close.
  //
  // Strategy: emit head outline including the right-side return-to-crown,
  // THEN start a SECOND M at (40, 78) for the bust. Two subpaths in one path,
  // both filled with --skin.
  return `
    ${headPath}
    M 40 78
    ${shouldersPath}
  `;
};

// =============================================================================
// EXPORTED FEATURES
// =============================================================================

const VARIANT_FEATURES = [];
for (const sex of Object.keys(HEADS)) {
  for (const build of Object.keys(SHOULDERS)) {
    VARIANT_FEATURES.push({
      id: `silhouette.${sex}-${build}`,
      label: `${sex} ${build}`,
      paths: [
        {
          d: buildSilhouette(sex, build),
          fill: 'var(--skin)',
          // fillRule even-odd would matter only if subpaths overlap; they
          // don't here (head ends at jaw, bust starts at jaw line).
        },
      ],
    });
  }
}

// Legacy singleton — kept so any consumer not yet updated to set silhouette
// still gets a renderable face.
const LEGACY_HEAD_AND_SHOULDERS = `
  M 50 18
  C 33 18, 26 32, 26 48
  C 26 62, 31 73, 40 78
  L 40 84
  C 40 88, 35 90, 30 92
  L 16 100
  L 84 100
  L 70 92
  C 65 90, 60 88, 60 84
  L 60 78
  C 69 73, 74 62, 74 48
  C 74 32, 67 18, 50 18
  Z
`;

export default [
  {
    id: 'skin.shape',
    label: 'Face (legacy)',
    paths: [{ d: LEGACY_HEAD_AND_SHOULDERS, fill: 'var(--skin)' }],
  },
  ...VARIANT_FEATURES,
];
