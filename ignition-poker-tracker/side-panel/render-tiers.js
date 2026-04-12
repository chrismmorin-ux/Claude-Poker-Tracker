/**
 * render-tiers.js — 3-tier rendering system for the side panel.
 *
 * Tier 1: Glance Strip (action badge, EV, metadata, cards)
 * Tier 2: Quick Context (villain brief, hand plan, blockers, range advantage, top vuln)
 * Tier 3: Deep Analysis (7 collapsible sections: buckets, recs, tendencies, fold curve, etc.)
 *
 * All functions are pure — state is passed as parameters, not read from closures.
 */

import { $, showEl, hideEl, escapeHtml } from './render-utils.js';

// =========================================================================
// TIER 1 — GLANCE STRIP
// =========================================================================

export const renderGlanceStrip = (advice, liveContext) => {
  const strip = $('glance-strip');
  if (!strip) return;

  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    hideEl(strip);
    return;
  }
  showEl(strip);

  const rec = advice.recommendations[0];
  const action = rec.action || 'check';
  const ev = rec.ev ?? 0;
  const badgeClass = action === 'raise' ? 'raise'
    : action === 'bet' ? 'bet'
    : action === 'call' ? 'call'
    : action === 'fold' ? 'fold' : 'check';

  // Accent bar color
  const accent = $('glance-accent');
  accent.className = `glance-accent ${badgeClass}`;

  // Action badge
  const actionEl = $('glance-action');
  let sizingHtml = '';
  if (rec.sizing?.betFraction) {
    sizingHtml = `<span class="action-sizing">${Math.round(rec.sizing.betFraction * 100)}%</span>`;
  }
  actionEl.className = `action-badge ${badgeClass}`;
  actionEl.innerHTML = escapeHtml(action.toUpperCase()) + sizingHtml;

  // EV display
  const evEl = $('glance-ev');
  const evSign = ev > 0 ? '+' : '';
  evEl.innerHTML = `${evSign}${ev.toFixed(1)}<span class="ev-unit">bb</span>`;
  evEl.className = `ev-display ${ev > 0 ? 'positive' : ev < 0 ? 'negative' : 'neutral'}`;

  // Metadata pills
  const pillsEl = $('glance-pills');
  let pillsHtml = '';
  const tm = advice.treeMetadata;
  if (tm?.depthReached) {
    pillsHtml += `<span class="pill depth">D${tm.depthReached}</span>`;
  }
  if (tm?.spr != null) {
    const zone = tm.sprZone ? tm.sprZone.toUpperCase() : '';
    pillsHtml += `<span class="pill spr">SPR ${tm.spr}${zone ? ' ' + zone : ''}</span>`;
  }
  pillsEl.innerHTML = pillsHtml;

  // Confidence dot
  const confEl = $('glance-confidence');
  const mq = advice.modelQuality;
  const confClass = mq?.overallSource === 'player_model' ? 'green'
    : mq?.overallSource === 'mixed' ? 'yellow' : 'red';
  const nLabel = advice.villainSampleSize ? `n=${advice.villainSampleSize}` : '';
  confEl.innerHTML = `<span class="confidence-dot ${confClass}"></span>`
    + (nLabel ? `<span class="confidence-label">${escapeHtml(nLabel)}</span>` : '');

  // Board + hero cards + pot
  const cardsEl = $('glance-cards');
  if (liveContext) {
    let html = '';

    // Board cards
    const board = liveContext.communityCards || [];
    const hasBoard = board.some(c => c && c !== '');
    if (hasBoard) {
      html += '<span class="card-group-label">Board</span><div class="card-group">';
      for (const c of board) {
        if (c && c !== '') {
          const isRed = c.includes('\u2665') || c.includes('\u2666');
          html += `<span class="mini-card ${isRed ? 'red' : 'black'}">${escapeHtml(c)}</span>`;
        }
      }
      html += '</div>';
    }

    // Hero cards
    const hero = liveContext.holeCards || [];
    const hasHero = hero.some(c => c && c !== '');
    if (hasHero) {
      if (hasBoard) html += '<span class="card-separator"></span>';
      html += '<div class="card-group">';
      for (const c of hero) {
        if (c && c !== '') {
          const isRed = c.includes('\u2665') || c.includes('\u2666');
          html += `<span class="mini-card hero-card ${isRed ? 'red' : 'black'}">${escapeHtml(c)}</span>`;
        }
      }
      html += '</div>';
    }

    // Pot
    if (advice.potSize > 0) {
      html += `<span class="pot-inline">Pot $${advice.potSize.toFixed(0)}</span>`;
    }

    cardsEl.innerHTML = html;
  } else {
    cardsEl.innerHTML = '';
  }
};

// =========================================================================
// TIER 2 — QUICK CONTEXT
// =========================================================================

export const renderQuickContext = (advice, liveContext) => {
  const container = $('quick-context');
  if (!container) return;

  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    hideEl(container);
    return;
  }
  showEl(container);

  const bestRec = advice.recommendations[0];
  const vp = advice.villainProfile;
  const tm = advice.treeMetadata;

  // DOM elements — bail if missing (pre-DOMContentLoaded safety)
  const briefEl = $('villain-brief');
  const planEl = $('hand-plan-section');
  const blockerEl = $('blocker-insight');
  const advEl = $('range-advantage');
  const vulnEl = $('top-vulnerability');
  if (!briefEl || !planEl || !blockerEl || !advEl || !vulnEl) return;

  // ── Villain brief ──
  if (vp?.headline) {
    briefEl.innerHTML = `<div class="villain-brief">
      <div class="villain-icon">\u{1F464}</div>
      <div class="villain-content">
        <div class="villain-brief-label">Villain \u00B7 Seat ${advice.villainSeat || '?'}${advice.villainStyle ? ' \u00B7 ' + escapeHtml(advice.villainStyle) : ''}</div>
        <div class="villain-headline-text">${escapeHtml(vp.headline)}</div>
      </div>
    </div>`;
  } else {
    briefEl.innerHTML = '';
  }

  // ── Hand plan tree ──
  const plan = bestRec?.handPlan;
  if (plan) {
    const branches = [];
    if (plan.ifCall?.note) {
      branches.push({ label: 'CALL', cls: 'call', note: plan.ifCall.note,
        favorable: plan.ifCall.favorableRunouts, total: plan.ifCall.totalRunouts,
        sizing: plan.ifCall.sizing, scaryCards: plan.ifCall.scaryCards });
    }
    if (plan.ifRaise?.note) {
      branches.push({ label: 'RAISE', cls: 'raise', note: plan.ifRaise.note });
    }
    if (plan.ifBet?.note) {
      branches.push({ label: 'V BETS', cls: 'raise', note: plan.ifBet.note });
    }

    if (branches.length > 0) {
      let html = '<div class="hand-plan-t2"><div class="t2-section-label">Hand Plan</div>';
      for (const b of branches) {
        const dotCls = b.favorable && b.total ? (b.favorable / b.total > 0.5 ? 'favorable' : 'unfavorable') : 'neutral-dot';
        html += `<div class="t2-plan-branch">`;
        html += `<div class="branch-dot ${dotCls}"></div>`;
        html += `<div class="t2-branch-content">`;
        html += `<div class="t2-branch-trigger">If <span class="action-word ${b.cls}">${b.label}</span> \u2192</div>`;
        html += `<div class="t2-branch-action">${escapeHtml(b.note)}</div>`;
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
        html += `</div></div>`;
      }
      html += '</div>';
      planEl.innerHTML = html;
    } else {
      planEl.innerHTML = '';
    }
  } else {
    planEl.innerHTML = '';
  }

  // ── Blocker insight ──
  const be = tm?.blockerEffects;
  if (be) {
    let bestBucket = null, bestEffect = 0;
    for (const [bucket, effect] of Object.entries(be)) {
      if (effect < bestEffect) { bestBucket = bucket; bestEffect = effect; }
    }
    if (bestBucket && bestEffect < -0.03) {
      const hero = liveContext?.holeCards?.filter(c => c && c !== '') || [];
      const cardLabel = hero.length > 0 ? hero.join(' ') : 'Your hand';
      const pctStr = Math.round(Math.abs(bestEffect) * 100);
      blockerEl.innerHTML = `<div class="insight-strip">
        <span class="insight-icon">\u25C6</span>
        <span>${escapeHtml(cardLabel)} blocks villain <span class="insight-highlight">${escapeHtml(bestBucket)}</span> range
        <span class="insight-highlight">\u2212${pctStr}%</span></span>
      </div>`;
    } else {
      blockerEl.innerHTML = '';
    }
  } else {
    blockerEl.innerHTML = '';
  }

  // ── Range advantage bar ──
  const adv = tm?.advantage;
  if (adv?.rangeAdvantage != null) {
    const heroPct = Math.round((0.5 + adv.rangeAdvantage / 2) * 100);
    const villainPct = 100 - heroPct;
    advEl.innerHTML = `<div class="range-adv">
      <div class="t2-section-label">Range Advantage</div>
      <div class="adv-bar-wrap">
        <div class="adv-fill hero" style="width:${heroPct}%"></div>
        <div class="adv-fill villain" style="width:${villainPct}%"></div>
      </div>
      <div class="adv-labels">
        <span class="hero-side">Hero ${heroPct}%</span>
        <span class="villain-side">Villain ${villainPct}%</span>
      </div>
    </div>`;
  } else {
    advEl.innerHTML = '';
  }

  // ── Top vulnerability ──
  const topVuln = vp?.vulnerabilities?.[0];
  if (topVuln) {
    const sev = topVuln.severity >= 0.7 ? 'high' : topVuln.severity >= 0.4 ? 'medium' : 'low';
    vulnEl.innerHTML = `<div class="vuln-callout">
      <div class="vuln-dot ${sev}"></div>
      <div class="vuln-text">${escapeHtml(topVuln.label || '')}${topVuln.exploitHint ? ' \u2014 ' + escapeHtml(topVuln.exploitHint) : ''}</div>
    </div>`;
  } else {
    vulnEl.innerHTML = '';
  }
};

// =========================================================================
// TIER 3 — DEEP ANALYSIS
// =========================================================================

export const renderDeepAnalysis = (advice) => {
  const container = $('deep-analysis');
  if (!container) return;

  if (!advice || !advice.recommendations || advice.recommendations.length === 0) {
    hideEl(container);
    return;
  }
  showEl(container);

  const tm = advice.treeMetadata;
  const mq = advice.modelQuality;
  const vp = advice.villainProfile;

  let html = '<div class="deep-divider"><span class="deep-divider-label">Deep Analysis</span></div>';

  const seg = advice.segmentation;
  if (seg?.handTypes && Object.keys(seg.handTypes).length > 0) {
    html += renderRangeBreakdownSection(seg);
  }
  if (advice.recommendations.length > 1) {
    html += renderAllRecsSection(advice.recommendations);
  }
  if (vp?.streets) {
    html += renderStreetTendenciesSection(vp.streets);
  }
  if (advice.foldMeta?.curve) {
    html += renderFoldCurveSection(advice.foldMeta, advice.recommendations[0]?.sizing?.betFraction);
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
  if (advice.narrowingLog?.length > 0) {
    html += renderNarrowingLogSection(advice.narrowingLog);
  }

  container.innerHTML = html;
};

// ── Sub-renderers (pure functions returning HTML strings) ──

// ── Hand type display constants (mirrors main app rangeSegmenter.js) ──

const HAND_TYPE_GROUPS = [
  { key: 'premium',  label: 'Premium',      types: ['straightFlush', 'quads', 'fullHouse'] },
  { key: 'flush',    label: 'Flush',         types: ['nutFlush', 'secondFlush', 'weakFlush'] },
  { key: 'straight', label: 'Straight',      types: ['nutStraight', 'nonNutStraight'] },
  { key: 'trips',    label: 'Set / Trips',   types: ['set', 'trips'] },
  { key: 'twoPair',  label: 'Two Pair',      types: ['twoPair'] },
  { key: 'topPair',  label: 'Top Pair',      types: ['overpair', 'topPairGood', 'topPairWeak'] },
  { key: 'midLow',   label: 'Mid/Low Pair',  types: ['middlePair', 'bottomPair', 'weakPair'] },
  { key: 'draws',    label: 'Draws',         types: ['comboDraw', 'nutFlushDraw', 'nonNutFlushDraw', 'oesd', 'gutshot', 'overcards'] },
  { key: 'air',      label: 'Air',           types: ['air'] },
];

const HAND_TYPE_LABELS = {
  straightFlush: 'Str. Flush', quads: 'Quads', fullHouse: 'Full House',
  nutFlush: 'Nut Flush', secondFlush: 'K-high Flush', weakFlush: 'Low Flush',
  nutStraight: 'Nut Straight', nonNutStraight: 'Non-nut Str.',
  set: 'Set', trips: 'Trips', twoPair: 'Two Pair',
  overpair: 'Overpair', topPairGood: 'TPTK+', topPairWeak: 'TP Weak',
  middlePair: 'Middle Pair', bottomPair: 'Bottom Pair', weakPair: 'Underpair',
  comboDraw: 'Combo Draw', nutFlushDraw: 'Nut FD', nonNutFlushDraw: 'Flush Draw',
  oesd: 'OESD', gutshot: 'Gutshot', overcards: 'Overcards',
  air: 'Air',
};

const GROUP_COLORS = {
  premium:  { bar: '#dc2626', text: '#fca5a5' },
  flush:    { bar: '#f97316', text: '#fdba74' },
  straight: { bar: '#eab308', text: '#fde047' },
  trips:    { bar: '#22c55e', text: '#86efac' },
  twoPair:  { bar: '#4ade80', text: '#86efac' },
  topPair:  { bar: '#3b82f6', text: '#93c5fd' },
  midLow:   { bar: '#8b5cf6', text: '#c4b5fd' },
  draws:    { bar: '#06b6d4', text: '#67e8f9' },
  air:      { bar: '#6b7280', text: '#9ca3af' },
};

const DRAW_TYPES = new Set(['comboDraw', 'nutFlushDraw', 'nonNutFlushDraw', 'oesd', 'gutshot']);

const formatDrawInfo = (ht, data) => {
  if (!DRAW_TYPES.has(ht) || !data.avgDrawOuts) return '';
  const outs = Math.round(data.avgDrawOuts);
  const hitPct = Math.round(outs * 2.1);
  return ` (${outs} outs ~${hitPct}%)`;
};

export const renderRangeBreakdownSection = (segmentation, { autoOpen = false } = {}) => {
  const handTypes = segmentation.handTypes;
  if (!handTypes || Object.keys(handTypes).length === 0) return '';

  // Build groups with non-zero members
  const groups = [];
  for (const gDef of HAND_TYPE_GROUPS) {
    const members = [];
    let groupPct = 0;
    let groupCount = 0;
    for (const ht of gDef.types) {
      if (handTypes[ht]) {
        members.push({ type: ht, ...handTypes[ht] });
        groupPct += handTypes[ht].pct;
        groupCount += handTypes[ht].count;
      }
    }
    if (groupPct >= 0.5) {
      groups.push({ ...gDef, pct: groupPct, count: groupCount, members });
    }
  }
  if (groups.length === 0) return '';

  // Stacked bar
  let barHtml = '';
  for (const g of groups) {
    const color = GROUP_COLORS[g.key];
    const showLabel = g.pct >= 8;
    barHtml += `<div class="rb-bar-seg" style="width:${g.pct}%;background:${color.bar}"` +
      ` title="${escapeHtml(g.label)}: ${Math.round(g.pct)}%">` +
      (showLabel ? `<span class="rb-bar-label">${Math.round(g.pct)}%</span>` : '') +
      `</div>`;
  }

  // Group rows
  let rowsHtml = '';
  for (const g of groups) {
    const color = GROUP_COLORS[g.key];
    let subDetail = '';
    if (g.members.length > 1) {
      const parts = g.members.map(m => {
        const drawInfo = formatDrawInfo(m.type, m);
        return `${escapeHtml(HAND_TYPE_LABELS[m.type] || m.type)} ${Math.round(m.pct)}%${drawInfo}`;
      });
      subDetail = parts.join(' \u00B7 ');
    } else if (g.members.length === 1 && g.members[0].avgDrawOuts > 0) {
      subDetail = formatDrawInfo(g.members[0].type, g.members[0]).trim();
    }

    rowsHtml += `<div class="rb-row">
      <span class="rb-pct" style="color:${color.text}">${Math.round(g.pct)}%</span>
      <span class="rb-label" style="color:${color.text}">${escapeHtml(g.label)}</span>
      ${subDetail ? `<span class="rb-detail">${subDetail}</span>` : ''}
    </div>`;
  }

  const comboLabel = segmentation.totalCombos > 0 ? ` \u00B7 ${segmentation.totalCombos} combos` : '';

  return `<div class="deep-section${autoOpen ? ' open' : ''}" data-section="range-breakdown">
    <div class="deep-header"><span class="deep-header-icon">\u229E</span>
      <span class="deep-header-title">Villain Range${comboLabel}</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">
      <div class="rb-stacked-bar">${barHtml}</div>
      <div class="rb-groups">${rowsHtml}</div>
    </div></div>
  </div>`;
};

export const renderAllRecsSection = (recs) => {
  let items = '';
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    const isBest = i === 0;
    const action = r.action || 'check';
    const badgeClass = action === 'raise' ? 'raise' : action === 'bet' ? 'bet'
      : action === 'call' ? 'call' : action === 'fold' ? 'fold' : 'check';
    const ev = r.ev ?? 0;
    const evClass = ev > 0 ? 'pos' : ev < 0 ? 'neg' : 'neu';
    const sizing = r.sizing?.betSize != null ? `$${r.sizing.betSize.toFixed(0)} \u00B7 ` : '';
    const foldNote = r.sizing && r.sizing.foldPct != null ? `fold ${Math.round(r.sizing.foldPct * 100)}% \u00B7 ` : '';
    const reason = r.reasoning ? r.reasoning.split(' \u2014 ')[0].substring(0, 50) : '';
    items += `<div class="rec-item${isBest ? ' best' : ''}">
      <span class="rec-rank">${i + 1}</span>
      <span class="rec-badge" style="background:var(--action-${badgeClass}-bg);color:var(--action-${badgeClass}-text)">${escapeHtml(action.toUpperCase())}${r.sizing ? ' ' + Math.round(r.sizing.betFraction * 100) + '%' : ''}</span>
      <span class="rec-detail">${escapeHtml(sizing + foldNote + reason)}</span>
      <span class="rec-ev ${evClass}">${ev > 0 ? '+' : ''}${ev.toFixed(1)}</span>
    </div>`;
  }
  return `<div class="deep-section" data-section="recs">
    <div class="deep-header"><span class="deep-header-icon">\u2630</span>
      <span class="deep-header-title">All Recommendations</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">${items}</div></div>
  </div>`;
};

export const renderStreetTendenciesSection = (streets) => {
  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const LABELS = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River' };
  let rows = '';
  for (const s of STREETS) {
    const st = streets[s];
    if (!st?.tendency) continue;
    const confPct = Math.round((st.confidence ?? 0) * 100);
    rows += `<div class="street-tendency">
      <span class="street-name-label">${LABELS[s]}</span>
      <span class="tendency-text">${escapeHtml(st.tendency)}</span>
      <div class="tendency-conf-track"><div class="tendency-conf-fill" style="width:${confPct}%"></div></div>
    </div>`;
  }
  if (!rows) return '';
  return `<div class="deep-section" data-section="tendencies">
    <div class="deep-header"><span class="deep-header-icon">\u{1F4CA}</span>
      <span class="deep-header-title">Villain Street Tendencies</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">${rows}</div></div>
  </div>`;
};

export const renderFoldCurveSection = (foldMeta, currentBetFraction, { autoOpen = false } = {}) => {
  const curve = foldMeta.curve;
  if (!curve || curve.length < 2) return '';

  const W = 320, H = 70, PAD_L = 30, PAD_R = 10, PAD_T = 5, PAD_B = 5;
  const minS = curve[0].sizing, maxS = curve[curve.length - 1].sizing;
  if (maxS === minS) return '';
  const toX = (s) => PAD_L + (s - minS) / (maxS - minS) * (W - PAD_L - PAD_R);
  const toY = (f) => PAD_T + (1 - f) * (H - PAD_T - PAD_B);

  let pathD = `M${toX(curve[0].sizing)},${toY(curve[0].foldPct)}`;
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1], curr = curve[i];
    const cx = (toX(prev.sizing) + toX(curr.sizing)) / 2;
    pathD += ` C${cx},${toY(prev.foldPct)} ${cx},${toY(curr.foldPct)} ${toX(curr.sizing)},${toY(curr.foldPct)}`;
  }

  let yLabels = '';
  for (const pct of [0.2, 0.4, 0.6, 0.8]) {
    yLabels += `<line x1="${PAD_L}" y1="${toY(pct)}" x2="${W - PAD_R}" y2="${toY(pct)}" stroke="rgba(42,42,74,0.3)" stroke-width="0.5"/>`;
    yLabels += `<text x="${PAD_L - 3}" y="${toY(pct) + 3}" fill="#4b5563" font-size="8" text-anchor="end" font-family="Consolas">${Math.round(pct * 100)}%</text>`;
  }

  let marker = '', markerHtml = '';
  if (currentBetFraction != null) {
    const closestPt = curve.reduce((a, b) => Math.abs(b.sizing - currentBetFraction) < Math.abs(a.sizing - currentBetFraction) ? b : a);
    const mx = toX(closestPt.sizing), my = toY(closestPt.foldPct);
    marker = `<circle cx="${mx}" cy="${my}" r="3.5" fill="#d4a847" stroke="#0d1117" stroke-width="1.5"/>`;
    marker += `<line x1="${mx}" y1="${my}" x2="${mx}" y2="${H - PAD_B}" stroke="#d4a847" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.5"/>`;
    markerHtml = `<div class="fold-curve-marker" style="left:${Math.round(mx / W * 100)}%;top:2px">${Math.round(closestPt.foldPct * 100)}%</div>`;
  }

  const src = foldMeta.curveSource === 'personalized' ? 'Personalized' : 'Style default';

  return `<div class="deep-section${autoOpen ? ' open' : ''}" data-section="foldcurve">
    <div class="deep-header"><span class="deep-header-icon">\u223F</span>
      <span class="deep-header-title">Fold Curve \u00B7 ${escapeHtml(src)}</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">
      <div class="fold-curve-wrap">
        <svg class="fold-curve-svg" viewBox="0 0 ${W} ${H}" fill="none">
          ${yLabels}
          <path d="${pathD}" stroke="#d4a847" stroke-width="2" fill="none"/>
          ${marker}
        </svg>
        ${markerHtml}
      </div>
      <div class="fold-curve-labels"><span>${Math.round(minS * 100)}% pot</span><span>${Math.round(maxS * 100)}% pot</span></div>
    </div></div>
  </div>`;
};

export const renderFoldBreakdownSection = (foldMeta, foldPct) => {
  const meta = foldMeta.bet;
  if (!meta) return '';
  let rows = '';
  for (const adj of (meta.adjustments || [])) {
    const shift = meta.baseEstimate > 0 ? Math.round((adj.multiplier - 1) * 100) : 0;
    const cls = shift > 0 ? 'up' : shift < 0 ? 'down' : 'flat';
    const sign = shift > 0 ? '+' : '';
    rows += `<div class="fold-adj">
      <span class="fold-adj-label">${escapeHtml(adj.factor)}</span>
      <span class="fold-adj-value ${cls}">${sign}${shift}%</span>
    </div>`;
  }
  const finalPct = foldPct?.bet != null ? Math.round(foldPct.bet * 100) : '?';
  return `<div class="deep-section" data-section="foldpct">
    <div class="deep-header"><span class="deep-header-icon">%</span>
      <span class="deep-header-title">Fold% Breakdown \u00B7 ${finalPct}%</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="font-size:var(--font-sm);color:var(--text-muted)">Base estimate</span>
        <span style="font-family:Consolas;font-size:var(--font-md);font-weight:var(--weight-bold);color:var(--text-primary)">${Math.round(meta.baseEstimate * 100)}%</span>
        <span style="font-family:Consolas;font-size:var(--font-xs);color:var(--text-faint);margin-left:auto">${escapeHtml(meta.source || '')}</span>
      </div>
      ${rows}
      <div style="border-top:1px solid var(--border-default);margin-top:3px;padding-top:3px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:var(--font-sm);color:var(--text-muted)">Final fold%</span>
        <span style="font-family:Consolas;font-size:var(--font-md);font-weight:var(--weight-bold);color:var(--text-primary)">${finalPct}%</span>
      </div>
    </div></div>
  </div>`;
};

export const renderComboStatsSection = (stats) => {
  const { total = 0, ahead = 0, behind = 0, tied = 0 } = stats;
  if (!total || total <= 0) return '';
  const aPct = (ahead / total * 100).toFixed(1);
  const tPct = (tied / total * 100).toFixed(1);
  const bPct = (behind / total * 100).toFixed(1);
  return `<div class="deep-section" data-section="combos">
    <div class="deep-header"><span class="deep-header-icon">\u2295</span>
      <span class="deep-header-title">Combo Distribution</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">
      <div class="combo-bar-wrap">
        <div class="combo-seg ahead" style="width:${aPct}%">${ahead}</div>
        <div class="combo-seg tied" style="width:${tPct}%"></div>
        <div class="combo-seg behind" style="width:${bPct}%">${behind}</div>
      </div>
      <div class="combo-legend">
        <span class="combo-legend-item"><span class="combo-legend-dot ahead"></span>Ahead <span class="combo-legend-count">${ahead}</span></span>
        <span class="combo-legend-item"><span class="combo-legend-dot tied"></span>Tied <span class="combo-legend-count">${tied}</span></span>
        <span class="combo-legend-item"><span class="combo-legend-dot behind"></span>Behind <span class="combo-legend-count">${behind}</span></span>
      </div>
    </div></div>
  </div>`;
};

export const renderModelAuditSection = (mq, tm, sampleSize) => {
  let rows = '';
  const row = (k, v) => `<div class="audit-row"><span class="audit-key">${escapeHtml(k)}</span><span class="audit-val">${escapeHtml(String(v))}</span></div>`;
  if (mq?.overallSource) rows += row('Data source', mq.overallSource === 'population' ? 'Population' : mq.overallSource === 'mixed' ? 'Hierarchical blend' : 'Player model');
  if (sampleSize != null) rows += row('Effective N', sampleSize + ' observations');
  if (tm?.branches) rows += row('Tree branches', `${tm.branches} actions \u00D7 D${tm.depthReached || 1}`);
  if (tm?.computeMs) rows += row('Compute time', tm.computeMs + 'ms');
  if (tm?.comboCounted) rows += row('Combo counted', 'Yes (exact)');
  if (tm?.dynamicAnchors) rows += row('Dynamic anchors', 'Yes (MC sampled)');
  if (tm?.numOpponents > 1) rows += row('Opponents', tm.numOpponents);
  if (!rows) return '';
  return `<div class="deep-section" data-section="audit">
    <div class="deep-header"><span class="deep-header-icon">\u2699</span>
      <span class="deep-header-title">Model Audit</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">${rows}</div></div>
  </div>`;
};

export const renderVulnerabilitiesSection = (vulns) => {
  let items = '';
  for (const v of vulns.slice(0, 5)) {
    const sev = v.severity >= 0.7 ? 'high' : v.severity >= 0.4 ? 'medium' : 'low';
    items += `<div class="vuln-callout" style="margin-bottom:5px">
      <div class="vuln-dot ${sev}"></div>
      <div class="vuln-text">${escapeHtml(v.label || '')}${v.exploitHint ? '<div style="font-size:var(--font-xs);color:var(--text-faint);margin-top:1px">\u2192 ' + escapeHtml(v.exploitHint) + '</div>' : ''}</div>
    </div>`;
  }
  return `<div class="deep-section" data-section="vulns">
    <div class="deep-header"><span class="deep-header-icon">\u26A1</span>
      <span class="deep-header-title">Active Vulnerabilities</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">${items}</div></div>
  </div>`;
};

/**
 * Render narrowing log section showing how villain ranges adapted per street.
 */
export const renderNarrowingLogSection = (narrowingLog) => {
  if (!narrowingLog || narrowingLog.length === 0) return '';

  const STREET_COLORS = { preflop: '#a78bfa', flop: '#3b82f6', turn: '#22c55e', river: '#ef4444' };
  let items = '';
  for (const entry of narrowingLog) {
    const color = STREET_COLORS[entry.street] || '#6b7280';
    const delta = entry.fromWidth - entry.toWidth;
    const deltaStr = delta > 0 ? `\u2212${delta}%` : delta < 0 ? `+${Math.abs(delta)}%` : '0%';
    const deltaColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text-faint)';
    items += `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:var(--font-xs)">
      <span style="background:${color};color:#fff;padding:1px 4px;border-radius:3px;font-size:var(--font-micro);min-width:32px;text-align:center">${escapeHtml(entry.street || '')}</span>
      <span style="color:var(--text-secondary);min-width:22px">S${entry.seat}</span>
      <span style="color:var(--text-primary);flex:1">${escapeHtml(entry.description || '')}</span>
      <span style="color:${deltaColor};font-weight:600;font-size:var(--font-xs)">${deltaStr}</span>
    </div>`;
  }

  return `<div class="deep-section" data-section="narrowing">
    <div class="deep-header"><span class="deep-header-icon">\u2198</span>
      <span class="deep-header-title">Range Narrowing</span>
      <span class="deep-chevron">\u25BE</span></div>
    <div class="deep-body"><div class="deep-content">${items}</div></div>
  </div>`;
};

// Deep section toggle event delegation
export const initDeepSectionToggles = () => {
  document.addEventListener('click', (e) => {
    const header = e.target.closest('.deep-header');
    if (!header) return;
    const section = header.closest('.deep-section');
    if (section) section.classList.toggle('open');
  });
};
