/**
 * bridgeProtocol.js — App-side bridge protocol constants
 *
 * Must stay in sync with: ignition-poker-tracker/shared/constants.js
 * (BRIDGE_MSG + PROTOCOL_VERSION).
 *
 * Duplication is intentional — the extension uses IIFE globals and
 * cannot import ES modules. Both files define the same string values.
 */

export const PROTOCOL_VERSION = 1;

export const BRIDGE_MSG = {
  // Extension -> App
  HANDS:         'POKER_SYNC_HANDS',
  HAND_STATE:    'POKER_SYNC_HAND_STATE',
  STATUS:        'POKER_SYNC_STATUS',
  // App -> Extension
  ACK:           'POKER_SYNC_ACK',
  EXPLOITS:      'POKER_SYNC_EXPLOITS',
  ACTION_ADVICE: 'POKER_SYNC_ACTION_ADVICE',
};
