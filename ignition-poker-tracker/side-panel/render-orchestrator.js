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
export const computeFocusedVillain = ({ pinnedVillainSeat, lastGoodAdvice, currentLiveContext, currentTableState }) => {
  const heroSeat = currentLiveContext?.heroSeat || currentTableState?.heroSeat;
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
  if (hasAdvice && advice.potSize > 0) {
    html += `<span class="pot-inline">$${advice.potSize.toFixed(0)}</span>`;
  } else if (live?.pot > 0) {
    html += `<span class="pot-inline">$${live.pot.toFixed(0)}</span>`;
  }
  const street = live?.currentStreet || advice?.currentStreet;
  if (street) {
    html += `<span class="pill street">${escapeHtml(street)}</span>`;
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
// RENDER SEAT ARC
// =========================================================================

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

    let classes = 'seat-circle';
    if (isHero) classes += ' hero';
    if (isVacant) classes += ' vacant';
    else if (isFolded) classes += ' folded';
    if (isFocused && !isVacant) classes += ' focused';
    if (isPinned && !isVacant) classes += ' pinned';
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
 * Build the deep expander content HTML.
 *
 * @param {Object|null} advice - From useLiveActionAdvisor
 * @param {string|null} street - Current street (for auto-expand logic)
 * @returns {{ html: string, showButton: boolean }}
 */
export const buildDeepExpanderHTML = (advice, street = null) => {
  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    return { html: '', showButton: false };
  }

  const tm = advice.treeMetadata;
  const mq = advice.modelQuality;
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
  if (tm || mq) {
    html += renderModelAuditSection(mq, tm, advice.villainSampleSize);
  }
  if (vp?.vulnerabilities?.length > 0) {
    html += renderVulnerabilitiesSection(vp.vulnerabilities);
  }

  return { html, showButton: true };
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
