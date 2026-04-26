/**
 * refresherSelectors.js — read-side state contract per `selectors.md`.
 *
 * Six pure selectors over (cardRegistry, userRefresherConfig, printBatches):
 *   - selectAllCards         — every card with visibility + class-suppression annotations
 *   - selectActiveCards      — neither hidden nor class-suppressed (default catalog read)
 *   - selectPinnedCards      — visibility === 'pinned' subset
 *   - selectSuppressedCards  — hidden OR class-suppressed (the inverse of active)
 *   - selectCardsForBatchPrint — selectedIds filtered to active (defense-in-depth)
 *   - selectStaleCards       — active cards whose contentHash differs from most-recent print
 *
 * State-clear-asymmetry contract (R-8.1 from Sidebar Rebuild doctrine):
 *   For every writer-action, there is a paired selector behavior. The
 *   un-suppress roundtrip is canonical: pin 3 cards → suppress class →
 *   un-suppress class → all 3 cards still pinned. Selectors guarantee
 *   zero data loss across this roundtrip because they do NOT mutate
 *   userRefresherConfig — only read + annotate.
 *
 * Spec: docs/projects/printable-refresher/selectors.md v1.0
 */

const VISIBILITY_DEFAULT = 'default';

function getVisibility(userRefresherConfig, cardId) {
  const map = (userRefresherConfig && userRefresherConfig.cardVisibility) || {};
  const value = map[cardId];
  return value === 'hidden' || value === 'pinned' ? value : VISIBILITY_DEFAULT;
}

function getClassSuppressed(userRefresherConfig, cardClass) {
  const list = (userRefresherConfig && userRefresherConfig.suppressedClasses) || [];
  return list.includes(cardClass);
}

/**
 * Annotate a single card with visibility + class-suppression state.
 * Pure helper — exported for tests + reuse.
 */
export function annotateCard(card, userRefresherConfig) {
  return {
    ...card,
    visibility: getVisibility(userRefresherConfig, card.cardId),
    classSuppressed: getClassSuppressed(userRefresherConfig, card.class),
    isStale: null,
    staleSinceBatch: null,
  };
}

/**
 * `selectAllCards` — base read. Returns every card in the registry annotated
 * with visibility + class-suppression. Never filters; never hides.
 *
 * Used for: catalog "Show suppressed" toggle (full view) + as the source set
 * for the partition test (selectActive ∪ selectSuppressed === selectAll).
 *
 * Red line linkage: #6 (flat access — suppressed cards remain visible here).
 */
export function selectAllCards({ cardRegistry, userRefresherConfig }) {
  if (!Array.isArray(cardRegistry)) return [];
  return cardRegistry.map((card) => annotateCard(card, userRefresherConfig));
}

/**
 * `selectActiveCards` — default catalog read. Returns cards that are neither
 * hidden nor class-suppressed.
 *
 * Used for: catalog default render + default print-export set + staleness-diff
 * base set (hidden/suppressed cards never count toward "N of M stale").
 *
 * Red line linkage: #5 (no engagement-pressure — catalog default doesn't
 * surface suppressed) + #6 (flat access preserved via selectAllCards coexistence).
 */
export function selectActiveCards({ cardRegistry, userRefresherConfig }) {
  return selectAllCards({ cardRegistry, userRefresherConfig })
    .filter((c) => c.visibility !== 'hidden' && !c.classSuppressed);
}

/**
 * `selectPinnedCards` — pinned subset. Returns cards where visibility === 'pinned'.
 *
 * Pinned cards are by definition active (pinning un-hides via W-URC-2 coupling
 * at the writer layer; this selector trusts that contract).
 *
 * Used for: "Pinned-first" sort lead-ordering + multi-page print-export
 * leading-page placement.
 */
export function selectPinnedCards({ cardRegistry, userRefresherConfig }) {
  return selectAllCards({ cardRegistry, userRefresherConfig })
    .filter((c) => c.visibility === 'pinned');
}

/**
 * `selectSuppressedCards` — hidden OR class-suppressed. The inverse of
 * selectActiveCards relative to selectAllCards.
 *
 * Constraint: `selectActiveCards` ∪ `selectSuppressedCards` === `selectAllCards`,
 * intersection empty. Test PRF-G5-SL-PARTITION asserts this.
 *
 * Red line linkage: #6 (flat access — suppressed cards reachable via this
 * selector) + #3 (durable override — system doesn't re-include them into
 * active selector until owner un-suppresses explicitly).
 */
export function selectSuppressedCards({ cardRegistry, userRefresherConfig }) {
  return selectAllCards({ cardRegistry, userRefresherConfig })
    .filter((c) => c.visibility === 'hidden' || c.classSuppressed);
}

/**
 * `selectCardsForBatchPrint` — print-export read. Returns cards in `selectedIds`
 * that pass `selectActiveCards` (excludes hidden + class-suppressed even if
 * explicitly selected — defense-in-depth against UI bugs).
 *
 * If the caller's selectedIds list contained suppressed entries that got
 * filtered, the caller can compare lengths to surface a "1 selected card was
 * suppressed + excluded from print" warning in PrintConfirmationModal.
 *
 * Red line linkage: #15 (no proactive print) + #13 (durable suppression —
 * suppressed cards don't print even if explicitly selected).
 */
export function selectCardsForBatchPrint({ cardRegistry, userRefresherConfig }, selectedIds) {
  const ids = Array.isArray(selectedIds) ? new Set(selectedIds) : new Set();
  return selectActiveCards({ cardRegistry, userRefresherConfig })
    .filter((c) => ids.has(c.cardId));
}

/**
 * `selectStaleCards` — staleness-diff read. Returns active cards whose current
 * contentHash differs from the most-recent printBatches[].perCardSnapshots[cardId]
 * snapshot.
 *
 * Semantics:
 *   - Only active cards are considered (hidden/suppressed are not "stale" — no
 *     laminate to be stale).
 *   - Only the most-recent batch in which the card appears is compared.
 *     Rationale: staleness is about the laminate the owner currently holds,
 *     not all historical laminates.
 *   - A card never printed is NOT stale — it has no laminate.
 *   - Matching hash → current; diverging hash → stale.
 *
 * Red line linkage: #10 (printed-advice permanence requires staleness
 * surfacing) + #12 (lineage-mandatory — staleness relies on per-card hash).
 *
 * @returns {StaleCard[]} active cards with isStale: true + currentHash +
 *                       printedHash + printedAt + batchId + batchLabel.
 */
export function selectStaleCards({ cardRegistry, userRefresherConfig }, printBatches) {
  const active = selectActiveCards({ cardRegistry, userRefresherConfig });
  const batches = Array.isArray(printBatches) ? printBatches : [];

  // Build most-recent-batch-per-cardId index. Iterate batches in printedAt-DESC
  // order; first occurrence per cardId wins.
  const sortedBatches = [...batches].sort((a, b) => {
    const aTime = Date.parse(a.printedAt || '');
    const bTime = Date.parse(b.printedAt || '');
    return bTime - aTime; // DESC
  });
  const mostRecentByCard = new Map();
  for (const batch of sortedBatches) {
    const ids = Array.isArray(batch.cardIds) ? batch.cardIds : [];
    const snapshots = batch.perCardSnapshots || {};
    for (const cardId of ids) {
      if (!mostRecentByCard.has(cardId) && snapshots[cardId]) {
        mostRecentByCard.set(cardId, {
          batchId: batch.batchId,
          batchLabel: batch.label !== undefined ? batch.label : null,
          printedAt: batch.printedAt,
          printedHash: snapshots[cardId].contentHash,
        });
      }
    }
  }

  const stale = [];
  for (const card of active) {
    const recent = mostRecentByCard.get(card.cardId);
    if (!recent) continue; // never printed → not stale
    if (recent.printedHash === card.contentHash) continue; // current
    stale.push({
      ...card,
      isStale: true,
      staleSinceBatch: recent.batchId,
      currentHash: card.contentHash,
      printedHash: recent.printedHash,
      printedAt: recent.printedAt,
      batchId: recent.batchId,
      batchLabel: recent.batchLabel,
    });
  }
  return stale;
}
