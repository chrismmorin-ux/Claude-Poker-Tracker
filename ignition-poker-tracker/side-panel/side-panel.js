/**
 * side-panel/side-panel.js — HUD rendering + exploit display (push-only)
 *
 * Connects to the service worker via chrome.runtime.Port for push-based
 * updates. No polling — all data arrives through port messages or is
 * read from chrome.storage on push triggers.
 */

import { injectTokens } from '../shared/design-tokens.js';
import * as stats from '../shared/stats-engine.js';
import * as cardUtils from '../shared/card-utils.js';
import { createPortConnection, EXTENSION_VERSION } from '../shared/port-connect.js';
import { MSG, SESSION_KEYS } from '../shared/constants.js';
import * as errors from '../shared/error-reporter.js';
import { $, showEl, hideEl, isHidden, escapeHtml, renderCard, renderStatRow, buildSeatArcPositions, renderMiniCard } from './render-utils.js';
import {
  renderRangeBreakdownSection,
  renderAllRecsSection, renderStreetTendenciesSection,
  renderFoldCurveSection, renderFoldBreakdownSection,
  renderComboStatsSection, renderModelAuditSection,
  renderVulnerabilitiesSection,
} from './render-tiers.js';
import { renderStreetCard } from './render-street-card.js';
import {
  computeFocusedVillain as _computeFocusedVillain,
  buildActionBarHTML,
  buildContextStripHTML,
  buildCardsStripHTML,
  buildPlanPanelHTML,
  classifyDecisionState,
  classifyBetweenHandsMode,
  buildBetweenHandsHTML,
  buildSeatArcHTML,
  buildDeepExpanderHTML,
  buildStreetProgressHTML,
  buildStatusBar,
} from './render-orchestrator.js';
import { RenderCoordinator, PRIORITY } from './render-coordinator.js';

injectTokens();

(() => {
  'use strict';

  // App URL — use prod if extension is from web store, else localhost dev server
  // Appends #online to deep-link directly to the Online Play view
  const APP_URL_PROD = 'https://poker-tracker-68b97.web.app';
  const APP_URL_DEV = 'http://localhost:5173';
  const getAppUrl = () => {
    const base = chrome.runtime.getManifest?.()?.update_url ? APP_URL_PROD : APP_URL_DEV;
    return `${base}#online`;
  };

  // Infrastructure vars (timers, async locks — not renderable state).
  // All renderable state lives exclusively in coordinator._state.
  // RT-60: tourneyTimer, tableGrace, planPanelAutoExpand, staleContext are
  // registered with the coordinator instead of held as module-level `let`
  // vars. clearForTableSwitch() cancels them all, preventing orphan-fire
  // on the next table's context.
  let _refreshInFlight = false;
  let _refreshPendingAfter = false;

  // =========================================================================
  // PORT-BASED CONNECTION TO SERVICE WORKER (via shared module)
  // =========================================================================

  const conn = createPortConnection({
    name: 'side-panel',
    initialDelay: 1000,
    maxDelay: 30000,

    onMessage: (message) => {
      switch (message.type) {
        case 'push_pipeline_status':
          handlePipelineStatus(message);
          break;
        case 'push_hands_updated':
          handleHandsUpdated(message.totalHands);
          break;
        case 'push_exploits':
          handleExploitsPush(message);
          break;
        case 'push_action_advice':
          handleAdvicePush(message);
          break;
        case 'push_live_context':
          handleLiveContextPush(message);
          break;
        case 'push_tournament':
          handleTournamentPush(message);
          break;
        case 'push_pipeline_diagnostics':
          if (message.data) {
            coordinator.set('cachedDiag', message.data);
            if (message.data.gameWsMessageCount > 0) {
              coordinator.set('recoveryMessage', null);
            }
            scheduleRender('pipeline_diag');
          }
          break;
        case 'push_recovery_needed':
          coordinator.set('recoveryMessage', message.message || 'Connection issue detected. Reload the Ignition page to start capturing.');
          scheduleRender('recovery_needed');
          break;
        case 'push_recovery_cleared':
          coordinator.set('recoveryMessage', null);
          scheduleRender('recovery_cleared');
          break;
        case 'push_silence_alert':
          if (message.level === 'stale' || message.level === 'dead') {
            coordinator.set('recoveryMessage', message.message || 'No game traffic detected. Reload the Ignition page.');
            scheduleRender('silence_alert');
          }
          break;
      }
    },

    onConnect: () => {
      console.log('[Side Panel] Port connected');
      coordinator.set('connState', { connected: true });
    },

    onDisconnect: () => {
      coordinator.set('connState', { connected: false });
      $('status-dot').className = 'status-dot yellow';
      $('status-text').textContent = 'Reconnecting...';
    },

    onContextDead: () => {
      $('status-dot').className = 'status-dot red';
      $('status-text').textContent = 'Extension disconnected — reload page';
    },

    onVersionMismatch: (swVersion) => {
      console.warn(`[Side Panel] Version mismatch — panel: ${EXTENSION_VERSION}, SW: ${swVersion}`);
      $('status-text').textContent = 'Version mismatch — close & reopen panel';
    },
  });

  // Refresh button — request full state push from SW
  const refreshBtn = $('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      conn.send({ type: 'request_full_state' });
    });
  }

  // =========================================================================
  // RECOVERY BANNER — shown when WS capture needs page reload
  // =========================================================================

  const recoveryBanner = $('recovery-banner');
  const recoveryText = $('recovery-text');
  const recoveryBtn = $('recovery-reload-btn');

  const showRecoveryBanner = (message) => {
    if (!recoveryBanner) return;
    if (recoveryText && message) recoveryText.textContent = message;
    showEl(recoveryBanner);
  };

  const hideRecoveryBanner = () => {
    if (recoveryBanner) hideEl(recoveryBanner);
  };

  if (recoveryBtn) {
    recoveryBtn.addEventListener('click', () => {
      recoveryBtn.disabled = true;
      recoveryBtn.textContent = 'Reloading...';
      conn.send({ type: 'reload_ignition_tabs' });
      // Re-enable after 5s in case reload doesn't trigger banner clear
      setTimeout(() => {
        recoveryBtn.disabled = false;
        recoveryBtn.textContent = 'Reload Ignition Page';
      }, 5000);
    });
  }

  // =========================================================================
  // STORAGE LISTENER — auto-refresh when new hands arrive in side panel mirror
  // =========================================================================

  // Storage listener: only update diagnostics (data-only, no render).
  // Hand stats are refreshed via push_hands_updated port message — the storage
  // listener was causing a redundant second render on every hand save.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'session') return;
    if (changes[SESSION_KEYS.PIPELINE_DIAG]) {
      coordinator.set('cachedDiag', changes[SESSION_KEYS.PIPELINE_DIAG].newValue || null);
      scheduleRender('storage_diag');
    }
  });

  // =========================================================================
  // PUSH HANDLERS
  // =========================================================================

  /** Update the app-connection badge in the status bar. */
  const updateAppStatus = (connected) => {
    const badge = $('app-status');
    if (!badge) return;
    if (connected) {
      badge.className = 'app-status connected';
      badge.textContent = 'App synced';
    } else {
      badge.className = 'app-status disconnected';
      badge.textContent = 'App not open';
    }
  };

  /** Handle full pipeline status push (replaces the old poll cycle). */
  const handlePipelineStatus = async (pipeline) => {
    coordinator.set('lastPipeline', pipeline);

    // Find active table
    const tables = pipeline?.tables || {};
    const tableEntries = Object.entries(tables);
    const prevTableId = coordinator.get('currentActiveTableId');

    if (tableEntries.length > 0) {
      // Table present — cancel any pending grace timer (RT-60)
      coordinator.clearTimer('tableGrace');
      const [connId] = tableEntries[0];
      coordinator.set('currentActiveTableId', `table_${connId}`);
      coordinator.set('currentTableState', tableEntries[0][1]);
    } else if (prevTableId && !coordinator._timers.has('tableGrace')) {
      // Tables went empty — start 5s grace period before clearing (RT-60).
      const handle = setTimeout(() => {
        coordinator.clearTimer('tableGrace');
        coordinator.set('currentActiveTableId', null);
        coordinator.set('currentTableState', null);
        coordinator.clearForTableSwitch();
        scheduleRender('table_grace_expired');
      }, 5000);
      coordinator.registerTimer('tableGrace', handle, 'timeout');
    }

    // Clear stale state on actual table switch (different table, not null)
    const newTableId = coordinator.get('currentActiveTableId');
    if (newTableId !== prevTableId && newTableId !== null && prevTableId !== null) {
      coordinator.clearForTableSwitch();
    }

    // RT-59: route through handleLiveContext so position-lock,
    // _receivedAt injection, and pending-advice promotion apply on both
    // push paths (push_live_context + pipeline-status embedded context).
    // Direct coordinator.set() here bypassed all three invariants.
    if (pipeline?.liveContext) {
      coordinator.handleLiveContext(pipeline.liveContext);
    }

    // Process diagnostic data for tournament log
    handleDiagnosticData(pipeline?.diagnosticData);

    // Capture values before async gap (other handlers may mutate coordinator during await)
    const tid = coordinator.get('currentActiveTableId');
    const pip = coordinator.get('lastPipeline');
    await refreshHandStats(tid, pip);
  };

  /** When hands are updated, re-read storage and recompute stats. */
  const handleHandsUpdated = async (_totalHands) => {
    await refreshHandStats(coordinator.get('currentActiveTableId'), coordinator.get('lastPipeline'));
  };

  /** Shared: read hands from storage, compute stats, render. */
  const refreshHandStats = async (activeTableId, pipeline) => {
    // Debounce: if a previous read is in-flight, defer this call
    if (_refreshInFlight) {
      _refreshPendingAfter = true;
      return;
    }
    _refreshInFlight = true;
    _refreshPendingAfter = false;

    try {
      const result = await chrome.storage.session.get(SESSION_KEYS.SIDE_PANEL_HANDS);
      const hands = result[SESSION_KEYS.SIDE_PANEL_HANDS] || [];

      // Use active table's hands only — cross-table fallback mixes seat data
      // from different tables causing wrong player stats
      let tableHands = [];
      if (activeTableId) {
        tableHands = hands.filter(h => h.tableId === activeTableId);
      }
      // Only fall back to recent hands if no active table at all (between sessions)
      if (tableHands.length === 0 && !activeTableId && hands.length > 0) {
        const cutoff = Date.now() - 2 * 60 * 60 * 1000;
        const recentHands = hands.filter(h => (h.capturedAt || h.timestamp || 0) > cutoff);
        tableHands = recentHands.length > 0 ? recentHands : hands.slice(-50);
      }

      if (tableHands.length === 0) {
        const hadHands = coordinator.get('hasTableHands');
        const tableId = coordinator.get('currentActiveTableId');

        // If we previously had hands and still have an active table, this may be
        // a transient storage race. Retry once after 500ms before hiding the HUD.
        if (hadHands && tableId) {
          setTimeout(async () => {
            const currentTableId = coordinator.get('currentActiveTableId');
            if (currentTableId !== tableId) return; // table switched — don't act
            const retry = await chrome.storage.session.get(SESSION_KEYS.SIDE_PANEL_HANDS);
            const retryHands = (retry[SESSION_KEYS.SIDE_PANEL_HANDS] || [])
              .filter(h => h.tableId === currentTableId);
            if (retryHands.length === 0) {
              coordinator.merge({ lastHandCount: 0, cachedSeatStats: null, hasTableHands: false });
              scheduleRender('no_hands_confirmed');
            }
          }, 500);
          return; // Don't render "no table" yet
        }

        coordinator.merge({ lastHandCount: 0, cachedSeatStats: null, hasTableHands: false });
        scheduleRender('no_hands');
        return;
      }

      // Recompute stats only when hand count changes
      if (tableHands.length !== coordinator.get('lastHandCount')) {
        coordinator.merge({
          cachedSeatStats: stats.computeAllSeatStats(tableHands),
          lastHandCount: tableHands.length,
          hasTableHands: true,
        });
      }

      // Build unified seat map (tournament: physical → regSeatNo, cash: null)
      const seatDisplayMap = coordinator.get('currentTableState')?.seatDisplayMap || null;
      coordinator.set('cachedSeatMap', buildUnifiedSeatMap(seatDisplayMap, tableHands));

      scheduleRender('hands_updated');
    } catch (e) {
      console.warn('[Side Panel] refreshHandStats error:', e.message);
    } finally {
      _refreshInFlight = false;
      if (_refreshPendingAfter) {
        _refreshPendingAfter = false;
        refreshHandStats(coordinator.get('currentActiveTableId'), coordinator.get('lastPipeline'));
      }
    }
  };

  const handleExploitsPush = (message) => {
    coordinator.set('exploitPushCount', coordinator.get('exploitPushCount') + 1);
    if (message.seats) {
      const appConnected = message.appConnected !== false;
      coordinator.set('lastGoodExploits', { seats: message.seats, appConnected });

      // Build per-seat lookup for enhanced seat cards
      const seatData = {};
      for (const s of message.seats) {
        seatData[s.seat] = {
          exploitCount: (s.exploits || []).length,
          weaknessCount: (s.weaknesses || []).length,
          style: s.style,
          sampleSize: s.sampleSize || 0,
          stats: s.stats || null,
          villainHeadline: s.villainHeadline || null,
          villainProfile: s.villainProfile || null,
        };
      }
      coordinator.set('appSeatData', seatData);

      coordinator.set('lastGoodWeaknesses', message.seats.flatMap(s =>
        (s.weaknesses || []).map(w => ({ ...w, seat: Number(s.seat), seatStyle: s.style }))
      ));
      coordinator.set('lastGoodBriefings', message.seats.flatMap(s =>
        (s.briefings || []).map(b => ({ ...b, seat: Number(s.seat), seatStyle: s.style }))
      ));
      coordinator.set('lastGoodObservations', message.seats.flatMap(s =>
        (s.observations || []).map(o => ({ ...o, seat: Number(s.seat), seatStyle: s.style }))
      ));

      coordinator.set('appSeatDataVersion', (coordinator.get('appSeatDataVersion') || 0) + 1);
      scheduleRender('exploits');
    }
  };

  const handleAdvicePush = (message) => {
    if (message.advice) {
      // RT-45: stamp the hand number currently locked into the coordinator
      // onto the advice BEFORE handing off. Advice that the SW cached and
      // replays after a hand boundary carries the stale hand number; the
      // guard in handleAdvice compares against _lockedHandNumber and rejects.
      const stampedAdvice = {
        ...message.advice,
        handNumber: message.advice.handNumber
          ?? coordinator.get('currentLiveContext')?.handNumber
          ?? null,
      };
      const accepted = coordinator.handleAdvice(stampedAdvice);
      if (accepted && !coordinator.get('advicePendingForStreet')) {
        scheduleRender('advice', PRIORITY.IMMEDIATE);
        return;
      }
    }
    scheduleRender('advice');
  };

  const handleLiveContextPush = (message) => {
    if (message.context) {
      coordinator.set('staleContext', false);

      // Detect hero fold → start Mode A timer
      const prevCtx = coordinator.get('currentLiveContext');
      const newCtx = message.context;
      const heroSeat = newCtx.heroSeat || coordinator.get('currentTableState')?.heroSeat;
      const wasHeroFolded = prevCtx && heroSeat != null && (prevCtx.foldedSeats || []).includes(heroSeat);
      const isHeroFolded = heroSeat != null && (newCtx.foldedSeats || []).includes(heroSeat);
      if (!wasHeroFolded && isHeroFolded) {
        coordinator.startModeATimer();
      }
      // New hand → clear Mode A timer
      const isNewHand = newCtx.state === 'DEALING' || (newCtx.state === 'PREFLOP' && !isHeroFolded);
      if (isNewHand) {
        coordinator.clearModeATimer();
      }

      coordinator.handleLiveContext(message.context);
      scheduleRender('live_context');
    }
  };

  // Two-phase stale context: 60s = stale indicator, 120s = full clear to between-hands.
  // Phase 1 keeps last content visible with a subtle badge so the user can still read it.
  // Phase 2 fully clears to between-hands (true session end / table close).
  // RT-60: registered so clearForTableSwitch cancels it on lifecycle events.
  {
    const handle = setInterval(() => {
      const ctx = coordinator.get('currentLiveContext');
      if (ctx?._receivedAt) {
        const age = Date.now() - ctx._receivedAt;
        if (age > 120_000) {
          coordinator.set('currentLiveContext', null);
          coordinator.set('staleContext', false);
          coordinator.set('advicePendingForStreet', null); // Fix 3: unblock waiting state
          scheduleRender('stale_full_clear');
        } else if (age > 60_000 && !coordinator.get('staleContext')) {
          coordinator.set('staleContext', true);
          scheduleRender('stale_indicator');
        }
      }
    }, 10_000);
    coordinator.registerTimer('staleContext', handle, 'interval');
  }

  // =========================================================================
  // TOURNAMENT PANEL
  // =========================================================================

  /**
   * Display basic tournament info from raw Ignition level data.
   * Used as a lightweight fallback before the main app provides structured data.
   */
  const renderRawTournamentInfo = (levelInfo) => {
    const bar = $('tournament-bar');
    if (!bar) return;

    // Coerce numerically-typed protocol fields so a string-injected value
    // displays as NaN rather than surviving as raw HTML. Source is WebSocket
    // protocol parse with no type enforcement — treat as untrusted input.
    const toNum = (v) => (v == null ? null : Number(v));
    const level = toNum(levelInfo.level) ?? toNum(levelInfo.levelNo);
    const sb = toNum(levelInfo.sb) ?? toNum(levelInfo.smallBlind);
    const bb = toNum(levelInfo.bb) ?? toNum(levelInfo.bigBlind);
    const ante = toNum(levelInfo.ante) ?? 0;

    if (level == null && sb == null) return;

    let blindStr = '';
    if (sb != null && bb != null) {
      blindStr = `${sb}/${bb}`;
      if (ante > 0) blindStr += ` A${ante}`;
    }

    const levelText = level == null ? '?' : String(level);

    showEl(bar);
    bar.innerHTML = `<span class="tourney-bar-info">Level ${escapeHtml(levelText)}</span>`
      + `<span class="tourney-bar-sep"></span>`
      + `<span class="tourney-bar-info">${escapeHtml(blindStr)}</span>`
      + `<span style="margin-left:auto;font-size:9px;color:var(--text-faint)">Open app for full analysis</span>`;
  };

  const handleTournamentPush = (message) => {
    coordinator.set('lastGoodTournament', message.tournament);
    scheduleRender('tournament');
  };

  const renderTournamentPanel = (t) => {
    const bar = $('tournament-bar');
    const detail = $('tournament-detail');
    const detailContent = $('tournament-detail-content');
    if (!bar) return;

    if (!t) {
      hideEl(bar);
      if (detail) detail.classList.remove('open');
      coordinator.clearTimer('tourneyTimer'); // RT-60
      return;
    }

    const ZONE_COLORS = {
      comfortable: '#22c55e', caution: '#eab308',
      pushFold: '#f97316', shoveOnly: '#ef4444',
    };

    // ── Slim bar ──
    const zone = t.mRatioGuidance?.zone || 'comfortable';
    const mColor = ZONE_COLORS[zone] || '#22c55e';
    const playersText = t.totalEntrants
      ? `${t.playersRemaining || '?'}/${t.totalEntrants}`
      : t.playersRemaining ? `${t.playersRemaining} left` : '';

    let barHtml = '';
    if (t.heroMRatio != null) {
      barHtml += `<span class="tourney-m-label">M</span>`;
      barHtml += `<span class="tourney-m-value" style="color:${mColor}">${t.heroMRatio.toFixed(1)}</span>`;
    }
    // ICM badge
    if (t.icmPressure && t.icmPressure.zone !== 'standard') {
      const icmLabels = { bubble: 'BUBBLE', approaching: 'NEAR BUBBLE', itm: 'ITM' };
      const icmClass = { bubble: 'icm-bubble', approaching: 'icm-approaching', itm: 'icm-itm' };
      const label = icmLabels[t.icmPressure.zone];
      const cls = icmClass[t.icmPressure.zone];
      if (label && cls) barHtml += `<span class="tourney-icm-badge ${cls}">${label}</span>`;
    }
    barHtml += `<span class="tourney-bar-sep"></span>`;
    barHtml += `<span class="tourney-bar-info">Lvl ${(t.currentLevelIndex || 0) + 1}</span>`;
    if (playersText) barHtml += `<span class="tourney-bar-info">${playersText}</span>`;

    // Timer
    barHtml += `<span class="tourney-bar-timer" id="tourney-bar-timer"></span>`;
    barHtml += `<span class="tourney-bar-chevron${coordinator.get('tournamentCollapsed') ? '' : ' open'}" id="tourney-bar-chevron">\u25BE</span>`;

    showEl(bar);
    bar.innerHTML = barHtml;

    // Timer countdown — RT-52: re-query DOM element on each tick (innerHTML replaces it)
    // RT-60: registered via coordinator so table switch / unload cancels it.
    coordinator.clearTimer('tourneyTimer');
    if (t.levelEndTime) {
      const endTime = t.levelEndTime;
      const updateTimer = () => {
        const el = $('tourney-bar-timer'); // re-query after potential innerHTML rewrite
        if (!el) return;
        const remaining = Math.max(0, endTime - Date.now());
        const totalSec = Math.floor(remaining / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
          el.textContent = '0:00';
          coordinator.clearTimer('tourneyTimer');
        }
      };
      updateTimer();
      coordinator.registerTimer('tourneyTimer', setInterval(updateTimer, 1000), 'interval');
    }

    // Click to expand/collapse detail
    bar.onclick = () => {
      const isCollapsed = !coordinator.get('tournamentCollapsed');
      coordinator.set('tournamentCollapsed', isCollapsed);
      const chevron = $('tourney-bar-chevron');
      if (isCollapsed) {
        detail.classList.remove('open');
        if (chevron) chevron.classList.remove('open');
      } else {
        detail.classList.add('open');
        if (chevron) chevron.classList.add('open');
      }
    };
    // Sync initial state
    const collapsed = coordinator.get('tournamentCollapsed');
    if (!collapsed) detail.classList.add('open');
    else detail.classList.remove('open');

    // ── Detail content ──
    if (!detailContent) return;
    let dHtml = '';

    // M-Ratio bar
    if (t.heroMRatio != null) {
      const barPct = Math.min(100, (t.heroMRatio / 30) * 100);
      dHtml += `<div class="tourney-section">
        <div class="flex-between" style="margin-bottom:3px">
          <span class="tourney-section-label">M-Ratio</span>
          <span class="tourney-mratio-value" style="color:${mColor}">${t.heroMRatio.toFixed(1)}</span>
        </div>
        <div class="tourney-bar-track"><div class="tourney-bar-fill" style="width:${barPct}%;background:${mColor}"></div></div>
        <div class="tourney-guidance" style="color:${mColor}">${escapeHtml(t.mRatioGuidance?.label || '')}</div>
      </div>`;
    }

    // Blinds
    if (t.currentBlinds) {
      const cb = t.currentBlinds;
      let label = `${cb.sb}/${cb.bb}`;
      if (cb.ante > 0) label += ` ante ${cb.ante}`;
      dHtml += `<div class="tourney-section">
        <div class="tourney-section-label">Blinds</div>
        <div class="tourney-section-value">${label}</div>`;
      if (t.nextBlinds) {
        const nb = t.nextBlinds;
        let next = `${nb.sb}/${nb.bb}`;
        if (nb.ante > 0) next += ` ante ${nb.ante}`;
        dHtml += `<div class="tourney-blinds-next">Next: ${next}</div>`;
      }
      dHtml += `</div>`;
    }

    // Stack
    if (t.heroStack > 0) {
      const bb = t.currentBlinds?.bb || 1;
      const bbRem = Math.round(t.heroStack / bb);
      let stackInfo = `${t.heroStack.toLocaleString()} (${bbRem} BB)`;
      if (t.avgStack > 0) {
        stackInfo += ` \u00B7 Avg: ${t.avgStack.toLocaleString()} (${(t.heroStack / t.avgStack * 100).toFixed(0)}%)`;
      }
      dHtml += `<div class="tourney-section">
        <div class="tourney-section-label">Stack</div>
        <div class="tourney-section-value">${stackInfo}</div>
      </div>`;
    }

    // Blind-out
    if (t.blindOutInfo) {
      const mins = t.blindOutInfo.wallClockMinutes || 0;
      const levels = t.blindOutInfo.levelsRemaining || 0;
      dHtml += `<div class="tourney-section">
        <div class="tourney-section-label">Blind-Out</div>
        <div class="tourney-section-value">${levels} level${levels !== 1 ? 's' : ''} / ~${mins} min</div>
      </div>`;
    }

    // ICM
    if (t.icmPressure && t.icmPressure.zone !== 'standard') {
      const icmLabels = { bubble: 'On the bubble', approaching: 'Approaching bubble', itm: 'In the money' };
      let icmDetail = icmLabels[t.icmPressure.zone] || '';
      if (t.icmPressure.playersFromBubble > 0) {
        icmDetail += ` (${t.icmPressure.playersFromBubble} away)`;
      }
      dHtml += `<div class="tourney-section">
        <div class="tourney-section-label">ICM</div>
        <div class="tourney-section-value">${escapeHtml(icmDetail)}</div>
      </div>`;
    }

    // Milestones
    const milestones = t.predictions?.milestones || [];
    if (milestones.length > 0) {
      dHtml += `<div class="tourney-section"><div class="tourney-section-label">Milestones</div>`;
      for (const m of milestones) {
        const mins = Math.round(m.estimatedMinutes || 0);
        const label = m.milestone === 'bubble' ? 'Bubble' : m.milestone === 'finalTable' ? 'Final Table' : m.milestone;
        const timeStr = mins < 60 ? `~${mins}m` : `~${(mins / 60).toFixed(1)}h`;
        dHtml += `<div class="milestone-row"><span class="milestone-label">${escapeHtml(label)}</span><span class="milestone-time">${timeStr}</span></div>`;
      }
      dHtml += `</div>`;
    }

    // Progress
    if (t.progress != null) {
      dHtml += `<div class="tourney-section">
        <div class="flex-between" style="margin-bottom:2px">
          <span class="tourney-section-label">Progress</span>
          <span class="tourney-progress-pct">${t.progress}% eliminated</span>
        </div>
        <div class="tourney-progress-track"><div class="tourney-progress-fill" style="width:${t.progress}%"></div></div>
      </div>`;
    }

    detailContent.innerHTML = dHtml;
  };

  // =========================================================================
  // STATUS BAR
  // =========================================================================

  /**
   * Update status bar — delegates text/class computation to render-orchestrator.js.
   */
  const updateStatusBar = (pipeline, handCount, diagData, fallbackState) => {
    const dot = $('status-dot');
    const text = $('status-text');

    if (!dot || !text) return; // DOM not ready
    $('hand-count').textContent = handCount;

    const result = buildStatusBar(pipeline, handCount);
    dot.className = result.dotClass;
    text.textContent = result.text || getDiagnosticStatus(diagData, fallbackState);
  };

  /** Generate a stage-aware status message from pipeline diagnostics. */
  const getDiagnosticStatus = (d, fallback) => {
    if (!d) {
      if (fallback) {
        if (fallback.capturePorts === 0) {
          return 'Capture script not running — open Ignition page';
        }
        return 'Capture connected but diagnostics unavailable';
      }
      return 'Connecting to capture...';
    }
    if (!d.probeReady) {
      const elapsed = Date.now() - (d.captureStartedAt || Date.now());
      return elapsed > 6000
        ? 'Probe not detected — try refreshing page'
        : 'Waiting for WebSocket probe...';
    }
    if (d.wsMessageCount === 0) return 'Probe active — waiting for WS traffic...';
    if (d.gameWsMessageCount === 0) return 'WS traffic detected — no game messages (URL mismatch?)';
    return 'Game messages received — building table state...';
  };

  // =========================================================================
  // PIPELINE HEALTH STRIP — visual indicator for each capture stage
  // =========================================================================

  const renderPipelineHealth = (snap) => {
    const healthEl = $('pipeline-health');
    if (!healthEl) return;

    const d = snap?.cachedDiag ?? coordinator.get('cachedDiag');
    const connState = snap?.connState ?? conn.getState();
    const now = Date.now();
    const detail = $('pipeline-detail');

    const setDot = (id, state) => {
      const dot = $(`stage-dot-${id}`);
      if (dot) dot.className = `stage-dot ${state}`;
    };

    // No diagnostics at all — check SW fallback for more info
    const fallback = snap?.swFallbackState ?? coordinator.get('swFallbackState');
    if (!d) {
      setDot('probe', 'unknown');
      setDot('bridge', 'unknown');
      setDot('filter', 'unknown');
      if (fallback) {
        setDot('port', fallback.capturePorts > 0 ? 'ok' : 'fail');
        setDot('panel', connState.connected ? 'ok' : 'warn');
        if (detail) {
          if (fallback.capturePorts === 0) {
            detail.textContent = 'No capture script connected to the service worker. '
              + 'Make sure the Ignition Casino page is open (.eu or .net) and refresh it.';
          } else {
            detail.textContent = 'Capture port connected but diagnostics not received. '
              + 'Try refreshing the Ignition page.';
          }
        }
      } else {
        setDot('port', 'unknown');
        setDot('panel', connState.connected ? 'ok' : 'warn');
        if (detail) detail.textContent = 'Waiting for capture script — is the Ignition page open?';
      }
      return;
    }

    const elapsed = now - (d.captureStartedAt || now);

    // Stage 1: Probe
    if (d.probeReady) {
      setDot('probe', 'ok');
    } else if (elapsed > 6000) {
      setDot('probe', 'fail');
    } else {
      setDot('probe', 'warn');
    }

    // Stage 2: Bridge (WS messages received from probe)
    if (d.wsMessageCount > 0) {
      setDot('bridge', 'ok');
    } else if (d.probeReady && elapsed > 10000) {
      setDot('bridge', 'warn');
    } else {
      setDot('bridge', d.probeReady ? 'warn' : 'unknown');
    }

    // Stage 3: Filter (game WS messages passed isGameWsUrl)
    if (d.gameWsMessageCount > 0) {
      setDot('filter', 'ok');
    } else if (d.wsMessageCount > 0 && d.gameWsMessageCount === 0) {
      setDot('filter', 'fail'); // URL mismatch!
    } else {
      setDot('filter', 'unknown');
    }

    // Stage 4: Port (capture → SW connection)
    if (d.capturePortConnected) {
      setDot('port', 'ok');
    } else if (d.capturePortConnectCount > 0) {
      setDot('port', 'warn'); // reconnecting
    } else if (elapsed > 5000) {
      setDot('port', 'fail');
    } else {
      setDot('port', 'unknown');
    }

    // Stage 5: Panel (side panel → SW connection)
    setDot('panel', connState.connected ? 'ok' : 'warn');

    // Detail text — explain the first broken stage
    if (detail) {
      detail.innerHTML = getPipelineDetailHTML(d, elapsed);
    }

    // Fix 6e: Message counter summary
    const counterEl = $('pipeline-msg-counters');
    if (counterEl) {
      const ctxAge = d.lastLiveContextAt ? `${Math.round((now - d.lastLiveContextAt) / 1000)}s` : '\u2014';
      counterEl.textContent = `ctx: ${d.liveContextPushCount || 0} (${ctxAge} ago) \u00B7 hands: ${d.handCompletedCount || 0}`;
      counterEl.style.display = '';
    }
  };

  /** Build detail text explaining the first broken pipeline stage. */
  const getPipelineDetailHTML = (d, elapsed) => {
    if (!d.probeReady && elapsed > 6000) {
      return 'WebSocket probe did not inject. Try refreshing the Ignition page.';
    }

    if (d.probeReady && d.wsMessageCount === 0 && elapsed > 10000) {
      return 'Probe is active but no WebSocket messages received. The poker client may not have opened a connection yet — navigate to a table.';
    }

    if (d.wsMessageCount > 0 && d.gameWsMessageCount === 0) {
      const urls = (d.seenWsUrls || []).map(u => escapeHtml(u)).join('<br>');
      return `WebSocket traffic detected but no game messages. URL mismatch?<br>`
        + `<span class="pipeline-urls">Seen: ${urls || 'none'}<br>Expected: pkscb.ignitioncasino.{eu,net}/poker-games/rgs</span>`;
    }

    if (!d.capturePortConnected && d.capturePortConnectCount === 0 && elapsed > 5000) {
      return 'Capture script cannot reach the service worker. Try reloading the extension.';
    }

    if (d.gameWsMessageCount > 0 && (d.tableCount || 0) === 0) {
      return 'Game messages received but no table state built yet — waiting for hand start...';
    }

    if (d.probeReady && d.wsMessageCount === 0) {
      return 'Probe active — waiting for WebSocket traffic...';
    }

    if (!d.probeReady) {
      return 'Waiting for WebSocket probe to initialize...';
    }

    // Everything looks OK but no hands yet
    if (d.tableCount > 0) {
      let html = `Connected to ${d.tableCount} table(s) — waiting for first hand to complete.`;
      // Fix 6b: Enhanced audit timing info
      if (d.lastHandCompletedAt) {
        const handAge = Math.round((Date.now() - d.lastHandCompletedAt) / 1000);
        html += `<br><span style="color:var(--text-muted);font-size:10px">Last hand: ${handAge}s ago \u00B7 ${d.handCompletedCount || 0} total</span>`;
      }
      if (d.lastLiveContextAt) {
        const ctxAge = Math.round((Date.now() - d.lastLiveContextAt) / 1000);
        html += `<br><span style="color:var(--text-muted);font-size:10px">Live context: ${ctxAge}s ago \u00B7 ${d.liveContextPushCount || 0} pushes</span>`;
      }
      if (d.batchedFrameCount > 0) {
        html += `<br><span style="color:var(--text-muted);font-size:10px">Batched frames: ${d.batchedFrameCount}, total messages: ${d.totalParsedMessages}</span>`;
      }
      return html;
    }

    return '';
  };

  /** Render PID distribution summary when diagnostics include pidCounts. */
  const renderPidSummary = (pidCounts) => {
    const pidEl = $('pid-summary');
    if (!pidEl) return;
    if (!pidCounts || Object.keys(pidCounts).length === 0) {
      hideEl(pidEl);
      return;
    }
    showEl(pidEl);

    const CRITICAL_PIDS = ['CO_BLIND_INFO', 'CO_CHIPTABLE_INFO', 'CO_OPTION_INFO'];
    const entries = Object.entries(pidCounts).sort((a, b) => b[1] - a[1]);
    let html = '<div style="font-size:10px;color:var(--text-secondary);padding:4px 8px">';
    html += `<div style="margin-bottom:2px;color:var(--text-muted)">PIDs (${entries.length} types, ${entries.reduce((s, e) => s + e[1], 0)} msgs)</div>`;
    for (const [pid, count] of entries.slice(0, 20)) {
      const isCritical = CRITICAL_PIDS.includes(pid);
      const color = isCritical && count === 0 ? 'color:var(--m-red)' : isCritical ? 'color:var(--m-green)' : '';
      html += `<span style="margin-right:6px;${color}">${escapeHtml(pid.replace('CO_', '').replace('PLAY_', ''))}:${escapeHtml(String(count))}</span>`;
    }
    html += '</div>';
    pidEl.innerHTML = html;
  };

  // =========================================================================
  // SEAT IDENTITY TRANSLATION (single boundary — physical → display keys)
  // =========================================================================

  /**
   * Build unified seat display map from live HSM + archived hand snapshots.
   * Returns the most complete physical → regSeatNo mapping available.
   * Returns null for cash games (no mapping data anywhere).
   */
  const buildUnifiedSeatMap = (liveSeatDisplayMap, hands) => {
    const unified = {};
    for (const hand of hands) {
      const map = hand.ignitionMeta?.seatDisplayMap;
      if (map) Object.assign(unified, map);
    }
    if (liveSeatDisplayMap) Object.assign(unified, liveSeatDisplayMap);
    return Object.keys(unified).length > 0 ? unified : null;
  };

  // =========================================================================
  // SEAT ARC — Semicircle poker table layout
  // =========================================================================

  /**
   * Render seat arc — delegates HTML generation to render-orchestrator.js.
   * @param {Object} physicalStats - { [physicalSeat]: statsObj } from stats engine
   * @param {Object} tableState - From HSM getState()
   * @param {Object|null} seatMap - Unified physical → regSeatNo map (null for cash)
   */
  const renderSeatArc = (physicalStats, tableState, seatMap, snap) => {
    const arc = $('seat-arc');
    if (!arc) return;
    const html = buildSeatArcHTML(physicalStats, tableState, seatMap, {
      currentLiveContext: snap.currentLiveContext,
      appSeatData: snap.appSeatData,
      focusedVillainSeat: snap.focusedVillainSeat,
      pinnedVillainSeat: snap.pinnedVillainSeat,
      containerWidth: arc.offsetWidth || 380,
    });
    if (arc.innerHTML === html) return; // skip redundant DOM write
    arc.innerHTML = html;
  };

  // =========================================================================
  // ZONE 1: ACTION BAR
  // =========================================================================

  const renderActionBar = (advice, liveCtx, snap) => {
    const el = $('action-bar');
    if (!el) return;
    const result = buildActionBarHTML(advice, liveCtx, {
      focusedVillainSeat: snap.focusedVillainSeat,
      pinnedVillainSeat: snap.pinnedVillainSeat,
      appSeatData: snap.appSeatData,
      currentTableState: snap.currentTableState,
      currentLiveContext: snap.currentLiveContext,
    });
    if (el.className === result.className && el.innerHTML === result.html) return;
    showEl(el);
    el.className = result.className;
    el.innerHTML = result.html;
  };

  // =========================================================================
  // ZONE 2: CONTEXT STRIP
  // =========================================================================

  const renderContextStrip = (advice, liveCtx, snap) => {
    const el = $('context-strip');
    if (!el) return;
    const result = buildContextStripHTML(advice, liveCtx, {
      focusedVillainSeat: snap.focusedVillainSeat,
      currentLiveContext: snap.currentLiveContext,
    });
    if (!result.html) { hideEl(el); return; }
    if (el.className === result.className && el.innerHTML === result.html) return;
    showEl(el);
    el.className = result.className;
    el.innerHTML = result.html;
  };

  // =========================================================================
  // CARDS STRIP — Board + hero cards (compact)
  // =========================================================================

  const renderCardsStrip = (advice, liveContext, snap) => {
    const el = $('cards-strip');
    if (!el) return;
    const result = buildCardsStripHTML(advice, liveContext, {
      currentTableState: snap.currentTableState,
      currentLiveContext: snap.currentLiveContext,
    });
    if (!result.html) { hideEl(el); return; }
    if (el.className === result.className && el.innerHTML === result.html) return;
    showEl(el);
    el.className = result.className;
    el.innerHTML = result.html;
  };

  // =========================================================================
  // ZONE 3: PLAN PANEL
  // =========================================================================

  // RT-60: planPanelAutoExpand registered with coordinator (was module-let).

  const renderPlanPanel = (advice, liveCtx, snap) => {
    const el = $('plan-panel');
    const body = $('pp-body');
    if (!el || !body) return;

    const decisionState = classifyDecisionState(advice, liveCtx);
    const result = buildPlanPanelHTML(advice, liveCtx, {
      focusedVillainSeat: snap.focusedVillainSeat,
      pinnedVillainSeat: snap.pinnedVillainSeat,
      appSeatData: snap.appSeatData,
      decisionState,
    });

    if (!result.html) { hideEl(el); return; }

    showEl(el);
    if (body.innerHTML !== result.html) {
      body.innerHTML = result.html;
    }

    // Auto-expand after 8 seconds if user hasn't toggled (RT-60 registered)
    coordinator.clearTimer('planPanelAutoExpand');
    const isOpen = coordinator.get('planPanelOpen');
    if (isOpen) {
      body.classList.add('open');
    } else {
      const handle = setTimeout(() => {
        coordinator.set('planPanelOpen', true);
        body.classList.add('open');
        const chevron = $('pp-chevron');
        if (chevron) chevron.classList.add('open');
        const toggle = $('pp-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
      }, 8000);
      coordinator.registerTimer('planPanelAutoExpand', handle, 'timeout');
    }
  };

  const ppToggle = $('pp-toggle');
  if (ppToggle) {
    ppToggle.addEventListener('click', () => {
      coordinator.clearTimer('planPanelAutoExpand');
      const isOpen = !coordinator.get('planPanelOpen');
      coordinator.set('planPanelOpen', isOpen);
      const body = $('pp-body');
      const chevron = $('pp-chevron');
      if (body) body.classList.toggle('open', isOpen);
      if (chevron) chevron.classList.toggle('open', isOpen);
      ppToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // =========================================================================
  // BETWEEN-HANDS PANEL — Modes A/B/C
  // =========================================================================

  const renderBetweenHands = (snap) => {
    const betweenEl = $('between-hands');
    const streetCard = $('street-card');
    if (!betweenEl) return;

    const heroSeat = snap.currentLiveContext?.heroSeat
      || snap.currentTableState?.heroSeat;
    const mode = classifyBetweenHandsMode(
      snap.currentLiveContext,
      heroSeat,
      snap.lastGoodAdvice,
      snap.modeAExpired
    );

    if (mode === null) {
      // Hero is active — hide between-hands, show street-card
      hideEl(betweenEl);
      if (streetCard) showEl(streetCard);
      return;
    }

    // Between-hands — hide street-card, show between-hands
    if (streetCard) hideEl(streetCard);
    showEl(betweenEl);

    const result = buildBetweenHandsHTML(mode, {
      liveContext: snap.currentLiveContext,
      lastGoodAdvice: snap.lastGoodAdvice,
      appSeatData: snap.appSeatData || {},
      focusedVillainSeat: snap.focusedVillainSeat,
    });

    if (betweenEl.className === result.className && betweenEl.innerHTML === result.html) return;
    betweenEl.className = result.className;
    betweenEl.innerHTML = result.html;
  };

  // =========================================================================
  // DEEP EXPANDER — "More Analysis" toggle
  // =========================================================================

  const deepExpanderBtn = $('deep-expander-btn');
  const deepExpanderContent = $('deep-expander-content');
  const deepExpanderChevron = $('deep-expander-chevron');

  if (deepExpanderBtn) {
    deepExpanderBtn.addEventListener('click', () => {
      const isOpen = !coordinator.get('deepExpanderOpen');
      coordinator.set('deepExpanderOpen', isOpen);
      if (isOpen) {
        deepExpanderContent.classList.add('open');
        deepExpanderChevron.classList.add('open');
      } else {
        deepExpanderContent.classList.remove('open');
        deepExpanderChevron.classList.remove('open');
      }
    });
  }

  /**
   * Render deep expander — delegates HTML generation to render-orchestrator.js.
   */
  const renderDeepExpander = (advice, street, snap) => {
    const btn = $('deep-expander-btn');
    const content = $('deep-expander-content');
    if (!btn || !content) return;

    const result = buildDeepExpanderHTML(advice, street);

    if (!result.showButton) {
      hideEl(btn);
      return;
    }

    showEl(btn);

    // Auto-open the expander container on postflop streets
    if (street && street !== 'preflop' && !snap.deepExpanderOpen) {
      coordinator.set('deepExpanderOpen', true);
      content.classList.add('open');
      if (deepExpanderChevron) deepExpanderChevron.classList.add('open');
    }

    if (content.innerHTML === result.html) return;
    content.innerHTML = result.html;

    // RT-49: Restore collapse state from userCollapsedSections after DOM rebuild
    const collapsed = snap.userCollapsedSections;
    for (const section of content.querySelectorAll('.deep-section[data-section]')) {
      const key = section.dataset.section;
      if (key && collapsed.has(key)) {
        section.classList.remove('open');
      }
    }

    // Init collapsible toggles for deep sections inside expander
    for (const header of content.querySelectorAll('.deep-header')) {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        const sectionKey = section.dataset.section;
        const wasOpen = section.classList.contains('open');
        section.classList.toggle('open');
        const sections = coordinator.get('userCollapsedSections');
        if (wasOpen && sectionKey) sections.add(sectionKey);
        else if (sectionKey) sections.delete(sectionKey);
      });
    }
  };

  // =========================================================================
  // APP LAUNCH PROMPT — shown when app isn't connected
  // =========================================================================

  const renderAppLaunchPrompt = (appConnected) => {
    const el = $('app-launch-prompt');
    if (!el) return;

    // Build the prompt HTML
    let promptHtml = '';
    if (!appConnected) {
      promptHtml = `<div class="street-card-section" style="text-align:center;padding:8px 0;border-top:1px solid var(--border-default);margin-top:6px">
        <a href="#" id="launch-app-link" style="color:var(--gold);font-weight:bold;font-size:var(--font-sm);text-decoration:none;cursor:pointer">
          Launch Poker Tracker \u2192
        </a>
        <div style="font-size:var(--font-xs);color:var(--text-faint);margin-top:4px">
          Open app for exploit tips &amp; live advice
        </div>
      </div>`;
    } else {
      promptHtml = `<div class="street-card-section" style="text-align:center;padding:4px 0;font-size:var(--font-xs);color:var(--text-faint)">
        App connected \u2014 analyzing opponents\u2026
      </div>`;
    }

    showEl(el);
    if (el.innerHTML === promptHtml) return; // change detection
    el.innerHTML = promptHtml;

    // Attach click handler for launch link
    const link = $('launch-app-link');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: getAppUrl() });
      });
    }
  };

  // =========================================================================
  // SEAT POPOVER — click a seat card to see villain profile details
  // =========================================================================

  const seatPopover = $('seat-popover');
  let activePopoverSeat = null;

  const showSeatPopover = (seatNum, cardEl) => {
    const app = (coordinator.get('appSeatData') || {})[seatNum];
    const vp = app?.villainProfile;
    const seatStats = coordinator.get('cachedSeatStats')?.[seatNum];

    // Need either villain profile or basic stats to show anything
    if (!vp && !seatStats) { hideSeatPopover(); return; }

    let html = '';

    // Header: seat + style
    const style = seatStats?.style || app?.style;
    if (style) {
      const colors = stats.STYLE_COLORS[style] || stats.STYLE_COLORS.Unknown;
      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">`;
      html += `<span style="font-weight:bold;color:var(--gold)">Seat ${seatNum}</span>`;
      html += `<span class="uh-style-badge" style="background:${colors.bg};color:${colors.text}">${style}</span>`;
      if (seatStats?.sampleSize) html += `<span style="font-size:var(--font-xs);color:var(--text-faint)">${seatStats.sampleSize}h</span>`;
      html += `</div>`;
    } else {
      html += `<div style="font-weight:bold;color:var(--gold);margin-bottom:6px">Seat ${seatNum}</div>`;
    }

    // Villain profile (from app)
    if (vp?.headline) {
      html += `<div class="seat-popover-headline">${escapeHtml(vp.headline)}</div>`;
    } else if (app?.villainHeadline) {
      html += `<div class="seat-popover-headline">${escapeHtml(app.villainHeadline)}</div>`;
    }
    if (vp?.maturityLabel) {
      html += `<div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px">${escapeHtml(vp.maturityLabel)} (${vp.totalObservations || 0} obs)</div>`;
    }
    if (vp?.decisionModelDescription) {
      html += `<div class="seat-popover-trait">${escapeHtml(vp.decisionModelDescription)}</div>`;
    }

    // Basic stats (always available from local capture, even without app)
    if (seatStats && seatStats.sampleSize > 0) {
      html += `<div class="seat-popover-label">Stats</div>`;
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:var(--font-sm)">`;
      if (seatStats.vpip != null) html += `<span style="color:var(--text-muted)">VPIP</span><span style="font-weight:600">${seatStats.vpip}%</span>`;
      if (seatStats.pfr != null) html += `<span style="color:var(--text-muted)">PFR</span><span style="font-weight:600">${seatStats.pfr}%</span>`;
      if (seatStats.af != null) html += `<span style="color:var(--text-muted)">AF</span><span style="font-weight:600">${seatStats.af === Infinity ? '\u221E' : seatStats.af.toFixed(1)}</span>`;
      html += `</div>`;
      // App-provided stats
      if (app?.stats) {
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:var(--font-sm);margin-top:2px">`;
        if (app.stats.cbet != null) html += `<span style="color:var(--text-muted)">C-Bet</span><span style="font-weight:600">${app.stats.cbet}%</span>`;
        if (app.stats.foldToCbet != null) html += `<span style="color:var(--text-muted)">Fold CB</span><span style="font-weight:600">${app.stats.foldToCbet}%</span>`;
        html += `</div>`;
      }
    }

    // Aggression response (from app villain profile)
    if (vp?.aggressionResponse) {
      const ar = vp.aggressionResponse;
      const parts = [];
      if (ar.facingBet) parts.push(`Facing bet: ${escapeHtml(ar.facingBet)}`);
      if (ar.facingRaise) parts.push(`Facing raise: ${escapeHtml(ar.facingRaise)}`);
      if (parts.length > 0) {
        html += `<div class="seat-popover-label">Aggression</div>`;
        html += `<div class="seat-popover-trait">${parts.join(' \u00B7 ')}</div>`;
      }
    }

    // Vulnerabilities
    if (vp?.vulnerabilities?.length > 0) {
      html += `<div class="seat-popover-label">Vulnerabilities</div>`;
      for (const v of vp.vulnerabilities.slice(0, 4)) {
        html += `<div class="seat-popover-vuln">\u2022 ${escapeHtml(v.label || v.id || '')}</div>`;
      }
    }

    seatPopover.innerHTML = html;
    seatPopover.classList.remove('hidden');
    activePopoverSeat = seatNum;

    // Position near the card
    const rect = cardEl.getBoundingClientRect();
    seatPopover.style.top = `${rect.bottom + 4}px`;
    seatPopover.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 310))}px`;
  };

  const hideSeatPopover = () => {
    if (seatPopover) seatPopover.classList.add('hidden');
    activePopoverSeat = null;
  };

  // Event delegation for seat circle clicks (pin/unpin + popover)
  document.addEventListener('click', (e) => {
    const circle = e.target.closest('.seat-circle[data-seat]');
    if (circle) {
      const seat = Number(circle.dataset.seat);
      const heroSeat = coordinator.get('currentLiveContext')?.heroSeat || coordinator.get('currentTableState')?.heroSeat;
      if (seat === heroSeat) return; // Don't pin hero

      // Toggle pin
      if (coordinator.get('pinnedVillainSeat') === seat) {
        coordinator.set('pinnedVillainSeat', null);
      } else {
        coordinator.set('pinnedVillainSeat', seat);
      }

      // Show/hide popover
      if (coordinator.get('pinnedVillainSeat') === seat) {
        showSeatPopover(seat, circle);
      } else {
        hideSeatPopover();
      }

      scheduleRender('pin', PRIORITY.IMMEDIATE);
      return;
    }
    // Villain range tab clicks — switch focused villain in range grid
    const rangeTab = e.target.closest('.villain-tab[data-range-seat]');
    if (rangeTab) {
      coordinator.set('pinnedVillainSeat', Number(rangeTab.dataset.rangeSeat));
      scheduleRender('range_tab', PRIORITY.IMMEDIATE);
      return;
    }

    // Click outside popover — dismiss
    if (!e.target.closest('.seat-popover')) {
      hideSeatPopover();
    }
  });

  const formatAF = (af) => {
    if (af === null || af === undefined) return null;
    if (af === Infinity) return '∞';
    return af.toFixed(1);
  };

  // Color classes based on exploitability
  const vpipClass = (v) => {
    if (v === null) return 'neutral';
    if (v > 40) return 'high';    // Fish
    if (v < 15) return 'low';     // Nit
    return 'neutral';
  };

  const pfrClass = (p) => {
    if (p === null) return 'neutral';
    if (p > 25) return 'high';
    if (p < 8) return 'low';
    return 'neutral';
  };

  const afClass = (a) => {
    if (a === null) return 'neutral';
    if (a > 3) return 'high';
    if (a < 1) return 'low';
    return 'neutral';
  };

  // =========================================================================
  // CURRENT HAND
  // =========================================================================

  // (renderCurrentHand removed — replaced by renderUnifiedHeader)

  // =========================================================================
  // EXPLOIT TIPS — CONTEXT FILTER
  // =========================================================================

  /**
   * Filter and annotate exploits based on the current hand state.
   *
   * @param {Object[]} seatExploits - Array of { seat, exploits, style, sampleSize } from app
   * @param {Object|null} liveContext - From HSM getLiveHandContext()
   * @param {Object|null} tableState - From HSM getState()
   * @returns {Object[]} Filtered, annotated, sorted exploit items ready to render
   */
  const filterExploitsByContext = (seatExploits, liveContext, tableState) => {
    if (!seatExploits || seatExploits.length === 0) return [];

    const heroSeat = liveContext?.heroSeat || tableState?.heroSeat;
    const foldedSeats = new Set(liveContext?.foldedSeats || []);
    const isLive = tableState && tableState.state !== 'IDLE' && tableState.state !== 'COMPLETE';
    const currentStreet = liveContext?.currentStreet || null;

    // Analyze board texture if we have community cards
    const communityCards = liveContext?.communityCards || tableState?.communityCards || [];
    const visibleCards = communityCards.filter(c => c && c !== '');
    const boardTexture = visibleCards.length >= 3 && cardUtils
      ? cardUtils.analyzeBoardFromStrings(visibleCards)
      : null;

    // Board texture context string
    let boardContext = null;
    if (boardTexture && isLive && currentStreet !== 'preflop') {
      if (boardTexture.texture === 'dry') {
        boardContext = boardTexture.isPaired
          ? 'Paired dry board — trips possible, caution with one pair'
          : 'Dry board — c-bets more credible, respect raises';
      } else if (boardTexture.texture === 'wet') {
        boardContext = boardTexture.monotone
          ? 'Monotone board — flush draws heavy, size up for protection'
          : 'Wet board — draws likely, size up for value and protection';
      } else {
        boardContext = boardTexture.flushDraw
          ? 'Medium texture — flush draw possible, watch for aggression'
          : 'Medium texture — mixed range advantages';
      }
    }

    const allExploits = [];

    for (const seatData of seatExploits) {
      const seatNum = Number(seatData.seat);

      // Skip hero's seat
      if (seatNum === heroSeat) continue;

      // During live hand: skip folded seats
      if (isLive && foldedSeats.has(seatNum)) continue;

      // Skip seats with no exploits
      if (!seatData.exploits || seatData.exploits.length === 0) continue;

      for (const exploit of seatData.exploits) {
        // Street filter: during live play, only show relevant exploits
        if (isLive && currentStreet) {
          const exploitStreet = exploit.street || 'all';
          if (currentStreet === 'preflop') {
            // On preflop: show preflop and all-street exploits
            if (exploitStreet !== 'preflop' && exploitStreet !== 'all') continue;
          } else {
            // Postflop: show flop/all exploits (flop rules generalize postflop)
            if (exploitStreet === 'preflop') continue;
          }
        }

        allExploits.push({
          ...exploit,
          seat: seatNum,
          seatStyle: seatData.style,
          boardContext: boardContext,
        });
      }
    }

    // Sort: high priority first, then by confidence desc
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    allExploits.sort((a, b) => {
      const pa = priorityOrder[a.scoring?.priority] ?? 2;
      const pb = priorityOrder[b.scoring?.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return (b.scoring?.confidence || 0) - (a.scoring?.confidence || 0);
    });

    // Limit to top 8
    return allExploits.slice(0, 8);
  };

  // =========================================================================
  // EXPLOIT TIPS — RENDERING
  // =========================================================================

  // DEAD CODE — replaced by renderDeepExpander + renderStreetCard. Remove in Phase 2 cleanup.
  const renderExploitPanel = (exploits, appConnected) => {
    const panel = $('exploit-panel');
    const list = $('exploit-list');
    const source = $('exploit-source');
    const count = $('exploit-count');

    if (!appConnected && (!exploits || exploits.length === 0)) {
      // Show hint to connect app with clickable launch link
      showEl(panel);
      count.textContent = '';
      source.className = 'exploit-source';
      list.innerHTML = '<div class="exploit-hint"><a href="#" class="exploit-hint-link" id="launch-app-link">Launch Poker Tracker</a> for real-time exploit tips</div>';
      const launchLink = $('launch-app-link');
      if (launchLink) {
        launchLink.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: getAppUrl() });
        });
      }
      return;
    }

    if (!exploits || exploits.length === 0) {
      showEl(panel);
      count.textContent = '';
      source.className = appConnected ? 'exploit-source visible' : 'exploit-source';
      list.innerHTML = appConnected
        ? '<div class="exploit-hint">Analyzing opponents — exploits appear after ~20 hands per seat</div>'
        : '<div class="exploit-hint">No exploits detected yet — need more hands</div>';
      return;
    }

    showEl(panel);
    count.textContent = exploits.length;
    source.className = appConnected ? 'exploit-source visible' : 'exploit-source';

    let html = '';
    for (const exploit of exploits) {
      const priority = exploit.scoring?.priority || 'low';

      html += `<div class="exploit-item priority-${priority}">`;

      // Header: priority/tier badge + seat + source + style
      html += `<div class="exploit-item-header">`;
      if (exploit.displayTier) {
        html += `<span class="exploit-tier-badge ${exploit.displayTier}">${exploit.displayTier}</span>`;
      } else {
        html += `<span class="exploit-priority ${priority}">${priority}</span>`;
      }
      html += `<span class="exploit-seat-badge">Seat ${exploit.seat}</span>`;
      if (exploit.source) {
        html += `<span class="exploit-source-badge">${escapeHtml(exploit.source)}</span>`;
      }
      if (exploit.seatStyle) {
        const colors = stats.STYLE_COLORS[exploit.seatStyle] || stats.STYLE_COLORS.Unknown;
        html += `<span class="style-badge" style="background:${colors.bg};color:${colors.text};font-size:8px">${exploit.seatStyle}</span>`;
      }
      html += `</div>`;

      // Label + position context
      let labelStr = exploit.label || 'Exploit detected';
      if (exploit.position) labelStr += ` (${exploit.position})`;
      html += `<div class="exploit-label">${escapeHtml(labelStr)}</div>`;

      // Evidence line (replaces stat basis + stars)
      if (exploit.evidence) {
        const ev = exploit.evidence;
        const delta = ev.delta != null ? ev.delta : (ev.observed != null && ev.profitable != null ? ev.observed - ev.profitable : null);
        html += '<div class="exploit-evidence">';
        if (ev.metric) html += `${escapeHtml(ev.metric)}: `;
        if (ev.observed != null) html += `${ev.observed}%`;
        if (ev.profitable != null) html += ` vs ${ev.profitable}% GTO`;
        if (delta != null) {
          const dCls = delta > 0 ? 'positive' : delta < 0 ? 'negative' : '';
          const sign = delta > 0 ? '+' : '';
          html += ` <span class="exploit-evidence-delta ${dCls}">(${sign}${delta}%)</span>`;
        }
        html += '</div>';
      } else if (exploit.statBasis) {
        const stars = exploit.scoring?.confidence != null ? starsFromConfidence(exploit.scoring.confidence) : '';
        html += `<div class="exploit-basis">${escapeHtml(exploit.statBasis)}`;
        if (stars) html += ` <span class="exploit-stars">${stars}</span>`;
        html += '</div>';
      }

      // Board context annotation (postflop only)
      if (exploit.boardContext) {
        html += `<div class="exploit-context">${escapeHtml(exploit.boardContext)}</div>`;
      }

      html += `</div>`;
    }

    list.innerHTML = html;
  };

  const starsFromConfidence = (confidence) => {
    if (confidence >= 0.9) return '★★★';
    if (confidence >= 0.7) return '★★';
    if (confidence >= 0.5) return '★';
    return '';
  };

  // =========================================================================
  // WEAKNESS PANEL — RENDERING
  // =========================================================================

  /**
   * Filter weaknesses by current live context (skip hero + folded seats).
   */
  const filterWeaknesses = (weaknesses, liveCtx, tableState) => {
    if (!weaknesses || weaknesses.length === 0) return [];

    const heroSeat = liveCtx?.heroSeat || tableState?.heroSeat;
    const foldedSeats = new Set(liveCtx?.foldedSeats || []);
    const isLive = tableState && tableState.state !== 'IDLE' && tableState.state !== 'COMPLETE';

    let filtered = weaknesses.filter(w => {
      if (w.seat === heroSeat) return false;
      if (isLive && foldedSeats.has(w.seat)) return false;
      return true;
    });

    // Sort: high severity first, then confidence desc
    const severityOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => {
      const sa = a.severity >= 0.7 ? 'high' : a.severity >= 0.4 ? 'medium' : 'low';
      const sb = b.severity >= 0.7 ? 'high' : b.severity >= 0.4 ? 'medium' : 'low';
      const pa = severityOrder[sa] ?? 2;
      const pb = severityOrder[sb] ?? 2;
      if (pa !== pb) return pa - pb;
      return (b.confidence || 0) - (a.confidence || 0);
    });

    return filtered.slice(0, 8);
  };

  // DEAD CODE — replaced by renderDeepExpander + renderStreetCard. Remove in Phase 2 cleanup.
  const renderWeaknessPanel = (weaknesses, appConnected) => {
    const panel = $('weakness-panel');
    const list = $('weakness-list');
    const count = $('weakness-count');

    const filtered = filterWeaknesses(weaknesses, coordinator.get('currentLiveContext'), coordinator.get('currentTableState'));

    if (!filtered || filtered.length === 0) {
      hideEl(panel);
      return;
    }

    showEl(panel);
    count.textContent = filtered.length;

    let html = '';
    for (const w of filtered) {
      const sev = w.severity >= 0.7 ? 'high' : w.severity >= 0.4 ? 'medium' : 'low';
      const stars = starsFromConfidence(w.confidence || 0);

      html += `<div class="weakness-item severity-${sev}">`;
      html += `<div class="weakness-item-header">`;
      html += `<span class="weakness-severity ${sev}">${sev}</span>`;
      html += `<span class="exploit-seat-badge">Seat ${w.seat}</span>`;
      if (w.seatStyle) {
        const colors = stats.STYLE_COLORS[w.seatStyle] || stats.STYLE_COLORS.Unknown;
        html += `<span class="style-badge" style="background:${colors.bg};color:${colors.text};font-size:8px">${w.seatStyle}</span>`;
      }
      if (stars) html += `<span class="exploit-stars" style="margin-left:auto">${stars}</span>`;
      html += `</div>`;
      html += `<div class="weakness-label">${escapeHtml(w.label || 'Weakness detected')}</div>`;

      // Street/context tags + sample size
      const tags = [w.category, w.street, w.context, w.position].filter(Boolean);
      if (tags.length > 0 || w.sampleSize) {
        html += '<div class="weakness-tags">';
        for (const tag of tags) {
          html += `<span class="weakness-tag">${escapeHtml(tag)}</span>`;
        }
        if (w.sampleSize) {
          html += `<span class="weakness-sample">${w.sampleSize}h</span>`;
        }
        html += '</div>';
      }

      // Evidence line
      if (w.evidence) {
        const ev = w.evidence;
        const delta = ev.delta != null ? ev.delta : (ev.observed != null && ev.profitable != null ? ev.observed - ev.profitable : null);
        html += '<div class="exploit-evidence">';
        if (ev.metric) html += `${escapeHtml(ev.metric)}: `;
        if (ev.observed != null) html += `${ev.observed}%`;
        if (ev.profitable != null) html += ` vs ${ev.profitable}% GTO`;
        if (delta != null) {
          const dCls = delta > 0 ? 'positive' : delta < 0 ? 'negative' : '';
          const sign = delta > 0 ? '+' : '';
          html += ` <span class="exploit-evidence-delta ${dCls}">(${sign}${delta}%)</span>`;
        }
        html += '</div>';
      }

      html += `</div>`;
    }

    list.innerHTML = html;
  };

  // =========================================================================
  // BRIEFING PANEL — deleted (RT-58). Superseded by renderDeepExpander +
  // renderStreetCard. The old implementation closed over module-level vars
  // that were eliminated in RT-43, creating a ReferenceError trap.
  // =========================================================================

  // renderBriefingPanel and its click handler: deleted RT-58. The function
  // closed over bare `currentLiveContext`/`currentTableState` which were
  // removed in RT-43's state-store migration; any invocation path would
  // throw ReferenceError in strict mode. Superseded by renderDeepExpander
  // + renderStreetCard. No live callers remained.

  // Event delegation for collapsible analysis panel headers
  document.addEventListener('click', (e) => {
    const header = e.target.closest('.collapsible-header');
    if (!header) return;
    // Don't collapse if clicking inside a briefing item (nested click)
    if (e.target.closest('.briefing-item')) return;
    const targetId = header.dataset.collapseTarget;
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    target.classList.toggle('expanded');
    const icon = header.querySelector('.collapse-icon');
    if (icon) icon.classList.toggle('expanded');
  });

  // renderObservationPanel: deleted RT-58 (same ReferenceError trap as
  // renderBriefingPanel above). Superseded by renderDeepExpander +
  // renderStreetCard.

  // =========================================================================
  // ACTION ADVISOR — RENDERING (tier renderers imported from render-tiers.js)
  // =========================================================================

  // =========================================================================
  // RENDER COORDINATOR — Unified render scheduler (RT-43)
  // =========================================================================
  // RenderCoordinator._state is the SOLE authoritative state store.
  // All push handlers write to coordinator via coordinator.set()/merge().
  // All DOM writes happen in one renderAll() call per animation frame.
  // No handler touches the DOM directly. syncStateToCoordinator() has been
  // deleted — there is no dual state to synchronize.

  /** The single render function. All DOM writes happen here. */
  const renderAll = (snap, reason) => {
    const advice = snap.lastGoodAdvice;
    const liveCtx = snap.currentLiveContext;
    const street = snap.street;

    // --- No-table / HUD visibility (Fix 2: moved from refreshHandStats) ---
    if (!snap.hasTableHands) {
      showEl($('no-table'));
      showEl($('pipeline-health'));
      hideEl($('hud-content'));
    } else {
      hideEl($('no-table'));
      hideEl($('pipeline-health'));
      showEl($('hud-content'));
    }

    // --- Recovery banner ---
    if (snap.recoveryMessage) {
      showRecoveryBanner(snap.recoveryMessage);
    } else {
      hideRecoveryBanner();
    }

    // --- App connection status ---
    updateAppStatus(snap.appConnected);

    // --- Pipeline health + PID summary ---
    renderPipelineHealth(snap);
    renderPidSummary(snap.cachedDiag?.pidCounts);

    // --- Status bar ---
    if (snap.lastPipeline) {
      updateStatusBar(snap.lastPipeline, snap.lastHandCount, snap.cachedDiag, snap.swFallbackState);
    }

    // --- Stale context indicator ---
    if (snap.staleContext && liveCtx) {
      const dot = $('status-dot');
      if (dot) dot.className = 'status-dot yellow';
      const text = $('status-text');
      if (text) text.textContent = 'Data may be stale \u2014 waiting for update\u2026';
    }

    // --- Tournament panel (previously bypassed renderUI) ---
    if (snap.lastGoodTournament) {
      renderTournamentPanel(snap.lastGoodTournament);
    } else if (liveCtx?.tournamentLevelInfo && !snap.lastGoodTournament) {
      renderRawTournamentInfo(liveCtx.tournamentLevelInfo);
    }

    // --- Seat arc ---
    if (snap.cachedSeatStats) {
      renderSeatArc(snap.cachedSeatStats, snap.currentTableState, snap.cachedSeatMap, snap);
    }

    // --- Zone 1: Action Bar + Zone 2: Context Strip + Cards Strip ---
    renderActionBar(advice, liveCtx, snap);
    renderContextStrip(advice, liveCtx, snap);
    renderCardsStrip(advice, liveCtx, snap);

    // --- Zone 3: Plan Panel ---
    renderPlanPanel(advice, liveCtx, snap);

    // --- Street progress ---
    const progressEl = $('street-progress');
    if (progressEl) {
      if (street && (advice || liveCtx)) {
        const progressHtml = buildStreetProgressHTML(street);
        if (progressEl.innerHTML !== progressHtml) progressEl.innerHTML = progressHtml;
        showEl(progressEl);
      } else {
        hideEl(progressEl);
      }
    }

    // --- Between-hands panel (Modes A/B/C) ---
    renderBetweenHands(snap);

    // --- Street card (RT-48: visual continuity) ---
    const card = $('street-card');
    if (snap.advicePendingForStreet && !advice && snap.lastStreetCardHtml && card) {
      // Hold previous content with shimmer — prevents advice disappear/reappear flash
      if (card.innerHTML !== snap.lastStreetCardHtml) {
        card.innerHTML = snap.lastStreetCardHtml;
      }
      card.classList.add('loading-advice');
    } else {
      renderStreetCard(street, advice, liveCtx, snap.appSeatData, snap.focusedVillainSeat, snap.lastGoodTournament, { loading: !!snap.advicePendingForStreet });
      // Cache rendered HTML for visual continuity on next hand boundary
      if (card && advice) {
        coordinator.setLastStreetCardHtml(card.innerHTML);
      }
    }

    // --- App launch prompt ---
    const appPromptEl = $('app-launch-prompt');
    if (!snap.lastGoodExploits && !advice?.recommendations?.length) {
      renderAppLaunchPrompt(snap.appConnected);
    } else if (appPromptEl) {
      hideEl(appPromptEl);
    }

    // --- Deep expander (RT-49: collapse state preservation) ---
    renderDeepExpander(advice, street, snap);
  };

  const coordinator = new RenderCoordinator({
    renderFn: renderAll,
    getTimestamp: () => Date.now(),
    requestFrame: typeof requestAnimationFrame === 'function'
      ? (cb) => requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 0),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  });

  /** Schedule a render. Coordinator._state is the sole authority — no sync needed. */
  const scheduleRender = (reason, priority = PRIORITY.NORMAL) => {
    coordinator.scheduleRender(reason, priority);
  };


  // Deep section toggles handled by renderDeepExpander click listeners

  // =========================================================================
  // TOURNAMENT PROTOCOL LOG (spike: captures unknown PIDs + lobby messages)
  // =========================================================================

  const tourneyLogPanel = $('tourney-log-panel');
  const tourneyLogOutput = $('tourney-log-output');
  const tourneyLogCount = $('tourney-log-count');
  const tourneyLogShow = $('tourney-log-show');
  const tourneyLogToggle = $('tourney-log-toggle');
  const tourneyLogCopy = $('tourney-log-copy');
  const tourneyTableConfig = $('tourney-table-config');
  const tourneyTableConfigContent = $('tourney-table-config-content');

  let tourneyLogVisible = false;
  let cachedDiagnosticData = null;

  // Show/hide tournament log
  if (tourneyLogShow) {
    tourneyLogShow.addEventListener('click', () => {
      tourneyLogVisible = true;
      showEl(tourneyLogPanel);
      hideEl(tourneyLogShow);
      renderTourneyLog();
    });
  }
  if (tourneyLogToggle) {
    tourneyLogToggle.addEventListener('click', () => {
      tourneyLogVisible = false;
      hideEl(tourneyLogPanel);
      showEl(tourneyLogShow);
    });
  }

  // Copy tournament log as JSON — always fetch fresh data on click
  if (tourneyLogCopy) {
    tourneyLogCopy.addEventListener('click', async () => {
      try {
        cachedDiagnosticData = await chrome.runtime.sendMessage({ type: MSG.GET_DIAGNOSTIC_LOG });
        if (tourneyLogVisible) renderTourneyLog(); // Refresh display with fresh data
      } catch (e) {
        errors.report('messaging', e, { op: 'fetchDiagnosticLog' });
      }
      const jsonStr = JSON.stringify(cachedDiagnosticData, null, 2);
      try {
        await navigator.clipboard.writeText(jsonStr);
        tourneyLogCopy.textContent = 'COPIED';
        setTimeout(() => { tourneyLogCopy.textContent = 'COPY JSON'; }, 1500);
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = jsonStr;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        tourneyLogCopy.textContent = 'COPIED';
        setTimeout(() => { tourneyLogCopy.textContent = 'COPY JSON'; }, 1500);
      }
    });
  }

  let activePidFilter = null;

  // Filter clear button
  const filterClearBtn = $('tourney-filter-clear');
  if (filterClearBtn) {
    filterClearBtn.addEventListener('click', () => {
      activePidFilter = null;
      hideEl(filterClearBtn);
      renderTourneyLog();
    });
  }

  /** Render the tournament diagnostic log from cached data. */
  const renderTourneyLog = () => {
    if (!tourneyLogOutput || !cachedDiagnosticData) return;

    const { hsmLogs, lobbyMessages, tableConfigs, validationLogs, protocolLogs } = cachedDiagnosticData;
    const lines = [];
    const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString() : '??:??';

    // ── Build combined diagnostic entries (HSM logs + lobby) ──
    const allDiagEntries = [];
    for (const [connId, log] of Object.entries(hsmLogs || {})) {
      for (const entry of log) allDiagEntries.push({ source: `HSM`, pid: entry.pid, ...entry });
    }
    for (const entry of (lobbyMessages || [])) {
      allDiagEntries.push({ source: 'LOBBY', pid: '__LOBBY__', keys: entry.keys, sampleValues: entry.sampleValues || null, timestamp: entry.timestamp });
    }
    allDiagEntries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // ── PID SUMMARY with clickable pills ──
    const pidSummary = $('tourney-pid-summary');
    const pidPills = $('tourney-pid-pills');
    if (pidSummary && pidPills) {
      // Count unique PIDs across all diagnostic entries
      const pidCounts = {};
      for (const e of allDiagEntries) {
        const p = e.pid || '?';
        pidCounts[p] = (pidCounts[p] || 0) + 1;
      }
      // Sort by count descending
      const sorted = Object.entries(pidCounts).sort((a, b) => b[1] - a[1]);

      if (sorted.length > 0) {
        showEl(pidSummary);
        pidPills.innerHTML = sorted.map(([pid, count]) => {
          const cls = activePidFilter === pid ? 'pid-pill active' : 'pid-pill';
          return `<span class="${cls}" data-pid="${escapeHtml(pid)}">${escapeHtml(pid)}(${escapeHtml(String(count))})</span>`;
        }).join('');

        // Attach click handlers
        for (const pill of pidPills.querySelectorAll('.pid-pill')) {
          pill.addEventListener('click', () => {
            activePidFilter = pill.dataset.pid === activePidFilter ? null : pill.dataset.pid;
            if (activePidFilter) showEl(filterClearBtn); else hideEl(filterClearBtn);
            renderTourneyLog();
          });
        }
      } else {
        hideEl(pidSummary);
      }
    }

    // ── VALIDATION LOG ──
    if (!activePidFilter) {
      const allValEntries = [];
      for (const [connId, log] of Object.entries(validationLogs || {})) {
        for (const entry of log) allValEntries.push({ connId, ...entry });
      }
      allValEntries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      lines.push('━━ VALIDATION LOG ━━');
      if (allValEntries.length === 0) {
        lines.push('  No hand build attempts yet.');
      } else {
        for (const v of allValEntries) {
          const status = v.valid ? '✓ PASS' : '✗ FAIL';
          lines.push(`[${fmtTime(v.timestamp)}] ${status} hand#${v.handNumber || '?'}`);
          lines.push(`  hero=S${v.heroSeat} dealer=S${v.dealerSeat} street=${v.street} actions=${v.actionCount}`);
          lines.push(`  activeSeats=[${(v.activeSeats || []).join(',')}]`);
          if (!v.valid && v.errors?.length > 0) {
            for (const err of v.errors) lines.push(`  ERROR: ${err}`);
          }
          lines.push('');
        }
      }
    }

    // ── PROTOCOL FEED ──
    if (!activePidFilter) {
      const allProtoEntries = [];
      for (const [connId, log] of Object.entries(protocolLogs || {})) {
        for (const entry of log) allProtoEntries.push({ connId, ...entry });
      }
      allProtoEntries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      lines.push('━━ PROTOCOL FEED (last 100) ━━');
      if (allProtoEntries.length === 0) {
        lines.push('  No protocol messages yet.');
      } else {
        const recent = allProtoEntries.slice(-50);
        for (const p of recent) {
          let detail = `[${p.state}]`;
          if (p.seat !== undefined) detail += ` seat=${p.seat}`;
          if (p.dealerSeat !== undefined) detail += ` dealer=${p.dealerSeat}`;
          if (p.tableState !== undefined) detail += ` tblState=${p.tableState}`;
          if (p.stageNo !== undefined) detail += ` stageNo=${p.stageNo}`;
          if (p.stageNumber !== undefined) detail += ` stageNum=${p.stageNumber}`;
          if (p.btn !== undefined) detail += ` btn=0x${p.btn.toString(16)}`;
          if (p.bet !== undefined) detail += ` bet=${p.bet}`;
          if (p.accountLen !== undefined) detail += ` account[${p.accountLen}]`;
          if (p.seatKeys) detail += ` seats=[${p.seatKeys.join(',')}]`;
          if (p.pcardKeys) detail += ` pcards=[${p.pcardKeys.join(',')}]`;
          if (p.bcardLen !== undefined) detail += ` bcard[${p.bcardLen}]`;
          lines.push(`[${fmtTime(p.timestamp)}] ${p.pid} ${detail}`);
        }
      }
      lines.push('');
    }

    // ── TABLE CONFIGS ──
    const configEntries = Object.entries(tableConfigs || {});
    if (!activePidFilter && configEntries.length > 0) {
      lines.push('━━ TABLE CONFIG ━━');
      for (const [connId, cfg] of configEntries) {
        lines.push(`conn ${connId}: gameType=${cfg.gameType} ante=${cfg.ante}`);
        lines.push(`  raw: ${JSON.stringify(cfg.raw)}`);
      }
      lines.push('');
    }
    if (configEntries.length > 0 && tourneyTableConfig) {
      if (activePidFilter) hideEl(tourneyTableConfig); else showEl(tourneyTableConfig);
      const configLines = configEntries.map(([connId, cfg]) =>
        `conn ${connId}: gameType=${cfg.gameType} ante=${cfg.ante}\n  raw: ${JSON.stringify(cfg.raw)}`
      );
      tourneyTableConfigContent.textContent = configLines.join('\n');
    } else if (tourneyTableConfig) {
      hideEl(tourneyTableConfig);
    }

    // ── FILTERED VIEW or FULL DIAGNOSTIC ENTRIES ──
    const filtered = activePidFilter
      ? allDiagEntries.filter(e => e.pid === activePidFilter)
      : allDiagEntries;

    if (activePidFilter) {
      lines.push(`━━ ${activePidFilter} (${filtered.length} entries) ━━`);
    } else if (filtered.length > 0) {
      lines.push('━━ DIAGNOSTIC ENTRIES ━━');
    }

    for (const entry of filtered) {
      lines.push(`[${fmtTime(entry.timestamp)}] ${entry.source} ${entry.pid || '?'}`);
      if (entry.keys?.length > 0) lines.push(`  keys: ${entry.keys.join(', ')}`);
      if (entry.sampleValues && typeof entry.sampleValues === 'object') {
        if (activePidFilter) {
          // Expanded view: one field per line for easy reading
          for (const [k, v] of Object.entries(entry.sampleValues)) {
            lines.push(`    ${k}: ${JSON.stringify(v)}`);
          }
        } else {
          const valStr = Object.entries(entry.sampleValues).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
          lines.push(`  vals: ${valStr}`);
        }
      }
      lines.push('');
    }

    const totalEntries = filtered.length;
    if (tourneyLogCount) {
      tourneyLogCount.textContent = activePidFilter
        ? `${totalEntries} ${activePidFilter}`
        : `${allDiagEntries.length} entries`;
    }

    tourneyLogOutput.textContent = lines.join('\n');
  };

  /** Handle diagnostic data pushed with pipeline status. */
  const handleDiagnosticData = (diagData) => {
    if (!diagData) return;
    cachedDiagnosticData = diagData;
    if (tourneyLogVisible) renderTourneyLog();
  };

  // =========================================================================
  // DIAGNOSTICS — Collects full pipeline state for debugging
  // =========================================================================

  const diagOutput = $('diag-output');
  const diagPanel = $('diag-panel');
  const diagToggle = $('diag-toggle');
  const diagShow = $('diag-show');

  let diagVisible = false;
  if (diagShow) diagShow.addEventListener('click', () => {
    diagVisible = true;
    showEl(diagPanel);
    hideEl(diagShow);
    runDiagnostics();
  });
  const diagCopy = $('diag-copy');
  if (diagCopy) diagCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(diagOutput.textContent);
      diagCopy.textContent = 'COPIED';
      setTimeout(() => { diagCopy.textContent = 'COPY'; }, 1500);
    } catch (_) {
      // Fallback for clipboard API failure
      const ta = document.createElement('textarea');
      ta.value = diagOutput.textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      diagCopy.textContent = 'COPIED';
      setTimeout(() => { diagCopy.textContent = 'COPY'; }, 1500);
    }
  });
  if (diagToggle) diagToggle.addEventListener('click', () => {
    diagVisible = false;
    hideEl(diagPanel);
    showEl(diagShow);
  });

  const runDiagnostics = async () => {
    if (!diagOutput) return;
    const lines = [];
    const ts = () => new Date().toLocaleTimeString();

    lines.push(`=== DIAGNOSTICS ${ts()} ===`);
    const connState = conn.getState();
    lines.push(`  port connected: ${connState.connected}`);
    lines.push(`  connectCount: ${connState.connectCount}`);
    lines.push(`  pendingMessages: ${connState.pendingMessages}`);
    lines.push(`  contextDead: ${connState.contextDead}`);
    lines.push(`  extensionVersion: ${connState.extensionVersion}`);
    if (connState.swVersion) lines.push(`  swVersion: ${connState.swVersion}${connState.swVersion !== connState.extensionVersion ? ' ⚠ MISMATCH' : ''}`);

    // 0. SW Health
    try {
      const health = await chrome.storage.session?.get(['sw_heartbeat', 'module_load_failures', 'error_log']);
      lines.push(`\n[SW Health]`);
      if (health?.sw_heartbeat) {
        const age = Math.round((Date.now() - health.sw_heartbeat) / 1000);
        lines.push(`  heartbeat: ${age}s ago ${age > 90 ? '⚠ STALE' : '✓'}`);
      } else {
        lines.push(`  heartbeat: never`);
      }
      if (health?.module_load_failures?.length > 0) {
        lines.push(`  module failures: ${health.module_load_failures.join(', ')}`);
      }
      if (health?.error_log?.length > 0) {
        lines.push(`  recent errors (${health.error_log.length}):`);
        for (const err of health.error_log.slice(-5)) {
          const age = Math.round((Date.now() - err.timestamp) / 1000);
          lines.push(`    [${err.category}] ${err.message} (${age}s ago${err.count > 1 ? `, x${err.count}` : ''})`);
        }
      }
    } catch (e) {
      lines.push(`  health read failed: ${e.message}`);
    }

    // 1. Pipeline status
    try {
      const p = await chrome.runtime.sendMessage({ type: MSG.GET_PIPELINE_STATUS });
      lines.push(`\n[Pipeline Status]`);
      lines.push(`  tableCount: ${p?.tableCount}`);
      lines.push(`  storedHands: ${p?.storedHands}`);
      lines.push(`  completedHands: ${p?.completedHands}`);
      lines.push(`  appConnected: ${p?.appConnected}`);
      const tables = p?.tables || {};
      const entries = Object.entries(tables);
      lines.push(`  tables: ${entries.length}`);
      for (const [connId, state] of entries) {
        lines.push(`    conn ${connId}: state=${state.state} street=${state.currentStreet} hero=${state.heroSeat} actions=${state.actionCount} hands=${state.completedHands}`);
      }
      if (p?.liveContext) {
        const lc = p.liveContext;
        lines.push(`  liveContext: street=${lc.currentStreet} hero=${lc.heroSeat} pot=${lc.pot} holeCards=${JSON.stringify(lc.holeCards)} board=${JSON.stringify(lc.communityCards)} foldedSeats=${JSON.stringify(lc.foldedSeats)} activeSeatNumbers=${JSON.stringify(lc.activeSeatNumbers)}`);
      } else {
        lines.push(`  liveContext: null`);
      }
    } catch (e) {
      lines.push(`  ERROR: ${e.message}`);
    }

    // 2. Storage
    try {
      const result = await chrome.storage.session.get(SESSION_KEYS.SIDE_PANEL_HANDS);
      const hands = result[SESSION_KEYS.SIDE_PANEL_HANDS] || [];
      lines.push(`\n[Storage (Side Panel Mirror)]`);
      lines.push(`  total hands: ${hands.length}`);
      if (hands.length > 0) {
        const tableIds = [...new Set(hands.map(h => h.tableId))];
        lines.push(`  tableIds: ${JSON.stringify(tableIds)}`);
        const last = hands[hands.length - 1];
        lines.push(`  latest: tableId=${last.tableId} street=${last.gameState?.currentStreet} hero=${last.gameState?.mySeat} actions=${last.gameState?.actionSequence?.length} cards=${JSON.stringify(last.cardState?.holeCards)}`);
      }
    } catch (e) {
      lines.push(`  ERROR: ${e.message}`);
    }

    // 3. Side panel filter state
    lines.push(`\n[Side Panel State]`);
    // RT-58: read coordinator state instead of deleted module vars.
    const _dumpHandCount = coordinator.get('lastHandCount');
    const _dumpTableState = coordinator.get('currentTableState');
    const _dumpLiveCtx = coordinator.get('currentLiveContext');
    lines.push(`  lastHandCount: ${_dumpHandCount}`);
    lines.push(`  currentTableState: ${_dumpTableState ? `state=${_dumpTableState.state} hero=${_dumpTableState.heroSeat}` : 'null'}`);
    lines.push(`  currentLiveContext: ${_dumpLiveCtx ? `street=${_dumpLiveCtx.currentStreet}` : 'null'}`);

    // 4. Exploits cache
    try {
      const ex = await chrome.runtime.sendMessage({ type: MSG.GET_EXPLOITS });
      lines.push(`\n[Exploits Cache]`);
      lines.push(`  appConnected: ${ex?.appConnected}`);
      lines.push(`  seats: ${ex?.seats?.length || 0}`);
      lines.push(`  pushes received: ${coordinator.get('exploitPushCount')}`);
      if (ex?.timestamp) lines.push(`  age: ${Math.round((Date.now() - ex.timestamp) / 1000)}s`);
    } catch (e) {
      lines.push(`  ERROR: ${e.message}`);
    }

    // 5. Action advice cache
    try {
      const adv = await chrome.runtime.sendMessage({ type: MSG.GET_ACTION_ADVICE });
      lines.push(`\n[Action Advice Cache]`);
      lines.push(`  has advice: ${!!adv?.advice}`);
      lines.push(`  pushes received: ${coordinator.get('advicePushCount')}`);
      if (adv?.advice) {
        lines.push(`  situation: ${adv.advice.situation} villain: ${adv.advice.villainSeat} recs: ${adv.advice.recommendations?.length}`);
      }
      if (adv?.timestamp) lines.push(`  age: ${Math.round((Date.now() - adv.timestamp) / 1000)}s`);
    } catch (e) {
      lines.push(`  ERROR: ${e.message}`);
    }

    // 6. Tournament diagnostic log summary
    try {
      const diag = await chrome.runtime.sendMessage({ type: MSG.GET_DIAGNOSTIC_LOG });
      cachedDiagnosticData = diag; // Cache for tournament log panel
      lines.push(`\n[Tournament Log]`);
      const hsmEntryCount = Object.values(diag?.hsmLogs || {}).reduce((sum, log) => sum + log.length, 0);
      const lobbyCount = diag?.lobbyMessages?.length || 0;
      lines.push(`  HSM unknown PIDs: ${hsmEntryCount}`);
      lines.push(`  lobby messages: ${lobbyCount}`);
      const configs = diag?.tableConfigs || {};
      for (const [connId, cfg] of Object.entries(configs)) {
        lines.push(`  table ${connId}: gameType=${cfg.gameType} ante=${cfg.ante}`);
      }
      // Show unique PIDs seen
      const uniquePids = new Set();
      for (const log of Object.values(diag?.hsmLogs || {})) {
        for (const entry of log) uniquePids.add(entry.pid);
      }
      if (uniquePids.size > 0) {
        lines.push(`  unique PIDs: ${[...uniquePids].join(', ')}`);
      }
    } catch (e) {
      lines.push(`\n[Tournament Log] ERROR: ${e.message}`);
    }

    // 7. Self-test: verify each message handler responds correctly
    lines.push('\n[Self-Test]');
    const tests = [
      { type: MSG.PING, label: 'ping', check: r => r?.alive ? `OK (uptime ${Math.round(r.uptime/1000)}s)` : 'FAIL' },
      { type: MSG.GET_PIPELINE_STATUS, label: 'get_pipeline_status', check: r => r?.tables !== undefined ? `OK (tables=${r.tableCount})` : 'FAIL' },
      { type: MSG.GET_EXPLOITS, label: 'get_exploits', check: r => r?.seats !== undefined ? `OK (seats=${r.seats.length}, app=${r.appConnected})` : 'FAIL' },
      { type: MSG.GET_LIVE_CONTEXT, label: 'get_live_context', check: r => r === null ? 'OK (null — no active hand)' : r?.currentStreet ? `OK (${r.currentStreet})` : 'FAIL — returned non-context data' },
      { type: MSG.GET_ACTION_ADVICE, label: 'get_action_advice', check: r => r !== undefined ? `OK (has_advice=${!!r?.advice})` : 'FAIL' },
    ];
    for (const t of tests) {
      try {
        const r = await chrome.runtime.sendMessage({ type: t.type });
        lines.push(`  ${t.label}: ${t.check(r)}`);
      } catch (e) {
        lines.push(`  ${t.label}: ERROR — ${e.message}`);
      }
    }

    diagOutput.textContent = lines.join('\n');
  };

  // =========================================================================
  // INIT — port connected automatically by createPortConnection above
  // =========================================================================

  // Diagnostics auto-refresh: only when diagnostics panel is visible
  setInterval(() => {
    if (diagVisible) runDiagnostics();
  }, 5000);

  // =========================================================================
  // INIT — read pipeline diagnostics from session storage on panel open
  // =========================================================================

  const updateStatusFromDiag = () => {
    const pip = coordinator.get('lastPipeline');
    if (!pip || (pip.tableCount || 0) === 0) {
      const dot = $('status-dot');
      const text = $('status-text');
      if (dot && text) {
        dot.className = 'status-dot yellow';
        text.textContent = getDiagnosticStatus(coordinator.get('cachedDiag'), coordinator.get('swFallbackState'));
      }
    }
  };

  // Read diagnostics from session storage on panel open
  (async () => {
    try {
      const result = await chrome.storage.session.get(SESSION_KEYS.PIPELINE_DIAG);
      coordinator.set('cachedDiag', result[SESSION_KEYS.PIPELINE_DIAG] || null);
      scheduleRender('init_diag');
      updateStatusFromDiag();
    } catch (e) { console.warn('[Side Panel] Initial diag read failed:', e.message); }
  })();

  // Fallback: if no diagnostics after 4s, query SW for capture port status
  setTimeout(async () => {
    if (coordinator.get('cachedDiag')) return;
    try {
      const ping = await chrome.runtime.sendMessage({ type: MSG.PING });
      if (!ping?.alive) return;
      coordinator.set('swFallbackState', {
        capturePorts: ping.capturePorts || 0,
        swVersion: ping.version,
        errorCount: ping.errorCount || 0,
      });
      console.log('[Side Panel] SW fallback:', coordinator.get('swFallbackState'));
      scheduleRender('init_sw_fallback');
      updateStatusFromDiag();
    } catch (e) { console.warn('[Side Panel] SW fallback ping failed:', e.message); }
  }, 4000);
})();
