/**
 * INV-VIEW-SCROLL — every routable view must bound its own height and scroll.
 *
 * THE BUG CLASS THIS GUARDS
 * -------------------------
 * `src/index.css` pins `html, body, #root` to `height: 100dvh; overflow: hidden`.
 * The page itself therefore CANNOT scroll. A view that lets its root grow past the
 * viewport — or that sits in the fixed 1600x720 `ScaledContainer` canvas without an
 * internal scroll region — has its overflow silently clipped: no scrollbar, no
 * indication, content simply unreachable.
 *
 * This has now recurred across eight surfaces (Sessions, Settings, SelfCoach,
 * AnchorLibrary, PrintableRefresher, then LessonDetail, Online and the two drill
 * views). `docs/design/audits/2026-06-19-responsive-layout-audit.md` catalogued it
 * and introduced `<FluidView>` as the shared shell; it kept drifting back because
 * nothing enforced it. This test is that enforcement.
 *
 * WHAT IT CHECKS
 * --------------
 * The view list is DERIVED from `viewRegistry.jsx`, so a newly registered view is
 * covered automatically — it cannot opt out by being new.
 *
 * Each view's entry module must satisfy one of three accepted shells:
 *   1. `<FluidView>`      — the canonical portrait-native shell.
 *   2. bounded-fluid      — a viewport-height bound AND an `overflow-y-auto` region.
 *   3. scaled canvas      — `ScaledContainer` / the fixed LAYOUT canvas, PLUS an
 *                           internal scroll region (unless spatially exempt below).
 * And no view may use an unbounded-growth root (`min-h-dvh` / `min-h-screen` /
 * `minHeight: 100dvh`) — that is the exact shape of the original bug.
 *
 * SCOPE / HONEST LIMITS
 * ---------------------
 * This is a STATIC source check on the entry module, not a rendered-DOM assertion.
 * It cannot prove a scroll region wraps the right subtree — it proves the shell is
 * present. That is deliberately strict: it scans only the entry file, so a scroll
 * region buried in some unrelated sibling component cannot launder a broken root.
 * The cost of that strictness is the explicit exemption list below, which is small,
 * documented, and self-verified.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY = resolve(REPO_ROOT, 'src/constants/viewRegistry.jsx');

/**
 * Views exempt from the "must have an internal scroll region" rule.
 * Every entry needs a reason. An exemption without one is a bug in this list.
 */
const EXEMPT = {
  'src/components/views/TableView/TableView.jsx':
    'Spatial game canvas. The poker table is a fixed 1600x720 spatial layout — ' +
    'seats are positioned, not flowed. Clipping at the canvas edge IS the design; ' +
    'a scrollbar here would mean the table layout itself had broken.',
  'src/components/views/PresessionDrillView/index.jsx':
    'Shell-only router. It renders one of five per-mode children (DrillEntry, ' +
    'DrillFlashcards, DrillReveal, DrillRetryQueue, DrillReview, DrillExit) and ' +
    'each child owns its own scroll region — asserted by the test below, so this ' +
    'exemption cannot rot silently.',
};

// --- source helpers ---------------------------------------------------------

const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

const resolveModule = (spec, fromDir) => {
  const base = resolve(fromDir, spec);
  for (const c of [base, `${base}.jsx`, `${base}.js`, `${base}/index.jsx`, `${base}/index.js`]) {
    if (isFile(c)) return c;
  }
  return null;
};

/**
 * Strip comments before pattern-matching. Load-bearing: several views carry
 * comments that NAME the old bug ("was minHeight:100dvh -> clipped"), and a naive
 * scan flags the very files that document their own fix.
 */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Follow barrel `index.js` re-exports through to the real component module. */
const followBarrel = (file, depth = 0) => {
  if (depth > 3) return file;
  const src = stripComments(readFileSync(file, 'utf8'));
  const body = src.replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, '').trim();
  const isBarrel =
    body.length > 0 &&
    body.split('\n').filter((l) => l.trim()).every((l) => /^\s*(export|import)\b/.test(l.trim()));
  if (!isBarrel) return file;
  const m = src.match(/(?:export|import)[\s\S]*?from\s*['"](\.[^'"]+)['"]/);
  if (!m) return file;
  const next = resolveModule(m[1], dirname(file));
  return next && next !== file ? followBarrel(next, depth + 1) : file;
};

const rel = (f) => relative(REPO_ROOT, f).replace(/\\/g, '/');

/** Every view module the registry can route to, derived from the registry source. */
const collectRoutableViews = () => {
  const src = readFileSync(REGISTRY, 'utf8');
  const specs = new Set();
  // Lazy views: lz(() => import('../components/views/...'))
  for (const m of src.matchAll(/import\(['"]([^'"]+)['"]\)/g)) specs.add(m[1]);
  // Eager hot-path views: import { X } from '../components/views/...'
  for (const m of src.matchAll(/^import \{[^}]+\} from ['"](\.\.\/components\/views\/[^'"]+)['"]/gm)) {
    specs.add(m[1]);
  }
  return [...specs].sort().map((spec) => {
    const entry = resolveModule(spec, dirname(REGISTRY));
    if (!entry) throw new Error(`viewRegistry references an unresolvable module: ${spec}`);
    const file = followBarrel(entry);
    return { spec, file, path: rel(file), src: stripComments(readFileSync(file, 'utf8')) };
  });
};

// --- shell detection --------------------------------------------------------

const usesFluidView    = (s) => /\bFluidView\b/.test(s);
const usesScaledCanvas = (s) => /\bScaledContainer\b/.test(s) || /LAYOUT\.TABLE_/.test(s);
const hasHeightBound   = (s) => /h-dvh|h-\[100dvh\]|height:\s*['"]100dvh['"]|LAYOUT\.TABLE_HEIGHT/.test(s);
const hasScrollRegion  = (s) => /overflow-y-auto|overflow-auto|overflowY:\s*['"]auto['"]/.test(s);
const hasUnboundedRoot = (s) => /min-h-dvh|min-h-screen|minHeight:\s*['"]?100dvh/.test(s);

const views = collectRoutableViews();

// --- the guard --------------------------------------------------------------

describe('INV-VIEW-SCROLL — routable views bound their height and scroll', () => {
  it('finds the routable views (guard is wired to the registry, not a hand list)', () => {
    // If this drops to near-zero the derivation silently broke and every
    // assertion below would vacuously pass.
    expect(views.length).toBeGreaterThan(15);
  });

  it.each(views.map((v) => [v.path, v]))(
    '%s — no unbounded-growth root',
    (_path, view) => {
      // min-height lets the element grow PAST the locked viewport, so
      // overflow-y-auto never engages and content below the fold is clipped.
      // Use a bounded height (h-[100dvh] / the LAYOUT canvas) instead.
      expect(hasUnboundedRoot(view.src)).toBe(false);
    },
  );

  it.each(views.map((v) => [v.path, v]))(
    '%s — renders through an accepted scroll shell',
    (path, view) => {
      const exemptReason = EXEMPT[path];
      const scrolls = hasScrollRegion(view.src);

      if (usesFluidView(view.src)) return;                       // canonical shell
      if (usesScaledCanvas(view.src) && (scrolls || exemptReason)) return;
      if (hasHeightBound(view.src) && scrolls) return;            // bounded-fluid

      throw new Error(
        `${path} has no scroll shell — content taller than the viewport will be ` +
        `silently clipped (index.css locks html/body/#root to 100dvh overflow:hidden).\n` +
        `Fix by wrapping the root in <FluidView> (portrait/reading/list/form surfaces), ` +
        `or by giving the ScaledContainer canvas an overflow-y-auto region ` +
        `(data-dense scaled surfaces — see StatsView).\n` +
        `If clipping is genuinely correct here, add it to EXEMPT with a reason.`,
      );
    },
  );

  it('exemptions are still accurate — PresessionDrill modes each scroll', () => {
    // Keeps the EXEMPT entry honest: the shell is only allowed to skip the rule
    // because its children carry it. If a mode loses its scroll region, fail here
    // rather than let the exemption quietly cover a real regression.
    const dir = resolve(REPO_ROOT, 'src/components/views/PresessionDrillView');
    const modes = [
      'DrillEntry.jsx', 'DrillFlashcards.jsx', 'DrillRetryQueue.jsx',
      'DrillReview.jsx', 'DrillExit.jsx',
    ];
    for (const mode of modes) {
      const file = resolve(dir, mode);
      expect(isFile(file), `${mode} missing — update EXEMPT`).toBe(true);
      expect(
        hasScrollRegion(stripComments(readFileSync(file, 'utf8'))),
        `${mode} lost its scroll region; PresessionDrillView's exemption no longer holds`,
      ).toBe(true);
    }
  });

  it('every exemption carries a reason and still points at a real view', () => {
    const routable = new Set(views.map((v) => v.path));
    for (const [path, reason] of Object.entries(EXEMPT)) {
      expect(reason?.length ?? 0, `EXEMPT['${path}'] needs a reason`).toBeGreaterThan(40);
      expect(routable.has(path), `EXEMPT['${path}'] is stale — not a routable view`).toBe(true);
    }
  });
});
