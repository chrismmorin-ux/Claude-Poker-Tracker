/**
 * FluidView — the standard portrait-native scroll container.
 *
 * The app globally locks the page (index.css: html/body/#root are
 * `height:100dvh; overflow:hidden`), so a fluid view CANNOT rely on the page to
 * scroll — it must scroll inside its own viewport-height box. This wrapper is
 * that box: a BOUNDED height (`h-[100dvh]`) + `overflow-y-auto`.
 *
 * Why this exists: ad-hoc roots using `min-h-dvh` / `minHeight: 100dvh` let the
 * element grow PAST the locked viewport, so `overflow-y-auto` never engages and
 * content below the fold is silently clipped (no scrollbar). That bug recurred
 * across Sessions, Settings, Self-Coach, Anchor Library, Printable Refresher.
 * Routing every fluid view through this wrapper fixes it at the root and stops
 * it drifting back. See docs/design/audits/2026-06-19-responsive-layout-audit.md.
 *
 * Use for all non-ScaledContainer (portrait-native) views. Game-flow spatial
 * views keep ScaledContainer / ScaledView.
 *
 * @param {string} [className] - extra classes on the scroll container (e.g. bg override).
 * @param {object} [style] - inline style passthrough.
 * @param {React.ReactNode} children - the view's content (provide its own width cap/padding).
 */
export const FluidView = ({ className = '', style, children, ...rest }) => (
  <div
    className={`h-[100dvh] overflow-y-auto bg-gray-900 ${className}`}
    style={style}
    {...rest}
  >
    {children}
  </div>
);

export default FluidView;
