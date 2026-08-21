/**
 * renderSessionReview.mjs — the review as something a human reads, not a JSON blob.
 *
 * `review.json` is the RECORD. This is a VIEW of it, and the distinction is load-bearing here:
 * repo doctrine is that a published page is never the record, so this file must be derivable
 * from the JSON and must add no fact the JSON does not already carry.
 *
 * WHAT IT LEADS WITH, AND WHY THAT ORDER.
 *
 * The founder is not reading this for a dashboard. He is reading it to know what to do
 * differently next time he sits down. So the page opens with what the session actually was,
 * then what is KNOWN, then — prominently, not in a footnote — what is REFUSED and what would
 * resolve each refusal. A review whose holes are hidden is worse than no review, because the
 * holes are the work queue.
 *
 * Self-contained by construction: no external CSS, no fonts, no scripts. It has to open from a
 * file:// path, from the sink's loopback endpoint, and from a published artifact, all identically.
 */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const pct = (x) => `${(Number(x) * 100).toFixed(1)}%`;

const REFUSAL_BLURB = {
  'unexamined:insufficient-n': 'Not enough hands in this spot yet.',
  'unexamined:no-field-policy': 'No measured model of this table’s players yet.',
  'unexamined:hero-not-seated': 'You were not seated.',
  'unexamined:hole-cards-not-captured': 'Your cards were not captured.',
};

const card = (title, body, tone = '') => `
  <section class="card ${tone}">
    <h2>${esc(title)}</h2>
    ${body}
  </section>`;

const refusalBlock = (r) => `
  <div class="refusal">
    <div class="refusal-head">${esc(REFUSAL_BLURB[r.reason] || 'Not answered.')}</div>
    <div class="refusal-detail">${esc(r.detail)}</div>
    ${r.resolvedBy ? `<div class="refusal-fix"><span>What would answer it</span> ${esc(r.resolvedBy)}</div>` : ''}
    <code>${esc(r.reason)}</code>
  </div>`;

export const renderSessionReview = (review) => {
  const s = review.session;
  const h = review.hero;
  const subjects = review.opponents?.subjects ?? [];
  const carded = subjects.filter((x) => x.card);
  const thin = subjects.filter((x) => !x.card);

  const heroBlock = h.conductCard
    ? `<p class="lead">Your play this session is on the record as
         <code>${esc(h.conductCard.cardId)}</code>.</p>
       <dl class="facts">
         <dt>Hands you played</dt><dd>${h.handsSeated}</dd>
         <dt>Hands you watched</dt><dd>${h.handsObserved}</dd>
         <dt>Decisions recorded</dt><dd>${h.decisions}</dd>
         <dt>Your cards known</dt><dd class="${h.cardsKnownFraction > 0.99 ? 'good' : 'warn'}">${pct(h.cardsKnownFraction)}</dd>
       </dl>`
    : refusalBlock(h.conductCardRefusal);

  const cardsKnownNote = h.cardsKnownFraction > 0.99 ? `
    <div class="callout">
      <strong>Every decision here includes the cards you actually held — folds included.</strong>
      That is something the 2009 hand corpus cannot give: it hides hole cards, so measurements
      taken on it have to average over hands you <em>might</em> have had, and the only
      cards-known slice it offers is showdowns, which by definition contains no folds at all.
      This session does not have that problem.
    </div>` : '';

  const opponentRows = subjects.map((o) => `
    <tr>
      <td><code>${esc(o.subjectId)}</code></td>
      <td>${o.handsObserved}</td>
      <td>${o.decisions}</td>
      <td>${o.card ? `<span class="good">${esc(o.card.cardId)}</span>` : `<span class="muted">${esc(REFUSAL_BLURB[o.refusal?.reason] || 'not enough yet')}</span>`}</td>
    </tr>`).join('');

  const spotsBlock = review.spots?.refused
    ? refusalBlock(review.spots)
    : (review.spots?.spots?.length
      ? `<ul class="spots">${review.spots.spots.map((sp) => `<li><strong>${esc(sp.label ?? sp.id)}</strong> <span class="muted">${esc(sp.situationKey ?? '')}</span></li>`).join('')}</ul>
         <p class="fineprint">${esc(review.spots.interpretation)}</p>`
      : `<p class="muted">Nothing crossed the sample-size floor this session — ${review.spots?.totalActions ?? 0} actions across ${review.spots?.ruleCount ?? 0} rules.</p>
         <p class="fineprint">${esc(review.spots?.interpretation ?? '')}</p>`);

  const notable = (review.notable?.hands ?? []).slice(0, 10).map((n) => `
    <tr><td><code>${esc(n.handId)}</code></td><td>${n.decisions}</td><td>${(n.investedBB ?? 0).toFixed(1)}</td><td>${(n.potPeakBB ?? 0).toFixed(1)}</td><td>${esc((n.streets || []).join(', '))}</td></tr>`).join('');

  return `<title>Session review — ${esc(s.id ?? 'unknown')}</title>
<style>
  :root {
    --bg: #ffffff; --fg: #16181d; --muted: #5b6270; --line: #e3e6eb;
    --card: #f7f8fa; --good: #1a7f4b; --warn: #9a5b00; --accent: #24405f;
    --refuse-bg: #fdf7ee; --refuse-line: #e6c68a;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #14161a; --fg: #e8eaee; --muted: #99a1b0; --line: #2a2f38;
      --card: #1b1e24; --good: #5fd39b; --warn: #e0aa5a; --accent: #9dc0e8;
      --refuse-bg: #241f16; --refuse-line: #6b552c;
    }
  }
  :root[data-theme="dark"] {
    --bg: #14161a; --fg: #e8eaee; --muted: #99a1b0; --line: #2a2f38;
    --card: #1b1e24; --good: #5fd39b; --warn: #e0aa5a; --accent: #9dc0e8;
    --refuse-bg: #241f16; --refuse-line: #6b552c;
  }
  body {
    background: var(--bg); color: var(--fg); margin: 0 auto; max-width: 52rem;
    padding: 2rem 1.25rem 5rem;
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; letter-spacing: -.01em; }
  h2 { font-size: 1.05rem; margin: 0 0 .75rem; letter-spacing: .01em; }
  .sub { color: var(--muted); margin: 0 0 2rem; font-size: .95rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 1.1rem 1.25rem; margin: 0 0 1rem; }
  .lead { margin: 0 0 .75rem; }
  code { font: 13px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; color: var(--accent); word-break: break-all; }
  dl.facts { display: grid; grid-template-columns: auto 1fr; gap: .3rem 1rem; margin: 0; }
  dl.facts dt { color: var(--muted); }
  dl.facts dd { margin: 0; font-variant-numeric: tabular-nums; }
  .good { color: var(--good); } .warn { color: var(--warn); } .muted { color: var(--muted); }
  .callout { border-left: 3px solid var(--good); padding: .6rem 0 .6rem .9rem; margin: 1rem 0 0; font-size: .95rem; }
  .refusal { background: var(--refuse-bg); border: 1px solid var(--refuse-line); border-radius: 8px; padding: .85rem 1rem; }
  .refusal-head { font-weight: 600; margin-bottom: .35rem; }
  .refusal-detail { font-size: .93rem; margin-bottom: .5rem; }
  .refusal-fix { font-size: .93rem; margin-bottom: .5rem; }
  .refusal-fix span { color: var(--muted); display: block; font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; }
  .tablewrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .92rem; }
  th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
  td { font-variant-numeric: tabular-nums; }
  ul.spots { margin: 0; padding-left: 1.1rem; }
  .fineprint { color: var(--muted); font-size: .85rem; margin: .75rem 0 0; }
  footer { color: var(--muted); font-size: .8rem; margin-top: 2.5rem; border-top: 1px solid var(--line); padding-top: 1rem; }
</style>

<h1>Session review</h1>
<p class="sub">
  ${esc(s.id ?? 'unknown session')}
  ${s.startedAt ? ` &middot; started ${esc(s.startedAt)}` : ''}
  &middot; ${review.intake.handsRead} hands captured
</p>

${card('Your play', heroBlock + cardsKnownNote)}

${card('What this session cost or made you',
    review.money.refused ? refusalBlock(review.money) : '<p>Priced.</p>', 'money')}

${card(`The players you sat with (${carded.length} with enough hands, ${thin.length} too thin)`,
    `<div class="tablewrap"><table>
       <thead><tr><th>Seat</th><th>Hands</th><th>Decisions</th><th>Record</th></tr></thead>
       <tbody>${opponentRows}</tbody>
     </table></div>
     <p class="fineprint">${esc(review.opponents?.caveat ?? '')}</p>`)}

${card('Spots worth a closer look', spotsBlock)}

${notable ? card('Hands where you had the most at stake',
    `<div class="tablewrap"><table>
       <thead><tr><th>Hand</th><th>Your decisions</th><th>You put in (bb)</th><th>Biggest pot (bb)</th><th>Streets</th></tr></thead>
       <tbody>${notable}</tbody>
     </table></div>
     <p class="fineprint">${esc(review.notable?.selectionBias ?? '')}</p>`) : ''}

${card('What was checked before any of the above was reported',
    `<div class="tablewrap"><table>
       <thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
       <tbody>${review.gates.map((g) => `<tr><td>${esc(g.name)}</td><td class="${g.ok ? 'good' : 'warn'}">${g.ok ? 'pass' : 'FAIL'}</td><td><code>${esc(g.detail)}</code></td></tr>`).join('')}</tbody>
     </table></div>`)}

<footer>
  <p>${esc(review.population)}</p>
  <p>This page is a view. The record is <code>review.json</code> beside it, and the hands behind
     it are sealed under <code>${esc(review.session.handsHash ?? 'no hash')}</code>.</p>
  <p>Generated ${esc(review.stampedAt)} &middot; <code>${esc(review.contentHash)}</code></p>
</footer>`;
};
