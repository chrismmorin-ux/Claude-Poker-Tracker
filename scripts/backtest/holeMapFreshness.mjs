/**
 * holeMapFreshness.mjs — is the Hole Map on disk still describing the engine at HEAD?
 *
 * THE PROBLEM THIS EXISTS FOR. The Hole Map (SCORED-READOUT-SPEC.md §9bis) is a readout over
 * a corpus, a measured fold curve and the shipped engine's own predicted fold rate. The moment
 * a fold-curve change, a narrower change or a game-tree change lands, the `engineFoldPct`
 * column — and every `model-suspect` verdict derived from it — is describing a DIFFERENT
 * ENGINE than the one in the tree. A rendered copy does not announce that. It looks exactly as
 * authoritative the day after the change as the day before, which is the mechanism ADR-009 and
 * the fault register exist to prevent: a wrong number that never has to meet a right one.
 *
 * THE SIGNAL. Not "how old is the file" — age in days is not the quantity that matters. The
 * quantity is **how many commits touching the engine have landed since the artifact was
 * generated**. A six-week-old Hole Map with zero engine commits behind it is current. A
 * six-hour-old one with a fold-curve commit behind it is stale.
 *
 * WHY THE PATHS BELOW AND NOT ALL OF `src/`. `WATCHED_PATHS` is the set whose contents can
 * change a number in the artifact. `exploitEngine/` supplies `engineFoldPct` via the shipped
 * fold curve and the narrower; `rangeEngine/` supplies the population priors the policy is
 * shrunk toward; the generator and its own logic modules obviously change their own output.
 * A commit to a React view cannot move a cell in this table, and counting it would make the
 * staleness signal fire so often that it would be ignored — the exact failure recorded in
 * `.claude/hooks/readiness-gate.cjs` ("a banner shown every session is a banner nobody reads
 * by week three"). The list is deliberately narrow so that when it fires, it means something.
 *
 * PURE / IMPURE SPLIT, AND WHY IT MATTERS BEYOND TESTABILITY. Everything in this module is a
 * pure function over data. The two questions that need git live in `holeMapGit.mjs` and are
 * passed IN. That keeps the verdict testable without a fixture repo — and, load-bearing for the
 * in-app study surface that is still behind Design Gate 2, it keeps this module importable from
 * a browser bundle. A view that cannot import `classifyFreshness` will re-implement the banner,
 * and a re-implemented banner drifts from the CLI's — the same defect class as transcribing a
 * number into JSX instead of projecting it from the artifact.
 */

/**
 * The paths whose history makes this artifact stale. See the docblock — narrowness is the
 * point, and widening this list without a reason that names a NUMBER in the artifact is a
 * regression, not an improvement.
 */
export const WATCHED_PATHS = Object.freeze([
  'src/utils/exploitEngine',
  'src/utils/rangeEngine',
  'scripts/backtest/holeMap.mjs',
  'scripts/backtest/holeMapLines.mjs',
  'scripts/backtest/run-hole-map.mjs',
]);

/** The one command that regenerates everything. Stamped INTO the artifact so it travels with it. */
export const REGEN_COMMAND = 'npm run hole-map';

export const FRESHNESS_STATE = Object.freeze({
  CURRENT: 'current',
  STALE: 'stale',
  DIRTY_SOURCE: 'dirty-source',
  UNKNOWN: 'unknown',
});

/**
 * Parse `git log --format=%H%x1f%s` output into commit records.
 *
 * Pure, and here rather than in `holeMapGit.mjs`, so the parse can be tested without spawning
 * a process — including the cases a real `git log` will not produce on demand (a subject
 * containing the separator, a truncated line, trailing blanks).
 *
 * @returns {{sha: string, subject: string}[]}
 */
export const parseCommitLines = (stdout) => String(stdout ?? '')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((line) => {
    const sep = line.indexOf('\x1f');
    // A subject may itself contain the separator; only the FIRST one delimits the sha.
    if (sep === -1) return { sha: line, subject: '' };
    return { sha: line.slice(0, sep), subject: line.slice(sep + 1) };
  });

/**
 * The verdict, as a pure function over the artifact's manifest and the git answer.
 *
 * `dirty-source` outranks `stale`. An artifact generated with uncommitted engine changes
 * cannot name the code that produced it at all — the commit it stamped is not what ran — so
 * counting commits since that commit would be answering a more precise question than the data
 * supports.
 *
 * `watchedDirty` is preferred over `engineDirty` when present; see `readWatchedDirty` for why
 * the whole-tree flag is the wrong input to this decision. `engineDirty` remains the fallback
 * so artifacts stamped before `watchedDirty` existed still get a conservative verdict.
 *
 * @param {object} manifest - the artifact's `manifest` block (may be absent/partial)
 * @param {{sha: string, subject: string}[] | null} commitsSince - from `readEngineCommits`
 */
export const classifyFreshness = (manifest, commitsSince) => {
  const dirty = typeof manifest?.watchedDirty === 'boolean'
    ? manifest.watchedDirty
    : manifest?.engineDirty === true;
  const engineCommit = typeof manifest?.engineCommit === 'string' ? manifest.engineCommit : null;
  const base = {
    engineCommit,
    engineCommitShort: engineCommit ? engineCommit.slice(0, 8) : null,
    generatedAt: manifest?.generatedAt ?? null,
    disclaimerRegisterVersion: manifest?.disclaimerRegisterVersion ?? null,
    regenCommand: manifest?.regenCommand ?? REGEN_COMMAND,
    commits: [],
    commitCount: 0,
    checkedAt: null,
  };

  if (!engineCommit) {
    return {
      ...base,
      state: FRESHNESS_STATE.UNKNOWN,
      headline: 'PROVENANCE MISSING — this artifact does not name the engine commit it was '
        + 'generated from, so its freshness cannot be established. Regenerate it.',
    };
  }
  if (dirty) {
    return {
      ...base,
      state: FRESHNESS_STATE.DIRTY_SOURCE,
      headline: `GENERATED FROM UNCOMMITTED ENGINE CHANGES on top of ${engineCommit.slice(0, 8)}. `
        + 'The commit stamped is not the code that ran, so every engine-derived column here is '
        + 'unattributable. Commit or stash the engine changes, then regenerate.',
    };
  }
  if (commitsSince === null) {
    return {
      ...base,
      state: FRESHNESS_STATE.UNKNOWN,
      headline: `Freshness UNKNOWN — git could not be asked whether the engine moved since `
        + `${engineCommit.slice(0, 8)}. Treat the engine-derived columns as unverified.`,
    };
  }
  if (commitsSince.length === 0) {
    return {
      ...base,
      state: FRESHNESS_STATE.CURRENT,
      headline: `CURRENT — no commit touching the engine has landed since ${engineCommit.slice(0, 8)}.`,
    };
  }
  return {
    ...base,
    state: FRESHNESS_STATE.STALE,
    commits: commitsSince,
    commitCount: commitsSince.length,
    headline: `STALE — ${commitsSince.length} commit${commitsSince.length === 1 ? '' : 's'} `
      + `touching the engine ha${commitsSince.length === 1 ? 's' : 've'} landed since this was `
      + `generated at ${engineCommit.slice(0, 8)}. The predicted-fold column and every `
      + '`model-suspect` verdict below describe a DIFFERENT ENGINE than the one in the tree.',
  };
};

/** Plain-text report, for the CLI and for anything that logs rather than renders. */
export const renderFreshnessLine = (verdict) => {
  const L = [];
  L.push(verdict.headline);
  if (verdict.generatedAt) L.push(`  generated   ${verdict.generatedAt}`);
  if (verdict.engineCommit) L.push(`  from commit ${verdict.engineCommit}`);
  if (verdict.disclaimerRegisterVersion) L.push(`  register    ${verdict.disclaimerRegisterVersion}`);
  for (const c of verdict.commits) L.push(`  since       ${c.sha.slice(0, 8)}  ${c.subject}`);
  if (verdict.state !== FRESHNESS_STATE.CURRENT) L.push(`  regenerate  ${verdict.regenCommand}`);
  return L.join('\n');
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The banner, as HTML. Amber-on-dark for stale, matching the one staleness treatment the app
 * already ships (`PrintableRefresherView/StalenessBanner.jsx` — `#451a03` / `#fde68a` /
 * `#92400e`), so the founder is not asked to learn a second visual language for the same idea.
 *
 * The COMMITS ARE NAMED. "Something changed" is not actionable; "the fold curve changed" is.
 */
export const freshnessBannerHtml = (verdict) => {
  const stale = verdict.state === FRESHNESS_STATE.STALE
    || verdict.state === FRESHNESS_STATE.DIRTY_SOURCE
    || verdict.state === FRESHNESS_STATE.UNKNOWN;
  const palette = stale
    ? { bg: '#451a03', fg: '#fde68a', border: '#92400e', icon: '⚠' }
    : { bg: '#052e16', fg: '#bbf7d0', border: '#166534', icon: '✓' };

  const commits = verdict.commits.length
    ? `<ul class="freshness-commits">${verdict.commits
      .map((c) => `<li><code>${esc(c.sha.slice(0, 8))}</code> ${esc(c.subject)}</li>`).join('')}</ul>`
    : '';

  return `
<section class="freshness" role="status" data-freshness="${esc(verdict.state)}"
         data-commit-count="${verdict.commitCount}"
         style="background:${palette.bg};color:${palette.fg};border:1px solid ${palette.border};
                border-radius:8px;padding:14px 18px;margin:0 0 22px 0;">
  <div style="display:flex;gap:12px;align-items:flex-start;">
    <span aria-hidden="true" style="font-size:20px;line-height:1.2;">${palette.icon}</span>
    <div style="flex:1 1 auto;min-width:0;">
      <p style="margin:0 0 6px 0;font-weight:700;line-height:1.45;">${esc(verdict.headline)}</p>
      ${commits}
      <p class="freshness-meta" style="margin:8px 0 0 0;opacity:.85;font-size:12px;line-height:1.6;">
        generated <code>${esc(verdict.generatedAt ?? '—')}</code>
        · engine commit <code>${esc(verdict.engineCommitShort ?? '—')}</code>
        · fault register <code>${esc(verdict.disclaimerRegisterVersion ?? '—')}</code>
        · checked <code>${esc(verdict.checkedAt ?? 'at generation')}</code>
      </p>
      <p style="margin:6px 0 0 0;font-size:12px;line-height:1.6;">
        Regenerate: <code style="background:rgba(0,0,0,.35);padding:2px 6px;border-radius:4px;">${esc(verdict.regenCommand)}</code>
        &nbsp;·&nbsp; Re-check without regenerating:
        <code style="background:rgba(0,0,0,.35);padding:2px 6px;border-radius:4px;">npm run hole-map:check</code>
      </p>
    </div>
  </div>
</section>`;
};

/**
 * The markers the stamper rewrites between. They are HTML comments so the banner can be
 * replaced in a rendered page WITHOUT re-running the generator — which matters because
 * freshness is a property of the moment you read the page, not of the moment it was made.
 */
export const BANNER_OPEN = '<!--FRESHNESS:START-->';
export const BANNER_CLOSE = '<!--FRESHNESS:END-->';

/**
 * Replace the freshness banner inside an already-rendered page.
 *
 * Returns the html unchanged and `replaced: false` when the markers are absent, rather than
 * appending a second banner — two banners disagreeing with each other is strictly worse than
 * one that is missing.
 */
export const stampFreshnessIntoHtml = (html, verdict) => {
  const open = html.indexOf(BANNER_OPEN);
  const close = html.indexOf(BANNER_CLOSE);
  if (open === -1 || close === -1 || close < open) return { html, replaced: false };
  const next = html.slice(0, open + BANNER_OPEN.length)
    + freshnessBannerHtml(verdict)
    + html.slice(close);
  return { html: next, replaced: true };
};
