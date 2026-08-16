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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
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

const readdirSyncRecursive = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readdirSyncRecursive(full));
    else out.push(full);
  }
  return out;
};

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
// `fixed inset-0` counts as a bound: the element is pinned to its containing
// block (viewport, or the rotated chrome viewport under WS-440) on all sides.
const hasHeightBound   = (s) => /h-dvh|h-\[100dvh\]|height:\s*['"]100dvh['"]|LAYOUT\.TABLE_HEIGHT|fixed inset-0/.test(s);
const hasScrollRegion  = (s) => /overflow-y-auto|overflow-auto|overflowY:\s*['"]auto['"]|overflow:\s*['"]auto['"]/.test(s);
const hasUnboundedRoot = (s) => /min-h-dvh|min-h-screen|minHeight:\s*['"]?100dvh/.test(s);

/**
 * The centered-scroller antipattern (WS-440 sweep, 2026-08-13): flex centering
 * on BOTH axes of a scroll container pushes an oversized child past the START
 * edge, where scrollTop/scrollLeft 0 cannot reach it — the scroll region is
 * present but non-functional. Found live in ShowdownView/CardGrid and two
 * PresessionDrill modes. Center the CHILD with m-auto instead.
 * Checked per className attribute, since outer-scroll + inner-center on
 * DIFFERENT elements (the FluidView/LoginView pattern) is correct.
 */
const CENTERED_SCROLLER = /className=(?:"[^"]*"|\{`[^`]*`\})/g;
const hasCenteredScroller = (src) => {
  for (const m of src.match(CENTERED_SCROLLER) ?? []) {
    const cls = m;
    if (
      /overflow-(?:y-)?auto/.test(cls) &&
      /items-center/.test(cls) &&
      /justify-center/.test(cls)
    ) return true;
  }
  return false;
};

const views = collectRoutableViews();

/**
 * Surfaces the registry derivation can NEVER see, each with the reason it is
 * out of registry reach. The 2026-08-13 sweep found real unreachable-content
 * bugs in four of these — the registry-only scan was the blind spot.
 */
const EXTRA_SURFACES = {
  'src/components/views/ShowdownView/ShowdownView.jsx':
    'Overlay routed by isShowdownViewOpen in PokerTracker, deliberately not in the registry.',
  'src/components/ui/ViewErrorBoundary.jsx':
    'Wraps every routed view; its crash card IS the view when rendering fails.',
  'src/components/ErrorBoundary.jsx':
    'Top-level boundary around AppRoot; the last screen standing on a crash.',
  'src/components/ui/AuthLoadingScreen.jsx':
    'Full-screen pre-auth surface rendered before any registry view.',
  'src/components/ui/ViewLoadingFallback.jsx':
    'Suspense fallback shown while lazy views load.',
  'src/components/views/CalibrationDashboardView/CalibrationDashboardView.jsx':
    'Registered deferred: true — the registry imports a stub, not the component, ' +
    'so the derived scan skips it; it must not ship broken when un-deferred.',
};

const extraSurfaces = Object.entries(EXTRA_SURFACES).map(([path, reason]) => {
  const file = resolve(REPO_ROOT, path);
  return { path, reason, src: stripComments(readFileSync(file, 'utf8')) };
});

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

  it.each(views.map((v) => [v.path, v]))(
    '%s — no centered scroll container (start-edge overflow is unreachable)',
    (_path, view) => {
      expect(hasCenteredScroller(view.src)).toBe(false);
    },
  );

  it.each(extraSurfaces.map((s) => [s.path, s]))(
    '%s — non-registry surface bounds its height and scrolls',
    (path, surface) => {
      // Same rules as routable views: no unbounded-growth root, no centered
      // scroller, and (for surfaces with real content) a scroll shell.
      expect(hasUnboundedRoot(surface.src), `${path} has an unbounded-growth root`).toBe(false);
      expect(hasCenteredScroller(surface.src), `${path} centers a scroll container`).toBe(false);
      // Loading screens are a spinner + a line of text — height-bound is
      // enough. Everything else must actually scroll.
      const spinnerOnly = /LoadingScreen|LoadingFallback/.test(path);
      if (!spinnerOnly) {
        expect(
          hasScrollRegion(surface.src),
          `${path} has no scroll region — its content can exceed a short viewport`,
        ).toBe(true);
      }
      expect(hasHeightBound(surface.src), `${path} has no viewport height bound`).toBe(true);
    },
  );

  it('modal shells bound their height (files named *Modal*)', () => {
    // A fixed-inset-0 modal with no max-height and no scroll region clips its
    // footer buttons on short viewports (the 2026-08-13 sweep found five).
    // Every modal component file must carry SOME height bound or scroll region.
    const modalFiles = readdirSyncRecursive(resolve(REPO_ROOT, 'src/components'))
      .filter((f) => /Modal[^/\\]*\.jsx$/.test(f) && !/__tests__/.test(f));
    expect(modalFiles.length).toBeGreaterThan(5); // derivation sanity
    const offenders = [];
    for (const file of modalFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const isOverlay = /fixed inset-0|position:\s*['"]fixed['"]/.test(src);
      if (!isOverlay) continue;
      const bounded =
        /max-h-\[|maxHeight/.test(src) || hasScrollRegion(src);
      if (!bounded) offenders.push(rel(file));
      if (hasCenteredScroller(src)) offenders.push(`${rel(file)} (centered scroller)`);
    }
    expect(offenders, `modal shells with no height bound/scroll: ${offenders.join(', ')}`).toEqual([]);
  });

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
      const src = stripComments(readFileSync(file, 'utf8'));
      expect(
        hasScrollRegion(src),
        `${mode} lost its scroll region; PresessionDrillView's exemption no longer holds`,
      ).toBe(true);
      expect(
        hasCenteredScroller(src),
        `${mode} centers its scroll container — start-edge content is unreachable`,
      ).toBe(false);
    }
    // DrillReveal has no scroll region of its own; that is only sound because
    // DrillFlashcards wraps it inside its scroller. Pin that wrap relation so
    // the exemption reason ("each child owns its scroll region") stays honest.
    const flashcards = stripComments(readFileSync(resolve(dir, 'DrillFlashcards.jsx'), 'utf8'));
    expect(
      /<DrillReveal/.test(flashcards),
      'DrillFlashcards no longer renders DrillReveal — its scroll coverage is gone; give DrillReveal its own scroll region',
    ).toBe(true);
  });

  it('every exemption carries a reason and still points at a real view', () => {
    const routable = new Set(views.map((v) => v.path));
    for (const [path, reason] of Object.entries(EXEMPT)) {
      expect(reason?.length ?? 0, `EXEMPT['${path}'] needs a reason`).toBeGreaterThan(40);
      expect(routable.has(path), `EXEMPT['${path}'] is stale — not a routable view`).toBe(true);
    }
  });
});
