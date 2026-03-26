/**
 * ObservationPanel — Decision-organized villain observations display
 *
 * Groups observations by hero decision context (P2: "When they limp",
 * F1: "Your c-bet decision", etc.) with tier badges and evidence lines.
 *
 * Props:
 *   observations: Array of observation objects from villainObservations.js
 *   style: 'inline' (OnlineView) or 'tailwind' (AnalysisView) — defaults to 'inline'
 */

import { HERO_CONTEXTS } from '../../utils/exploitEngine/villainObservations';

const TIER_COLORS = {
  solid:      { bg: '#166534', text: '#86efac', border: '#22c55e' },
  developing: { bg: '#854d0e', text: '#fde047', border: '#eab308' },
  early:      { bg: '#9a3412', text: '#fdba74', border: '#f97316' },
  none:       { bg: '#374151', text: '#9ca3af', border: '#6b7280' },
};

export const ObservationPanel = ({ observations, style: displayStyle = 'inline' }) => {
  if (!observations || observations.length === 0) return null;

  // Group by heroContext
  const groups = {};
  for (const obs of observations) {
    const ctx = obs.heroContext;
    if (!groups[ctx]) groups[ctx] = [];
    groups[ctx].push(obs);
  }

  // Sort groups by HERO_CONTEXTS sortOrder
  const sortedContexts = Object.keys(groups).sort((a, b) => {
    const sa = HERO_CONTEXTS[a]?.sortOrder ?? 99;
    const sb = HERO_CONTEXTS[b]?.sortOrder ?? 99;
    return sa - sb;
  });

  return (
    <div style={{ marginBottom: 10 }}>
      <h4 style={{
        fontSize: 11, color: '#d4a847', marginBottom: 8,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        Observations ({observations.length})
      </h4>

      {sortedContexts.map(ctx => {
        const contextInfo = HERO_CONTEXTS[ctx] || { label: ctx };
        const contextObs = groups[ctx];

        return (
          <div key={ctx} style={{ marginBottom: 8 }}>
            {/* Context header */}
            <div style={{
              fontSize: 10, color: '#9ca3af', fontWeight: 'bold',
              textTransform: 'uppercase', letterSpacing: 0.5,
              marginBottom: 4, paddingLeft: 2,
            }}>
              {contextInfo.label}
            </div>

            {/* Observation cards */}
            {contextObs.map(obs => {
              const tierColor = TIER_COLORS[obs.tier] || TIER_COLORS.none;

              return (
                <div key={obs.id} style={{
                  padding: '5px 8px', marginBottom: 3, borderRadius: 4,
                  background: '#0d1117',
                  borderLeft: `2px solid ${tierColor.border}`,
                }}>
                  {/* Signal + tier badge */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 6,
                  }}>
                    <span style={{ fontSize: 11, color: '#e0e0e0', flex: 1 }}>
                      {obs.signal}
                    </span>
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: tierColor.bg, color: tierColor.text,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {obs.tier}
                    </span>
                  </div>

                  {/* Evidence line */}
                  {obs.evidence && (
                    <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                      {typeof obs.evidence.observed === 'number' && typeof obs.evidence.baseline === 'number'
                        ? `observed ${obs.evidence.observed}% vs baseline ${obs.evidence.baseline}%`
                        : typeof obs.evidence.observed === 'string'
                          ? obs.evidence.observed
                          : `${obs.evidence.sampleSize} observations`
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default ObservationPanel;
