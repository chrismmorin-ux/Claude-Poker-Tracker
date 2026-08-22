/**
 * buildReviewArtifact.mjs — the session review as something the founder can absorb.
 *
 * NO SHEBANG, DELIBERATELY — see the note in `reviewSession.mjs`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS FOR
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * FOUNDER, 2026-08-21: "get this into an artifact that I can actually absorb and see my hands
 * next to analysis, not just notes and impromptu analysis."
 *
 * So the organising principle is ADJACENCY. The verdict on a decision renders inline, directly
 * beneath the action it prices, inside the chronological action log. Not in a table after the
 * hand, not on a second page. A hand read out of order is not a hand, and a verdict read away
 * from its moment is a statistic.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * EVERY HERO DECISION RENDERS A STATE (WS-622)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * An unpriced decision previously produced NO ROW, so silence read as approval. Here every
 * hero action carries exactly one state — PRICED / CLEAN / UNPRICED — and unpriced says WHY.
 * The docket is the record; the absence of a row is never a verdict.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE TRANSFER LABEL IS NOT DECORATION (WS-632, WS-415)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `money.transferStatus` is a structured object precisely so a renderer cannot show the level
 * without the label. WS-415 is the bug where a renderer dropped a population caveat. This file
 * refuses to render a money figure at all if the transfer status is missing — a number with no
 * population is the WS-291 mechanism, and the page is the last place it could be caught.
 *
 * RUN
 *   node scripts/villainArchetype/buildReviewArtifact.mjs [--out <path>] [--store <dir>]
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const DEFAULT_STORE = 'C:/Users/chris/data/poker-sessions/closed';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ─────────────────────────────────────────────────────────────────────────────────────
// null IS NOT ZERO (WS-632 family)
// ─────────────────────────────────────────────────────────────────────────────────────
//
// `Number(null) || 0` printed `exploitationEfficiency: null` — the record's way of saying
// "0 of 0 decisions were priced, the ratio is undefined" — as a confident `0%`. On
// sess-20260618-024529 that rendered "0.00bb left on the table" beside "0% of the available
// money taken": two adjacent numbers that contradict each other, NEITHER of them a
// measurement. One reads as a flawless session, the other as a catastrophic one.
//
// That is `observed-zero` and `unexamined` collapsed into the same glyph, on the surface whose
// entire stated purpose is keeping them apart. A missing number renders as a refusal mark and
// never as a value.
const NOT_MEASURED = '<span class="nm" title="not measured — no value was produced for this">—</span>';
const bb = (n) => (Number.isFinite(Number(n)) && n !== null ? Number(n).toFixed(2) : null);
const pct = (n) => (Number.isFinite(Number(n)) && n !== null ? `${(Number(n) * 100).toFixed(0)}%` : null);
/** Render a figure, or the refusal mark. Never a zero standing in for an absence. */
const fig = (v, unit = '') => (v === null ? NOT_MEASURED : `${v}${unit}`);

const SUIT_CLASS = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
const cards = (arr) => (arr || []).map((c) => {
  const suit = String(c).slice(-1);
  return `<span class="card ${SUIT_CLASS[suit] || ''}">${esc(c)}</span>`;
}).join('');

const parseArgs = (argv) => {
  const a = {};
  for (let i = 2; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) a[k] = true; else { a[k] = n; i += 1; }
  }
  return a;
};

const loadReviews = (store) => {
  const out = [];
  for (const id of readdirSync(store)) {
    const p = join(store, id, 'review', 'review.json');
    if (!existsSync(p)) continue;
    try { out.push(JSON.parse(readFileSync(p, 'utf8'))); } catch { /* skip unreadable */ }
  }
  return out.sort((x, y) => String(y.session?.startedAt).localeCompare(String(x.session?.startedAt)));
};

/** A verdict panel — the analysis that sits beneath the action it prices. */
const verdictPanel = (d) => {
  const leak = d.evLeftBB > 0.005;
  const alts = Object.entries(d.values || {})
    .sort((a, b) => b[1] - a[1])
    .map(([act, v]) => {
      const isBest = act === d.bestAction;
      const isTaken = act === d.observedAction;
      const tag = [isBest ? 'best' : '', isTaken ? 'taken' : ''].filter(Boolean).join(' ');
      return `<div class="alt ${tag}">
        <span class="alt-act">${esc(act)}</span>
        <span class="alt-val">${bb(v)}<span class="unit">bb</span></span>
        ${isTaken ? '<span class="alt-flag">you</span>' : ''}
        ${isBest && !isTaken ? '<span class="alt-flag best-flag">ceiling</span>' : ''}
      </div>`;
    }).join('');

  return `<div class="verdict ${leak ? 'is-leak' : 'is-clean'}">
    <div class="verdict-head">
      <span class="verdict-state">${leak ? 'Left on the table' : 'Matched the ceiling'}</span>
      ${leak ? `<span class="verdict-cost">${bb(d.evLeftBB)}<span class="unit">bb</span></span>` : ''}
    </div>
    ${leak && d.attribution?.detail
    ? `<p class="verdict-why">${esc(d.attribution.detail)}</p>` : ''}
    <div class="alts">${alts}</div>
    <dl class="verdict-facts">
      <div><dt>Your equity</dt><dd>${pct(d.heroEquity)}</dd></div>
      <div><dt>Pot</dt><dd>${bb(d.potExBetBB)}<span class="unit">bb</span></dd></div>
      ${d.facingBetBB > 0 ? `<div><dt>Facing</dt><dd>${bb(d.facingBetBB)}<span class="unit">bb</span></dd></div>` : ''}
      <div><dt>Opponents</dt><dd>${d.numOpponents}</dd></div>
    </dl>
  </div>`;
};

/** One action row. Hero rows carry their state; villain rows are context. */
const actionRow = (a, priced, scope) => {
  const amt = a.amountBB != null ? ` <span class="amt">${bb(a.amountBB)}<span class="unit">bb</span></span>` : '';
  if (!a.isHero) {
    return `<div class="act villain">
      <span class="who">seat ${esc(a.seat)} <em>${esc(a.position)}</em></span>
      <span class="what">${esc(a.action)}${amt}</span>
    </div>`;
  }

  const geo = a.geo;
  const geoLine = geo ? `<div class="geo">
      pot ${bb(geo.potBB)}bb${geo.facingBetBB > 0
    ? ` · facing ${bb(geo.facingBetBB)}bb · needs ${geo.equityNeededPct.toFixed(0)}% to call`
    : ' · nothing to call'}${geo.spr != null ? ` · SPR ${geo.spr.toFixed(1)}` : ''} · ${geo.liveOpponents} live${geo.madeHand ? ` · <strong>${esc(geo.madeHand)}</strong>` : ''}
    </div>` : '';

  let state = '';
  if (!geo) {
    state = '<span class="state posted">posted</span>';
  } else if (priced) {
    state = priced.evLeftBB > 0.005
      ? '<span class="state leak">priced · leak</span>'
      : '<span class="state clean">priced · clean</span>';
  } else if (a.street === 'preflop') {
    state = '<span class="state unpriced">unpriced — preflop</span>';
  } else {
    state = '<span class="state unpriced">unpriced</span>';
  }

  const unpricedNote = (!priced && geo && a.street === 'preflop' && scope)
    ? `<p class="unpriced-why">${esc(scope.why)} <span class="fix">Removed by: ${esc(scope.removedBy)}</span></p>`
    : '';

  return `<div class="act hero">
    <span class="who">You <em>${esc(a.position)}</em></span>
    <span class="what">${esc(a.action)}${amt}</span>
    ${state}
    ${geoLine}
    ${unpricedNote}
    ${priced ? verdictPanel(priced) : ''}
  </div>`;
};

const handBlock = (hand, pricedByOrder, scope) => {
  const f = hand.dossier?.facts || {};
  const actions = hand.dossier?.actions || [];
  if (!actions.length) return '';

  const heroDecisions = actions.filter((a) => a.isHero && a.geo);
  const pricedHere = heroDecisions.filter((a) => pricedByOrder.get(a.order));
  const leakHere = pricedHere.reduce((s, a) => s + (pricedByOrder.get(a.order).evLeftBB || 0), 0);

  let curStreet = null;
  const body = actions.map((a) => {
    let head = '';
    if (a.street !== curStreet) {
      curStreet = a.street;
      head = `<div class="street">
        <span class="street-name">${esc(a.street)}</span>
        ${a.board?.length ? `<span class="board">${cards(a.board)}</span>` : ''}
        ${a.texture ? `<span class="texture">${esc(a.texture)}</span>` : ''}
      </div>`;
    }
    return head + actionRow(a, pricedByOrder.get(a.order), scope);
  }).join('');

  return `<article class="hand">
    <header class="hand-head">
      <div class="hand-id">
        <span class="label">Hand</span>
        <span class="mono">${esc(f.handId)}</span>
      </div>
      <div class="hand-hero">
        ${f.villainCards ? cards(f.villainCards) : '<span class="unknown">cards not captured</span>'}
        <span class="pos">${esc(f.position)}</span>
        ${f.effectiveStackBB != null ? `<span class="stack">${f.effectiveStackBB.toFixed(0)}bb deep</span>` : ''}
        <span class="stack">${esc(f.players)}-handed</span>
      </div>
      <div class="hand-cost ${leakHere > 0.005 ? 'has-leak' : ''}">
        ${leakHere > 0.005
    ? `<span class="cost-val">${bb(leakHere)}<span class="unit">bb</span></span><span class="cost-lab">left on the table</span>`
    : `<span class="cost-lab">${pricedHere.length ? 'nothing left on the table' : 'no priced decision'}</span>`}
      </div>
    </header>
    <div class="log">${body}</div>
    <footer class="hand-foot">
      ${heroDecisions.length} decision${heroDecisions.length === 1 ? '' : 's'} ·
      ${pricedHere.length} priced ·
      ${heroDecisions.length - pricedHere.length} unpriced
    </footer>
  </article>`;
};

const sessionBlock = (r) => {
  const m = r.money || {};
  const t = m.totals || {};
  const cov = m.coverage || {};
  const hero = r.hero || {};
  const when = String(r.session?.startedAt || '').slice(0, 10);
  const stake = r.hero?.conductCard?.dealBook?.stakeLabel || '';

  const pricedByHand = new Map();
  for (const d of (m.priced || [])) {
    if (!pricedByHand.has(d.handId)) pricedByHand.set(d.handId, new Map());
    pricedByHand.get(d.handId).set(d.order, d);
  }

  const hands = (r.notable?.hands || [])
    .map((h) => handBlock(h, pricedByHand.get(h.handId) || new Map(), m.scope))
    .filter(Boolean).join('');

  // A money figure never renders without its population label. See the header note.
  const ts = m.transferStatus;
  const moneyOk = !m.refused && ts && typeof ts === 'object';

  const summary = m.refused
    ? `<div class="refusal">
         <span class="refusal-reason">${esc(m.reason)}</span>
         <p>${esc(m.detail)}</p>
         ${m.resolvedBy ? `<p class="fix"><span>What would answer it</span> ${esc(m.resolvedBy)}</p>` : ''}
       </div>`
    : (!moneyOk
      ? `<div class="refusal"><span class="refusal-reason">render-refused:no-transfer-status</span>
           <p>The money column priced this session but carries no population label, so no figure
           is shown. A level without its population is the failure this whole standard exists to
           prevent.</p></div>`
      : `<div class="totals">
        <div class="stat big"><span class="v">${bb(t.evLeftBB)}<span class="unit">bb</span></span><span class="k">left on the table</span></div>
        <div class="stat"><span class="v">${pct(t.exploitationEfficiency)}</span><span class="k">of the available money taken</span></div>
        <div class="stat"><span class="v">${t.decisionsPriced}<span class="of">/${cov.heroDecisionsTotal}</span></span><span class="k">decisions priced</span></div>
        <div class="stat"><span class="v">${t.agreedCount}</span><span class="k">matched the ceiling</span></div>
      </div>`);

  const covNote = (!m.refused && cov.heroDecisionsTotal)
    ? `<p class="coverage">Priced <strong>${t.decisionsPriced} of ${cov.heroDecisionsTotal}</strong>
       decisions (${pct(cov.pricedShareOfSession)}).
       ${cov.heroDecisionsByStreet?.preflop
    ? `<strong>${cov.heroDecisionsByStreet.preflop} preflop decisions were never evaluated</strong> — ${esc(m.scope?.why || '')}`
    : ''}</p>`
    : '';

  return `<section class="session">
    <header class="session-head">
      <h2>${esc(when)}${stake ? ` · ${esc(stake)}` : ''}</h2>
      <p class="session-meta mono">${esc(r.session?.id)}</p>
      <p class="session-meta">${hero.handsSeated ?? 0} hands · ${hero.decisions ?? 0} decisions ·
        cards known on ${pct(hero.cardsKnownFraction ?? 0)} of them</p>
    </header>
    ${summary}
    ${covNote}
    ${hands || '<p class="empty">No hand carried enough detail to lay out here.</p>'}
  </section>`;
};

export const buildReviewArtifact = (reviews) => {
  const withMoney = reviews.filter((r) => r.money && !r.money.refused && r.money.transferStatus);
  const totalLeft = withMoney.reduce((s, r) => s + (r.money.totals?.evLeftBB || 0), 0);
  const totalPriced = withMoney.reduce((s, r) => s + (r.money.totals?.decisionsPriced || 0), 0);
  const totalDecisions = reviews.reduce((s, r) => s + (r.hero?.decisions || 0), 0);
  const totalHands = reviews.reduce((s, r) => s + (r.hero?.handsSeated || 0), 0);
  const ts = withMoney[0]?.money?.transferStatus;

  return `<title>Where the Money Went</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
  :root {
    --ground: #f2f3f5;
    --surface: #ffffff;
    --surface-2: #e9ebee;
    --fg: #14171d;
    --fg-muted: #5d646f;
    --fg-faint: #868d99;
    --line: #d6d9de;
    --line-strong: #b9bec6;
    --brass: #8a6220;
    --brass-bg: #f5eddc;
    --rust: #a8492a;
    --rust-bg: #f8e8e2;
    --teal: #26635a;
    --teal-bg: #e0eeea;
    --heart: #b03040;
    --spade: #14171d;
    --shadow: 0 1px 2px rgba(20,23,29,.06), 0 4px 12px rgba(20,23,29,.05);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #14171d;
      --surface: #1b1f27;
      --surface-2: #232833;
      --fg: #e7e9ed;
      --fg-muted: #9aa2ae;
      --fg-faint: #6f7885;
      --line: #2c323d;
      --line-strong: #3d4552;
      --brass: #d0a24e;
      --brass-bg: #2b2415;
      --rust: #e0805f;
      --rust-bg: #33201a;
      --teal: #6fb8a8;
      --teal-bg: #16302b;
      --heart: #e0697a;
      --spade: #e7e9ed;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 4px 14px rgba(0,0,0,.25);
    }
  }
  :root[data-theme="dark"] {
    --ground: #14171d;
    --surface: #1b1f27;
    --surface-2: #232833;
    --fg: #e7e9ed;
    --fg-muted: #9aa2ae;
    --fg-faint: #6f7885;
    --line: #2c323d;
    --line-strong: #3d4552;
    --brass: #d0a24e;
    --brass-bg: #2b2415;
    --rust: #e0805f;
    --rust-bg: #33201a;
    --teal: #6fb8a8;
    --teal-bg: #16302b;
    --heart: #e0697a;
    --spade: #e7e9ed;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 4px 14px rgba(0,0,0,.25);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--fg);
    font-family: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 940px; margin: 0 auto; padding: 40px 20px 96px; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; }
  .unit { font-size: .72em; color: var(--fg-faint); margin-left: 1px; }

  /* ── masthead ─────────────────────────────────────────────── */
  .masthead { border-bottom: 2px solid var(--fg); padding-bottom: 20px; margin-bottom: 8px; }
  .eyebrow {
    font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--fg-muted); margin: 0 0 10px;
  }
  h1 {
    font-family: "Zilla Slab", Georgia, serif; font-weight: 700;
    font-size: clamp(30px, 5.5vw, 46px); line-height: 1.06; margin: 0 0 14px;
    letter-spacing: -.015em; text-wrap: balance;
  }
  .standfirst { font-size: 17px; color: var(--fg-muted); margin: 0; max-width: 60ch; }

  .headline-figures {
    display: flex; flex-wrap: wrap; gap: 28px 44px;
    padding: 22px 0 26px; border-bottom: 1px solid var(--line); margin-bottom: 28px;
  }
  .fig { display: flex; flex-direction: column; }
  .fig .v {
    font-family: "Zilla Slab", Georgia, serif; font-weight: 600; font-size: 30px;
    font-variant-numeric: tabular-nums; line-height: 1;
  }
  .fig.money .v { color: var(--brass); }
  .fig .k {
    font-size: 12px; color: var(--fg-muted); margin-top: 6px;
    letter-spacing: .03em;
  }

  /* ── the transfer banner: load-bearing, not decoration ────── */
  .transfer {
    background: var(--brass-bg); border: 1px solid var(--brass);
    border-left-width: 4px; border-radius: 3px;
    padding: 16px 18px; margin: 0 0 34px;
  }
  .transfer-label {
    font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600;
    letter-spacing: .12em; text-transform: uppercase; color: var(--brass);
    display: block; margin-bottom: 8px;
  }
  .transfer p { margin: 0 0 8px; font-size: 14px; color: var(--fg); }
  .transfer p:last-child { margin-bottom: 0; }
  .transfer .pop { color: var(--fg-muted); font-size: 13px; }

  /* ── session ──────────────────────────────────────────────── */
  .session { margin: 0 0 60px; }
  .session-head { margin-bottom: 18px; }
  .session-head h2 {
    font-family: "Zilla Slab", Georgia, serif; font-weight: 600; font-size: 24px;
    margin: 0 0 4px; letter-spacing: -.01em;
  }
  .session-meta { margin: 0; font-size: 12px; color: var(--fg-faint); }

  .totals {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1px; background: var(--line); border: 1px solid var(--line);
    border-radius: 3px; overflow: hidden; margin-bottom: 14px;
  }
  .stat { background: var(--surface); padding: 14px 16px; display: flex; flex-direction: column; }
  .stat .v {
    font-family: "Zilla Slab", Georgia, serif; font-weight: 600; font-size: 22px;
    font-variant-numeric: tabular-nums; line-height: 1.1;
  }
  .stat.big .v { color: var(--brass); }
  .stat .of { color: var(--fg-faint); font-size: .68em; font-weight: 500; }
  .stat .k { font-size: 11.5px; color: var(--fg-muted); margin-top: 5px; }

  .coverage {
    font-size: 13px; color: var(--fg-muted); margin: 0 0 24px;
    padding: 10px 14px; background: var(--surface-2); border-radius: 3px;
  }
  .coverage strong { color: var(--fg); }

  .refusal {
    background: var(--surface); border: 1px solid var(--line-strong);
    border-left: 4px solid var(--fg-faint); border-radius: 3px;
    padding: 14px 16px; margin-bottom: 24px;
  }
  .refusal-reason {
    font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--fg-muted);
    letter-spacing: .06em;
  }
  .refusal p { margin: 8px 0 0; font-size: 13.5px; color: var(--fg-muted); }
  .fix span { font-weight: 600; color: var(--fg); }

  /* ── a hand ───────────────────────────────────────────────── */
  .hand {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 4px; margin-bottom: 22px; overflow: hidden;
    box-shadow: var(--shadow);
  }
  .hand-head {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px;
    padding: 14px 18px; border-bottom: 1px solid var(--line);
    background: var(--surface-2);
  }
  .hand-id .label {
    font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--fg-faint); margin-right: 7px;
  }
  .hand-id .mono { font-size: 13px; color: var(--fg-muted); }
  .hand-hero { display: flex; align-items: center; gap: 8px; }
  .hand-cost { margin-left: auto; text-align: right; display: flex; flex-direction: column; }
  .hand-cost .cost-val {
    font-family: "Zilla Slab", Georgia, serif; font-weight: 700; font-size: 19px;
    color: var(--brass); font-variant-numeric: tabular-nums; line-height: 1;
  }
  .hand-cost .cost-lab { font-size: 11px; color: var(--fg-faint); margin-top: 3px; }

  .card {
    display: inline-block; font-family: "IBM Plex Mono", monospace; font-weight: 600;
    font-size: 14px; padding: 2px 5px; border-radius: 2px;
    background: var(--ground); border: 1px solid var(--line-strong);
    color: var(--spade); margin-right: 2px;
  }
  .card.h, .card.d { color: var(--heart); }
  .unknown { font-size: 12px; color: var(--fg-faint); font-style: italic; }
  .pos, .stack {
    font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
    color: var(--fg-muted); padding: 2px 7px; background: var(--ground);
    border-radius: 2px; border: 1px solid var(--line);
  }

  .log { padding: 4px 0; }
  .street {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 12px 18px 8px; margin-top: 6px;
    border-top: 1px solid var(--line);
  }
  .log > .street:first-child { border-top: none; margin-top: 0; }
  .street-name {
    font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600;
    letter-spacing: .14em; text-transform: uppercase; color: var(--fg-muted);
  }
  .texture { font-size: 11.5px; color: var(--fg-faint); font-style: italic; }

  .act { padding: 4px 18px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .act .who { font-size: 12.5px; color: var(--fg-faint); min-width: 120px; }
  .act .who em { font-style: normal; letter-spacing: .05em; text-transform: uppercase; font-size: 10.5px; }
  .act .what { font-family: "IBM Plex Mono", monospace; font-size: 13px; color: var(--fg-muted); }
  .act .amt { font-variant-numeric: tabular-nums; color: var(--fg); font-weight: 500; }

  .act.hero { background: var(--surface); padding-top: 9px; padding-bottom: 9px; }
  .act.hero .who { color: var(--fg); font-weight: 600; }
  .act.hero .what { color: var(--fg); font-weight: 500; }
  .act.hero { border-left: 3px solid var(--line-strong); }
  .act.hero .geo, .act.hero .verdict, .act.hero .unpriced-why { flex-basis: 100%; }

  .state {
    font-family: "IBM Plex Mono", monospace; font-size: 10px; font-weight: 600;
    letter-spacing: .1em; text-transform: uppercase; padding: 2px 7px; border-radius: 2px;
  }
  .state.leak { background: var(--rust-bg); color: var(--rust); }
  .state.clean { background: var(--teal-bg); color: var(--teal); }
  .state.unpriced { background: var(--surface-2); color: var(--fg-faint); }
  .state.posted { background: transparent; color: var(--fg-faint); font-weight: 400; }

  .geo {
    font-family: "IBM Plex Mono", monospace; font-size: 11.5px; color: var(--fg-faint);
    margin-top: 5px; font-variant-numeric: tabular-nums;
  }
  .geo strong { color: var(--fg-muted); font-weight: 600; }
  .unpriced-why {
    font-size: 12px; color: var(--fg-faint); margin: 7px 0 2px;
    padding-left: 10px; border-left: 2px solid var(--line);
  }
  .unpriced-why .fix { display: block; margin-top: 3px; color: var(--fg-muted); }

  /* ── the verdict, inline with its action ──────────────────── */
  .verdict {
    margin: 10px 0 4px; border-radius: 3px; padding: 12px 14px;
    border: 1px solid var(--line);
  }
  .verdict.is-leak { background: var(--rust-bg); border-color: var(--rust); }
  .verdict.is-clean { background: var(--teal-bg); border-color: var(--teal); }
  .verdict-head { display: flex; align-items: baseline; gap: 12px; }
  .verdict-state {
    font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
  }
  .is-leak .verdict-state { color: var(--rust); }
  .is-clean .verdict-state { color: var(--teal); }
  .verdict-cost {
    margin-left: auto; font-family: "Zilla Slab", Georgia, serif; font-weight: 700;
    font-size: 20px; color: var(--rust); font-variant-numeric: tabular-nums;
  }
  .verdict-why { margin: 7px 0 0; font-size: 13px; color: var(--fg); }

  .alts { display: flex; flex-wrap: wrap; gap: 7px; margin: 11px 0 0; }
  .alt {
    display: flex; align-items: baseline; gap: 6px; padding: 5px 9px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 2px;
    font-size: 12.5px;
  }
  .alt-act {
    font-family: "IBM Plex Mono", monospace; text-transform: uppercase;
    font-size: 10.5px; letter-spacing: .08em; color: var(--fg-muted);
  }
  .alt-val { font-variant-numeric: tabular-nums; font-weight: 600; }
  .alt.best { border-color: var(--teal); }
  .alt.taken { border-color: var(--fg-muted); }
  .alt.best.taken { border-color: var(--teal); }
  .alt-flag {
    font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase;
    padding: 1px 5px; border-radius: 2px; background: var(--surface-2); color: var(--fg-muted);
  }
  .alt-flag.best-flag { background: var(--teal); color: var(--surface); }

  .verdict-facts {
    display: flex; flex-wrap: wrap; gap: 6px 20px; margin: 11px 0 0;
    padding-top: 10px; border-top: 1px solid var(--line);
  }
  .verdict-facts div { display: flex; gap: 6px; align-items: baseline; }
  .verdict-facts dt {
    font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-faint);
  }
  .verdict-facts dd {
    margin: 0; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
  }

  .hand-foot {
    padding: 9px 18px; border-top: 1px solid var(--line); background: var(--surface-2);
    font-size: 11.5px; color: var(--fg-faint);
  }
  .empty { color: var(--fg-faint); font-style: italic; }

  .colophon {
    margin-top: 56px; padding-top: 22px; border-top: 2px solid var(--fg);
    font-size: 12.5px; color: var(--fg-muted);
  }
  .colophon h3 {
    font-family: "Zilla Slab", Georgia, serif; font-size: 15px; margin: 0 0 10px; color: var(--fg);
  }
  .colophon ul { margin: 0; padding-left: 18px; }
  .colophon li { margin-bottom: 6px; }
  .colophon code {
    font-family: "IBM Plex Mono", monospace; font-size: 11.5px;
    background: var(--surface-2); padding: 1px 5px; border-radius: 2px;
  }

  @media (max-width: 620px) {
    .act { padding-left: 14px; padding-right: 14px; }
    .act .who { min-width: 0; flex-basis: 100%; }
    .hand-cost { margin-left: 0; text-align: left; }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">Session review · cards-known arm</p>
    <h1>Where the Money Went</h1>
    <p class="standfirst">Every decision you made, priced against the most profitable
      response available to the pool — with the hand it happened in, in order, around it.</p>
  </header>

  <div class="headline-figures">
    <div class="fig money"><span class="v">${bb(totalLeft)}<span class="unit">bb</span></span><span class="k">left on the table, all sessions</span></div>
    <div class="fig"><span class="v">${totalPriced}<span class="of">/${totalDecisions}</span></span><span class="k">decisions priced</span></div>
    <div class="fig"><span class="v">${totalHands}</span><span class="k">hands played</span></div>
    <div class="fig"><span class="v">${reviews.length}</span><span class="k">sessions</span></div>
  </div>

  ${ts ? `<div class="transfer">
    <span class="transfer-label">${esc(ts.label)}</span>
    <p><strong>These numbers are measured on a different population than the one you played against.</strong>
       ${esc(ts.warn || '')}</p>
    <p class="pop">${esc(ts.population)}</p>
  </div>` : ''}

  ${reviews.map(sessionBlock).join('')}

  <div class="colophon">
    <h3>What this is, and what it is not</h3>
    <ul>
      <li><strong>The yardstick is Pool Best Response</strong> — the most profitable response to
        the field's <em>measured</em> behaviour, not a solver. It is a ceiling, never advice:
        played as a strategy it is maximally exploitable by construction.</li>
      <li><strong>Folds are priced.</strong> Your own hole cards are on every decision including
        the ones you folded, with no showdown conditioning — which is the arm the corpus
        structurally cannot produce.</li>
      <li><strong>Session totals sum decisions that could not all have happened.</strong> Where
        you checked and then faced a bet, both are priced, but the second exists only because of
        the first. Per-decision figures are sound; the totals are not yet, and are marked
        <code>WS-619</code>.</li>
      <li><strong>Big-pot verdicts lean toward "you should have been more aggressive."</strong>
        The villain model is not yet conditioned on the line, which overstates fold equity on
        later streets — <code>WS-620</code>.</li>
      <li><strong>Preflop is unpriced</strong> — over half your decisions — <code>WS-621</code>.</li>
      <li>The lower pier post, an equilibrium comparison, is <strong>unavailable and not
        faked</strong>. The location reported here is one-sided and says so.</li>
    </ul>
  </div>
</div>`;
};

const main = () => {
  const args = parseArgs(process.argv);
  const store = typeof args.store === 'string' ? args.store : DEFAULT_STORE;
  const out = typeof args.out === 'string' ? args.out : 'out/session-review-artifact.html';
  const reviews = loadReviews(store);
  if (!reviews.length) {
    console.error(`No review.json found under ${store}. Run reviewSession.mjs first.`);
    process.exit(2);
  }
  const html = buildReviewArtifact(reviews);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, 'utf8');
  const priced = reviews.filter((r) => r.money && !r.money.refused).length;
  console.log(`${reviews.length} session(s), ${priced} with a priced money column → ${out}`);
};

if (process.argv[1] && process.argv[1].endsWith('buildReviewArtifact.mjs')) main();
