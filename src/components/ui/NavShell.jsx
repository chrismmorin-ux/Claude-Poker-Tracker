import React from 'react';
import { Home } from 'lucide-react';
import { useUI } from '../../contexts';
import { SCREEN } from '../../constants/uiConstants';
import { VIEW_REGISTRY } from '../../constants/viewRegistry';
import { NAV_COLORS } from '../../constants/designTokens';

/**
 * NavShell — the persistent "throughpoint" navigation affordance.
 * Plan shimmying-moseying-lantern, Phase E.
 *
 * Makes Homebase the real hub: a one-tap Home button reachable from ANY screen.
 * Implemented as a fixed-position overlay (same proven pattern as HealthIndicator)
 * rather than a wrapping top-bar, because ~20 views are pixel-fit ScaledContainer
 * layouts at 1600×720 and already render their own in-header "Back to Table"
 * button — wrapping them would reflow fitted surfaces and duplicate that
 * affordance. The overlay adds Home without touching any view's layout.
 *
 * Hidden where it would be redundant:
 *  - HOMEBASE (you're already home)
 *  - TABLE (the in-table CollapsibleSidebar already has a Home item + needs its
 *    full surface free for live play)
 *  - auth screens (login/signup/reset — pre-app, no hub yet)
 */

const HIDDEN_ON = new Set([
  SCREEN.HOMEBASE,
  SCREEN.TABLE,
  SCREEN.LOGIN,
  SCREEN.SIGNUP,
  SCREEN.PASSWORD_RESET,
]);

export const NavShell = () => {
  const { currentView, isShowdownViewOpen, setCurrentScreen } = useUI();

  // Showdown is a full-screen live overlay — never chrome it.
  if (isShowdownViewOpen || HIDDEN_ON.has(currentView)) return null;

  const title = VIEW_REGISTRY[currentView]?.name || '';

  return (
    <button
      type="button"
      onClick={() => setCurrentScreen(SCREEN.HOMEBASE)}
      className="fixed top-3 left-3 z-[55] flex items-center gap-2 px-3 py-2 rounded-full text-white text-sm font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-white/60"
      style={{ backgroundColor: NAV_COLORS.home.base }}
      title="Home"
      aria-label={title ? `Home — leave ${title}` : 'Home'}
      data-testid="nav-shell-home"
    >
      <Home size={16} />
      <span>Home</span>
    </button>
  );
};

export default NavShell;
