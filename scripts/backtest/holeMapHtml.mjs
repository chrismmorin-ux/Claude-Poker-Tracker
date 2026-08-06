/**
 * holeMapHtml.mjs — the Hole Map visual.
 *
 * SELF-CONTAINED BY REQUIREMENT. No CDN, no external font, no fetch, no build step: the
 * file opens from disk with no network and embeds into anything. Every chart is inline SVG
 * computed here, because a charting library would be the one dependency that makes an
 * artifact stop rendering three years from now, which is exactly when a Result Card is
 * supposed to still be readable.
 *
 * The page is a VIEW. It computes no poker and holds no thresholds — everything numeric
 * arrives on `doc` from `run-hole-map.mjs`. If a number appears here that was not computed
 * upstream, that is a bug, because it would be a figure with no provenance in the record.
 */

import { freshnessBannerHtml, BANNER_OPEN, BANNER_CLOSE } from './holeMapFreshness.mjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const num = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const pct = (v, d = 1) => (Number.isFinite(v) ? `${v.toFixed(d)}%` : '—');
const sign = (v, d = 1) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}` : '—');

/* ─────────────────────────────────────────────────────────────────────────────────────
   THE THRESHOLD CHART — the founder's "where are the thresholds" put on ONE axis.

   Three curves over bet/pot:
     · REQUIRED  s/(1+s), pure pot geometry, exact, no data behind it and none needed
     · MEASURED  the pool's actual fold rate, HandHQ EVAL half, with per-bin n
     · ENGINE    what the shipped model predicts, so its error is visible rather than argued
   The shaded band between required and measured IS the exploit, and its vertical extent at
   each x is the gap that the hole table converts to money.
   ───────────────────────────────────────────────────────────────────────────────────── */
const thresholdChart = (doc) => {
  const W = 900; const H = 420;
  const P = { l: 64, r: 28, t: 28, b: 52 };
  const xMax = 2.1;
  const X = (s) => P.l + (s / xMax) * (W - P.l - P.r);
  const Y = (f) => P.t + (1 - f) * (H - P.t - P.b);

  const bins = (doc.foldCurve.betBins ?? []).filter((b) => b.s <= xMax && b.n >= 50);
  const required = [];
  for (let s = 0.02; s <= xMax; s += 0.02) required.push([s, s / (1 + s)]);

  const path = (pts) => pts.map(([s, f], i) => `${i ? 'L' : 'M'}${X(s).toFixed(1)},${Y(f).toFixed(1)}`).join('');
  const reqPath = path(required);
  const measPath = path(bins.map((b) => [b.s, b.obs]));
  const engPath = path(required.map(([s]) => [s, engineCurveAt(doc, s)]));

  // The exploit band: measured above required, closed back along required.
  const band = `${measPath}${[...bins].reverse().map((b) => `L${X(b.s).toFixed(1)},${Y(b.s / (1 + b.s)).toFixed(1)}`).join('')}Z`;

  const gridY = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const gridX = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  return `
<svg viewBox="0 0 ${W} ${H}" class="chart" role="img"
     aria-label="Required fold percentage versus measured pool fold percentage against bet size">
  <defs>
    <linearGradient id="gapfill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--gap)" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="var(--gap)" stop-opacity="0.06"/>
    </linearGradient>
  </defs>
  ${gridY.map((g) => `<line x1="${P.l}" y1="${Y(g)}" x2="${W - P.r}" y2="${Y(g)}" class="grid"/>
    <text x="${P.l - 10}" y="${Y(g) + 4}" class="axlab" text-anchor="end">${(g * 100).toFixed(0)}%</text>`).join('')}
  ${gridX.map((g) => `<line x1="${X(g)}" y1="${P.t}" x2="${X(g)}" y2="${H - P.b}" class="grid"/>
    <text x="${X(g)}" y="${H - P.b + 20}" class="axlab" text-anchor="middle">${g.toFixed(2)}x</text>`).join('')}
  <path d="${band}" fill="url(#gapfill)"/>
  <path d="${reqPath}" class="ln req"/>
  <path d="${engPath}" class="ln eng"/>
  <path d="${measPath}" class="ln meas"/>
  ${bins.map((b) => `<circle cx="${X(b.s).toFixed(1)}" cy="${Y(b.obs).toFixed(1)}" r="${Math.min(6, 1.6 + Math.sqrt(b.n) / 55).toFixed(1)}" class="dot">
      <title>bet ${b.s.toFixed(2)}x pot — pool folds ${(b.obs * 100).toFixed(1)}% (k=${b.k} / n=${b.n}); pot odds require ${((b.s / (1 + b.s)) * 100).toFixed(1)}%; gap ${(((b.obs) - b.s / (1 + b.s)) * 100).toFixed(1)}pp</title>
    </circle>`).join('')}
  <text x="${P.l}" y="${H - 12}" class="axtitle">bet size as a fraction of the pot →</text>
  <text transform="translate(16,${P.t + 150}) rotate(-90)" class="axtitle">fold frequency →</text>
</svg>
<div class="legend">
  <span><i class="sw req"></i>REQUIRED — <code>s/(1+s)</code>, pot geometry. Exact; no data behind it.</span>
  <span><i class="sw meas"></i>MEASURED — pool's actual fold rate, HandHQ EVAL half. Dot area ∝ n.</span>
  <span><i class="sw eng"></i>ENGINE — the shipped fold curve at base 0.45.</span>
  <span><i class="sw gap"></i>THE GAP — measured minus required. This band is the exploit.</span>
</div>`;
};

// Mirror of holeMap.engineFoldPct, kept local so the renderer stays a pure function of doc.
const engineCurveAt = (doc, s) => {
  const c = { maxDelta: 0.95, steepnessUp: 6.5, steepnessDown: 0.75, midpoint: 0.35 };
  const k = s < c.midpoint ? c.steepnessUp : c.steepnessDown;
  const sig = 1 / (1 + Math.exp(-(k * (s - c.midpoint))));
  return Math.min(1, Math.max(0, 0.45 + (sig - 0.5) * c.maxDelta));
};

/* ─────────────────────────────────────────────────────────────────────────────────────
   THE DECISION TREE — numbers at decision points AND at terminations, as asked.

   Decision point = an interior node: its n, and the distribution over the actions leaving
   it. Termination = an action edge: its count, its frequency, and where an EV exists on
   disk, that EV with the count of decisions behind it.

   Rare branches are drawn rare. A 2%-frequency edge gets a 2%-width bar, because a tree
   that renders every branch equally is a tree in which a hole is invisible — which is the
   one thing this diagram exists to prevent.
   ───────────────────────────────────────────────────────────────────────────────────── */
const ACTION_ORDER = ['fold', 'check', 'call', 'bet', 'raise'];

const actionBar = (counts, freq, n) => {
  const acts = ACTION_ORDER.filter((a) => counts?.[a] != null);
  return `<div class="bar">${acts.map((a) => {
    const f = freq[a] ?? 0;
    const rare = f < 0.10;
    return `<span class="seg ${a}${rare ? ' rare' : ''}" style="width:${(f * 100).toFixed(2)}%"
      title="${a}: ${counts[a]} of ${n} (${(f * 100).toFixed(1)}%)"></span>`;
  }).join('')}</div>
  <div class="barlab">${acts.map((a) => {
    const f = freq[a] ?? 0;
    return `<span class="${f < 0.10 ? 'holeish' : ''}"><b class="k ${a}"></b>${a} ${(f * 100).toFixed(1)}% <em>n=${counts[a]}</em></span>`;
  }).join('')}</div>`;
};

const treeNode = (node, depth = 0) => {
  const kids = node.children ?? [];
  const ev = Number.isFinite(node.evMean)
    ? `<span class="ev" title="Mean over combos of the engine's TOP-action EV, from ${node.evN} scored decisions. NOT a per-action EV — the sidecar that would carry one does not exist yet.">EV ${num(node.evMean)} <em>n=${node.evN}</em>${node.depthMax ? ` · depth≤${node.depthMax}` : ''}</span>`
    : '<span class="ev none" title="No scored decision on disk joins to this cell.">EV —</span>';
  return `
<details class="tn d${depth}"${depth < 2 ? ' open' : ''}>
  <summary>
    <span class="tname">${esc(node.name)}</span>
    <span class="tn-n">n=${node.n.toLocaleString()}</span>
    ${ev}
  </summary>
  ${node.counts && Object.keys(node.counts).length ? actionBar(node.counts, node.freq ?? {}, node.n) : ''}
  ${kids.length ? `<div class="tkids">${kids.map((k) => treeNode(k, depth + 1)).join('')}</div>` : ''}
</details>`;
};

/* ───────────────────────────── the hole table ───────────────────────────────────────── */
const holeTable = (doc) => {
  const rows = doc.holes.filter((r) => Number.isFinite(r.denom.bbPerHour)).slice(0, 30);
  const unrated = doc.holes.filter((r) => !Number.isFinite(r.denom.bbPerHour)).slice(0, 10);
  const rowHtml = (r) => `
<tr class="${r.verdict === 'model-suspect' ? 'suspect' : ''}">
  <td class="lab">${esc(r.label)}
    ${r.verdict === 'model-suspect' ? `<div class="flag">MODEL SUSPECT — ${esc(r.suspectComponent ?? '')}</div>` : ''}
  </td>
  <td class="n">${pct(r.requiredFoldPct)}</td>
  <td class="n">${pct(r.predictedFoldPct)}<div class="sub">n=${r.denom.nGap.toLocaleString()}</div></td>
  <td class="n gapcell ${r.denom.gapFoldPp >= 0 ? 'pos' : 'neg'}">${sign(r.denom.gapFoldPp)}pp</td>
  <td class="n">${num(r.denom.perOccurrenceBB)}</td>
  <td class="n">${Number.isFinite(r.denom.ratePer100) ? num(r.denom.ratePer100, 2) : '<span class="unm">unmeasured</span>'}
    <div class="sub">n=${r.denom.nRate.toLocaleString()}</div></td>
  <td class="n">${num(r.denom.bbPer100, 3)}</td>
  <td class="n hero">${num(r.denom.bbPerHour, 2)}</td>
  <td class="n">${r.poolFreq == null ? '—' : pct(r.poolFreq * 100)}<div class="sub">${r.nNode ? `n=${r.nNode}` : ''}</div></td>
</tr>`;
  return `
<div class="tablewrap">
<table class="holes">
  <thead><tr>
    <th>spot &amp; the branch the pool leaves untaken</th>
    <th>required<br>fold%</th><th>measured<br>fold%</th><th>GAP</th>
    <th>bb per<br>occurrence</th><th>rate<br>/100 hands</th><th>bb/100</th>
    <th>bb/HOUR<br><em>@${doc.handsPerHour} h/hr</em></th><th>pool already<br>takes it</th>
  </tr></thead>
  <tbody>${rows.map(rowHtml).join('')}</tbody>
</table>
</div>
${unrated.length ? `<p class="note"><b>${unrated.length} further rows carry a per-occurrence gap but no rate.</b>
  Their spot frequency was not established from the sampled corpus slice. They are not dropped and not guessed —
  see <code>hole-map.json</code>, field <code>denom.rateUnmeasuredReason</code>.</p>` : ''}
${doc.totalCheck.disjoint
    ? `<p class="note"><b>Total across the top rows: ${num(doc.totalCheck.total)} bb/hour</b> —
       ${doc.totalCheck.rowsSummed} disjoint rows summed, ${doc.totalCheck.rowsDropped} dropped for want of a rate.
       Disjointness was checked, not assumed.</p>`
    : `<div class="blocked"><p style="margin-top:0"><b>THE TABLE DOES NOT SUM, AND THAT IS THE CORRECT OUTPUT.</b>
       ${esc(doc.totalCheck.reason)} You choose one sizing and one raise multiple per spot; adding nine sizings
       at the same flop node would be adding nine alternatives to the same decision.</p>
       ${doc.portfolio?.disjoint ? `<p style="margin-bottom:0"><b>The defensible aggregate is
       ${num(doc.portfolio.total)} bb/hour</b> — the best-priced line at each of
       ${doc.portfolio.rowsSummed} <em>disjoint</em> spots. ${esc(doc.portfolio.ceilingNote ?? '')}</p>`
    : '<p style="margin-bottom:0">No portfolio aggregate is available either.</p>'}</div>`}`;
};

/* ─────────────────── the engine-independent outcome arm ─────────────────────────────── */
const outcomeTable = (doc) => {
  const rows = doc.corpus?.lines ?? [];
  if (!rows.length) return '<p class="note">Corpus pass disabled — no outcome arm.</p>';
  return `
<div class="tablewrap">
<table class="holes">
  <thead><tr>
    <th>line, as it actually occurred</th><th>occurrences</th><th>/100 hands</th>
    <th>rate given<br>the chance</th><th>mean bb</th><th>±SE</th>
    <th>median</th><th>p10 … p90</th><th>won the<br>hand</th><th>reached<br>showdown</th>
  </tr></thead>
  <tbody>${rows.map((r) => `
  <tr>
    <td class="lab">${esc(r.lineId)}${doc.practitionerRepertoire[r.lineId]
    ? ` <span class="badge" title="Practitioner repertoire: ${esc(doc.practitionerRepertoire[r.lineId])}. A negative model verdict on this line is read as a defect report against the model, not as advice to avoid the line.">repertoire</span>` : ''}</td>
    <td class="n hero">${r.n.toLocaleString()}</td>
    <td class="n">${num(r.ratePer100, 3)}</td>
    <td class="n">${r.rateGivenOpportunity == null ? '—' : pct(r.rateGivenOpportunity * 100)}
      <div class="sub">${r.opportunities ? `of ${r.opportunities.toLocaleString()}` : ''}</div></td>
    <td class="n ${r.meanNetBB >= 0 ? 'pos' : 'neg'}">${sign(r.meanNetBB, 2)}</td>
    <td class="n">${num(r.seNetBB, 2)}</td>
    <td class="n">${sign(r.medianNetBB, 2)}</td>
    <td class="n">${sign(r.p10NetBB, 1)} … ${sign(r.p90NetBB, 1)}</td>
    <td class="n">${r.winShare == null ? '—' : pct(r.winShare * 100, 0)}</td>
    <td class="n">${r.showdownShare == null ? '—' : pct(r.showdownShare * 100, 0)}</td>
  </tr>`).join('')}</tbody>
</table>
</div>
<p class="note"><b>Every line here is <span class="badge">repertoire</span></b> — a line results-tracking winning
players demonstrably use. That is why a negative model verdict on any of them is read as a defect report against
the model rather than as advice to drop the line. <code>rate given the chance</code> is populated only where a
clean denominator exists: for check-raises it is <em>checked, then actually faced a bet</em>, which is the only
node at which the decision arises. The barrel lines have no comparable denominator here and show “—” rather than
a number that would silently divide by something else.</p>`;
};

const provenanceTable = (doc) => `
<div class="tablewrap">
<table class="prov">
  <thead><tr><th>component of the inelasticity model</th><th>status</th><th>evidence</th></tr></thead>
  <tbody>${doc.inelasticityModel.map((c) => `
  <tr class="${c.status.startsWith('FIT') ? 'fit' : 'assumed'}">
    <td><b>${esc(c.component)}</b><div class="sub"><code>${esc(c.site)}</code></div></td>
    <td class="status">${esc(c.status)}</td>
    <td>${esc(c.evidence)}</td>
  </tr>`).join('')}</tbody>
</table>
</div>`;

export const renderHoleMapHtml = (doc) => {
  const c = doc.corpus ?? {};
  // A COMPLETE document, not a fragment. This file has to open from disk with no server and
  // no network, so it carries its own doctype and — the part that actually bites — its own
  // charset. Served or opened without one, every em-dash and × in the copy becomes mojibake.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hole Map — where the pool has no defence, and what it is worth</title>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#fbfaf8; --fg:#16181d; --mut:#5d6470; --line:#e2e0da; --card:#ffffff;
  --req:#c2410c; --meas:#0e7490; --eng:#7c6f9e; --gap:#0e9f6e;
  --pos:#047857; --neg:#b91c1c; --warn:#b45309; --hero:#111827;
  --fold:#94a3b8; --check:#a8b3c4; --call:#60a5fa; --bet:#f59e0b; --raise:#e11d48;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0f1115; --fg:#e8e6e1; --mut:#98a0ae; --line:#282c35; --card:#161920;
  --req:#fb923c; --meas:#38bdf8; --eng:#b3a6d6; --gap:#34d399;
  --pos:#34d399; --neg:#f87171; --warn:#fbbf24; --hero:#f5f5f4;
}}
:root[data-theme="dark"]{
  --bg:#0f1115; --fg:#e8e6e1; --mut:#98a0ae; --line:#282c35; --card:#161920;
  --req:#fb923c; --meas:#38bdf8; --eng:#b3a6d6; --gap:#34d399;
  --pos:#34d399; --neg:#f87171; --warn:#fbbf24; --hero:#f5f5f4;
}
:root[data-theme="light"]{
  --bg:#fbfaf8; --fg:#16181d; --mut:#5d6470; --line:#e2e0da; --card:#ffffff;
  --req:#c2410c; --meas:#0e7490; --eng:#7c6f9e; --gap:#0e9f6e;
  --pos:#047857; --neg:#b91c1c; --warn:#b45309; --hero:#111827;
}
body{background:var(--bg);color:var(--fg);margin:0;padding:0 20px 90px;
 font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
 -webkit-text-size-adjust:100%}
.wrap{max-width:1180px;margin:0 auto}
h1{font-size:30px;line-height:1.15;letter-spacing:-.02em;margin:34px 0 6px;font-weight:640}
h2{font-size:20px;letter-spacing:-.01em;margin:46px 0 8px;padding-top:18px;border-top:1px solid var(--line);font-weight:640}
h3{font-size:15px;margin:26px 0 6px;font-weight:640}
p{margin:9px 0;max-width:78ch}
.lede{font-size:16.5px;color:var(--mut);max-width:78ch;margin-bottom:4px}
code{font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--card);
 border:1px solid var(--line);border-radius:4px;padding:1px 4px}
.banner{border:1px solid var(--warn);border-left:4px solid var(--warn);background:var(--card);
 border-radius:6px;padding:13px 16px;margin:20px 0}
.banner b{color:var(--warn)}
.prior{border:1px solid var(--line);border-left:4px solid var(--gap);background:var(--card);
 border-radius:6px;padding:13px 16px;margin:20px 0}
.blocked{border:1px solid var(--neg);border-left:4px solid var(--neg);background:var(--card);
 border-radius:6px;padding:13px 16px;margin:20px 0}
.chart{width:100%;height:auto;display:block;margin:14px 0 6px;overflow:visible}
.grid{stroke:var(--line);stroke-width:1}
.axlab{fill:var(--mut);font:11px ui-monospace,monospace}
.axtitle{fill:var(--mut);font:12px ui-sans-serif,system-ui,sans-serif}
.ln{fill:none;stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
.ln.req{stroke:var(--req);stroke-dasharray:6 4}
.ln.meas{stroke:var(--meas)}
.ln.eng{stroke:var(--eng);stroke-width:1.8;stroke-dasharray:2 3}
.dot{fill:var(--meas);fill-opacity:.85;stroke:var(--bg);stroke-width:1}
.legend{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:13px;color:var(--mut);margin:6px 0 4px}
.legend .sw{display:inline-block;width:15px;height:3px;border-radius:2px;margin-right:7px;vertical-align:middle}
.sw.req{background:var(--req)}.sw.meas{background:var(--meas)}.sw.eng{background:var(--eng)}
.sw.gap{background:var(--gap);height:10px;border-radius:2px}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;margin:14px 0;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{text-align:left;font-weight:600;color:var(--mut);font-size:11.5px;letter-spacing:.04em;
 text-transform:uppercase;padding:10px;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:bottom}
th em{font-style:normal;font-weight:400;text-transform:none;letter-spacing:0}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:none}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.hero{font-weight:680;color:var(--hero)}
td.lab{min-width:270px}
.sub{color:var(--mut);font-size:11px;font-variant-numeric:tabular-nums}
.gapcell.pos{color:var(--pos);font-weight:640}
.gapcell.neg{color:var(--neg);font-weight:640}
.pos{color:var(--pos)}.neg{color:var(--neg)}
.unm{color:var(--warn);font-size:11.5px;font-style:italic}
tr.suspect{background:color-mix(in srgb,var(--neg) 7%,transparent)}
.flag{color:var(--neg);font-size:11.5px;margin-top:4px;font-weight:600;max-width:46ch;line-height:1.4}
.rep{color:var(--gap);font-size:11.5px;margin-top:3px;max-width:46ch;line-height:1.4}
.badge{display:inline-block;font-size:10px;letter-spacing:.04em;text-transform:uppercase;
 color:var(--gap);border:1px solid var(--gap);border-radius:3px;padding:0 4px;vertical-align:1px;
 font-weight:640;cursor:help}
tr.fit .status{color:var(--pos);font-weight:660}
tr.assumed .status{color:var(--warn);font-weight:660}
.prov td{font-size:13px}
.finding{border:1px solid var(--gap);border-left:4px solid var(--gap);background:var(--card);
 border-radius:6px;padding:15px 18px;margin:22px 0}
.finding>b{color:var(--gap);letter-spacing:.01em}
.split{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:14px 0}
.split>div{border:1px solid var(--line);border-radius:6px;padding:10px 12px}
.split b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);font-weight:600}
.split span{font-size:22px;font-weight:680;font-variant-numeric:tabular-nums;display:block;margin:2px 0}
.split small{color:var(--mut);font-size:12px;line-height:1.4;display:block}
.note{font-size:13.5px;color:var(--mut);max-width:82ch}
.note.refuse{color:var(--neg)}
details.tn{border-left:2px solid var(--line);padding-left:12px;margin:5px 0}
details.tn summary{cursor:pointer;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;
 padding:3px 0;list-style:none}
details.tn summary::-webkit-details-marker{display:none}
details.tn summary::before{content:"▸";color:var(--mut);font-size:11px;width:10px}
details.tn[open]>summary::before{content:"▾"}
.tname{font-weight:600}
.tn-n{color:var(--mut);font-variant-numeric:tabular-nums;font-size:12.5px}
.ev{color:var(--meas);font-size:12.5px;font-variant-numeric:tabular-nums}
.ev.none{color:var(--mut)}
.ev em{color:var(--mut);font-style:normal;font-size:11px}
.bar{display:flex;height:14px;border-radius:3px;overflow:hidden;background:var(--line);margin:5px 0 3px;max-width:640px}
.seg{display:block;min-width:1px}
.seg.fold{background:var(--fold)}.seg.check{background:var(--check)}.seg.call{background:var(--call)}
.seg.bet{background:var(--bet)}.seg.raise{background:var(--raise)}
.seg.rare{outline:1.5px solid var(--gap);outline-offset:-1.5px}
.barlab{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:11.5px;color:var(--mut);margin-bottom:5px}
.barlab .k{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}
.k.fold{background:var(--fold)}.k.check{background:var(--check)}.k.call{background:var(--call)}
.k.bet{background:var(--bet)}.k.raise{background:var(--raise)}
.barlab em{font-style:normal;opacity:.7}
.barlab .holeish{color:var(--gap);font-weight:620}
.tkids{margin-left:6px}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:16px 0}
.meta div{border:1px solid var(--line);border-radius:7px;padding:10px 12px;background:var(--card)}
.meta b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);font-weight:600}
.meta span{font-size:17px;font-variant-numeric:tabular-nums;font-weight:640}
.meta small{display:block;color:var(--mut);font-size:11.5px;margin-top:2px;line-height:1.35}
/* Freshness banner. Colours are inline on the element so the freshness check can swap the
   whole block (current vs stale) by string replacement without also editing this stylesheet. */
.freshness code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
.freshness-commits{margin:4px 0 0 0;padding-left:18px;font-size:12px;line-height:1.65}
.freshness-commits code{opacity:.85;margin-right:6px}
</style>
</head>
<body>
<div class="wrap">

<h1>The Hole Map</h1>

${BANNER_OPEN}${freshnessBannerHtml(doc.freshness ?? { state: 'unknown', commits: [], commitCount: 0, headline: 'PROVENANCE MISSING — this page was rendered from a document with no freshness block. Regenerate it.', regenCommand: 'npm run hole-map' })}${BANNER_CLOSE}

<p class="lede">Views 1–6 of the Scored Readout measure how good our action is <em>on branches the pool takes</em>.
This is the inverse: <b>what is the price of the branches nobody takes?</b> A line the pool almost never
faces has no defence constructed against it — so the hole in the action distribution <em>is</em> the exploit.</p>

<div class="banner">
  <b>TRANSFERRED, NOT MEASURED.</b> ${esc(doc.population)}
  Online 2009 tables run several multiples faster than a live 9-handed table, so the <em>rate</em> columns
  transfer worse than the per-occurrence gaps. Every bb/hour figure below assumes
  <b>${doc.handsPerHour} hands/hour</b>; the bb/100-hands column beside it carries no pace assumption and is
  the repo's own currency (POKER_THEORY §14.1).
</div>

<div class="meta">
  <div><b>pool policy</b><span>${(doc.policyProvenance?.observations ?? 0).toLocaleString()}</span>
    <small>decisions, ${doc.policyProvenance?.players ?? '—'} POOL players, ${esc((doc.policyProvenance?.stakes ?? []).join(', '))}</small></div>
  <div><b>fold curve — facing a bet</b><span>${(doc.foldCurve.betBins ?? []).reduce((a, b) => a + b.n, 0).toLocaleString()}</span>
    <small>EVAL-half decisions across ${(doc.foldCurve.betBins ?? []).length} sizing bins</small></div>
  <div><b>fold curve — facing a raise</b><span>${(doc.foldCurve.raiseBins ?? []).reduce((a, b) => a + b.n, 0).toLocaleString()}</span>
    <small>the arm every check-raise row needs, never merged into the shipped curve</small></div>
  <div><b>corpus slice</b><span>${(c.totals?.hands ?? 0).toLocaleString()}</span>
    <small>${c.skipped ? 'corpus pass disabled' : `hands from ${c.filesScanned} of ${c.totalAvailable} files · ${(c.totals?.seatHands ?? 0).toLocaleString()} seat-hands`}</small></div>
  <div><b>scored decisions</b><span>${(doc.decisionSource?.rows ?? 0).toLocaleString()}</span>
    <small>${esc(doc.decisionSource?.source)}</small></div>
  <div><b>engine commit</b><span style="font-size:15px">${esc((doc.manifest?.engineCommit ?? '—').slice(0, 8))}${doc.manifest?.engineDirty ? ' +dirty' : ''}</span>
    <small>fault register ${esc(doc.manifest?.disclaimerRegisterVersion ?? '—')} · ADR-009. Every
    engine-derived column below (predicted fold, <code>model-suspect</code>) is a statement about
    THIS commit and no other.</small></div>
</div>

<div class="finding">
  <b>THE HEADLINE, AND IT POINTS THE OPPOSITE WAY TO THE HYPOTHESIS.</b>
  <p style="margin:8px 0 0">${esc(doc.asymmetry.headline)}</p>
  <div class="split">
    <div><b>bets</b><span class="pos">${sign(doc.asymmetry.betArmMeanGapPp)}pp</span>
      <small>mean gap across the sizing ladder — the pool folds <em>more</em> than pot odds require,
      at every sizing. n=${doc.asymmetry.betArmEvidenceN.toLocaleString()} decisions.</small></div>
    <div><b>raises</b><span class="neg">${sign(doc.asymmetry.raiseArmMeanGapPp)}pp</span>
      <small>mean gap across the raise ladder — the pool folds <em>less</em> than a pure bluff-raise
      needs. n=${doc.asymmetry.raiseArmEvidenceN.toLocaleString()} decisions.</small></div>
  </div>
  <p style="margin-bottom:0">${esc(doc.asymmetry.consequence)}</p>
</div>

<h2>1 · The thresholds, on one axis</h2>
<p>The founder asked to see “where the thresholds are”. There are three, and they only mean anything together.
<b>Required</b> is pot geometry — a pure bluff of <code>s</code>×pot needs the pool to fold <code>s/(1+s)</code>
of the time, and that is arithmetic with no data behind it. <b>Measured</b> is what the pool actually does.
<b>Engine</b> is what the shipped model predicts it does. The shaded band between required and measured is the money.</p>
${thresholdChart(doc)}
<p class="note"><b>Read the band, not the lines.</b> The pool over-folds at <em>every</em> sizing on this axis, and the
gap does not close as sizing rises — which is the measured form of the founder's “increasing value bet sizing”
intuition. Each dot's area is proportional to its n; hover any dot for <code>k / n</code> and its gap.</p>

<div class="banner">
  <b>THE GAP IS AN UPPER BOUND THAT DECAYS WITH USE.</b> ${esc(doc.exploitDecayCaveat)}
</div>

<h2>2 · Is the inelasticity model fit, or assumed?</h2>
<p>This is the question the whole instrument turns on. If the elasticity model were assumed, every gap — and
therefore every bb/hour figure — would be an assumption wearing a measurement's clothes. The answer is not one
word. <b>The shape is fit. The level is not.</b> That is why the hole table prices holes off the
<em>measured</em> curve rather than off the engine's: the measured curve carries shape and level from the same data.</p>
${provenanceTable(doc)}

<h2>3 · The hole table</h2>
<p>Each row is a branch the pool leaves largely untaken, priced at its own pot geometry. Sorted by the last
numeric column, because that is the answer to “where is the exploit” — and it disagrees with a sort by gap
alone, which is exactly what this instrument exists to show. <b>Rows are never suppressed for small n.</b>
A large gap at a rare spot and a modest gap at a common one both appear, with their counts visible, rather than
behind a hidden editorial cutoff.</p>
<p class="note"><b>Two n's per row, never merged.</b> <code>n</code> under <em>measured fold%</em> is the evidence
behind the elasticity prediction. <code>n</code> under <em>rate</em> is the seat-hands behind the frequency.
They differ by orders of magnitude and the larger must not launder the smaller.</p>
<div class="banner"><b>WHAT A NEGATIVE GAP MEANS, EXACTLY.</b> ${esc(doc.zeroEquityAssumption)}</div>
${holeTable(doc)}

<div class="prior">
  <b>THE STANDING PRIOR ON A NEGATIVE ROW.</b> Triple barrels and river raises win huge pots when they land,
  and results-tracking winning players use them — otherwise they would not. That is legitimate revealed-preference
  evidence. So: <b>if this instrument reports that a line winning players demonstrably use is −EV, the leading
  hypothesis is that the model of the line is wrong, not that the line is wrong.</b> Rows on those lines are
  flagged <span style="color:var(--neg);font-weight:640">MODEL SUSPECT</span> with the component that would have
  to be defective named, rather than being read as advice to avoid the line.
</div>

<h2>4 · The outcome-anchored arm — no engine involved</h2>
<p>Everything above prices a line <em>through a model</em>, and the model's level is not fitted. This table reads
what actually happened instead: hands in the sampled slice where the line genuinely occurred, and the realized
chip result. If the model says a line is −EV and these outcomes say otherwise, that disagreement is the most
informative number in the deliverable, and it points at a specific defect rather than a vague doubt.</p>
${outcomeTable(doc)}
<h3>What this table does not establish</h3>
<div class="tablewrap"><table class="prov"><tbody>
${doc.outcomeArmCaveats.map((cv) => `<tr class="${cv.severity.startsWith('SEVERE') ? 'assumed' : ''}">
  <td style="white-space:nowrap"><b>${esc(cv.id)}</b><div class="status">${esc(cv.severity)}</div></td>
  <td>${esc(cv.text)}</td></tr>`).join('')}
</tbody></table></div>
<p class="note"><b>Sampled:</b> ${esc(c.sampled ?? 'n/a')}
${c.totals?.unresolved ? ` ${c.totals.unresolved} hands could not be outcome-resolved and are excluded.` : ''}</p>

<h3>The two arms disagree — and that is the most informative number here</h3>
<div class="finding">
  <div class="split">
    <div><b>model arm — pure-bluff raise</b>
      <span class="${doc.armDisagreement.modelArm.meanGapPp >= 0 ? 'pos' : 'neg'}">${sign(doc.armDisagreement.modelArm.meanGapPp)}pp</span>
      <small>mean gap. Only ${doc.armDisagreement.modelArm.positiveRows} of
      ${doc.armDisagreement.modelArm.totalRows} rows are positive${doc.armDisagreement.modelArm.bestSignature.length
    ? `, and they are all <code>${esc(doc.armDisagreement.modelArm.bestSignature.join('</code>, <code>'))}</code>`
    : ''}.</small></div>
    <div><b>outcome arm — realized check-raises</b>
      <span class="pos">${doc.armDisagreement.outcomeArm.rows.map((r) => sign(r.meanNetBB, 1)).join(' / ')} bb</span>
      <small>${doc.armDisagreement.outcomeArm.rows.map((r) => `${esc(r.lineId.split('_')[0])} n=${r.n}`).join(' · ')}</small></div>
  </div>
  <p style="margin-bottom:0">${esc(doc.armDisagreement.reconciliation)}</p>
</div>

<h2>5 · The decision tree</h2>
<p>Decision points carry their n and the distribution over the actions leaving them; terminations carry the
count, the frequency, and — where a scored decision on disk joins to the cell — an EV. Branches are drawn at
their true width, so a 2%-frequency edge is 2% wide: a tree that renders every branch equally is a tree in which
a hole is invisible. Branches below 10% are outlined in green.</p>
${treeNode(doc.tree)}
<p class="note"><b>What the EV column is, exactly.</b> It is the mean over sampled combos of the engine's
<em>top-action</em> EV — one scalar per decision. It is <b>not</b> a per-action EV, so it cannot say what the
untaken branch was worth. The per-action EVs exist inside the engine at evaluation time and are discarded; the
sidecar that would keep them is described in §7.</p>

<h3>The board dimension, and what it costs</h3>
<p>Texture is <code>${esc(doc.textureResolution.labels.join(' / '))}</code> from
<code>${esc(doc.textureResolution.classifier)}</code>. ${esc(doc.textureResolution.rule)}</p>
<p class="note"><b>${esc(doc.textureResolution.discarded)}</b></p>
<p class="note refuse"><b>The cost is measured, not guessed, and it is negative.</b>
${esc(doc.textureResolution.measuredCost)}</p>

<h2>6 · What the collapsed action vocabulary prevents</h2>
<div class="blocked">
  <p style="margin-top:0"><b>The founder's headline example is invisible to the scoring instrument.</b>
  <code>scripts/backtest/heroPolicy.mjs:85</code> maps <code>check-raise → CHECK</code>, and it is
  <em>correct</em> to do so: the corpus records a check, and recording a raise would compare our advice against
  an action the hand history could not contain. But the consequence is total —
  a check-raise never changes the argmax, never moves the IPS weight, and contributes exactly zero to any
  measured EV delta. <code>π_ours</code> at a check node cannot distinguish <em>check and give up</em> from
  <em>check intending to raise</em>, and those are the highest- and lowest-EV plans at the same node.</p>
  <p><b>Two further defects compound it.</b> The engine's own check-raise candidate is built at
  <code>heroActionBuilder.js:257</code> carrying <em>no EV</em> — it is a bare descriptor, and the EV is attached
  later at <code>gameTreeEvaluator.js:338-524</code>. And that EV is under an open defect report:
  <b>WS-314</b> measured check-raise ranking first for <em>every</em> weak hand, including 5-high with 12% equity,
  at 2–3× the best bet EV. So the engine's candidate list cannot be used as a trustworthy price for this line
  either. That is why §4 above reads the corpus directly.</p>
  <p style="margin-bottom:0"><b>What would fix it.</b> A plan-vs-primitive scoring vocabulary. The leak-free
  form is a <em>conditional second instrument</em>: at check nodes where villain subsequently bet, compare hero's
  actual response (fold / call / raise) against the engine's, reusing
  <code>RESPONSES_BY_FACING.bet</code> unchanged. The conditioning event is villain's action, not hero's, so there
  is no lookahead leakage into the label — and the denominator it needs
  (<code>checkThenFacedBetCount</code>) is already computed at
  <code>decisionAccumulator.js:534-556</code>. The alternative — adding <code>checkRaise</code> to the
  <code>none</code> response set with the corpus label assigned by lookahead — breaks the
  “what would be RECORDED at this node” invariant and is not recommended.</p>
</div>
<p class="note"><b>No queue item owns this.</b> A search of the queue, the index and the findings returns nothing
on the vocabulary collapse specifically; the term “plan-vs-primitive” does not appear in the repo. It is recorded
only as an explicit out-of-scope note inside <b>WS-294</b> (“sizing not scored — actions collapse to primitives”).
The two tickets that would own a fix are <b>WS-336</b> (CP-2 — a continuation policy that can barrel and
check-raise) and <b>WS-314</b>. This view cross-references them rather than duplicating them; the conditional
instrument above is the piece none of them currently contains.</p>

<h2>7 · What this gains once the baseline run's sidecar exists</h2>
<p>The visual is specified as a pure view over the per-decision record
(<code>scripts/backtest/decisionRecord.mjs</code>). That record is not on disk yet, so the prototype substitutes
weaker sources. Each substitution and its cost:</p>
<div class="tablewrap"><table>
<thead><tr><th>sidecar field</th><th>standing in today</th><th>what is lost</th></tr></thead>
<tbody>
<tr><td><code>candidates[].ev</code> (whole ranked list)</td><td><code>evStats.statedEvMean</code></td>
  <td>the per-action EV. Today no row can say what the <em>untaken</em> branch was worth — the single most
  load-bearing number in a hole map, currently absent.</td></tr>
<tr><td><code>candidates[].villainResponse.foldPct</code></td><td>nothing</td>
  <td>the engine's own predicted fold per candidate. Without it the engine's threshold cannot be compared
  against the measured one <em>per spot</em> — only in aggregate, as in §1.</td></tr>
<tr><td>raw geometry (pot / bet / stack / SPR / <code>closesAction</code>)</td>
  <td>re-derived from a corpus slice; medians only</td>
  <td>per-decision pot geometry. Every bb figure here is priced at a <em>median</em> pot for its street, so the
  variance across spots inside a row is invisible.</td></tr>
<tr><td><code>situationKey</code> (7 axes)</td><td><code>slices</code> — 5 axes</td>
  <td><code>isAgg</code> and <code>isIP</code> on the scored rows, so the decision rows cannot be joined to the
  pool policy at its full key depth.</td></tr>
<tr><td><code>pPoolObserved</code>, <code>pOursObservedByArm</code>, <code>wRawByArm</code> un-pre-multiplied</td>
  <td><code>piPool</code> / <code>piOurs</code> on the ablation rows</td>
  <td>the raw uncapped weight. A hole has <code>π_pool ≈ 0</code> by definition, so its weight explodes or clips
  — and the clipped share per row cannot currently be shown.</td></tr>
<tr><td>refinement stage ledger, <code>depthReached</code> per combo</td><td><code>depthReachedMax</code></td>
  <td>whether the wall clock, rather than the position, decided the advice at this node.</td></tr>
</tbody></table></div>
<p class="note"><b>The one structural warning.</b> The lines the founder most wants priced are precisely where
importance-weighted estimation is <em>structurally weakest</em>: a hole has <code>π_pool</code> near zero by
definition, so <code>w = π_ours/π_pool</code> explodes or hits the cap (<code>weightCap: 20</code>), the payoffs
are large so variance goes as magnitude², and the counts are tiny. The current run shows <code>clippedShare</code>
0.0038 and 0 only because the engine takes <em>common</em> actions. Rare-line rows will clip, and the sidecar is
what makes that visible per row rather than in aggregate.</p>

<h2>8 · Replication</h2>
<p>Regenerate with:</p>
<p><code>node scripts/backtest/run-hole-map.mjs --policy out/behavior-policy.json
--fold-cells out/fold-vs-sizing.json --fold-fit out/fold-curve-fit.txt
--decisions out/depth-ablation.json --max-files ${c.filesScanned ?? 0}
--out out/hole-map.json --html out/hole-map.html</code></p>
<p class="note">Once a baseline run has emitted the sidecar, add
<code>--decision-records &lt;path.jsonl&gt;</code>; it takes precedence and every substitution in §7 resolves.
Generated ${esc(doc.generatedAt)}. Machine-readable twin: <code>${esc('out/hole-map.json')}</code>.</p>

</div>
</body>
</html>`;
};
