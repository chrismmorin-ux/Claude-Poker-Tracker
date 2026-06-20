import React, { lazy } from 'react';
import { SCREEN } from './uiConstants';
// Eager hot-path views — first frames the user can see, no Suspense spinner.
import { HomebaseView } from '../components/views/HomebaseView';
import { TableView } from '../components/views/TableView';

/**
 * viewRegistry — the single source of truth for routable views (WS: homebase
 * throughpoint, 2026-06-19).
 *
 * Before this, adding a view meant editing four disconnected places (SCREEN
 * constant, lazy import, ViewRouter switch case, VIEW_TO_ORIENTATION / HASH_TO_SCREEN)
 * with nothing linking them — they drifted (CALIBRATION_DASHBOARD shipped with a
 * SCREEN constant + reducer action + feature-gate but no router case, rendering
 * nothing). Now every routable screen is one entry here, and the router, the
 * orientation policy, and the deep-link hash map all DERIVE from this object.
 *
 * Entry shape:
 *   name        — VEB/error-boundary label (also the human title for nav chrome).
 *   component    — the view component (eager) or a lazy() wrapper.
 *   eager        — true → rendered without Suspense (hot path).
 *   orientation  — 'portrait' | 'landscape' (default 'landscape'). Drives the lock.
 *   hash         — deep-link hash (e.g. '#online'), optional.
 *   noScale      — true → component does NOT take a `scale` prop (e.g. ExtensionPanel).
 *   render       — optional (scale) => ReactNode override for views needing extra props.
 *   deferred     — true → registered but not yet built; renders an explicit stub
 *                  (never silently nothing — that was the CALIBRATION_DASHBOARD bug).
 *
 * ShowdownView is intentionally absent: it is an overlay toggled by
 * `isShowdownViewOpen`, not by `currentView`, and is handled directly in ViewRouter.
 */

// lazy() wrapper for the repo's named-export view modules.
const lz = (importFn, exportName) =>
  lazy(() => importFn().then((m) => ({ default: exportName ? m[exportName] : m.default })));

const StatsView = lz(() => import('../components/views/StatsView'), 'StatsView');
const SessionsView = lz(() => import('../components/views/SessionsView'), 'SessionsView');
const PlayersView = lz(() => import('../components/views/PlayersView'), 'PlayersView');
const SettingsView = lz(() => import('../components/views/SettingsView'), 'SettingsView');
const AnalysisView = lz(() => import('../components/views/AnalysisView'), 'AnalysisView');
const HandReplayView = lz(() => import('../components/views/HandReplayView'), 'HandReplayView');
const LoginView = lz(() => import('../components/views/LoginView'), 'LoginView');
const SignupView = lz(() => import('../components/views/SignupView'), 'SignupView');
const PasswordResetView = lz(() => import('../components/views/PasswordResetView'), 'PasswordResetView');
const TournamentView = lz(() => import('../components/views/TournamentView'), 'TournamentView');
const OnlineView = lz(() => import('../components/views/OnlineView'), 'OnlineView');
const ExtensionPanel = lz(() => import('../components/views/OnlineView/ExtensionPanel'), 'ExtensionPanel');
const PlayerFinderView = lz(() => import('../components/views/PlayerFinderView/PlayerFinderView'), 'PlayerFinderView');
const PreflopDrillsView = lz(() => import('../components/views/PreflopDrillsView/PreflopDrillsView'), 'PreflopDrillsView');
const PostflopDrillsView = lz(() => import('../components/views/PostflopDrillsView/PostflopDrillsView'), 'PostflopDrillsView');
const PresessionDrillView = lz(() => import('../components/views/PresessionDrillView'), 'PresessionDrillView');
const PrintableRefresherView = lz(() => import('../components/views/PrintableRefresherView'), 'PrintableRefresherView');
const AnchorLibraryView = lz(() => import('../components/views/AnchorLibraryView'), 'AnchorLibraryView');
const LessonDetailView = lz(() => import('../components/views/LessonDetailView'), 'LessonDetailView');
const SelfCoachView = lz(() => import('../components/views/SelfCoachView/SelfCoachView'), 'SelfCoachView');
const PlayerProfileView = lz(() => import('../components/views/PlayerProfileView/PlayerProfileView'), 'PlayerProfileView');
const VoiceTimelineSandbox = lz(() => import('../components/views/VoiceTimelineSandbox'), 'VoiceTimelineSandbox');

// Explicit stub for a registered-but-unbuilt view. Visible, never silent.
const DeferredStub = ({ name }) => (
  <div className="h-dvh bg-gray-900 flex flex-col items-center justify-center text-gray-300 gap-2">
    <div className="text-xl font-semibold">{name}</div>
    <div className="text-sm text-gray-500">This view isn’t available yet.</div>
  </div>
);

export const VIEW_REGISTRY = {
  // Eager hot-path
  [SCREEN.HOMEBASE]: { name: 'Homebase', component: HomebaseView, eager: true },
  [SCREEN.TABLE]: { name: 'Table', component: TableView, eager: true },

  // Lazy main views
  [SCREEN.STATS]: { name: 'Stats', component: StatsView },
  [SCREEN.HISTORY]: { name: 'History', render: (scale) => <AnalysisView scale={scale} initialTab="review" /> },
  [SCREEN.SESSIONS]: { name: 'Sessions', component: SessionsView, orientation: 'portrait', hash: '#sessions' },
  [SCREEN.PLAYERS]: { name: 'Players', component: PlayersView, orientation: 'portrait', hash: '#players' },
  [SCREEN.SETTINGS]: { name: 'Settings', component: SettingsView, orientation: 'portrait', hash: '#settings' },
  [SCREEN.ANALYSIS]: { name: 'Analysis', component: AnalysisView },
  [SCREEN.HAND_REPLAY]: { name: 'Hand Replay', component: HandReplayView },
  [SCREEN.TOURNAMENT]: { name: 'Tournament', component: TournamentView },
  [SCREEN.ONLINE]: { name: 'Online', component: OnlineView, hash: '#online' },
  [SCREEN.EXTENSION]: { name: 'Extension', component: ExtensionPanel, noScale: true, hash: '#extension' },
  [SCREEN.PLAYER_FINDER]: { name: 'Player Finder', component: PlayerFinderView, orientation: 'portrait', hash: '#player-finder' },
  [SCREEN.PREFLOP_DRILLS]: { name: 'Preflop Drills', component: PreflopDrillsView },
  [SCREEN.POSTFLOP_DRILLS]: { name: 'Postflop Drills', component: PostflopDrillsView },
  [SCREEN.PRESESSION_DRILL]: { name: 'Presession Drill', component: PresessionDrillView },
  [SCREEN.PRINTABLE_REFRESHER]: { name: 'Printable Refresher', component: PrintableRefresherView, orientation: 'portrait', hash: '#printableRefresher' },
  [SCREEN.ANCHOR_LIBRARY]: { name: 'Anchor Library', component: AnchorLibraryView, orientation: 'portrait', hash: '#anchorLibrary' },
  [SCREEN.LESSON_DETAIL]: { name: 'Lesson Detail', component: LessonDetailView, orientation: 'portrait' },
  [SCREEN.SELF_COACH]: { name: 'Self Coach', component: SelfCoachView, orientation: 'portrait', hash: '#selfCoach' },
  [SCREEN.PLAYER_PROFILE]: { name: 'Player Profile', component: PlayerProfileView, orientation: 'portrait' },

  // Auth screens
  [SCREEN.LOGIN]: { name: 'Login', component: LoginView },
  [SCREEN.SIGNUP]: { name: 'Signup', component: SignupView },
  [SCREEN.PASSWORD_RESET]: { name: 'Password Reset', component: PasswordResetView },

  // Registered-but-unbuilt — explicit stub so the SCREEN constant can't render
  // nothing. AdminSection sandbox tools route via setCurrentScreen(tool.screen),
  // so these go through ViewRouter and need a registry entry. Swap `deferred` for
  // a `component` when the view is built.
  [SCREEN.CALIBRATION_DASHBOARD]: { name: 'Calibration Dashboard', deferred: true },
  // Owner-only sandbox prototype (Voice Hand-Tree Entry), routed from AdminSection.
  [SCREEN.VOICE_TIMELINE_SANDBOX]: { name: 'Voice Timeline (Sandbox)', component: VoiceTimelineSandbox, orientation: 'portrait' },
};

/**
 * renderView — turn a registry entry into a React element.
 * Handles deferred stubs, custom render overrides, and no-scale components.
 */
export const renderView = (screen, scale) => {
  const entry = VIEW_REGISTRY[screen];
  if (!entry) return null;
  if (entry.deferred) return <DeferredStub name={entry.name} />;
  if (entry.render) return entry.render(scale);
  const Component = entry.component;
  return entry.noScale ? <Component /> : <Component scale={scale} />;
};

// Derived: per-view orientation policy. Only non-default ('portrait') entries matter,
// but we expose the full map so the resolver can default the rest to 'landscape'.
export const VIEW_TO_ORIENTATION = Object.fromEntries(
  Object.entries(VIEW_REGISTRY)
    .filter(([, e]) => e.orientation)
    .map(([screen, e]) => [screen, e.orientation])
);

// Derived: deep-link hash → SCREEN map.
export const HASH_TO_SCREEN = Object.fromEntries(
  Object.entries(VIEW_REGISTRY)
    .filter(([, e]) => e.hash)
    .map(([screen, e]) => [e.hash, screen])
);
