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
  PLAYER_EDITOR: 'playerEditor',
  PLAYER_PICKER: 'playerPicker',
  // Printable Refresher (PRF) — Phase 5 UI; first explicit Reference-mode surface.
  // Dispatched at mount via currentIntent: 'Reference' per surfaces/printable-refresher.md.
  PRINTABLE_REFRESHER: 'printableRefresher',
  // Exploit Anchor Library (EAL) — Phase 6+; flat-list study surface for anchors.
  // Per surfaces/anchor-library.md. Deep-link target for capture toast Undo (S18+).
  ANCHOR_LIBRARY: 'anchorLibrary',
  // Auth screens
  LOGIN: 'login',
  SIGNUP: 'signup',
  PASSWORD_RESET: 'passwordReset',
};
