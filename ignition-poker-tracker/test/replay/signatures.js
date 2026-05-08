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

  // ── SR-cluster boundary-hardening corpus extension (S14–S19) ──────────────
  // Added 2026-05-07 (SPR-047 / WS-101). Each signature asserts the POST-FIX
  // observable — `matched: true` means the SPR-043/044/045 fix is in place.
  // If a regression breaks the fix, the post-fix observable disappears, the
  // signature returns matched: false, and the test fails with a clear delta.

  S14({ snapshots }) {
    // Post-fix observable (RT-45 + locked-hand gate, WS-105/WS-103): stale
    // advice replayed across hand boundary onto a coincidentally-matching
    // street is rejected. The FINAL snapshot is taken after the stale advice
    // re-injection — it must show plan-panel hidden despite contextStreet
    // matching the stale advice's street.
    const last = snapshots[snapshots.length - 1];
    if (!last) return { matched: false, evidence: 'no snapshots' };
    if (last.handNumber !== 14_002) {
      return { matched: false, evidence: `final hand=${last.handNumber}, expected 14002` };
    }
    if (last.contextStreet !== 'flop') {
      return { matched: false, evidence: `final ctx=${last.contextStreet}, expected flop (coincidental match)` };
    }
    if (last.planPanelVisible) {
      return { matched: false, evidence: `plan-panel visible at t=${last.t} — stale advice was promoted (RT-45 regressed!)` };
    }
    return {
      matched: true,
      evidence: `stale advice rejected at hand boundary; plan-panel hidden at t=${last.t} despite coincidental street match`,
    };
  },

  S15({ snapshots }) {
    // Post-fix observable (RT-45 + R-8.1, WS-105/WS-103): SW reanimation
    // bundle (cached advice from hand 15001) replayed onto hand 15002 PREFLOP
    // does NOT promote the stale advice. The FINAL snapshot must show
    // plan-panel hidden, hand=15002, contextStreet='preflop' — proving the
    // locked-hand gate rejected the bundled cross-hand replay.
    const last = snapshots[snapshots.length - 1];
    if (!last) return { matched: false, evidence: 'no snapshots' };
    if (last.handNumber !== 15_002) {
      return { matched: false, evidence: `final hand=${last.handNumber}, expected 15002` };
    }
    if (last.contextStreet !== 'preflop') {
      return { matched: false, evidence: `final ctx=${last.contextStreet}, expected preflop` };
    }
    if (last.planPanelVisible) {
      return { matched: false, evidence: `plan-panel visible at t=${last.t} — SW-reanimated stale advice promoted (RT-45/R-8.1 regressed!)` };
    }
    return {
      matched: true,
      evidence: `SW-reanimate bundle rejected; plan-panel hidden at t=${last.t} on hand 15002 PREFLOP`,
    };
  },

  S16({ snapshots }) {
    // Post-fix observable (WS-104 synchronous timer + WS-102 pendingActive
    // debounce): handNew within the 80ms coalesce window does NOT cause
    // plan-panel oscillation, AND the final settled state is correct.
    //
    // Check 1: planPanelVisible flips at most ONCE across the snapshot
    //   sequence (visible → hidden on hand boundary; never back to visible).
    // Check 2: final snapshot — hand 16002, contextStreet 'preflop',
    //   plan-panel hidden (advice correctly cleared on hand boundary).
    let flipCount = 0;
    let prev = null;
    for (const s of snapshots) {
      if (prev != null && s.planPanelVisible !== prev) flipCount += 1;
      prev = s.planPanelVisible;
    }
    if (flipCount > 1) {
      return {
        matched: false,
        evidence: `plan-panel oscillated: ${flipCount} flips across ${snapshots.length} snapshots (WS-102/WS-104 regressed?)`,
      };
    }
    const last = snapshots[snapshots.length - 1];
    if (!last) return { matched: false, evidence: 'no snapshots' };
    if (last.handNumber !== 16_002) {
      return { matched: false, evidence: `final hand=${last.handNumber}, expected 16002` };
    }
    if (last.contextStreet !== 'preflop') {
      return { matched: false, evidence: `final ctx=${last.contextStreet}, expected preflop` };
    }
    if (last.planPanelVisible) {
      return { matched: false, evidence: `plan-panel stuck visible at t=${last.t} (advice not cleared on hand boundary)` };
    }
    return {
      matched: true,
      evidence: `${flipCount} flip(s) total; settled state correct at t=${last.t} (hand 16002 PREFLOP, plan hidden)`,
    };
  },

  S18({ snapshots }) {
    // Post-fix observable (R-5.6 FSM-output exclusivity, WS-102 + WS-104):
    // during a rapid villain-action transition (donk→cbet), the plan-panel
    // does not oscillate AND the final snapshot has advice/context coupled
    // (same street; no S2-style decoupling left).
    let flipCount = 0;
    let prev = null;
    for (const s of snapshots) {
      if (prev != null && s.planPanelVisible !== prev) flipCount += 1;
      prev = s.planPanelVisible;
    }
    if (flipCount > 1) {
      return {
        matched: false,
        evidence: `plan-panel oscillated: ${flipCount} flips (R-5.6 FSM/raw-state decoupling regressed?)`,
      };
    }
    const last = snapshots[snapshots.length - 1];
    if (!last) return { matched: false, evidence: 'no snapshots' };
    if (!last.adviceStreet || !last.contextStreet) {
      return { matched: false, evidence: `final incomplete: advice=${last.adviceStreet} ctx=${last.contextStreet}` };
    }
    if (last.adviceStreet !== last.contextStreet) {
      return { matched: false, evidence: `advice/context decoupled at t=${last.t}: advice=${last.adviceStreet} ctx=${last.contextStreet}` };
    }
    return {
      matched: true,
      evidence: `${flipCount} flip(s); final advice=${last.adviceStreet} ctx=${last.contextStreet} coupled at t=${last.t}`,
    };
  },

  S19({ snapshots }) {
    // Post-fix observable (R-8.1 state-clear symmetry, RT-60 timer discipline,
    // WS-104): after a table switch during a stale-advice fade, the new
    // table's snapshot has zero residual state from the prior table:
    //   - action-bar NOT stale,
    //   - no "Stale Ns" badge HTML,
    //   - plan-panel hidden (lastGoodAdvice cleared),
    //   - handNumber advanced (state actually transitioned).
    const last = snapshots[snapshots.length - 1];
    if (!last) return { matched: false, evidence: 'no snapshots' };
    if (last.actionBarStale) {
      return { matched: false, evidence: `action-bar stuck stale at t=${last.t} (R-8.1 regressed!)` };
    }
    if (/Stale \d+s/.test(last.actionBarHTML || '')) {
      return { matched: false, evidence: `stale-badge HTML residue at t=${last.t} (timer/clear race regressed)` };
    }
    if (last.planPanelVisible) {
      return { matched: false, evidence: `plan-panel stuck visible at t=${last.t} (lastGoodAdvice not cleared on table switch)` };
    }
    if (last.handNumber === 19_001) {
      return { matched: false, evidence: `still showing prior table's hand at t=${last.t}` };
    }
    return {
      matched: true,
      evidence: `post-table-switch state cleared at t=${last.t}: action-bar fresh, no badge residue, plan-panel hidden, hand=${last.handNumber}`,
    };
  },

  S17({ snapshots }) {
    // Post-fix observable (R-7.2 pre-dispatch invariant gate, WS-103/WS-105):
    // when push_action_advice arrives WITHOUT a companion push_live_context,
    // plan-panel must remain hidden. We scan for a snapshot where adviceStreet
    // is set (proving advice was injected) AND contextStreet is null AND
    // planPanelVisible is false. If a future regression promotes advice
    // without context, planPanelVisible flips to true and the match fails.
    for (const s of snapshots) {
      if (!s.adviceStreet) continue;
      if (s.contextStreet) continue;
      if (s.planPanelVisible) continue;
      return {
        matched: true,
        evidence: `advice without context held at t=${s.t} (adviceStreet=${s.adviceStreet}, planPanel hidden)`,
      };
    }
    return { matched: false, evidence: 'no snapshot found with advice-set + context-null + plan-panel-hidden' };
  },
};
