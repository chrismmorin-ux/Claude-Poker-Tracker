/**
 * render-orchestrator.js — Extracted render functions (pure, testable)
 *
 * These functions were extracted from the IIFE in side-panel.js so they can
 * be imported by both the production code and the test harness.
 *
 * Key design: all state is passed in explicitly — no closure variables,
 * no chrome.* APIs. Functions return HTML strings or data objects rather
 * than writing to DOM directly.
 */

import { escapeHtml, renderMiniCard, buildSeatArcPositions } from './render-utils.js';
import { STYLE_COLORS } from '../shared/stats-engine.js';
import {
  renderRangeBreakdownSection,
  renderAllRecsSection, renderStreetTendenciesSection,
  renderFoldCurveSection, renderFoldBreakdownSection,
  renderComboStatsSection, renderModelAuditSection,
  renderVulnerabilitiesSection,
} from './render-tiers.js';

// =========================================================================
// COMPUTE FOCUSED VILLAIN
// =========================================================================

/**
 * Determine which villain seat to focus on.
 * Priority: pinned > advice.villainSeat > pfAggressor > HU opponent > null
 *
 * @param {Object} state
 * @param {number|null} state.pinnedVillainSeat
 * @param {Object|null} state.lastGoodAdvice
 * @param {Object|null} state.currentLiveContext
 * @param {Object|null} state.currentTableState
 * @returns {number|null}
 */
export const computeFocusedVillain = ({ pinnedVillainSeat, rangeSelectedSeat, lastGoodAdvice, currentLiveContext, currentTableState }) => {
  const heroSeat = currentLiveContext?.heroSeat || currentTableState?.heroSeat;
  // SR-6.11 §1.11 Rule V: explicit range-grid override wins over all other
  // signals. This is the decoupled replacement for the old "pill-click pins
  // villain" shortcut — scouting pin and range-grid selection now live in
  // separate slots (R-5.1).
  if (rangeSelectedSeat != null && rangeSelectedSeat !== heroSeat) return rangeSelectedSeat;
  if (pinnedVillainSeat != null && pinnedVillainSeat !== heroSeat) return pinnedVillainSeat;
  if (lastGoodAdvice?.villainSeat) return lastGoodAdvice.villainSeat;
  if (currentLiveContext?.pfAggressor && currentLiveContext.pfAggressor !== heroSeat) return currentLiveContext.pfAggressor;
  // Heads-up: the other remaining player
  const active = currentLiveContext?.activeSeatNumbers || [];
  const nonHero = active.filter(s => s !== heroSeat);
  if (nonHero.length === 1) return nonHero[0];
  return null;
};

// =========================================================================
// COMPUTE VISIBILITY
// =========================================================================

/**
 * Determine which top-level DOM sections should be visible.
 *
 * @param {Object} state
 * @param {number} state.handCount - Number of hands for current table
 * @param {boolean} state.hasActiveTable - Whether an active table exists
 * @returns {{ showHudContent: boolean, showNoTable: boolean, showPipelineHealth: boolean }}
 */
export const computeVisibility = ({ handCount, hasActiveTable }) => {
  const hasHands = handCount > 0;
  return {
    showHudContent: hasHands,
    showNoTable: !hasHands,
    showPipelineHealth: !hasHands,
  };
};

// =========================================================================
// RENDER UNIFIED HEADER
// =========================================================================

/**
 * Build the unified header HTML (action badge + villain info + cards + meta pills).
 *
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @param {Object|null} liveContext - Current live hand state
 * @param {Object} opts
 * @param {number|null} opts.focusedVillainSeat
 * @param {number|null} opts.pinnedVillainSeat
 * @param {Object} opts.appSeatData - Per-seat data from exploit pushes
 * @param {Object|null} opts.currentTableState
 * @param {Object|null} opts.currentLiveContext
 * @returns {{ html: string, className: string, isWaiting: boolean }}
 */
export const buildUnifiedHeaderHTML = (advice, liveContext, opts = {}) => {
  const {
    focusedVillainSeat = null,
    pinnedVillainSeat = null,
    appSeatData = {},
    currentTableState = null,
    currentLiveContext = null,
  } = opts;

  const hasAdvice = advice && advice.recommendations && advice.recommendations.length > 0;
  const ctx = liveContext || currentLiveContext;
  const isLive = ctx && ctx.state &&
    ctx.state !== 'IDLE' && ctx.state !== 'COMPLETE';

  if (!hasAdvice && !isLive) {
    return {
      html: `<div class="uh-waiting">Waiting for next deal\u2026</div>`,
      className: 'unified-header',
      isWaiting: true,
    };
  }

  const className = hasAdvice ? 'unified-header has-advice' : 'unified-header';
  let html = '';

  // Accent bar + Row 1
  if (hasAdvice) {
    const rec = advice.recommendations[0];
    const action = rec.action || 'check';
    const badgeClass = action === 'raise' ? 'raise' : action === 'bet' ? 'bet'
      : action === 'call' ? 'call' : action === 'fold' ? 'fold' : 'check';
    html += `<div class="unified-header-accent ${badgeClass}"></div>`;

    html += `<div class="uh-row1">`;

    // Left: action badge + EV
    const ev = rec.ev ?? 0;
    let sizingHtml = '';
    if (rec.sizing?.betFraction) {
      sizingHtml = `<span class="action-sizing">${Math.round(rec.sizing.betFraction * 100)}%</span>`;
    }
    html += `<div class="uh-action-side">`;
    html += `<span class="action-badge ${badgeClass}">${escapeHtml(action.toUpperCase())}${sizingHtml}</span>`;
    const evSign = ev > 0 ? '+' : '';
    const evClass = ev > 0 ? 'positive' : ev < 0 ? 'negative' : 'neutral';
    html += `<span class="ev-display ${evClass}">${evSign}${ev.toFixed(1)}<span class="ev-unit">bb</span></span>`;
    html += `</div>`;

    // Right: villain info
    const foldedSeats = new Set(currentLiveContext?.foldedSeats || []);
    const villainIsFolded = focusedVillainSeat && foldedSeats.has(focusedVillainSeat);
    const pinnedData = pinnedVillainSeat ? appSeatData[pinnedVillainSeat] : null;

    const vp = (pinnedData?.villainProfile) || advice.villainProfile;
    const vStyle = (pinnedData?.style) || advice.villainStyle;
    const vSample = (pinnedData?.sampleSize) || advice.villainSampleSize;
    const vHeadline = (pinnedData?.villainHeadline) || vp?.headline;
    const mq = advice.modelQuality;
    const confClass = mq?.overallSource === 'player_model' ? 'green'
      : mq?.overallSource === 'mixed' ? 'yellow' : 'red';

    html += `<div class="uh-villain-side">`;
    if (villainIsFolded) {
      html += `<div class="uh-villain-headline" style="color:var(--text-faint)">Folded</div>`;
    } else if (vHeadline) {
      html += `<div class="uh-villain-headline">${escapeHtml(vHeadline)}</div>`;
    } else if (focusedVillainSeat) {
      html += `<div class="uh-villain-headline" style="color:var(--text-faint)">Seat ${focusedVillainSeat} \u2014 no data</div>`;
    }
    html += `<div class="uh-villain-meta">`;
    if (vStyle) {
      const colors = STYLE_COLORS[vStyle] || STYLE_COLORS.Unknown;
      html += `<span class="uh-style-badge" style="background:${colors.bg};color:${colors.text}">${vStyle}</span>`;
    }
    if (vSample) html += `<span class="uh-sample">n=${vSample}</span>`;
    const confLabel = confClass === 'green' ? 'Player model'
      : confClass === 'yellow' ? 'Mixed (model + population)' : 'Population estimate';
    html += `<span class="confidence-dot ${confClass}" title="${confLabel}"></span>`;
    html += `</div></div>`;

    html += `</div>`; // uh-row1
  } else {
    // Live but no advice yet
    html += `<div class="uh-row1"><div class="uh-action-side"><span style="color:var(--text-muted);font-size:var(--font-sm)">Analyzing\u2026</span></div></div>`;
  }

  // Row 2: Cards
  const live = liveContext || currentLiveContext;
  const heroSeat = live?.heroSeat || currentTableState?.heroSeat;
  const heroFolded = heroSeat && (live?.foldedSeats || []).includes(heroSeat);
  html += `<div class="uh-row2">`;

  // Board cards
  const board = live?.communityCards || [];
  const hasBoard = board.some(c => c && c !== '');
  if (hasBoard) {
    html += `<span class="card-group-label">Board</span><div class="card-group">`;
    for (const c of board) {
      if (c && c !== '') html += renderMiniCard(c);
    }
    html += `</div>`;
  }

  // Hero cards
  const hero = live?.holeCards || [];
  const hasHero = hero.some(c => c && c !== '');
  if (hasHero) {
    if (hasBoard) html += `<span class="card-separator"></span>`;
    html += `<div class="card-group">`;
    for (const c of hero) {
      if (c && c !== '') html += renderMiniCard(c, true, heroFolded);
    }
    html += `</div>`;
    if (heroFolded) {
      html += `<span class="uh-observing">Observing</span>`;
    }
  }

  html += `</div>`; // uh-row2 (cards only)

  // Row 3: Meta pills (own row — prevents card overflow from pushing pills off-screen)
  html += `<div class="uh-row2 uh-meta-row">`;
  html += `<div class="uh-meta-pills">`;
  // SR-6.12 Z2 §2.7 / §2.8 (B1 fix): between hands, the pot chip + street pill
  // must blank. `lastGoodAdvice` persists across hand boundaries for visual
  // continuity, so `advice.potSize` / `advice.currentStreet` are stale signals
  // once liveCtx reports COMPLETE/IDLE. Guard live-state explicitly rather
  // than letting the fallback chain render the old hand's pot + street.
  const handLive = !!(live && live.state && live.state !== 'COMPLETE' && live.state !== 'IDLE');
  if (handLive) {
    if (hasAdvice && advice.potSize > 0) {
      html += `<span class="pot-inline">$${advice.potSize.toFixed(0)}</span>`;
    } else if (live?.pot > 0) {
      html += `<span class="pot-inline">$${live.pot.toFixed(0)}</span>`;
    }
    const street = live?.currentStreet || advice?.currentStreet;
    if (street) {
      html += `<span class="pill street">${escapeHtml(street)}</span>`;
    }
  }
  const tm = advice?.treeMetadata;
  if (tm?.spr != null) {
    html += `<span class="pill spr">SPR ${tm.spr}</span>`;
  }
  if (tm?.depthReached) {
    html += `<span class="pill depth">D${tm.depthReached}</span>`;
  }
  html += `</div>`;
  html += `</div>`; // uh-meta-row

  return { html, className, isWaiting: false };
};

// =========================================================================
// BET FRACTION FORMATTING (shared by Zone 1 + Zone 2)
// =========================================================================

const FRACTION_MAP = [
  [0.33, '1/3 pot'], [0.34, '1/3 pot'],
  [0.50, '1/2 pot'],
  [0.67, '2/3 pot'], [0.66, '2/3 pot'],
  [0.75, '3/4 pot'],
  [1.00, 'pot'],
];

/**
 * Format a bet fraction as a human-readable string.
 * @param {number} betFraction - e.g. 0.67
 * @returns {string} e.g. "2/3 pot"
 */
export const formatBetFraction = (betFraction) => {
  if (betFraction == null) return '';
  const rounded = Math.round(betFraction * 100) / 100;
  for (const [val, label] of FRACTION_MAP) {
    if (Math.abs(rounded - val) < 0.02) return label;
  }
  return `${Math.round(betFraction * 100)}%`;
};

// =========================================================================
// ZONE 1: ACTION BAR
// =========================================================================

/**
 * Build the Zone 1 Action Bar HTML.
 *
 * Shows the primary recommendation: action word (24px), sizing, EV edge,
 * risk badge, and fold equity or equity stat. Handles mixed spots, waiting,
 * and analyzing states.
 *
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @param {Object|null} liveContext - Current live hand state
 * @param {Object} [opts]
 * @returns {{ html: string, className: string }}
 */
export const buildActionBarHTML = (advice, liveContext, opts = {}) => {
  const ctx = liveContext || opts.currentLiveContext;
  const isLive = ctx && ctx.state && ctx.state !== 'IDLE' && ctx.state !== 'COMPLETE';
  const hasAdvice = advice && advice.recommendations && advice.recommendations.length > 0;

  // Between-hands / no live context
  if (!hasAdvice && !isLive) {
    return {
      html: `<div class="ab-waiting">Waiting for next deal\u2026</div>`,
      className: 'action-bar is-waiting',
    };
  }

  // Live but no advice yet
  if (!hasAdvice) {
    return {
      html: `<div class="ab-row1"><span class="ab-action-word analyzing">Analyzing\u2026</span></div>`,
      className: 'action-bar',
    };
  }

  const rec = advice.recommendations[0];
  const action = rec.action || 'check';
  const isMixed = rec.mixFrequency != null && advice.recommendations.length > 1;

  if (isMixed) {
    return _buildMixedActionBar(advice, rec);
  }

  return _buildStandardActionBar(advice, rec, action);
};

/** Build standard (single action) action bar. */
function _buildStandardActionBar(advice, rec, action) {
  // SR-6.12 (Z2 §2.3, B2 fix): equity + EV edge now live in the headline row.
  // Row 2 becomes SPR-only (Z2 §2.4). The old layout hid equity behind the
  // edge in a secondary row, violating R-1.2 primary-metric adjacency.
  let html = '<div class="ab-row1">';

  // Action word
  html += `<span class="ab-action-word ${escapeHtml(action)}">${escapeHtml(action.toUpperCase())}</span>`;

  // Sizing
  if (rec.sizing?.betFraction) {
    html += `<span class="ab-sizing-frac">${escapeHtml(formatBetFraction(rec.sizing.betFraction))}</span>`;
    if (rec.sizing.betSize != null) {
      html += `<span class="ab-sizing-dollar">($${rec.sizing.betSize.toFixed(0)})</span>`;
    }
  }

  // Risk badge
  if (rec.risk != null) {
    const r = String(rec.risk).toLowerCase();
    html += `<span class="ab-risk-badge ${escapeHtml(r)}">${escapeHtml(String(rec.risk))}</span>`;
  }

  // EV edge — now headline (was row 2).
  const ev = rec.ev ?? 0;
  const evSign = ev > 0 ? '+' : '';
  const evClass = ev > 0 ? 'ab-ev-pos' : ev < 0 ? 'ab-ev-neg' : 'ab-ev-neutral';
  html += `<span class="ab-ev-edge ${evClass}">${evSign}${ev.toFixed(1)} edge</span>`;

  // Z2 §2.3 sole equity owner — headline inline, R-4.2 placeholder when unknown.
  if (advice.heroEquity != null) {
    // Defend against fraction-vs-percent mixed-unit bug (spec §2.3 §4 edge).
    const eq = advice.heroEquity <= 1 ? advice.heroEquity * 100 : advice.heroEquity;
    html += `<span class="ab-equity">${Math.round(eq)}% equity</span>`;
  } else {
    html += `<span class="ab-equity ab-equity-unknown">\u2014% equity</span>`;
  }

  html += '</div>';

  // Row 2 — Z2 §2.4 SPR-only. Shows SPR zone badge if advice carries SPR; else
  // R-4.2 placeholder to preserve R-1.3 fixed row height.
  html += '<div class="ab-row2">';
  const spr = advice.spr ?? advice.treeMetadata?.spr ?? null;
  if (spr != null) {
    html += `<span class="ab-spr">SPR: ${typeof spr === 'number' ? spr.toFixed(1) : escapeHtml(String(spr))}</span>`;
  } else {
    html += `<span class="ab-spr ab-spr-unknown">SPR: \u2014</span>`;
  }

  // Retain fold% as secondary stat (villain folds) — distinct from equity so
  // no collision with the headline's equity owner per R-5.1.
  const foldPct = rec.villainResponse?.fold?.pct;
  if (foldPct != null) {
    html += `<span class="ab-sep">\u00B7</span>`;
    html += `<span class="ab-stat">${Math.round(foldPct * 100)}% villain folds</span>`;
  }

  html += '</div>';

  return {
    html,
    className: `action-bar has-advice ${escapeHtml(action)}`,
  };
}

/** Build mixed spot (two actions with frequencies) action bar. */
function _buildMixedActionBar(advice, rec) {
  const rec2 = advice.recommendations[1];
  const freq1 = Math.round((rec.mixFrequency ?? 0.5) * 100);
  const freq2 = Math.round((rec2.mixFrequency ?? (1 - (rec.mixFrequency ?? 0.5))) * 100);

  let html = '<div class="ab-row1 ab-mix-row">';
  html += `<span class="ab-mix-action">${escapeHtml((rec.action || 'bet').toUpperCase())}</span>`;
  html += `<span class="ab-mix-freq">${freq1}%</span>`;
  html += `<span class="ab-sep">\u00B7</span>`;
  html += `<span class="ab-mix-action">${escapeHtml((rec2.action || 'check').toUpperCase())}</span>`;
  html += `<span class="ab-mix-freq">${freq2}%</span>`;
  html += '</div>';

  // Row 2: both EVs
  html += '<div class="ab-row2">';
  const ev1 = rec.ev ?? 0;
  const ev2 = rec2.ev ?? 0;
  const evSign1 = ev1 > 0 ? '+' : '';
  const evSign2 = ev2 > 0 ? '+' : '';
  const evClass1 = ev1 > 0 ? 'ab-ev-pos' : ev1 < 0 ? 'ab-ev-neg' : 'ab-ev-neutral';
  const evClass2 = ev2 > 0 ? 'ab-ev-pos' : ev2 < 0 ? 'ab-ev-neg' : 'ab-ev-neutral';
  html += `<span class="ab-ev-edge ${evClass1}">${escapeHtml((rec.action || 'bet').charAt(0).toUpperCase() + (rec.action || 'bet').slice(1))}: ${evSign1}${ev1.toFixed(1)}</span>`;
  html += `<span class="ab-sep">\u00B7</span>`;
  html += `<span class="ab-ev-edge ${evClass2}">${escapeHtml((rec2.action || 'check').charAt(0).toUpperCase() + (rec2.action || 'check').slice(1))}: ${evSign2}${ev2.toFixed(1)}</span>`;
  html += '</div>';

  return {
    html,
    className: 'action-bar has-advice is-mixed',
  };
}

// =========================================================================
// ZONE 2: CONTEXT STRIP
// =========================================================================

/**
 * Build the Zone 2 Context Strip HTML.
 *
 * Row 1: Three context numbers (equity, pot odds or SPR, model sample size).
 * Row 2: Villain response probabilities (when hero is the actor).
 *
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @param {Object|null} liveContext - Current live hand state
 * @param {Object} [opts]
 * @returns {{ html: string, className: string }}
 */
export const buildContextStripHTML = (advice, liveContext, opts = {}) => {
  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    return { html: '', className: 'context-strip' };
  }

  const rec = advice.recommendations[0];

  // Confidence class for opacity (spec §4: player=100%, mixed=80%, population=60%)
  const confSource = advice.modelQuality?.overallSource;
  const confClass = confSource === 'player_model' ? 'conf-player'
    : confSource === 'mixed' ? 'conf-mixed' : 'conf-population';

  let html = '<div class="cs-row1">';

  // Equity
  if (advice.heroEquity != null) {
    html += `<div class="cs-item"><span class="cs-label">Equity:</span> <span class="cs-value ${confClass}">${Math.round(advice.heroEquity * 100)}%</span></div>`;
  }

  // Pot odds (when facing a bet) or SPR
  if (advice.situation === 'facing_raise' || advice.situation === 'facing_bet') {
    const ctx = liveContext || opts.currentLiveContext;
    const currentStreet = (ctx?.state || ctx?.street || '').toLowerCase() || null;
    const faced = findFacedBet(ctx?.actionSequence, ctx?.heroSeat, currentStreet);
    const betAmount = faced?.amount ?? 0;
    const pot = advice.potSize ?? ctx?.pot ?? 0;
    if (betAmount > 0 && pot > 0) {
      const potOdds = Math.round((betAmount / (pot + betAmount)) * 100);
      html += `<div class="cs-item"><span class="cs-label">Pot odds:</span> <span class="cs-value ${confClass}">${potOdds}%</span></div>`;
    }
  } else if (advice.treeMetadata?.spr != null) {
    html += `<div class="cs-item"><span class="cs-label">SPR:</span> <span class="cs-value ${confClass}">${advice.treeMetadata.spr}</span></div>`;
  }

  // Model sample size
  if (advice.villainSampleSize != null) {
    html += `<div class="cs-item"><span class="cs-label">Model:</span> <span class="cs-value ${confClass}">${advice.villainSampleSize}h</span></div>`;
  }

  html += '</div>';

  // Row 2: Villain response probabilities
  if (rec.villainResponse) {
    const vr = rec.villainResponse;
    const actionLabel = rec.action ? rec.action.toUpperCase() : 'BET';
    const sizingLabel = rec.sizing?.betFraction ? ` ${formatBetFraction(rec.sizing.betFraction)}` : '';

    html += '<div class="cs-row2">';
    html += `<span class="cs-response-action">If ${escapeHtml(actionLabel)}${escapeHtml(sizingLabel)}:</span>`;

    if (vr.fold?.pct != null) {
      html += `<span class="cs-dot">\u00B7</span><span class="cs-response-fold">Folds ${Math.round(vr.fold.pct * 100)}%</span>`;
    }
    if (vr.call?.pct != null) {
      html += `<span class="cs-dot">\u00B7</span><span class="cs-response-call">Calls ${Math.round(vr.call.pct * 100)}%</span>`;
    }
    if (vr.raise?.pct != null) {
      html += `<span class="cs-dot">\u00B7</span><span class="cs-response-raise">Raises ${Math.round(vr.raise.pct * 100)}%</span>`;
    }

    html += '</div>';
  }

  return { html, className: 'context-strip' };
};

// =========================================================================
// CARDS STRIP (extracted from unified header)
// =========================================================================

/**
 * Build the cards-only strip HTML (board cards + hero cards).
 * Extracted from the cards row of buildUnifiedHeaderHTML.
 *
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @param {Object|null} liveContext - Current live hand state
 * @param {Object} [opts]
 * @returns {{ html: string, className: string }}
 */
export const buildCardsStripHTML = (advice, liveContext, opts = {}) => {
  const ctx = liveContext || opts.currentLiveContext;
  const heroSeat = ctx?.heroSeat || opts.currentTableState?.heroSeat;
  const heroFolded = heroSeat && (ctx?.foldedSeats || []).includes(heroSeat);

  const board = ctx?.communityCards || [];
  const hasBoard = board.some(c => c && c !== '');
  const hero = ctx?.holeCards || [];
  const hasHero = hero.some(c => c && c !== '');

  if (!hasBoard && !hasHero) {
    return { html: '', className: 'cards-strip' };
  }

  let html = '';

  if (hasBoard) {
    html += `<span class="card-group-label">Board</span><div class="card-group">`;
    for (const c of board) {
      if (c && c !== '') html += renderMiniCard(c);
    }
    html += `</div>`;
  }

  if (hasHero) {
    if (hasBoard) html += `<span class="card-separator"></span>`;
    html += `<div class="card-group">`;
    for (const c of hero) {
      if (c && c !== '') html += renderMiniCard(c, true, heroFolded);
    }
    html += `</div>`;
    if (heroFolded) {
      html += `<span class="uh-observing">Observing</span>`;
    }
  }

  // Pot display
  const pot = advice?.potSize ?? ctx?.pot;
  if (pot != null && pot > 0) {
    html += `<span class="pot-inline" style="margin-left:auto">$${pot.toFixed(0)}</span>`;
  }

  return { html, className: 'cards-strip' };
};

// =========================================================================
// DECISION STATE CLASSIFICATION
// =========================================================================

/**
 * The 6 decision states that drive Zone 2-3 content.
 */
export const DECISION_STATES = Object.freeze({
  PREFLOP_STANDARD:       'PREFLOP_STANDARD',
  PREFLOP_CONTESTED:      'PREFLOP_CONTESTED',
  AGGRESSOR_FIRST_TO_ACT: 'AGGRESSOR_FIRST_TO_ACT',
  AGGRESSOR_FACING_CHECK: 'AGGRESSOR_FACING_CHECK',
  CALLER_FACING_BET:      'CALLER_FACING_BET',
  CALLER_FIRST_TO_ACT:    'CALLER_FIRST_TO_ACT',
});

/**
 * Classify the hero's current decision into one of 6 states.
 *
 * @param {Object|null} advice
 * @param {Object|null} liveContext
 * @returns {string} One of DECISION_STATES values
 */
export const classifyDecisionState = (advice, liveContext) => {
  if (!liveContext) return DECISION_STATES.AGGRESSOR_FIRST_TO_ACT;

  const street = liveContext.currentStreet || advice?.currentStreet;
  const heroSeat = liveContext.heroSeat;
  const actionSeq = liveContext.actionSequence || [];

  // Preflop classification
  if (street === 'preflop') {
    const raiseCount = actionSeq.filter(a => a.action === 'raise').length;
    return raiseCount >= 2 ? DECISION_STATES.PREFLOP_CONTESTED : DECISION_STATES.PREFLOP_STANDARD;
  }

  // Postflop classification
  const pfAggressor = liveContext.pfAggressor;

  // Determine heroIsAggressor: hero was pfAggressor OR hero was last raiser on prior streets
  let heroIsAggressor = pfAggressor === heroSeat;
  if (!heroIsAggressor && heroSeat != null) {
    const priorActions = actionSeq.filter(a => a.street !== street && a.street !== 'preflop');
    for (let i = priorActions.length - 1; i >= 0; i--) {
      if (priorActions[i].action === 'bet' || priorActions[i].action === 'raise') {
        if (priorActions[i].seat === heroSeat) heroIsAggressor = true;
        break;
      }
    }
  }

  // Find last non-hero action on current street
  const streetActions = actionSeq.filter(a => a.street === street);
  let lastVillainAction = null;
  for (let i = streetActions.length - 1; i >= 0; i--) {
    if (streetActions[i].seat !== heroSeat) {
      lastVillainAction = streetActions[i];
      break;
    }
  }

  const heroFacesBet = lastVillainAction?.action === 'bet' || lastVillainAction?.action === 'raise';

  if (heroFacesBet) return DECISION_STATES.CALLER_FACING_BET;
  if (heroIsAggressor && lastVillainAction?.action === 'check') return DECISION_STATES.AGGRESSOR_FACING_CHECK;
  if (heroIsAggressor) return DECISION_STATES.AGGRESSOR_FIRST_TO_ACT;
  return DECISION_STATES.CALLER_FIRST_TO_ACT;
};

// =========================================================================
// ZONE 3: PLAN PANEL
// =========================================================================

/**
 * Extract the primary plan note from handPlan based on decision state.
 * @param {Object|null} handPlan
 * @param {string} decisionState
 * @param {string|null} action - primary recommendation action
 * @returns {string} Plan sentence or ''
 */
function _extractPlanNote(handPlan, decisionState, action) {
  if (!handPlan) return '';

  let note = '';
  let prefix = '';

  switch (decisionState) {
    case DECISION_STATES.CALLER_FACING_BET:
      note = handPlan.ifCall?.note || handPlan.nextStreet?.note || '';
      if (action) prefix = action.charAt(0).toUpperCase() + action.slice(1) + '. ';
      break;
    case DECISION_STATES.AGGRESSOR_FACING_CHECK:
      note = handPlan.ifVillainChecks?.note || handPlan.ifCall?.note || '';
      break;
    case DECISION_STATES.AGGRESSOR_FIRST_TO_ACT:
      note = handPlan.ifCall?.note || handPlan.nextStreet?.note || handPlan.ifVillainBets?.note || '';
      break;
    case DECISION_STATES.CALLER_FIRST_TO_ACT:
      note = handPlan.ifVillainBets?.note || handPlan.nextStreet?.note || '';
      break;
    default: // PREFLOP_*
      note = handPlan.ifCall?.note || handPlan.nextStreet?.note || '';
      break;
  }

  // Fallback: find any note across all branches
  if (!note) {
    for (const branch of ['ifCall', 'ifRaise', 'ifBet', 'ifVillainBets', 'ifVillainChecks', 'nextStreet']) {
      if (handPlan[branch]?.note) { note = handPlan[branch].note; break; }
    }
  }

  return note ? prefix + note : '';
}

/**
 * Find the bet/raise hero is currently facing.
 *
 * Walks actionSequence backward and returns the most recent BET/RAISE/DONK
 * on the current street from a seat other than hero. In multiway pots,
 * actionSequence.slice(-1) may land on an intermediate caller's action —
 * the amount of a call is not what hero is being asked to match.
 *
 * @param {Array|null} actionSequence - Sequence entries: {seat, action, amount, street, order}
 * @param {number|null} heroSeat
 * @param {string|null} currentStreet - 'preflop' | 'flop' | 'turn' | 'river'
 * @returns {{amount: number, seat: number, action: string}|null}
 */
export function findFacedBet(actionSequence, heroSeat, currentStreet) {
  if (!Array.isArray(actionSequence) || actionSequence.length === 0) return null;
  const aggressive = new Set(['bet', 'raise', 'donk', 'donk_bet']);
  for (let i = actionSequence.length - 1; i >= 0; i--) {
    const a = actionSequence[i];
    if (!a) continue;
    if (currentStreet && a.street && a.street !== currentStreet) continue;
    if (heroSeat != null && a.seat === heroSeat) continue;
    if (!aggressive.has(a.action)) continue;
    if (typeof a.amount !== 'number' || a.amount <= 0) continue;
    return { amount: a.amount, seat: a.seat, action: a.action };
  }
  return null;
}

/**
 * Extract scary-runout info from handPlan branches.
 *
 * Returns both the count (for legacy displays) and the specific rank chars
 * the engine flagged as equity-killing on the next street. Ranks come from
 * gameTreeDepth2.js's stratified runout sampler and are capped at 4 distinct.
 *
 * @param {Object|null} handPlan
 * @returns {{ count: number, ranks: string[], nextStreetName: string|null }}
 */
function _extractScaryCards(handPlan) {
  if (!handPlan) return { count: 0, ranks: [], nextStreetName: null };
  // Branch → next-street name. ifCall happens on the street after the current one;
  // nextStreet on the same logic; ifVillainChecks/Bets land on the turn/river.
  for (const branch of ['ifCall', 'nextStreet', 'ifVillainChecks', 'ifVillainBets']) {
    const b = handPlan[branch];
    if (!b) continue;
    const sc = b.scaryCards;
    const ranks = Array.isArray(b.scaryCardRanks) ? b.scaryCardRanks.filter(r => typeof r === 'string') : [];
    if (sc != null || ranks.length > 0) {
      const count = typeof sc === 'number' ? sc : (Array.isArray(sc) ? sc.length : ranks.length);
      return { count, ranks, nextStreetName: null };
    }
  }
  return { count: 0, ranks: [], nextStreetName: null };
}

/**
 * Build the Zone 3 Plan Panel HTML.
 *
 * 4 content lines: villain characterization, hand plan, watch/scary cards,
 * showdown anchor. Content selection driven by decision state.
 *
 * @param {Object|null} advice
 * @param {Object|null} liveContext
 * @param {Object} [opts]
 * @param {number|null} [opts.focusedVillainSeat]
 * @param {number|null} [opts.pinnedVillainSeat]
 * @param {Object} [opts.appSeatData]
 * @param {string} [opts.decisionState]
 * @returns {{ html: string, className: string }}
 */
export const buildPlanPanelHTML = (advice, liveContext, opts = {}) => {
  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    return { html: '', className: 'plan-panel' };
  }

  const {
    focusedVillainSeat = null,
    appSeatData = {},
    decisionState = DECISION_STATES.AGGRESSOR_FIRST_TO_ACT,
  } = opts;

  const rec = advice.recommendations[0];
  const vp = advice.villainProfile || appSeatData[focusedVillainSeat]?.villainProfile;
  const sampleSize = advice.villainSampleSize || appSeatData[focusedVillainSeat]?.sampleSize;

  let html = '<div class="pp-content">';

  // Line 1: Villain characterization
  const headline = vp?.headline;
  if (headline) {
    const sampleStr = sampleSize ? ` (${sampleSize}h)` : '';
    html += `<div class="pp-line pp-villain">${escapeHtml(headline)}${escapeHtml(sampleStr)}</div>`;
  }

  // Line 2: Plan sentence
  const planNote = _extractPlanNote(rec.handPlan, decisionState, rec.action);
  if (planNote) {
    html += `<div class="pp-line pp-plan">Plan: ${escapeHtml(planNote)}</div>`;
  }

  // Line 3: Watch/scary cards — render specific rank chars when available
  const scary = _extractScaryCards(rec.handPlan);
  if (scary.count > 0 || scary.ranks.length > 0) {
    const currStreet = (liveContext?.state || liveContext?.street || '').toString().toLowerCase();
    const nextStreet = currStreet === 'preflop' ? 'flop'
      : currStreet === 'flop' ? 'turn'
      : currStreet === 'turn' ? 'river'
      : 'next street';
    if (scary.ranks.length > 0) {
      const rankList = scary.ranks.map(escapeHtml).join(', ');
      html += `<div class="pp-line pp-watch">Watch: ${rankList} on ${escapeHtml(nextStreet)}</div>`;
    } else {
      const noun = scary.count === 1 ? 'runout' : 'runouts';
      html += `<div class="pp-line pp-watch">Watch: ${scary.count} dangerous ${noun} on ${escapeHtml(nextStreet)}</div>`;
    }
  }

  // Line 4: Showdown anchor (optional)
  const anchor = vp?.showdownAnchors?.[0];
  if (anchor?.handDescription) {
    html += `<div class="pp-line pp-anchor">Anchor: ${escapeHtml(anchor.handDescription)}</div>`;
  }

  html += '</div>';

  // If only the wrapper div, return empty
  if (html === '<div class="pp-content"></div>') {
    return { html: '', className: 'plan-panel' };
  }

  return { html, className: 'plan-panel' };
};

// =========================================================================
// BETWEEN-HANDS MODE CLASSIFICATION
// =========================================================================

/**
 * Check if the last advice had a profitable non-fold alternative.
 */
function _hasProfitableAlternative(lastGoodAdvice) {
  if (!lastGoodAdvice?.recommendations?.length) return false;
  const recs = lastGoodAdvice.recommendations;
  const primary = recs[0];
  if (primary.action !== 'fold') return true;
  return recs.some(r => r.action !== 'fold' && (r.ev ?? 0) > 0);
}

/**
 * Classify which between-hands mode to show.
 *
 * @param {Object|null} liveContext
 * @param {number|null} heroSeat
 * @param {Object|null} lastGoodAdvice
 * @param {boolean} modeAExpired - true when 10s timer has fired
 * @returns {'REFLECTION'|'OBSERVING'|'WAITING'|null} null = not between-hands
 */
export const classifyBetweenHandsMode = (liveContext, heroSeat, lastGoodAdvice, modeAExpired) => {
  if (!liveContext) return 'WAITING';

  const state = liveContext.state;
  const isLive = state && state !== 'IDLE' && state !== 'COMPLETE';
  const heroFolded = heroSeat != null && (liveContext.foldedSeats || []).includes(heroSeat);

  if (heroFolded && isLive) {
    if (!modeAExpired && _hasProfitableAlternative(lastGoodAdvice)) return 'REFLECTION';
    return 'OBSERVING';
  }

  if (!isLive) return 'WAITING';
  return null; // hero is active in live hand
};

// =========================================================================
// BETWEEN-HANDS HTML BUILDER
// =========================================================================

/** EV magnitude label. */
function _evLabel(ev) {
  const abs = Math.abs(ev ?? 0);
  if (abs < 0.5) return 'small \u2014 marginal spot';
  if (abs < 2.0) return 'medium \u2014 notable spot';
  return 'large \u2014 significant spot';
}

/** Mode A: Post-fold reflection. */
function _buildReflectionHTML(lastGoodAdvice) {
  if (!lastGoodAdvice?.recommendations?.length) return '';

  const recs = lastGoodAdvice.recommendations;
  // Find the best non-fold alternative
  let bestAlt = recs[0].action !== 'fold' ? recs[0] : null;
  if (!bestAlt) {
    bestAlt = recs.find(r => r.action !== 'fold' && (r.ev ?? 0) > 0);
  }
  if (!bestAlt) return '';

  const action = (bestAlt.action || 'check').toUpperCase();
  const ev = bestAlt.ev ?? 0;
  const evSign = ev > 0 ? '+' : '';
  const evClass = ev > 0 ? 'bh-ev-pos' : ev < 0 ? 'bh-ev-neg' : 'bh-ev-neutral';

  let html = '<div class="bh-reflection">';
  html += `<div class="bh-reflection-label">You folded</div>`;
  html += `<div class="bh-reflection-rec">Engine recommended: <strong>${escapeHtml(action)}</strong> (<span class="${evClass}">${evSign}${ev.toFixed(1)} bb</span>)</div>`;
  html += `<div class="bh-reflection-diff">Difference: ${escapeHtml(_evLabel(ev))}</div>`;
  html += '</div>';
  return html;
}

/** Select focus seat for Mode B scouting. */
function _selectScoutFocusSeat(liveContext, appSeatData, focusedVillainSeat) {
  const heroSeat = liveContext?.heroSeat;
  const active = (liveContext?.activeSeatNumbers || []).filter(s => s !== heroSeat);
  if (active.length === 0) return null;
  if (focusedVillainSeat != null && active.includes(focusedVillainSeat)) return focusedVillainSeat;
  return active.find(s => appSeatData[s]) || active[0];
}

/** Mode B: Observing / scouting. */
function _buildObservingHTML(liveContext, appSeatData, focusedVillainSeat) {
  const seat = _selectScoutFocusSeat(liveContext, appSeatData, focusedVillainSeat);
  if (seat == null) {
    return '<div class="bh-empty">Observing hand\u2026</div>';
  }

  const data = appSeatData[seat] || {};
  const vp = data.villainProfile;
  const style = data.style || 'Unknown';
  const sample = data.sampleSize || 0;

  let html = '<div class="bh-scout">';
  html += `<div class="bh-scout-header">SCOUTING \u2014 Seat ${seat} (${escapeHtml(style)}, ${sample}h)</div>`;

  // Patterns: vulnerabilities (top 3 by severity)
  const vulns = (vp?.vulnerabilities || [])
    .slice()
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, 3);

  if (vulns.length > 0) {
    for (const v of vulns) {
      html += `<div class="bh-scout-pattern">${escapeHtml(v.label)}</div>`;
    }
  } else if (data.villainHeadline) {
    html += `<div class="bh-scout-pattern">${escapeHtml(data.villainHeadline)}</div>`;
  }

  // Street tendencies (up to 2)
  if (vp?.streets) {
    let tendencyCount = 0;
    for (const [street, info] of Object.entries(vp.streets)) {
      if (info?.tendency && tendencyCount < 2) {
        html += `<div class="bh-scout-pattern" style="color:var(--text-faint)">${escapeHtml(street)}: ${escapeHtml(info.tendency)}</div>`;
        tendencyCount++;
      }
    }
  }

  // Showdown anchor
  const anchor = vp?.showdownAnchors?.[0];
  if (anchor?.handDescription) {
    html += `<div class="bh-scout-anchor">Anchor: ${escapeHtml(anchor.handDescription)}</div>`;
  }

  html += '</div>';
  return html;
}

/** Rank seats for Mode C focus. */
function _rankSeatsForNextHand(appSeatData, heroSeat) {
  return Object.entries(appSeatData || {})
    .filter(([seat]) => Number(seat) !== heroSeat)
    .filter(([, data]) => data.villainHeadline || (data.sampleSize ?? 0) > 0)
    .sort(([, a], [, b]) =>
      ((b.exploitCount || 0) + (b.weaknessCount || 0)) -
      ((a.exploitCount || 0) + (a.weaknessCount || 0))
    )
    .slice(0, 2);
}

/** Mode C: Waiting for next deal. */
function _buildWaitingHTML(appSeatData, liveContext) {
  const heroSeat = liveContext?.heroSeat;
  const focusSeats = _rankSeatsForNextHand(appSeatData, heroSeat);

  if (focusSeats.length === 0) {
    return '<div class="bh-empty">Waiting for next hand\u2026</div>';
  }

  let html = '<div class="bh-waiting">';
  html += '<div class="bh-waiting-header">Next hand focus:</div>';

  for (const [seat, data] of focusSeats) {
    const style = data.style || 'Unknown';
    const headline = data.villainHeadline || '\u2014';
    html += `<div class="bh-focus-row">`;
    html += `<span class="bh-focus-seat">S${seat} (${escapeHtml(style)})</span>`;
    html += `<span class="bh-focus-note">\u2014 ${escapeHtml(headline)}</span>`;
    html += `</div>`;
  }

  html += '</div>';
  return html;
}

/**
 * Build the between-hands content HTML for the 3 modes.
 *
 * @param {string} mode - 'REFLECTION' | 'OBSERVING' | 'WAITING'
 * @param {Object} opts
 * @returns {{ html: string, className: string }}
 */
export const buildBetweenHandsHTML = (mode, opts = {}) => {
  const {
    liveContext = null,
    lastGoodAdvice = null,
    appSeatData = {},
    focusedVillainSeat = null,
  } = opts;

  let html = '';
  let modeClass = '';

  switch (mode) {
    case 'REFLECTION':
      html = _buildReflectionHTML(lastGoodAdvice);
      modeClass = 'mode-reflection';
      break;
    case 'OBSERVING':
      html = _buildObservingHTML(liveContext, appSeatData, focusedVillainSeat);
      modeClass = 'mode-observing';
      break;
    case 'WAITING':
      html = _buildWaitingHTML(appSeatData, liveContext);
      modeClass = 'mode-waiting';
      break;
    default:
      html = '';
  }

  if (!html) {
    html = '<div class="bh-empty">Waiting for next hand\u2026</div>';
    modeClass = 'mode-waiting';
  }

  return { html, className: `between-hands ${modeClass}` };
};

// =========================================================================
// RENDER SEAT ARC
// =========================================================================

/**
 * SR-6.11: Quantize villain hands-count onto a 5-band logarithmic scale per
 * Z1 §1.1. Bands: {0, <20, 20–99, 100–499, 500+}. Pure function over count.
 * Return value is a band name that maps 1:1 onto CSS classes on the seat
 * circle (`.ring-band-{name}`), with `band-empty` reserved for occupied-zero
 * seats so that R-4.2 renders an explicit `—` placeholder rather than a
 * misread "tiny ring".
 *
 * @param {number|null|undefined} handsCount
 * @returns {'empty'|'tiny'|'small'|'medium'|'large'}
 */
export const quantizeSampleBand = (handsCount) => {
  const n = Number(handsCount) || 0;
  if (n <= 0) return 'empty';
  if (n < 20) return 'tiny';
  if (n < 100) return 'small';
  if (n < 500) return 'medium';
  return 'large';
};

/**
 * Build the seat arc HTML (semicircle poker table layout).
 *
 * @param {Object} physicalStats - { [physicalSeat]: statsObj } from stats engine
 * @param {Object|null} tableState - From HSM getState()
 * @param {Object|null} seatMap - Unified physical → regSeatNo map (null for cash)
 * @param {Object} opts
 * @param {Object|null} opts.currentLiveContext
 * @param {Object} opts.appSeatData
 * @param {number|null} opts.focusedVillainSeat
 * @param {number|null} opts.pinnedVillainSeat
 * @param {number} [opts.containerWidth=380] - Width for arc position calculation
 * @returns {string} HTML string
 */
export const buildSeatArcHTML = (physicalStats, tableState, seatMap, opts = {}) => {
  const {
    currentLiveContext = null,
    appSeatData = {},
    focusedVillainSeat = null,
    pinnedVillainSeat = null,
    rangeSelectedSeat = null,
    containerWidth = 380,
  } = opts;

  const heroSeat = tableState?.heroSeat || currentLiveContext?.heroSeat;
  const activeSeatSet = new Set(currentLiveContext?.activeSeatNumbers || []);

  // Discover seats
  const seatSet = new Set();
  for (const s of activeSeatSet) seatSet.add(s);
  if (heroSeat) seatSet.add(heroSeat);
  if (physicalStats) {
    for (const k of Object.keys(physicalStats)) seatSet.add(Number(k));
  }
  if (tableState?.activeSeats) {
    for (const s of tableState.activeSeats) seatSet.add(s);
  }

  const seats = [...seatSet].filter(s => s > 0).sort((a, b) => a - b);

  if (seats.length === 0) return '';

  const foldedSeats = new Set(currentLiveContext?.foldedSeats || []);
  const isTournament = !!seatMap;
  const dealerSeat = currentLiveContext?.dealerSeat || tableState?.dealerButtonSeat;
  const pfAggressor = currentLiveContext?.pfAggressor;

  // Build per-seat last action from action sequence
  const actionSeq = currentLiveContext?.actionSequence || [];
  const seatLastAction = {};
  for (const a of actionSeq) {
    if (a.seat) seatLastAction[a.seat] = a;
  }

  // Compute arc positions (inset by 20px each side to prevent clipping of badges/tags)
  const positions = buildSeatArcPositions(seats, heroSeat, containerWidth - 40, 95);
  // Offset all positions by 20px to center the inset arc
  for (const [, pos] of positions) {
    pos.x += 20;
  }

  let html = '';

  // Tournament mapping indicator
  if (isTournament) {
    const mappedCount = seats.filter(s => seatMap[s] !== undefined).length;
    const color = mappedCount === seats.length ? 'var(--m-green)' : 'var(--m-yellow)';
    html += `<div class="seat-mapping-status" style="color:${color};position:absolute;width:100%;top:0">ID: ${mappedCount}/${seats.length}</div>`;
  }

  for (const seat of seats) {
    const pos = positions.get(seat);
    if (!pos) continue;

    const s = physicalStats?.[seat];
    const app = appSeatData[seat] || null;
    const isHero = seat === heroSeat;
    const isFolded = foldedSeats.has(seat);
    const isFocused = seat === focusedVillainSeat && !isHero;
    const isPinned = seat === pinnedVillainSeat && !isHero;
    const style = (s?.style || app?.style || 'unknown').toLowerCase();
    const regSeatNo = seatMap?.[seat];
    const sampleSize = s?.sampleSize || app?.sampleSize || 0;

    // Between hands (no live context / empty activeSeatSet), treat all stats-known
    // seats as present — they were at the table recently. Only mark vacant when we
    // have an active hand's seat list to compare against.
    const hasLiveHand = activeSeatSet.size > 0;
    const isVacant = !isHero && hasLiveHand && !activeSeatSet.has(seat);

    // SR-6.11 §1.1: logarithmic hands-count ring band + R-4.2 `—` placeholder.
    // SR-6.11 §1.11: Rule V range-selection ring — distinct visual channel
    // from pinned/focused (R-5.1 single-owner-per-slot: each channel is its
    // own modifier class + its own CSS ring stroke).
    const isRangeSelected = !isHero && !isVacant && seat === rangeSelectedSeat;
    const sampleBand = isHero || isVacant || isFolded ? null : quantizeSampleBand(sampleSize);

    let classes = 'seat-circle';
    if (isHero) classes += ' hero';
    if (isVacant) classes += ' vacant';
    else if (isFolded) classes += ' folded';
    if (isFocused && !isVacant) classes += ' focused';
    if (isPinned && !isVacant) classes += ' pinned';
    if (isRangeSelected) classes += ' rule-v-selected';
    if (sampleBand) classes += ` ring-band-${sampleBand}`;
    if (!isHero && !isVacant && style !== 'unknown') classes += ` style-${style}`;

    const seatLabel = regSeatNo !== undefined ? regSeatNo : seat;
    const displayText = isHero ? '\u2605' : seatLabel;

    html += `<div class="${classes}" style="left:${pos.x - 16}px;top:${pos.y - 16}px" data-seat="${seat}" title="Seat ${seat}${isHero ? ' (Hero)' : isVacant ? ' (Empty)' : ''}${sampleSize > 0 ? ' \u00B7 ' + sampleSize + 'h' : ''}">`;
    html += displayText;

    // Style dot
    if (!isHero && !isVacant && sampleSize > 0) {
      html += `<span class="seat-style-dot ${style}"></span>`;
    }

    // Sample badge
    if (!isHero && !isVacant && sampleSize > 0) {
      html += `<span class="seat-sample-badge">${sampleSize}</span>`;
    }

    // SR-6.11 §1.1: occupied-zero placeholder. R-4.2 — distinct from "tiny
    // ring" so low-sample vs no-sample are not conflated by the glance.
    if (!isHero && !isVacant && !isFolded && sampleSize === 0) {
      html += `<span class="seat-sample-unknown">\u2014</span>`;
    }

    // Dealer button
    if (seat === dealerSeat) {
      html += `<span class="seat-dealer-btn">D</span>`;
    }

    // Action annotation
    const lastAct = seatLastAction[seat];
    if (lastAct && !isVacant) {
      const actLabel = lastAct.action === 'raise' ? 'R'
        : lastAct.action === 'bet' ? 'B'
        : lastAct.action === 'call' ? 'C'
        : lastAct.action === 'check' ? '\u2713'
        : lastAct.action === 'fold' ? 'F'
        : null;
      if (actLabel) {
        const actColor = lastAct.action === 'raise' ? 'var(--action-raise-text)'
          : lastAct.action === 'bet' ? 'var(--action-bet-text)'
          : lastAct.action === 'call' ? 'var(--action-call-text)'
          : lastAct.action === 'check' ? 'var(--action-check-text)'
          : lastAct.action === 'fold' ? 'var(--action-fold-text)'
          : 'var(--text-faint)';
        const amtStr = lastAct.amount > 0 ? `$${lastAct.amount.toFixed(0)}` : '';
        // .seat-action-tag — Z1/1.10 per-seat last-action label (F/B/C/R/✓), NOT the deleted 1.6 duplicate of 1.5 bet chip.
        html += `<span class="seat-action-tag" style="color:${actColor}">${actLabel}${amtStr ? ' ' + amtStr : ''}</span>`;
      }
    }

    // PF aggressor marker
    if (seat === pfAggressor && !isVacant && !isFolded) {
      html += `<span class="seat-pfa-tag">PFA</span>`;
    }

    html += `</div>`;
  }

  return html;
};

// =========================================================================
// STREET PROGRESS INDICATOR
// =========================================================================

const PROGRESS_STREETS = ['preflop', 'flop', 'turn', 'river'];
const PROGRESS_LABELS = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River' };

/**
 * Build the street progress indicator HTML (Pre · Flop · Turn · River).
 * @param {string|null} currentStreet
 * @returns {string}
 */
export const buildStreetProgressHTML = (currentStreet) => {
  if (!currentStreet) return '';
  const currentIdx = PROGRESS_STREETS.indexOf(currentStreet);
  let html = '';
  for (let i = 0; i < PROGRESS_STREETS.length; i++) {
    if (i > 0) html += '<div class="street-sep"></div>';
    const cls = i === currentIdx ? 'active' : i < currentIdx ? 'past' : '';
    html += `<div class="street-dot ${cls}"><div class="street-dot-circle"></div><span>${PROGRESS_LABELS[PROGRESS_STREETS[i]]}</span></div>`;
  }
  return html;
};

// =========================================================================
// RENDER DEEP EXPANDER
// =========================================================================

/**
 * Build the "More Analysis" (Z4 row 4.2) collapsible content HTML.
 * SR-6.14: split from the former monolithic buildDeepExpanderHTML. Model
 * Audit (row 4.3) now lives in its own builder + its own collapsible DOM
 * because it's debug-flag-gated and must be absent-from-DOM when flag=off
 * (Z4 batch invariant 6).
 *
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @param {string|null} street - Current street (for auto-expand logic)
 * @returns {{ html: string, showButton: boolean }}
 */
export const buildMoreAnalysisHTML = (advice, street = null) => {
  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    return { html: '', showButton: false };
  }

  const tm = advice.treeMetadata;
  const vp = advice.villainProfile;
  const seg = advice.segmentation;

  const autoExpandRange = street === 'flop' || street === 'turn' || street === 'river';
  const autoExpandFoldCurve = street === 'flop' || street === 'turn';

  let html = '';

  if (seg?.handTypes && Object.keys(seg.handTypes).length > 0) {
    html += renderRangeBreakdownSection(seg, { autoOpen: autoExpandRange });
  }
  if (advice.recommendations.length > 1) {
    html += renderAllRecsSection(advice.recommendations);
  }
  if (vp?.streets) {
    html += renderStreetTendenciesSection(vp.streets);
  }
  if (advice.foldMeta?.curve) {
    html += renderFoldCurveSection(advice.foldMeta, advice.recommendations[0]?.sizing?.betFraction, { autoOpen: autoExpandFoldCurve });
  }
  if (advice.foldMeta?.bet?.adjustments) {
    html += renderFoldBreakdownSection(advice.foldMeta, advice.foldPct);
  }
  if (tm?.comboStats) {
    html += renderComboStatsSection(tm.comboStats);
  }
  if (vp?.vulnerabilities?.length > 0) {
    html += renderVulnerabilitiesSection(vp.vulnerabilities);
  }

  return { html, showButton: html.length > 0 };
};

/**
 * Build the "Model Audit" (Z4 row 4.3) collapsible content HTML. Debug-flag
 * gated — the caller is responsible for checking `settings.debugDiagnostics`
 * and omitting the DOM entirely when flag=off (Z4 batch invariant 6).
 *
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @returns {{ html: string, showButton: boolean }}
 */
export const buildModelAuditHTML = (advice) => {
  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    return { html: '', showButton: false };
  }
  const tm = advice.treeMetadata;
  const mq = advice.modelQuality;
  if (!tm && !mq) return { html: '', showButton: false };
  return {
    html: renderModelAuditSection(mq, tm, advice.villainSampleSize),
    showButton: true,
  };
};

// =========================================================================
// RENDER STATUS BAR
// =========================================================================

/**
 * Build status bar text and dot class.
 *
 * @param {Object|null} pipeline
 * @param {number} handCount
 * @returns {{ dotClass: string, text: string }}
 */
export const buildStatusBar = (pipeline, handCount) => {
  if (!pipeline) {
    return { dotClass: 'status-dot yellow', text: 'Service worker not responding' };
  }

  const tableCount = pipeline?.tableCount || 0;
  const tables = pipeline?.tables || {};
  const tableIds = Object.keys(tables);
  const tableLabel = tableIds.length > 0 ? ` (id:${tableIds[0]})` : '';

  if (tableCount > 0 && handCount > 0) {
    return { dotClass: 'status-dot green', text: `Tracking${tableLabel} \u00B7 ${handCount} hands` };
  } else if (handCount > 0) {
    return { dotClass: 'status-dot green', text: `${handCount} hands captured` };
  } else if (tableCount > 0) {
    return { dotClass: 'status-dot yellow', text: `Connected${tableLabel} \u2014 waiting for hands` };
  } else {
    return { dotClass: 'status-dot yellow', text: '' }; // Caller fills via diagnostic status
  }
};
