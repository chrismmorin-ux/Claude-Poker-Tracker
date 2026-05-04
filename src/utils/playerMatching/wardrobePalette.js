/**
 * @file Wardrobe palette — small starter set (~10 entries).
 *
 * Per WS-163 / SPR-035 plan-mode (locked: small starter sets, amendable).
 * Each entry is a (id, label) pair where id is the canonical string written
 * to Player.wardrobe[] and matched in stability scoring.
 *
 * Owner amends this file directly to add/remove palette options.
 *
 * Per `feedback_pio_identification_utility_first.md`: identification
 * utility binds; cultural-sensitivity is reviewing voice.
 *
 * SPR-035 / WS-163 (2026-05-04).
 */

export const WARDROBE_PALETTE = [
  { id: 'black-hoodie', label: 'Black hoodie' },
  { id: 'graphic-tee', label: 'Graphic tee' },
  { id: 'plain-tee', label: 'Plain tee' },
  { id: 'polo-shirt', label: 'Polo shirt' },
  { id: 'button-down', label: 'Button-down' },
  { id: 'dress-shirt', label: 'Dress shirt' },
  { id: 'athletic-jersey', label: 'Athletic jersey' },
  { id: 'jacket', label: 'Jacket' },
  { id: 'suit', label: 'Suit' },
  { id: 'sweater', label: 'Sweater' },
];
