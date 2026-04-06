/**
 * render-street-card.js — Street-adaptive content card for the side panel.
 *
 * Content automatically changes based on currentStreet:
 * - preflop: hand plan, archetype breakdown, villain preflop stats, blocker insight
 * - flop: fold%, fold curve mini, blocker, range advantage, hand plan, range breakdown
 * - turn: fold%, range narrowing, barrel/check decision
 * - river: value/bluff classification, multi-sizing fold%, final range
 * - between: villain scouting, last hand result, tournament snapshot
 *
 * All functions are pure — state is passed as parameters, not read from closures.
 */

import { $, escapeHtml } from './render-utils.js';
import { STYLE_COLORS as _STYLE_COLORS } from '../shared/stats-engine.js';
import { renderRangeGrid } from './render-range-grid.js';
import { getPositionName } from './range-grid-data.js';

// =========================================================================
// MAIN DISPATCHER
// =========================================================================

// Module-level state for street transitions
let _prevStreet = null;
let _transitionTimer = null;

/** Reset module state for test harness temporal replay. */
export const resetStreetCardState = () => {
  if (_transitionTimer) { clearTimeout(_transitionTimer); _transitionTimer = null; }
  _prevStreet = null;
};

/**
 * Render the street-adaptive content card.
 * @param {string|null} street - 'preflop'|'flop'|'turn'|'river'|null
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @param {Object|null} liveContext - Current live hand state
 * @param {Object} appSeatData - Per-seat data from exploit pushes
 * @param {number|null} focusedVillain - Currently focused villain seat
 * @param {Object|null} tournament - Tournament data (for between-hands)
 * @param {Object} [opts] - Options: { loading: boolean }
 */
export const renderStreetCard = (street, advice, liveContext, appSeatData, focusedVillain, tournament, { loading = false } = {}) => {
  const card = $('street-card');
  if (!card) return;

  const isLive = liveContext && liveContext.state &&
    liveContext.state !== 'IDLE' && liveContext.state !== 'COMPLETE';

  // Between-hands guard: don't flash between-hands content when a new hand is
  // starting (DEALING/PREFLOP) — keep current content until advice arrives
  if (!isLive && !advice) {
    const pendingNewHand = liveContext && (liveContext.state === 'DEALING' || liveContext.state === 'PREFLOP');
    if (pendingNewHand && card.innerHTML) {
      // Keep existing content visible; loading shimmer shows via CSS class
      card.classList.toggle('loading-advice', true);
      return;
    }
    const betweenHtml = renderBetweenHandsContent(appSeatData, focusedVillain, tournament, liveContext);
    if (betweenHtml || !card.innerHTML) {
      if (card.innerHTML !== betweenHtml) { // change detection
        card.innerHTML = betweenHtml;
      }
    }
    _prevStreet = null;
    card.classList.remove('loading-advice');
    return;
  }

  // Live but no advice yet (e.g. DEALING/PREFLOP before engine responds):
  // hold existing visual content and show shimmer — prevents empty/stale flash
  if (isLive && !advice && loading && card.innerHTML) {
    card.classList.toggle('loading-advice', true);
    return;
  }

  // Determine effective street
  const effectiveStreet = street || advice?.currentStreet || detectStreetFromCards(liveContext);

  // Build: compact overhead + unified street content (fixed section order)
  let html = '';
  html += renderActivePlayers(liveContext, appSeatData); // multiway only (hidden in HU)
  html += renderCompactTimeline(liveContext, effectiveStreet);
  html += renderUnifiedStreetContent(effectiveStreet, advice, liveContext, appSeatData, focusedVillain);

  // Loading indicator (shimmer bar via CSS when advice is pending)
  card.classList.toggle('loading-advice', loading);

  // Change detection — skip DOM write if content is identical
  if (card.innerHTML === html) {
    _prevStreet = effectiveStreet;
    return;
  }

  // Street transition: cross-fade when street changes (e.g. preflop→flop)
  const streetChanged = effectiveStreet !== _prevStreet && _prevStreet !== null;
  _prevStreet = effectiveStreet;

  if (streetChanged) {
    // Cancel any in-flight transition
    if (_transitionTimer) { clearTimeout(_transitionTimer); _transitionTimer = null; }

    // Lock height to prevent layout jump during fade
    const currentHeight = card.offsetHeight;
    card.style.minHeight = currentHeight + 'px';

    // Fade out
    card.classList.add('transitioning');
    card.classList.remove('fade-in');

    _transitionTimer = setTimeout(() => {
      _transitionTimer = null;
      // Swap content while invisible
      card.innerHTML = html;
      // Fade in
      card.classList.remove('transitioning');
      card.classList.add('fade-in');
      // Release height lock smoothly
      requestAnimationFrame(() => {
        card.style.transition = 'min-height 0.2s ease';
        card.style.minHeight = '';
        setTimeout(() => { card.style.transition = ''; }, 250);
      });
      // Clean up fade-in class
      card.addEventListener('animationend', () => {
        card.classList.remove('fade-in');
      }, { once: true });
    }, 150); // matches .transitioning opacity transition
    return;
  }

  // Same-street update: instant swap (already guarded by change detection above)
  card.innerHTML = html;
};

// =========================================================================
// STREET DETECTION
// =========================================================================

const detectStreetFromCards = (liveContext) => {
  if (!liveContext?.communityCards) return 'preflop';
  const visible = liveContext.communityCards.filter(c => c && c !== '');
  if (visible.length >= 5) return 'river';
  if (visible.length >= 4) return 'turn';
  if (visible.length >= 3) return 'flop';
  return 'preflop';
};

// =========================================================================
// SHARED SUB-RENDERERS
// =========================================================================

const renderSectionLabel = (text) =>
  `<div class="sc-section-label">${escapeHtml(text)}</div>`;

// ── Villain context header: tells hero WHO the analysis data is about ──

// Build lowercase-key lookup from canonical STYLE_COLORS (stats-engine.js)
const STYLE_COLORS = Object.fromEntries(
  Object.entries(_STYLE_COLORS).map(([k, v]) => [k.toLowerCase(), v])
);

const renderVillainContextHeader = (advice, liveContext, appSeatData, focusedVillain) => {
  // Show focused villain (respects pin), with note if advice targets a different seat
  const villainSeat = focusedVillain || advice?.villainSeat;
  const heroSeat = liveContext?.heroSeat;
  if (!villainSeat || villainSeat === heroSeat) return '';

  const adviceSeat = advice?.villainSeat || null;
  const adviceTargetsDifferent = adviceSeat && adviceSeat !== villainSeat;

  const app = appSeatData?.[villainSeat];
  // When focused villain matches advice, use advice data; otherwise use app data
  const style = (!adviceTargetsDifferent ? advice?.villainStyle : null) || app?.style || null;
  const sample = (!adviceTargetsDifferent ? advice?.villainSampleSize : null) || app?.sampleSize || 0;
  const headline = (!adviceTargetsDifferent ? advice?.villainProfile?.headline : null) || app?.villainHeadline || null;
  const styleLower = (style || 'unknown').toLowerCase();
  const colors = STYLE_COLORS[styleLower] || STYLE_COLORS.unknown;

  // Count active opponents to indicate if this is heads-up or multiway
  const foldedSeats = new Set(liveContext?.foldedSeats || []);
  const activeOpponents = (liveContext?.activeSeatNumbers || [])
    .filter(s => s !== heroSeat && !foldedSeats.has(s));
  const isMultiway = activeOpponents.length > 1;

  let html = `<div style="display:flex;align-items:center;gap:6px;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid var(--border-default)">`;
  html += `<span style="font-size:8px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.5px">${isMultiway ? 'Villain' : 'vs'}</span>`;
  html += `<span style="font-weight:700;color:var(--gold);font-size:var(--font-md)">S${villainSeat}</span>`;
  if (style) {
    html += `<span style="font-size:8px;font-weight:bold;padding:1px 4px;border-radius:3px;background:${colors.bg};color:${colors.text}">${escapeHtml(style)}</span>`;
  }
  if (sample > 0) {
    html += `<span style="font-family:Consolas,monospace;font-size:8px;color:var(--text-faint)">${sample}h</span>`;
  }
  if (isMultiway) {
    html += `<span style="font-size:8px;color:var(--text-faint);margin-left:auto">${activeOpponents.length} opponents</span>`;
  }
  html += `</div>`;

  // Headline below context bar
  if (headline) {
    html += `<div style="font-size:var(--font-sm);color:var(--text-secondary);font-style:italic;margin-bottom:6px;line-height:1.3">${escapeHtml(headline)}</div>`;
  }

  // Disambiguation note when advice data is computed for a different seat
  if (adviceTargetsDifferent) {
    html += `<div style="font-size:9px;color:var(--text-muted);padding:2px 6px;margin-bottom:6px;border-radius:3px;background:var(--surface-inset)">Advice computed vs S${adviceSeat}</div>`;
  }

  return html;
};

// ── Active players strip: shows key stats for all players in the hand ──

const renderActivePlayers = (liveContext, appSeatData) => {
  if (!liveContext) return '';

  const heroSeat = liveContext.heroSeat;
  const foldedSeats = new Set(liveContext.foldedSeats || []);
  const activeSeats = (liveContext.activeSeatNumbers || [])
    .filter(s => s !== heroSeat && !foldedSeats.has(s))
    .sort((a, b) => a - b);

  if (activeSeats.length <= 1) return ''; // Hide in HU — only show when multiway

  const MAX_SHOWN = 4;
  const shown = activeSeats.slice(0, MAX_SHOWN);
  const overflow = activeSeats.length - MAX_SHOWN;

  let html = `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">`;

  for (const seat of shown) {
    const app = appSeatData?.[seat];
    const style = app?.style || null;
    const styleLower = (style || 'unknown').toLowerCase();
    const colors = STYLE_COLORS[styleLower] || STYLE_COLORS.unknown;
    const sample = app?.sampleSize || 0;
    const stats = app?.stats || null;

    html += `<div style="display:flex;align-items:center;gap:3px;padding:2px 6px;background:var(--surface-inset);border-radius:4px;border:1px solid var(--border-default);font-size:9px">`;
    html += `<span style="font-weight:700;color:var(--text-primary)">S${seat}</span>`;
    if (style) {
      html += `<span style="font-size:7px;font-weight:bold;padding:0 3px;border-radius:2px;background:${colors.bg};color:${colors.text}">${escapeHtml(style)}</span>`;
    }
    if (sample > 0) {
      html += `<span style="color:var(--text-faint)">${sample}h</span>`;
    }
    // Show key stat if available
    if (stats?.cbet != null) {
      html += `<span style="color:var(--text-muted)">CB:${stats.cbet}%</span>`;
    } else if (stats?.foldToCbet != null) {
      html += `<span style="color:var(--text-muted)">FCB:${stats.foldToCbet}%</span>`;
    }
    html += `</div>`;
  }

  if (overflow > 0) {
    html += `<span style="font-size:9px;color:var(--text-faint);align-self:center">+${overflow} more</span>`;
  }

  html += `</div>`;
  return html;
};

// ── Action timeline: compact hand history ──

const ACTION_COLORS = {
  fold: 'var(--action-fold-text)',
  check: 'var(--action-check-text)',
  call: 'var(--action-call-text)',
  bet: 'var(--action-bet-text)',
  raise: 'var(--action-raise-text)',
  won: 'var(--m-green)',
};

const ACTION_LABELS = {
  fold: 'F', check: '\u2713', call: 'C', bet: 'B', raise: 'R', won: 'W',
};

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];

const renderActionTimeline = (liveContext) => {
  const actions = liveContext?.actionSequence;
  if (!actions || actions.length === 0) return '';

  // Group actions by street
  const byStreet = {};
  for (const a of actions) {
    const st = a.street || 'preflop';
    if (!byStreet[st]) byStreet[st] = [];
    byStreet[st].push(a);
  }

  const heroSeat = liveContext?.heroSeat;
  let html = `<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border-default)">`;

  for (const st of STREET_ORDER) {
    const streetActions = byStreet[st];
    if (!streetActions || streetActions.length === 0) continue;

    // Street label
    const stLabel = st === 'preflop' ? 'Pre' : st.charAt(0).toUpperCase() + st.slice(1);
    html += `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;flex-wrap:wrap">`;
    html += `<span style="font-size:7px;font-weight:700;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.5px;min-width:24px">${stLabel}</span>`;

    // Action chips
    for (const a of streetActions) {
      const label = ACTION_LABELS[a.action] || '?';
      const color = ACTION_COLORS[a.action] || 'var(--text-faint)';
      const isHeroAction = a.seat === heroSeat;
      const amt = a.amount > 0 ? `$${a.amount < 1 ? a.amount.toFixed(2) : a.amount.toFixed(0)}` : '';
      const border = isHeroAction ? ';border:1px solid var(--gold-dim)' : '';
      const fullAction = a.action.charAt(0).toUpperCase() + a.action.slice(1);
      html += `<span style="font-family:Consolas,monospace;font-size:8px;font-weight:600;color:${color};padding:0 2px;border-radius:2px;background:var(--surface-inset)${border}" title="Seat ${a.seat} ${fullAction}${amt ? ' ' + amt : ''}">`;
      html += `S${a.seat}${label}`;
      if (amt) html += `<span style="font-size:7px;opacity:0.7">${amt}</span>`;
      html += `</span>`;
    }

    html += `</div>`;
  }

  html += `</div>`;
  return html;
};

/**
 * Compact action timeline — shows only current street actions inline,
 * with past streets collapsed to count chips.
 */
const renderCompactTimeline = (liveContext, currentStreet) => {
  const actions = liveContext?.actionSequence;
  if (!actions || actions.length === 0) return '';

  const byStreet = {};
  for (const a of actions) {
    const st = a.street || 'preflop';
    if (!byStreet[st]) byStreet[st] = [];
    byStreet[st].push(a);
  }

  const heroSeat = liveContext?.heroSeat;
  let html = `<div style="display:flex;align-items:center;gap:3px;margin-bottom:6px;flex-wrap:wrap;padding-bottom:4px;border-bottom:1px solid var(--border-default)">`;

  for (const st of STREET_ORDER) {
    const streetActions = byStreet[st];
    if (!streetActions || streetActions.length === 0) continue;

    const stLabel = st === 'preflop' ? 'Pre' : st.charAt(0).toUpperCase() + st.slice(1);
    const isCurrent = st === currentStreet;

    if (!isCurrent) {
      // Past street: collapsed count chip
      html += `<span style="font-size:7px;font-weight:700;color:var(--text-faint);padding:1px 3px;background:var(--surface-inset);border-radius:2px" title="${streetActions.length} actions">${stLabel} ${streetActions.length}</span>`;
    } else {
      // Current street: show action chips
      html += `<span style="font-size:7px;font-weight:700;color:var(--gold-dim);text-transform:uppercase;letter-spacing:0.5px">${stLabel}</span>`;
      for (const a of streetActions) {
        const label = ACTION_LABELS[a.action] || '?';
        const color = ACTION_COLORS[a.action] || 'var(--text-faint)';
        const isHeroAction = a.seat === heroSeat;
        const amt = a.amount > 0 ? `$${a.amount < 1 ? a.amount.toFixed(2) : a.amount.toFixed(0)}` : '';
        const border = isHeroAction ? ';border:1px solid var(--gold-dim)' : '';
        const fullAction = a.action.charAt(0).toUpperCase() + a.action.slice(1);
        html += `<span style="font-family:Consolas,monospace;font-size:8px;font-weight:600;color:${color};padding:0 2px;border-radius:2px;background:var(--surface-inset)${border}" title="Seat ${a.seat} ${fullAction}${amt ? ' ' + amt : ''}">`;
        html += `S${a.seat}${label}`;
        if (amt) html += `<span style="font-size:7px;opacity:0.7">${amt}</span>`;
        html += `</span>`;
      }
    }
  }

  html += `</div>`;
  return html;
};

const renderHandPlanTree = (plan) => {
  if (!plan) return '';
  const branches = [];
  if (plan.ifCall?.note) {
    branches.push({ label: 'CALL', cls: 'call', note: plan.ifCall.note,
      favorable: plan.ifCall.favorableRunouts, total: plan.ifCall.totalRunouts,
      scaryCards: plan.ifCall.scaryCards });
  }
  if (plan.ifRaise?.note) {
    branches.push({ label: 'RAISE', cls: 'raise', note: plan.ifRaise.note });
  }
  if (plan.ifBet?.note) {
    branches.push({ label: 'V BETS', cls: 'raise', note: plan.ifBet.note });
  }
  if (branches.length === 0) return '';

  let html = `<div class="street-card-section">${renderSectionLabel('Hand Plan')}`;
  for (const b of branches) {
    html += `<div class="plan-branch ${b.cls}">`;
    html += `<div class="plan-trigger">If <span class="action-word ${b.cls}">${b.label}</span> \u2192</div>`;
    html += `<div class="plan-note">${escapeHtml(b.note)}</div>`;
    if (b.favorable && b.total) {
      const goodPct = Math.round(b.favorable / b.total * 100);
      html += `<div class="runout-bar-wrap">
        <div class="runout-bar">
          <div class="runout-fill good" style="width:${goodPct}%"></div>
          <div class="runout-fill bad" style="width:${100 - goodPct}%"></div>
        </div>
        <span class="runout-label">${b.favorable}/${b.total}</span>
      </div>`;
    }
    if (b.scaryCards?.length > 0) {
      html += `<div style="font-size:9px;color:var(--m-yellow);margin-top:2px">Scary: ${escapeHtml(b.scaryCards.join(', '))}</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
};

const renderBlockerInsight = (tm, liveContext, villainSeat) => {
  const be = tm?.blockerEffects;
  if (!be) return '';
  // Find the bucket with strongest blocker effect
  let bestBucket = null, bestEffect = 0;
  for (const [bucket, effect] of Object.entries(be)) {
    if (typeof effect === 'number' && effect < bestEffect) {
      bestBucket = bucket; bestEffect = effect;
    }
  }
  if (!bestBucket || bestEffect > -0.03) return '';
  const hero = liveContext?.holeCards?.filter(c => c && c !== '') || [];
  const cardLabel = hero.length > 0 ? hero.join(' ') : 'Your hand';
  const pctStr = Math.round(Math.abs(bestEffect) * 100);
  const vsLabel = villainSeat ? `S${villainSeat}'s` : 'villain';
  return `<div class="street-card-section">
    <div class="insight-strip">
      <span class="insight-icon">\u25C6</span>
      <span>${escapeHtml(cardLabel)} blocks ${vsLabel} <span class="insight-highlight">${escapeHtml(bestBucket)}</span> range
      <span class="insight-highlight">\u2212${pctStr}%</span></span>
    </div>
  </div>`;
};

const renderRangeAdvantage = (tm, villainSeat) => {
  const adv = tm?.advantage;
  if (adv?.rangeAdvantage == null) return '';
  const heroPct = Math.round((0.5 + adv.rangeAdvantage / 2) * 100);
  const villainPct = 100 - heroPct;
  const label = villainSeat ? `Range vs S${villainSeat}` : 'Range Advantage';
  return `<div class="street-card-section">
    ${renderSectionLabel(label)}
    <div class="range-adv">
      <div class="adv-bar-wrap">
        <div class="adv-fill hero" style="width:${heroPct}%"></div>
        <div class="adv-fill villain" style="width:${villainPct}%"></div>
      </div>
      <div class="adv-labels">
        <span class="hero-side">Hero ${heroPct}%</span>
        <span class="villain-side">Villain ${villainPct}%</span>
      </div>
    </div>
  </div>`;
};

const renderFoldPctSection = (advice) => {
  if (!advice?.foldPct && !advice?.foldMeta) return '';
  const foldPct = advice.foldPct?.bet != null ? advice.foldPct.bet
    : advice.foldMeta?.foldPct != null ? advice.foldMeta.foldPct
    : null;
  if (foldPct == null) return '';

  const vSeat = advice.villainSeat;
  const label = vSeat ? `S${vSeat} Fold %` : 'Fold %';
  const pctDisplay = Math.round(foldPct * 100);
  let html = `<div class="street-card-section">
    ${renderSectionLabel(label)}
    <div class="fold-pct-display">
      <span class="fold-pct-value">${pctDisplay}%</span>
      <span class="fold-pct-label">fold to bet</span>`;

  // Mini fold curve (if curve data available)
  const curve = advice.foldMeta?.curve;
  if (curve && curve.length >= 2) {
    const W = 120, H = 30;
    const minS = curve[0].sizing, maxS = curve[curve.length - 1].sizing;
    if (maxS > minS) {
      const toX = (s) => (s - minS) / (maxS - minS) * W;
      const toY = (f) => H - f * H;
      let pathD = `M${toX(curve[0].sizing).toFixed(1)},${toY(curve[0].foldPct).toFixed(1)}`;
      for (let i = 1; i < curve.length; i++) {
        pathD += ` L${toX(curve[i].sizing).toFixed(1)},${toY(curve[i].foldPct).toFixed(1)}`;
      }
      html += `<div class="fold-curve-mini">
        <svg viewBox="0 0 ${W} ${H}" fill="none" preserveAspectRatio="none">
          <path d="${pathD}" stroke="var(--gold)" stroke-width="1.5" fill="none"/>
        </svg>
      </div>`;
    }
  }

  html += `</div></div>`;
  return html;
};

const renderTopVulnerability = (vp, villainSeat) => {
  const topVuln = vp?.vulnerabilities?.[0];
  if (!topVuln) return '';
  const sev = topVuln.severity >= 0.7 ? 'high' : topVuln.severity >= 0.4 ? 'medium' : 'low';
  const seatPrefix = villainSeat ? `S${villainSeat}: ` : '';
  return `<div class="street-card-section">
    <div class="vuln-callout">
      <div class="vuln-dot ${sev}"></div>
      <div class="vuln-text">${seatPrefix}${escapeHtml(topVuln.label || '')}${topVuln.exploitHint ? ' \u2014 ' + escapeHtml(topVuln.exploitHint) : ''}</div>
    </div>
  </div>`;
};

// Range breakdown removed from street card — lives in deep expander only

const renderReasoningNote = (advice) => {
  if (!advice?.recommendations?.[0]?.reasoning) return '';
  const reason = advice.recommendations[0].reasoning;
  const short = reason.length > 80 ? reason.substring(0, 80) + '\u2026' : reason;
  return `<div style="font-size:var(--font-sm);color:var(--text-secondary);line-height:1.3;padding:4px 6px;background:var(--surface-inset);border-radius:var(--radius-md);border-left:2px solid var(--gold);margin-bottom:6px">${escapeHtml(short)}</div>`;
};

// =========================================================================
// PREFLOP CONTENT
// =========================================================================

const renderPreflopContent = (advice, liveContext, appSeatData, focusedVillain) => {
  let html = '';

  // Preflop range grid (renders immediately from liveContext, before advice arrives)
  const heroPos = getPositionName(liveContext?.heroSeat, liveContext?.dealerSeat);
  html += renderRangeGrid({
    position: heroPos,
    holeCards: liveContext?.holeCards,
    situation: advice?.situation || null,
  });

  // Reasoning note
  html += renderReasoningNote(advice);

  // Hand plan tree
  if (advice?.recommendations?.[0]?.handPlan) {
    html += renderHandPlanTree(advice.recommendations[0].handPlan);
  }

  // Flop archetype breakdown (from flopBreakdown if available)
  const fb = advice?.flopBreakdown || advice?.recommendations?.[0]?.flopBreakdown;
  if (fb && Array.isArray(fb) && fb.length > 0) {
    html += `<div class="street-card-section">${renderSectionLabel('Flop Outcome Probabilities')}`;
    const ARCH_COLORS = {
      set: '#22c55e', overpair: '#3b82f6', top_pair: '#60a5fa',
      second_pair: '#a78bfa', flush_draw: '#06b6d4', overcards: '#eab308', miss: '#6b7280',
    };
    for (const arch of fb) {
      const pct = Math.round((arch.probability || 0) * 100);
      if (pct < 1) continue;
      const color = ARCH_COLORS[arch.archetype] || '#6b7280';
      const name = (arch.archetype || '').replace(/_/g, ' ');
      html += `<div class="archetype-row">
        <span class="archetype-name">${escapeHtml(name)}</span>
        <div class="archetype-bar-track">
          <div class="archetype-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="archetype-pct">${pct}%</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Villain preflop tendencies
  const villainData = focusedVillain ? appSeatData?.[focusedVillain] : null;
  if (villainData) {
    const vp = villainData.villainProfile;
    const vpStats = vp?.streets?.preflop;
    const stats = villainData.stats;
    if (vpStats?.tendency || stats) {
      html += `<div class="street-card-section">${renderSectionLabel('Villain Preflop')}`;
      if (vpStats?.tendency) {
        html += `<div style="font-size:var(--font-base);color:var(--text-secondary);margin-bottom:4px;font-style:italic">${escapeHtml(vpStats.tendency)}</div>`;
      }
      if (stats) {
        const rows = [];
        if (stats.cbet != null) rows.push(['C-Bet', stats.cbet + '%']);
        if (stats.foldToCbet != null) rows.push(['F-CB', stats.foldToCbet + '%']);
        if (stats.threeBet != null) rows.push(['3-Bet', stats.threeBet + '%']);
        if (rows.length > 0) {
          html += `<div style="display:flex;gap:12px;font-size:var(--font-sm)">`;
          for (const [label, val] of rows) {
            html += `<span style="color:var(--text-muted)">${label}: <span style="color:var(--text-primary);font-weight:600">${val}</span></span>`;
          }
          html += `</div>`;
        }
      }
      html += `</div>`;
    }
  }

  // Blocker insight
  html += renderBlockerInsight(advice?.treeMetadata, liveContext, advice?.villainSeat);

  // Top vulnerability
  html += renderTopVulnerability(advice?.villainProfile, advice?.villainSeat);

  if (!html) {
    html = `<div style="color:var(--text-faint);text-align:center;padding:16px;font-size:var(--font-sm)">Waiting for action data\u2026</div>`;
  }

  return html;
};

// =========================================================================
// VILLAIN RANGE SECTION — Shows focused villain's Bayesian range grid
// =========================================================================

/**
 * Render multiway equity badge when facing multiple opponents.
 */
const renderMultiwayEquity = (multiwayEquity) => {
  if (!multiwayEquity?.equity) return '';
  const eq = Math.round(multiwayEquity.equity * 100);
  const color = eq >= 50 ? 'var(--green)' : eq >= 30 ? 'var(--gold)' : 'var(--red)';
  return `<div style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:var(--radius-md);background:var(--surface-inset);font-size:var(--font-xs)">
    <span style="color:var(--text-faint)">vs All</span>
    <span style="color:${color};font-weight:600">${eq}%</span>
  </div>`;
};

/**
 * Render villain range section with tab pills for multiway and focused grid.
 * Falls back to static GTO grid when no Bayesian range data available.
 */
const renderVillainRangeSection = (advice, liveContext, focusedVillain) => {
  const villainRanges = advice?.villainRanges;

  // No dynamic range data — fall back to static GTO grid on preflop
  if (!villainRanges || villainRanges.length === 0) {
    if (advice?.currentStreet === 'preflop' || !advice?.currentStreet) {
      const heroPos = getPositionName(liveContext?.heroSeat, liveContext?.dealerSeat);
      return renderRangeGrid({
        position: heroPos,
        holeCards: liveContext?.holeCards,
        situation: advice?.situation || null,
      });
    }
    return '';
  }

  let html = '';

  // Villain selector tabs (multiway: show pills for each active villain)
  if (villainRanges.length > 1) {
    html += `<div class="villain-range-tabs">`;
    for (const vr of villainRanges) {
      if (!vr.active) continue;
      const isFocused = vr.seat === focusedVillain || vr.seat === advice?.villainSeat;
      const eqStr = vr.equity != null ? ` ${Math.round(vr.equity * 100)}%` : '';
      html += `<button class="villain-tab${isFocused ? ' active' : ''}" data-range-seat="${vr.seat}">`;
      html += `S${vr.seat}${eqStr}`;
      html += `</button>`;
    }
    // Multiway equity badge
    html += renderMultiwayEquity(advice.multiwayEquity);
    html += `</div>`;
  }

  // Render focused villain's range grid
  const focused = villainRanges.find(vr => vr.seat === focusedVillain)
    || villainRanges.find(vr => vr.seat === advice?.villainSeat)
    || villainRanges[0];

  if (focused?.range?.length === 169) {
    const actionLabel = focused.actionKey
      ? focused.actionKey.charAt(0).toUpperCase() + focused.actionKey.slice(1)
      : '';
    const label = `S${focused.seat} · ${focused.position || '?'}${actionLabel ? ' · ' + actionLabel : ''}`;
    html += renderRangeGrid({
      range: focused.range,
      label,
      holeCards: liveContext?.holeCards,
      equity: focused.equity,
      rangeWidth: focused.rangeWidth,
    });
  }

  return html;
};

// =========================================================================
// UNIFIED STREET CONTENT — Fixed section order across all streets
// =========================================================================

/**
 * Render street-adaptive content in a FIXED canonical section order.
 * Hero's eyes always know where to look: reasoning → fold% → hand plan → blocker → range.
 *
 * @param {string} street - 'preflop'|'flop'|'turn'|'river'
 * @param {Object|null} advice
 * @param {Object|null} liveContext
 * @param {Object} appSeatData
 * @param {number|null} focusedVillain
 * @returns {string} HTML
 */
const renderUnifiedStreetContent = (street, advice, liveContext, appSeatData, focusedVillain) => {
  let html = '';

  // === Section 1: Villain range grid (all streets) ===
  html += renderVillainRangeSection(advice, liveContext, focusedVillain);

  // === Section 2: Reasoning note (all streets — "what to do and why") ===
  html += renderReasoningNote(advice);

  // === Section 3: Fold% or multi-sizing table (postflop only) ===
  if (street !== 'preflop') {
    // River: multi-sizing fold table; Flop/Turn: single fold%
    if (street === 'river') {
      html += renderMultiSizingTable(advice);
    } else {
      html += renderFoldPctSection(advice);
    }
  }

  // === Section 4: Hand plan tree (preflop/flop/turn; river only if branches exist) ===
  if (advice?.recommendations?.[0]?.handPlan) {
    html += renderHandPlanTree(advice.recommendations[0].handPlan);
  }

  // === Section 5: Blocker insight (any street, when relevant) ===
  html += renderBlockerInsight(advice?.treeMetadata, liveContext, advice?.villainSeat);

  // === Section 6: Range advantage (postflop only) ===
  if (street !== 'preflop') {
    html += renderRangeAdvantage(advice?.treeMetadata, advice?.villainSeat);
  }

  // === Section 7: Top vulnerability callout (any street, when relevant) ===
  html += renderTopVulnerability(advice?.villainProfile, advice?.villainSeat);

  // === Section 8: Preflop extras (flop breakdown, villain preflop stats) ===
  if (street === 'preflop') {
    html += renderPreflopExtras(advice, appSeatData, focusedVillain);
  }

  if (!html) {
    const streetLabel = street === 'preflop' ? 'action data' : street;
    html = `<div style="color:var(--text-faint);text-align:center;padding:16px;font-size:var(--font-sm)">Waiting for ${streetLabel}\u2026</div>`;
  }

  return html;
};

/**
 * River multi-sizing fold table (extracted for unified layout).
 */
const renderMultiSizingTable = (advice) => {
  const curve = advice?.foldMeta?.curve;
  if (curve && curve.length >= 2) {
    const foldLabel = advice?.villainSeat ? `S${advice.villainSeat} Fold % by Sizing` : 'Fold % by Sizing';
    let html = `<div class="street-card-section">${renderSectionLabel(foldLabel)}`;
    html += `<div class="fold-sizing-table">`;
    for (const pt of curve) {
      const sizingLabel = `${Math.round(pt.sizing * 100)}%`;
      const foldPct = Math.round(pt.foldPct * 100);
      const color = foldPct >= 50 ? 'var(--m-green)' : foldPct >= 30 ? 'var(--m-yellow)' : 'var(--m-red)';
      html += `<div class="fold-sizing-row">
        <span class="fold-sizing-label">${sizingLabel} pot</span>
        <div class="fold-sizing-bar-track">
          <div class="fold-sizing-bar-fill" style="width:${foldPct}%;background:${color}"></div>
        </div>
        <span class="fold-sizing-pct" style="color:${color}">${foldPct}%</span>
      </div>`;
    }
    html += `</div></div>`;
    return html;
  }
  // Fallback: single fold %
  return renderFoldPctSection(advice);
};

/**
 * Preflop-specific extras (flop archetype breakdown + villain preflop tendencies).
 */
const renderPreflopExtras = (advice, appSeatData, focusedVillain) => {
  let html = '';

  // Flop archetype breakdown
  const fb = advice?.flopBreakdown || advice?.recommendations?.[0]?.flopBreakdown;
  if (fb && Array.isArray(fb) && fb.length > 0) {
    html += `<div class="street-card-section">${renderSectionLabel('Flop Outcome Probabilities')}`;
    const ARCH_COLORS = {
      set: '#22c55e', overpair: '#3b82f6', top_pair: '#60a5fa',
      second_pair: '#a78bfa', flush_draw: '#06b6d4', overcards: '#eab308', miss: '#6b7280',
    };
    for (const arch of fb) {
      const pct = Math.round((arch.probability || 0) * 100);
      if (pct < 1) continue;
      const color = ARCH_COLORS[arch.archetype] || '#6b7280';
      const name = (arch.archetype || '').replace(/_/g, ' ');
      html += `<div class="archetype-row">
        <span class="archetype-name">${escapeHtml(name)}</span>
        <div class="archetype-bar-track">
          <div class="archetype-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="archetype-pct">${pct}%</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Villain preflop tendencies
  const villainData = focusedVillain ? appSeatData?.[focusedVillain] : null;
  if (villainData) {
    const vp = villainData.villainProfile;
    const vpStats = vp?.streets?.preflop;
    const stats = villainData.stats;
    if (vpStats?.tendency || stats) {
      html += `<div class="street-card-section">${renderSectionLabel('Villain Preflop')}`;
      if (vpStats?.tendency) {
        html += `<div style="font-size:var(--font-base);color:var(--text-secondary);margin-bottom:4px;font-style:italic">${escapeHtml(vpStats.tendency)}</div>`;
      }
      if (stats) {
        const rows = [];
        if (stats.cbet != null) rows.push(['C-Bet', stats.cbet + '%']);
        if (stats.foldToCbet != null) rows.push(['F-CB', stats.foldToCbet + '%']);
        if (stats.threeBet != null) rows.push(['3-Bet', stats.threeBet + '%']);
        if (rows.length > 0) {
          html += `<div style="display:flex;gap:12px;font-size:var(--font-sm)">`;
          for (const [label, val] of rows) {
            html += `<span style="color:var(--text-muted)">${label}: <span style="color:var(--text-primary);font-weight:600">${val}</span></span>`;
          }
          html += `</div>`;
        }
      }
      html += `</div>`;
    }
  }

  return html;
};

// =========================================================================
// LEGACY PER-STREET EXPORTS (delegate to unified layout for test compat)
// =========================================================================

/* eslint-disable no-unused-vars -- exported for tests */
const _legacyPreflopContent = (advice, liveContext, appSeatData, focusedVillain) =>
  renderUnifiedStreetContent('preflop', advice, liveContext, appSeatData, focusedVillain);

const _legacyFlopContent = (advice, liveContext, focusedVillain) =>
  renderUnifiedStreetContent('flop', advice, liveContext, {}, focusedVillain);

const _legacyTurnContent = (advice, liveContext, focusedVillain) =>
  renderUnifiedStreetContent('turn', advice, liveContext, {}, focusedVillain);

const _legacyRiverContent = (advice, liveContext, focusedVillain) =>
  renderUnifiedStreetContent('river', advice, liveContext, {}, focusedVillain);

// =========================================================================
// BETWEEN HANDS
// =========================================================================

const renderBetweenHandsContent = (appSeatData, focusedVillain, tournament, liveContext) => {
  let html = '';

  // Tournament info shown in slim tournament bar (side-panel.js renderTournamentPanel)
  // — no need to duplicate here

  // Villain scouting — one line per seat with data
  const seatEntries = Object.entries(appSeatData || {});
  const heroSeat = liveContext?.heroSeat;
  const scoutRows = seatEntries
    .filter(([seat, data]) => Number(seat) !== heroSeat && (data.sampleSize > 0 || data.villainHeadline))
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  if (scoutRows.length > 0) {
    html += `<div class="street-card-section">${renderSectionLabel('Table Reads')}`;
    for (const [seat, data] of scoutRows) {
      const isFocused = Number(seat) === focusedVillain;
      const styleLower = (data.style || 'unknown').toLowerCase();
      const styleColors = {
        fish: { bg: 'rgba(127,29,29,0.5)', text: '#fca5a5' },
        lag: { bg: 'rgba(124,45,18,0.5)', text: '#fdba74' },
        tag: { bg: 'rgba(20,83,45,0.5)', text: '#86efac' },
        nit: { bg: 'rgba(30,58,138,0.5)', text: '#93c5fd' },
        lp: { bg: 'rgba(113,63,18,0.5)', text: '#fde68a' },
        reg: { bg: 'rgba(88,28,135,0.5)', text: '#d8b4fe' },
        unknown: { bg: '#374151', text: '#9ca3af' },
      };
      const colors = styleColors[styleLower] || styleColors.unknown;

      html += `<div class="scout-row" data-scout-seat="${seat}"${isFocused ? ' style="background:rgba(212,168,71,0.08)"' : ''}>`;
      html += `<span class="scout-seat"${isFocused ? ' style="color:var(--gold)"' : ''}>S${seat}</span>`;
      if (data.style) {
        html += `<span class="scout-style-badge" style="background:${colors.bg};color:${colors.text}">${data.style}</span>`;
      }
      html += `<span class="scout-headline">${escapeHtml(data.villainHeadline || '\u2014')}</span>`;
      html += `<span class="scout-sample">${data.sampleSize || 0}h</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  if (!html) {
    html = `<div style="color:var(--text-faint);text-align:center;padding:20px;font-size:var(--font-sm)">Waiting for next hand\u2026</div>`;
  }

  return html;
};

// Exported for testing — pure functions returning HTML strings, no DOM dependency
export {
  _legacyPreflopContent as _renderPreflopContent,
  _legacyFlopContent as _renderFlopContent,
  _legacyTurnContent as _renderTurnContent,
  _legacyRiverContent as _renderRiverContent,
  renderBetweenHandsContent as _renderBetweenHandsContent,
};
