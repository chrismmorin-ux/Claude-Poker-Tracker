/**
 * uiConstants.js - UI-related constants
 */

// Screen constants
export const SCREEN = {
  // Homebase — default app-entry launchpad (2026-06-19). Routes to the primary
  // jobs (start/resume session, review, study, navigate). Per
  // docs/design/surfaces/homebase-view.md. Replaced TABLE as initialUiState default.
  HOMEBASE: 'homebase',
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
  // Unified PlayerFinder — single fullscreen surface for player find /
  // edit / create. Replaced the legacy PlayerEditorView + PlayerPickerView
  // pair via plan floating-questing-conway (Phases A → D, 2026-05-06).
  PLAYER_FINDER: 'playerFinder',
  // Printable Refresher (PRF) — Phase 5 UI; first explicit Reference-mode surface.
  // Dispatched at mount via currentIntent: 'Reference' per surfaces/printable-refresher.md.
  PRINTABLE_REFRESHER: 'printableRefresher',
  // Exploit Anchor Library (EAL) — Phase 6+; flat-list study surface for anchors.
  // Per surfaces/anchor-library.md. Deep-link target for capture toast Undo (S18+).
  ANCHOR_LIBRARY: 'anchorLibrary',
  // Calibration Dashboard (EAL Stream D / WS-169 / SPR-066, 2026-05-09) — 3-tab
  // study-mode audit surface (Predicates / Anchors / Primitives). Deep-link
  // target from AnchorLibraryView's handleOpenDashboard. Per
  // docs/design/surfaces/calibration-dashboard.md (v1.1 amended 2026-05-09) +
  // docs/design/audits/2026-05-09-entry-calibration-dashboard.md (verdict YELLOW).
  CALIBRATION_DASHBOARD: 'calibrationDashboard',
  // SCF G5 child 3 (WS-147 / SPR-032, 2026-05-03) — lesson detail surface.
  // Per docs/projects/self-coach-foundation/lesson-authoring-template.md +
  // src/utils/skillAssessment/CLAUDE.md source-util-policy whitelist (read-allowed
  // from HandReplayView via Drill-this affordance + future SelfCoachView Curriculum).
  LESSON_DETAIL: 'lessonDetail',
  // SCF G5 Phase-5a (WS-159 / SPR-042, 2026-05-06) — Self-Coach curriculum surface.
  // 2-tab IA (Curriculum / Settings); consumes tierConceptMap + conceptMastery +
  // composite + learningStateDescriber + lessonRegistry. Per
  // docs/design/surfaces/self-coach-view.md +
  // docs/design/audits/2026-05-06-entry-self-coach-view.md (verdict GREEN).
  SELF_COACH: 'selfCoach',
  // PIO G5 child C (WS-162 / SPR-035, 2026-05-04) — player profile surface.
  // Sighting history + per-attribute stability descriptors + manual-add-sighting modal.
  // Row-tap from PlayersView opens this (was PlayerEditor pre-WS-163).
  // Per docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md §PIO-G4-S1.
  PLAYER_PROFILE: 'playerProfile',
  // Owner-only sandbox prototype (2026-06-19) — voice-fed hand-tree editor +
  // raw Web Speech transcript collector. Mounted via AdminSection SANDBOX_TOOLS.
  // Pre-Gate experiment for the Voice Hand-Tree Entry project (evolves WS-181).
  VOICE_TIMELINE_SANDBOX: 'voiceTimelineSandbox',
  // Auth screens
  LOGIN: 'login',
  SIGNUP: 'signup',
  PASSWORD_RESET: 'passwordReset',
};
