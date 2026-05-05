/**
 * @file AccessoryInventoryDisplay — read-only inventory list for PlayerProfile.
 *
 * Per `feedback_accessory_inventory_model.md`: most-recent-seen first. Each
 * item shows kind / color swatch / subtype / free-text note (the load-
 * bearing identifier — "KC Royals", "WSOP", etc.) / times seen / last
 * seen date.
 *
 * Read-only here — editing is in PlayerEditorView's AccessoryInventorySection.
 */

import React from 'react';
import { CLOTHING_COLORS } from '../../../constants/avatarFeatureConstants';
import { sortInventoryRecentFirst } from '../../../utils/accessoryInventory';

const COLOR_HEX_BY_KEY = Object.fromEntries(
  CLOTHING_COLORS.map((c) => [c.id.replace(/^cloth\./, ''), c.hex]),
);

const formatDate = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString();
};

const Swatch = ({ colorKey }) => {
  const hex = COLOR_HEX_BY_KEY[colorKey];
  if (!hex) return null;
  return (
    <span
      className="rounded-full inline-block shrink-0"
      style={{
        background: hex,
        width: 16,
        height: 16,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
      aria-hidden="true"
    />
  );
};

export const AccessoryInventoryDisplay = ({ inventory }) => {
  const list = Array.isArray(inventory) ? inventory : [];
  const sorted = sortInventoryRecentFirst(list);

  if (sorted.length === 0) {
    return (
      <section
        className="mb-6"
        data-testid="player-profile-accessories"
      >
        <h2 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">
          Accessory Inventory
        </h2>
        <div
          className="text-gray-500 text-sm bg-gray-800/40 rounded p-3"
          data-testid="player-profile-accessories-empty"
        >
          No accessories recorded yet.
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-6"
      data-testid="player-profile-accessories"
    >
      <h2 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">
        Accessory Inventory ({sorted.length})
      </h2>
      <div className="bg-gray-800/40 rounded divide-y divide-gray-700">
        {sorted.map((entry) => {
          const headlineParts = [];
          if (entry.color) headlineParts.push(entry.color);
          if (entry.subtype) headlineParts.push(entry.subtype);
          const headline = headlineParts.join(' ') || entry.kind;
          return (
            <div
              key={entry.accessoryId}
              className="px-3 py-2 flex items-center gap-2"
              data-testid={`profile-accessory-row-${entry.accessoryId}`}
            >
              <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
                {entry.kind}
              </span>
              {entry.color ? <Swatch colorKey={entry.color} /> : null}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">
                  {headline}
                  {entry.note ? (
                    <span className="ml-1.5 text-gray-400 italic">({entry.note})</span>
                  ) : null}
                </div>
              </div>
              <div className="text-[10px] text-gray-500 whitespace-nowrap text-right">
                seen {entry.timesSeen || 1}×<br />
                <span className="text-gray-600">{formatDate(entry.lastSeenAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default AccessoryInventoryDisplay;
