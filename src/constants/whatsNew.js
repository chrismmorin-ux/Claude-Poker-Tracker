/**
 * WHATS_NEW — newest-first list of notable changes, surfaced on the Homebase to
 * a returning ("Lapsed Returner") player as "what's new since you were away."
 * Plan shimmying-moseying-lantern, Phase D.
 *
 * Each entry has a stable `id`; lastVisit tracks the newest id the player has
 * seen, so only genuinely-new entries are shown. Add new entries at the TOP.
 * Keep highlights short — sourced from docs/CHANGELOG.md.
 */
export const WHATS_NEW = [
  {
    id: '2026-06-homebase-dashboard',
    title: 'New Home screen + dashboard',
    detail:
      'The app now opens to a Home screen with your results dashboard, recent sessions, a study queue, and one-tap navigation everywhere.',
  },
];
