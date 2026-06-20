/**
 * @file AdminSection — owner-only "sandbox" tab in Settings.
 *
 * Houses tools that are part of the build but shouldn't be visible to
 * regular users — design prototypes, in-progress experiments, internal
 * dev affordances. Visible only when the authed user matches OWNER_EMAIL.
 *
 * Owner intent (2026-05-05): "I think of this like a sandbox I'll be
 * able to view on my phone and my phone alone for the purposes of
 * development." Gating by email is the lightest-weight way to honor
 * that without standing up a roles system.
 *
 * Adding a new sandbox tool: extend the SANDBOX_TOOLS array. Each entry
 * gets its own card with a tap target.
 */

import React from 'react';
import { Beaker, ChevronRight } from 'lucide-react';
import { useAuth, useUI } from '../../../contexts';
import { SCREEN } from '../../../constants/uiConstants';

// Owner gate. If the app ships to other users later, change this to a
// roles check or a feature flag — keep AdminSection's render gate as
// the only place this email lives so swapping in a different mechanism
// touches one file.
const OWNER_EMAIL = 'chrismmorin@gmail.com';

// Sandbox tool registry. Each entry renders as one tappable card.
// `screen` is a SCREEN constant; `hash` is a fallback URL hash for
// tools without a registered screen (none yet, but the pattern's here).
const SANDBOX_TOOLS = [
  {
    id: 'voice-timeline',
    title: 'Voice hand-timeline',
    summary: 'Narrate a hand to capture real voice + feel the hand-tree correction UX. Pre-Gate prototype (Voice Hand-Tree Entry).',
    badge: 'WIP',
    screen: SCREEN.VOICE_TIMELINE_SANDBOX,
  },
];

const ToolCard = ({ tool, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(tool)}
    className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-700/40 bg-amber-900/10 hover:bg-amber-900/20 transition-colors"
    data-testid={`admin-tool-${tool.id}`}
  >
    <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mt-0.5">
      <Beaker size={18} className="text-amber-300" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-sm font-semibold text-gray-100 truncate">{tool.title}</span>
        {tool.badge ? (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 shrink-0">
            {tool.badge}
          </span>
        ) : null}
      </div>
      <div className="text-xs text-gray-400 leading-snug">{tool.summary}</div>
    </div>
    <ChevronRight size={18} className="text-gray-500 shrink-0 mt-1.5" />
  </button>
);

export const AdminSection = () => {
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { setCurrentScreen } = useUI();

  // Render gate: must be authenticated AND match owner email.
  // Anyone else (anonymous, other accounts) sees nothing — section
  // doesn't exist for them.
  if (!isInitialized) return null;
  if (!isAuthenticated || !user) return null;
  const email = (user.email || '').toLowerCase().trim();
  if (email !== OWNER_EMAIL) return null;

  // No registered sandbox tools — hide the section entirely rather than
  // render an empty shell. It reappears when the next tool is added.
  if (SANDBOX_TOOLS.length === 0) return null;

  const handleOpen = (tool) => {
    if (tool.screen) {
      setCurrentScreen(tool.screen);
    } else if (tool.hash) {
      window.location.hash = tool.hash;
    }
  };

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 border border-amber-700/30"
      data-testid="settings-admin-section"
    >
      <div className="flex items-center gap-2 mb-1">
        <Beaker size={18} className="text-amber-400" />
        <h3 className="text-lg font-semibold text-gray-100">Admin / Sandbox</h3>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Owner-only tools. Build artifacts and design previews that aren't part
        of the regular product surface. Visible to {OWNER_EMAIL} only.
      </p>
      <div className="space-y-2">
        {SANDBOX_TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  );
};

export default AdminSection;
