import React, { useMemo } from 'react';
import { Play, Globe, BarChart3, Target, Users, BookOpen, Brain, Settings } from 'lucide-react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { useUI, useSession } from '../../../contexts';
import { SCREEN } from '../../../constants/uiConstants';
import { NAV_COLORS } from '../../../constants/designTokens';
import { HomebaseDashboard } from './HomebaseDashboard';

// A session still flagged active this long after it started was almost certainly
// never formally ended (phone died, walked away) — "Resume" would be a lie. We
// reframe it as "Unfinished" and route to the table, which owns the cash-out flow.
// We never fabricate a cash-out from the hub (financial integrity).
const STALE_SESSION_MS = 12 * 60 * 60 * 1000; // 12h

const formatDuration = (ms) => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatAgo = (ms) => {
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  return `${Math.max(1, h)}h ago`;
};

/**
 * HomebaseView — default app-entry launchpad.
 *
 * The first screen on app load (replaced TableView as the default, 2026-06-19).
 * Launcher tiles (Live Table, Online + a secondary nav grid) AND an at-a-glance
 * results dashboard (HomebaseDashboard). Long-tail views (Extension, Refresher,
 * Tournament, Analysis) stay on the in-table CollapsibleSidebar.
 *
 * Renders inside ScaledContainer (fixed 1600×720, scaled to fit) — the SAME model
 * as TableView and every other landscape surface — so on a phone it fits one screen
 * at the same scale as the rest of the app (founder report 2026-06-20: the prior
 * fluid layout sized differently than the rest of the app and the fixed health pill
 * overlapped tiles in portrait; ScaledContainer letterboxes those overlays away).
 * The launcher (header + tiles + nav) is always visible; the variable-height
 * dashboard lives in an internal scroll region.
 *
 * NOTE: inside ScaledContainer the design is always 1600px wide, but Tailwind
 * breakpoints (sm:/md:) key off the *device* viewport, not the design width — so
 * this surface uses FIXED grid columns + fixed sizes (never sm:/md:), matching how
 * the rest of the ScaledContainer app is built. Per docs/design/surfaces/homebase-view.md.
 */

// A single secondary launchpad tile. Colors mirror CollapsibleSidebar's NAV_COLORS
// so the two navigation surfaces speak the same visual language. Fixed sizing — the
// 1600px design space is constant; the grid controls width.
const Tile = ({ label, icon, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-2 p-3 min-h-[120px] rounded-2xl text-white font-semibold transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-white/50"
    style={{ backgroundColor: color }}
  >
    {icon}
    <span className="text-xl">{label}</span>
  </button>
);

export const HomebaseView = ({ scale }) => {
  const { setCurrentScreen } = useUI();
  const { currentSession, hasActiveSession } = useSession();

  const go = (screen) => () => setCurrentScreen(screen);

  // Active-session context for the primary tile. `stale` means the session is
  // still flagged active long after it started — surface "Unfinished" instead of
  // a "Resume" that implies a fresh live game.
  const sessionInfo = useMemo(() => {
    if (!hasActiveSession || !currentSession?.startTime) return null;
    const elapsedMs = Date.now() - currentSession.startTime;
    return {
      elapsedMs,
      stale: elapsedMs > STALE_SESSION_MS,
      handCount: currentSession.handCount || 0,
    };
  }, [hasActiveSession, currentSession?.startTime, currentSession?.handCount]);

  let liveTitle = 'Live Table';
  let liveSubtitle = 'Start a live session';
  if (sessionInfo?.stale) {
    liveTitle = 'Unfinished Session';
    liveSubtitle = `Started ${formatAgo(sessionInfo.elapsedMs)} — tap to finish`;
  } else if (sessionInfo) {
    liveTitle = 'Resume Session';
    liveSubtitle = `Active · ${formatDuration(sessionInfo.elapsedMs)} · ${sessionInfo.handCount} hands`;
  }

  const secondaryTiles = [
    { label: 'Stats', icon: <BarChart3 size={40} />, color: NAV_COLORS.stats.base, screen: SCREEN.STATS },
    { label: 'Sessions', icon: <Target size={40} />, color: NAV_COLORS.sessions.base, screen: SCREEN.SESSIONS },
    { label: 'Players', icon: <Users size={40} />, color: NAV_COLORS.players.base, screen: SCREEN.PLAYERS },
    { label: 'Hand Review', icon: <BookOpen size={40} />, color: NAV_COLORS.history.base, screen: SCREEN.HISTORY },
    { label: 'Self Coach', icon: <Brain size={40} />, color: NAV_COLORS.selfCoach.base, screen: SCREEN.SELF_COACH },
  ];

  return (
    <ScaledContainer scale={scale}>
      <div className="w-full h-full flex flex-col bg-gray-800 px-12 py-8">
        {/* Header — fixed */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h1 className="text-4xl font-bold text-white">Poker Tracker</h1>
          <button
            type="button"
            onClick={go(SCREEN.SETTINGS)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold transition-colors"
            style={{ backgroundColor: NAV_COLORS.settings.base }}
            title="Settings"
          >
            <Settings size={24} />
            <span className="text-lg">Settings</span>
          </button>
        </div>

        {/* Primary tiles — fixed */}
        <div className="grid grid-cols-2 gap-6 mb-6 shrink-0">
          <button
            type="button"
            onClick={go(SCREEN.TABLE)}
            className="flex flex-col items-center justify-center gap-3 min-h-[170px] rounded-3xl text-white font-bold transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/50"
            style={{ backgroundColor: '#15803d' }}
          >
            <Play size={56} />
            <span className="text-3xl">{liveTitle}</span>
            <span className="text-lg text-white/80">{liveSubtitle}</span>
          </button>

          <button
            type="button"
            onClick={go(SCREEN.ONLINE)}
            className="flex flex-col items-center justify-center gap-3 min-h-[170px] rounded-3xl text-white font-bold transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/50"
            style={{ backgroundColor: NAV_COLORS.online.base }}
          >
            <Globe size={56} />
            <span className="text-3xl">Online</span>
            <span className="text-lg text-white/80">Ignition play</span>
          </button>
        </div>

        {/* Secondary nav grid — fixed, always visible */}
        <div className="grid grid-cols-5 gap-4 mb-6 shrink-0">
          {secondaryTiles.map((t) => (
            <Tile key={t.screen} label={t.label} icon={t.icon} color={t.color} onClick={go(t.screen)} />
          ))}
        </div>

        {/* Dashboard — scrolls within the remaining height so the launcher above
            always fits one screen (founder: "fit one screen like the table"). */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <HomebaseDashboard onNavigate={setCurrentScreen} />
        </div>
      </div>
    </ScaledContainer>
  );
};

export default HomebaseView;
