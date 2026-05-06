/**
 * uiConstants.js - UI-related constants
 */

// Screen constants
export const SCREEN = {
  TABLE: 'table',
  STATS: 'stats',
  HISTORY: 'history',
  SESSIONS: 'sessions',
  PLAYERS: 'players',
  SETTINGS: 'settings',
  ANALYSIS: 'analysis',
  HAND_REPLAY: 'handReplay',
  TOURNAMENT: 'tournament',
  ONLINE: 'online',
  EXTENSION: 'extension',
  PREFLOP_DRILLS: 'preflopDrills',
  POSTFLOP_DRILLS: 'postflopDrills',
  // Exploit Deviation project — Presession Drill (feature-flagged, default off)
  PRESESSION_DRILL: 'presessionDrill',
  // Player Entry Overhaul (PEO) screens — S1 ships constants; S2/S3 wire views
  // Phase B (2026-05-06, plan floating-questing-conway): PLAYER_EDITOR and
  // PLAYER_PICKER now alias to PLAYER_FINDER. The legacy keys are kept so
  // any persisted nav state from prior sessions still resolves to a real
  // screen, and so any caller that hasn't migrated yet still functions via
  // the openPlayerFinder redirects in UIContext. Phase D drops these.
  PLAYER_EDITOR: 'playerFinder',
  PLAYER_PICKER: 'playerFinder',
  // Unified PlayerFinder — replaces PlayerEditorView + PlayerPickerView.
  // See `.claude/plans/floating-questing-conway.md`.
  PLAYER_FINDER: 'playerFinder',
  // Printable Refresher (PRF) — Phase 5 UI; first explicit Reference-mode surface.
  // Dispatched at mount via currentIntent: 'Reference' per surfaces/printable-refresher.md.
  PRINTABLE_REFRESHER: 'printableRefresher',
  // Exploit Anchor Library (EAL) — Phase 6+; flat-list study surface for anchors.
  // Per surfaces/anchor-library.md. Deep-link target for capture toast Undo (S18+).
  ANCHOR_LIBRARY: 'anchorLibrary',
  // SCF G5 child 3 (WS-147 / SPR-032, 2026-05-03) — lesson detail surface.
  // Per docs/projects/self-coach-foundation/lesson-authoring-template.md +
  // src/utils/skillAssessment/CLAUDE.md source-util-policy whitelist (read-allowed
  // from HandReplayView via Drill-this affordance + future SelfCoachView Curriculum).
  LESSON_DETAIL: 'lessonDetail',
  // PIO G5 child C (WS-162 / SPR-035, 2026-05-04) — player profile surface.
  // Sighting history + per-attribute stability descriptors + manual-add-sighting modal.
  // Row-tap from PlayersView opens this (was PlayerEditor pre-WS-163).
  // Per docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md §PIO-G4-S1.
  PLAYER_PROFILE: 'playerProfile',
  // Auth screens
  LOGIN: 'login',
  SIGNUP: 'signup',
  PASSWORD_RESET: 'passwordReset',
  // Prototype surface (2026-05-05) — interactive design preview for the
  // unified PlayerFinder. Reachable via URL hash #prototype-finder. Uses
  // mock data only; never reads/writes IDB. Will be removed once the real
  // PlayerFinderView ships and the design is locked.
  PROTOTYPE_FINDER: 'prototypeFinder',
};
