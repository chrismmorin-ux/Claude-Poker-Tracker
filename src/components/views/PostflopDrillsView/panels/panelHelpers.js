/**
 * Shared panel constants for the v2 BucketEVPanelV2 composition.
 *
 * Post-Commit-5 (2026-04-22) the v1 helpers (`formatEV`, `actionLabel`,
 * `CAVEAT_LABELS`, `isRowApplicable`) are deleted along with the v1 panel.
 * Only `RELATION_STYLE` remains — consumed by `VillainRangeDecomposition`
 * (P1) to color-code the crushed/dominated/neutral/favored/dominating
 * relation badges.
 */

export const RELATION_STYLE = {
  crushed:    { color: 'text-rose-300',    bg: 'bg-rose-950/30',    border: 'border-rose-800',    label: 'crushed' },
  dominated:  { color: 'text-orange-300',  bg: 'bg-orange-950/30',  border: 'border-orange-800',  label: 'dominated' },
  neutral:    { color: 'text-amber-300',   bg: 'bg-amber-950/30',   border: 'border-amber-800',   label: 'coin-flip' },
  favored:    { color: 'text-teal-300',    bg: 'bg-teal-950/30',    border: 'border-teal-800',    label: 'favored' },
  dominating: { color: 'text-emerald-300', bg: 'bg-emerald-950/30', border: 'border-emerald-800', label: 'dominating' },
};
