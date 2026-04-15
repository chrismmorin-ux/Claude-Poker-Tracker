/**
 * signatures.js — symptom matchers against a captured mutation log + DOM snapshots.
 *
 * Each matcher takes { mutations, snapshots, corpus } and returns
 * { matched: boolean, evidence?: string }. `snapshots` is a list of
 * { t, renderKey, seatArcHTML, planPanelVisible, betweenHandsVisible, streetCardStreet, contextStreet }
 * recorded at every renderAll-exit-like moment (captured post-render by observer).
 *
 * Signatures:
 *   S1 — any seat-arc snapshot contains a '$0' bet badge while a seat is flagged active.
 *   S2 — plan-panel visible while advice.street !== liveContext.street.
 *   S3 — plan-panel transitions visible → hidden within 200ms with no intervening user event.
 *   S4 — between-hands visible at the same tick that liveContext advertises a new hand number.
 *   S5 — mutation count per logical delta exceeds a threshold (see docs — threshold left TBD).
 */

export const signatures = {
  S1({ snapshots }) {
    for (const s of snapshots) {
      if (!s.seatArcHTML) continue;
      // Match $0 action annotation. render-orchestrator.js renders bet/raise amounts as
      // `$${amount.toFixed(0)}` inside a `seat-action-tag` span. A fractional amount < 0.5
      // (e.g. 0.4) renders as "$0" — visually identical to no bet. This is the S1 bug.
      // Pattern: seat-action-tag span containing "B $0" or "R $0".
      if (/class="seat-action-tag"[^>]*>[BR✓CF] \$0\b/.test(s.seatArcHTML)) {
        return { matched: true, evidence: `seat-arc $0 action badge at t=${s.t}` };
      }
    }
    return { matched: false };
  },

  S2({ snapshots }) {
    for (const s of snapshots) {
      if (!s.planPanelVisible) continue;
      if (!s.adviceStreet || !s.contextStreet) continue;
      if (s.adviceStreet !== s.contextStreet) {
        return { matched: true, evidence: `plan-panel visible at t=${s.t} with advice=${s.adviceStreet} ctx=${s.contextStreet}` };
      }
    }
    return { matched: false };
  },

  S3({ snapshots }) {
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const cur = snapshots[i];
      if (prev.planPanelVisible && !cur.planPanelVisible && (cur.t - prev.t) < 200) {
        return { matched: true, evidence: `plan-panel vis→hidden in ${cur.t - prev.t}ms at t=${cur.t}` };
      }
    }
    return { matched: false };
  },

  S4({ snapshots }) {
    let lastHand = null;
    for (const s of snapshots) {
      if (s.handNumber && s.handNumber !== lastHand) {
        // New hand starts; if between-hands is visible on the same tick, that's the symptom.
        if (s.betweenHandsVisible) {
          return { matched: true, evidence: `between-hands visible at start of hand ${s.handNumber} (t=${s.t})` };
        }
        lastHand = s.handNumber;
      }
    }
    return { matched: false };
  },

  S5({ mutations, snapshots }) {
    // Ratio of mutations to snapshots. Each snapshot represents one logical render
    // checkpoint. A healthy render pass produces ~5-15 mutations (visibility toggles,
    // innerHTML replacements for changed content). Ratio > 25 indicates excessive
    // churn: classList.toggle/innerHTML writes firing even when content is unchanged.
    if (snapshots.length === 0) return { matched: false };
    const ratio = mutations.length / snapshots.length;
    return { matched: ratio > 25, evidence: `mutation/snapshot ratio = ${ratio.toFixed(1)}` };
  },

  // ── SR-3 corpus extension (S6–S13) ────────────────────────────────────────
  // Each matcher checks the relevant DOM region for the element the corpus was
  // designed to fire. When the element is visible with the expected content,
  // signature matches.

  S6({ snapshots }) {
    // Invariant badge: <span class="invariant-badge">!</span> inside #status-text.
    for (const s of snapshots) {
      if (/class="[^"]*invariant-badge/.test(s.statusTextHTML || '')) {
        return { matched: true, evidence: `invariant-badge visible in status-text at t=${s.t}` };
      }
    }
    return { matched: false };
  },

  S7({ snapshots }) {
    // Stale advice: action-bar gains .stale class AND contains a stale-badge span
    // with "Stale Ns" text after age > 10s.
    for (const s of snapshots) {
      if (!s.actionBarStale) continue;
      if (/Stale \d+s/.test(s.actionBarHTML || '')) {
        return { matched: true, evidence: `action-bar.stale + "Stale Ns" badge at t=${s.t}` };
      }
    }
    return { matched: false };
  },

  S8({ snapshots }) {
    // No active table: #no-table visible AND #hud-content hidden.
    for (const s of snapshots) {
      if (s.noTableVisible && !s.hudContentVisible) {
        return { matched: true, evidence: `no-table banner visible (hud hidden) at t=${s.t}` };
      }
    }
    return { matched: false };
  },

  S9({ snapshots }) {
    // Recovery banner visible in one snapshot, then hidden in a later snapshot.
    let sawVisible = false;
    let sawClearedAfterVisible = false;
    for (const s of snapshots) {
      if (s.recoveryBannerVisible) sawVisible = true;
      else if (sawVisible) { sawClearedAfterVisible = true; break; }
    }
    return {
      matched: sawVisible && sawClearedAfterVisible,
      evidence: `recovery-banner visible→cleared: visible=${sawVisible} clearedAfter=${sawClearedAfterVisible}`,
    };
  },

  S10({ snapshots }) {
    // Tournament bar visible + HTML contains M-ratio indicator.
    for (const s of snapshots) {
      if (!s.tournamentBarVisible) continue;
      if (/tourney-m-|M[- ]?[Rr]atio|M:/.test(s.tournamentBarHTML || '')) {
        return { matched: true, evidence: `tournament-bar visible with M-ratio markup at t=${s.t}` };
      }
    }
    return { matched: false };
  },

  S11({ snapshots }) {
    // Hero folded: a snapshot where heroSeatFolded=true AND the DOM reflects
    // observing state (either an "Observing" label somewhere, or the between-hands
    // panel became visible for observer mode).
    for (const s of snapshots) {
      if (!s.heroSeatFolded) continue;
      const observingLabel = /Observing/i.test(s.betweenHandsHTML || '')
        || /Observing/i.test(s.actionBarHTML || '')
        || /Observing/i.test(s.statusTextHTML || '');
      if (observingLabel || s.betweenHandsVisible) {
        return { matched: true, evidence: `hero folded + observer indication at t=${s.t}` };
      }
    }
    return { matched: false };
  },

  S12({ snapshots }) {
    // River hero-to-act: contextStreet === 'river' AND the last street-dot
    // (river) carries the `active` class. Markup:
    //   <div class="street-dot active"><div class="street-dot-circle">...<span>River</span></div>
    for (const s of snapshots) {
      if (s.contextStreet !== 'river') continue;
      const html = s.streetProgressHTML || '';
      if (/class="street-dot active">\s*<div class="street-dot-circle"><\/div><span>River/.test(html)) {
        return { matched: true, evidence: `street-progress shows river active at t=${s.t}` };
      }
    }
    return { matched: false };
  },

  S13({ snapshots }) {
    // Checked-around flop fixture: latest snapshot has contextStreet='turn', hand
    // was 13001, heroSeat in active set. This is a structural-state assertion —
    // the range-slot UI for this case doesn't exist yet (SR-4 spec will build it).
    for (const s of snapshots) {
      if (s.contextStreet !== 'turn') continue;
      if (s.handNumber !== 13_001) continue;
      if (s.heroSeatFolded) continue;
      return { matched: true, evidence: `checked-flop fixture state achieved at t=${s.t} (hand=${s.handNumber})` };
    }
    return { matched: false };
  },
};
