/**
 * persistence/validation.js - Persistence layer validation
 *
 * Validators for data before saving to IndexedDB.
 * Ensures data integrity and prevents corruption.
 *
 * Part of Phase C.1 - Audit Fixes (Persistence Hardening)
 */

import { logger } from '../errorHandler';

const MODULE_NAME = 'persistence/validation';

// =============================================================================
// HAND RECORD VALIDATION
// =============================================================================

/**
 * Validates a hand record before saving
 * @param {Object} handRecord - Hand data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateHandRecord = (handRecord) => {
  const errors = [];

  if (!handRecord || typeof handRecord !== 'object') {
    return { valid: false, errors: ['Hand record must be an object'] };
  }

  // Required fields
  if (!handRecord.timestamp || typeof handRecord.timestamp !== 'number') {
    errors.push('Missing or invalid timestamp');
  }

  // gameState validation
  if (!handRecord.gameState) {
    errors.push('Missing gameState');
  } else if (typeof handRecord.gameState !== 'object') {
    errors.push('gameState must be an object');
  } else {
    if (typeof handRecord.gameState.currentStreet !== 'string') {
      errors.push('gameState.currentStreet must be string');
    }
    if (typeof handRecord.gameState.dealerButtonSeat !== 'number') {
      errors.push('gameState.dealerButtonSeat must be number');
    }
    if (typeof handRecord.gameState.mySeat !== 'number') {
      errors.push('gameState.mySeat must be number');
    }
  }

  // cardState validation
  if (!handRecord.cardState) {
    errors.push('Missing cardState');
  } else if (typeof handRecord.cardState !== 'object') {
    errors.push('cardState must be an object');
  } else {
    if (!Array.isArray(handRecord.cardState.communityCards)) {
      errors.push('cardState.communityCards must be array');
    } else if (handRecord.cardState.communityCards.length !== 5) {
      errors.push('cardState.communityCards must have exactly 5 elements');
    }
    if (!Array.isArray(handRecord.cardState.holeCards)) {
      errors.push('cardState.holeCards must be array');
    } else if (handRecord.cardState.holeCards.length !== 2) {
      errors.push('cardState.holeCards must have exactly 2 elements');
    }
  }

  // seatPlayers validation (optional but must be object if present)
  if (handRecord.seatPlayers !== undefined && handRecord.seatPlayers !== null) {
    if (typeof handRecord.seatPlayers !== 'object') {
      errors.push('seatPlayers must be an object');
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// SESSION RECORD VALIDATION
// =============================================================================

/**
 * Validates a session record before saving
 * @param {Object} sessionRecord - Session data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateSessionRecord = (sessionRecord) => {
  const errors = [];

  if (!sessionRecord || typeof sessionRecord !== 'object') {
    return { valid: false, errors: ['Session record must be an object'] };
  }

  // Required fields
  if (!sessionRecord.startTime || typeof sessionRecord.startTime !== 'number') {
    errors.push('Missing or invalid startTime');
  }

  // Optional but typed fields
  if (sessionRecord.buyIn !== null && sessionRecord.buyIn !== undefined) {
    if (typeof sessionRecord.buyIn !== 'number') {
      errors.push('buyIn must be null or number');
    } else if (sessionRecord.buyIn < 0) {
      errors.push('buyIn must be non-negative');
    }
  }

  if (sessionRecord.cashOut !== null && sessionRecord.cashOut !== undefined) {
    if (typeof sessionRecord.cashOut !== 'number') {
      errors.push('cashOut must be null or number');
    } else if (sessionRecord.cashOut < 0) {
      errors.push('cashOut must be non-negative');
    }
  }

  // rebuyTransactions validation
  if (!Array.isArray(sessionRecord.rebuyTransactions)) {
    errors.push('rebuyTransactions must be array');
  } else {
    sessionRecord.rebuyTransactions.forEach((tx, i) => {
      if (!tx || typeof tx !== 'object') {
        errors.push(`rebuyTransactions[${i}] must be an object`);
      } else {
        if (typeof tx.amount !== 'number') {
          errors.push(`rebuyTransactions[${i}].amount must be number`);
        } else if (tx.amount < 0) {
          errors.push(`rebuyTransactions[${i}].amount must be non-negative`);
        }
        if (typeof tx.timestamp !== 'number') {
          errors.push(`rebuyTransactions[${i}].timestamp must be number`);
        }
      }
    });
  }

  // handCount validation
  if (sessionRecord.handCount !== undefined) {
    if (typeof sessionRecord.handCount !== 'number') {
      errors.push('handCount must be a number');
    } else if (sessionRecord.handCount < 0 || !Number.isInteger(sessionRecord.handCount)) {
      errors.push('handCount must be a non-negative integer');
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// PLAYER RECORD VALIDATION
// =============================================================================
//
// Modern Phase 3+ canonical identification field enums. Records that fail
// these validators are rejected before they reach IndexedDB. Updated
// 2026-05-06 as part of the unified PlayerFinder migration — previously
// the entire Phase 3+ field set was unvalidated and could accept any
// type without complaint, risking silent corruption.

const VALID_SEX = ['male', 'female', 'other'];
const VALID_AGE_DECADES = ['<20', '20s', '30s', '40s', '50s', '60s+'];
const VALID_BUILD = ['slim', 'average', 'heavy', 'muscular'];
const VALID_HEIGHT = ['short', 'medium', 'tall'];
const VALID_SKIN_TONE = ['very-light', 'ruddy', 'light', 'tan', 'brown', 'dark'];
const VALID_HAIR_COLOR = ['white', 'gray', 'salt-pepper', 'red', 'blonde', 'light-brown', 'brown', 'dark-brown', 'black'];
const VALID_HAIR_LENGTH = ['bald', 'shaved', 'buzz', 'short', 'medium', 'long'];
const VALID_HAIR_TEXTURE = ['straight', 'curly', 'braided', 'receding'];
const VALID_FACIAL_HAIR = ['clean', 'stubble', 'mustache', 'goatee', 'full', 'soul-patch'];
const VALID_EYEWEAR = ['none', 'clear', 'sunglasses', 'readers', 'aviators'];
const VALID_EYEWEAR_COLOR = ['black', 'brown', 'tortoiseshell', 'gold', 'silver', 'red', 'blue'];
const VALID_HEADWEAR = ['cap', 'beanie', 'visor', 'fedora', 'cowboy'];
const VALID_TREATMENT = ['salt-pepper'];
// Hat color uses the CLOTHING_COLORS palette keys; same set as accessory colors.
const VALID_CLOTHING_COLOR = ['white', 'gray', 'black', 'yellow', 'orange', 'red', 'pink', 'brown', 'green', 'blue', 'navy', 'purple', 'gold', 'silver'];
const VALID_ACCESSORY_KIND = ['hat', 'glasses', 'top', 'bottom', 'jewelry', 'other'];

// SPR-041 Phase 4: distinguishingMarks per-item schema (PIO Gate 4 v2 audit §A7).
// Mirror the type / location enums from `src/assets/distinguishingMarks/index.js`.
// When extending the mark catalog, update BOTH the registry AND these enums
// (the style guide §8.2 is the authoritative cross-reference).
const VALID_MARK_TYPE = ['tattoo', 'hearing-aid', 'bindi', 'scar', 'prosthetic'];
const VALID_MARK_LOCATION = ['face', 'arm', 'ear', 'neck', 'hand', 'other'];

// Pair of (field, allowed values). Each entry validated as: undefined/null
// passes (the field is optional); otherwise must be a string IN the enum.
const ENUM_FIELDS = [
  ['sex', VALID_SEX],
  ['ageDecade', VALID_AGE_DECADES],
  ['build', VALID_BUILD],
  ['height', VALID_HEIGHT],
  ['skinTone', VALID_SKIN_TONE],
  ['hairColor', VALID_HAIR_COLOR],
  ['hairLength', VALID_HAIR_LENGTH],
  ['hairTexture', VALID_HAIR_TEXTURE],
  ['hairTreatment', VALID_TREATMENT],
  ['facialHair', VALID_FACIAL_HAIR],
  ['beardColor', VALID_HAIR_COLOR],
  ['beardTreatment', VALID_TREATMENT],
  ['eyewear', VALID_EYEWEAR],
  ['eyewearColor', VALID_EYEWEAR_COLOR],
  ['headwear', VALID_HEADWEAR],
  ['hatColor', VALID_CLOTHING_COLOR],
];

const validateDistinguishingMarkItem = (mark, idx, errors) => {
  if (!mark || typeof mark !== 'object' || Array.isArray(mark)) {
    errors.push(`distinguishingMarks[${idx}] must be an object`);
    return;
  }
  if (!VALID_MARK_TYPE.includes(mark.type)) {
    errors.push(`distinguishingMarks[${idx}].type must be one of: ${VALID_MARK_TYPE.join(', ')} (got ${JSON.stringify(mark.type)})`);
  }
  // location is optional — renderer falls back to spec.defaultLocation when
  // missing. But if SET, must be a known anchor.
  if (mark.location !== undefined && mark.location !== null) {
    if (!VALID_MARK_LOCATION.includes(mark.location)) {
      errors.push(`distinguishingMarks[${idx}].location must be one of: ${VALID_MARK_LOCATION.join(', ')} (got ${JSON.stringify(mark.location)})`);
    }
  }
  // description is optional free-text; only the type is structurally required.
  if (mark.description !== undefined && mark.description !== null && typeof mark.description !== 'string') {
    errors.push(`distinguishingMarks[${idx}].description must be string or null`);
  }
  // Timestamps are optional on read-side migrations from older records but
  // should be numbers when present.
  if (mark.firstSeenAt !== undefined && mark.firstSeenAt !== null) {
    if (typeof mark.firstSeenAt !== 'number' || !Number.isFinite(mark.firstSeenAt)) {
      errors.push(`distinguishingMarks[${idx}].firstSeenAt must be a number (ms timestamp)`);
    }
  }
  if (mark.lastSeenAt !== undefined && mark.lastSeenAt !== null) {
    if (typeof mark.lastSeenAt !== 'number' || !Number.isFinite(mark.lastSeenAt)) {
      errors.push(`distinguishingMarks[${idx}].lastSeenAt must be a number (ms timestamp)`);
    }
  }
};

const validateAccessoryInventoryItem = (item, idx, errors) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    errors.push(`accessoryInventory[${idx}] must be an object`);
    return;
  }
  if (typeof item.accessoryId !== 'string' || item.accessoryId.length === 0) {
    errors.push(`accessoryInventory[${idx}].accessoryId must be a non-empty string`);
  }
  if (!VALID_ACCESSORY_KIND.includes(item.kind)) {
    errors.push(`accessoryInventory[${idx}].kind must be one of: ${VALID_ACCESSORY_KIND.join(', ')}`);
  }
  if (item.subtype !== null && item.subtype !== undefined && typeof item.subtype !== 'string') {
    errors.push(`accessoryInventory[${idx}].subtype must be string or null`);
  }
  if (item.color !== null && item.color !== undefined && typeof item.color !== 'string') {
    errors.push(`accessoryInventory[${idx}].color must be string or null`);
  }
  if (item.note !== undefined && item.note !== null && typeof item.note !== 'string') {
    errors.push(`accessoryInventory[${idx}].note must be string or null`);
  }
  if (typeof item.firstSeenAt !== 'number' || !Number.isFinite(item.firstSeenAt)) {
    errors.push(`accessoryInventory[${idx}].firstSeenAt must be a number (ms timestamp)`);
  }
  if (typeof item.lastSeenAt !== 'number' || !Number.isFinite(item.lastSeenAt)) {
    errors.push(`accessoryInventory[${idx}].lastSeenAt must be a number (ms timestamp)`);
  }
  if (typeof item.timesSeen !== 'number' || item.timesSeen < 1 || !Number.isInteger(item.timesSeen)) {
    errors.push(`accessoryInventory[${idx}].timesSeen must be a positive integer`);
  }
};

/**
 * Validates a player record before saving
 * @param {Object} playerRecord - Player data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validatePlayerRecord = (playerRecord) => {
  const errors = [];

  if (!playerRecord || typeof playerRecord !== 'object') {
    return { valid: false, errors: ['Player record must be an object'] };
  }

  // Required fields
  if (!playerRecord.name || typeof playerRecord.name !== 'string') {
    errors.push('name is required and must be a string');
  } else if (playerRecord.name.trim().length === 0) {
    errors.push('name cannot be empty');
  }

  // Optional string fields (legacy + free-form). Includes:
  //   - legacy fields kept for back-compat read-shim (gender, ethnicity, hat
  //     and sunglasses bools — booleans are validated separately below)
  //   - new free-form: ethnicityNote (heritage label like "Italian")
  const optionalStringFields = ['nickname', 'ethnicity', 'gender', 'notes', 'avatar', 'ethnicityNote'];
  optionalStringFields.forEach(field => {
    if (playerRecord[field] !== undefined && playerRecord[field] !== null) {
      if (typeof playerRecord[field] !== 'string') {
        errors.push(`${field} must be a string`);
      }
    }
  });

  // Phase 3+ canonical enum fields. undefined/null pass; any other value
  // must be in the enum or it's a corruption-risk write.
  ENUM_FIELDS.forEach(([field, allowed]) => {
    const value = playerRecord[field];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string' || !allowed.includes(value)) {
      errors.push(`${field} must be one of: ${allowed.join(', ')} (got ${JSON.stringify(value)})`);
    }
  });

  // ethnicityTags — modern multi-tag field (single-select UI persists
  // as an array of length 0 or 1). Each tag must be a string.
  if (playerRecord.ethnicityTags !== undefined && playerRecord.ethnicityTags !== null) {
    if (!Array.isArray(playerRecord.ethnicityTags)) {
      errors.push('ethnicityTags must be an array');
    } else if (!playerRecord.ethnicityTags.every(tag => typeof tag === 'string')) {
      errors.push('ethnicityTags must contain only strings');
    }
  }

  // distinguishingMarks — array of structured marks per audit §A7 + SPR-041
  // Phase 4. Each entry must satisfy the schema enforced by the mark
  // registry at `src/assets/distinguishingMarks/index.js`.
  if (playerRecord.distinguishingMarks !== undefined && playerRecord.distinguishingMarks !== null) {
    if (!Array.isArray(playerRecord.distinguishingMarks)) {
      errors.push('distinguishingMarks must be an array');
    } else {
      playerRecord.distinguishingMarks.forEach((mark, idx) => {
        validateDistinguishingMarkItem(mark, idx, errors);
      });
    }
  }

  // accessoryInventory — Phase C persistent per-player accessory list.
  // Each entry must satisfy the schema documented in
  // src/utils/accessoryInventory.js + feedback_accessory_inventory_model.md.
  if (playerRecord.accessoryInventory !== undefined && playerRecord.accessoryInventory !== null) {
    if (!Array.isArray(playerRecord.accessoryInventory)) {
      errors.push('accessoryInventory must be an array');
    } else {
      playerRecord.accessoryInventory.forEach((item, idx) => {
        validateAccessoryInventoryItem(item, idx, errors);
      });
    }
  }

  // photoBlobId — FK into playerPhotos store (autoincrement number key).
  if (playerRecord.photoBlobId !== undefined && playerRecord.photoBlobId !== null) {
    if (typeof playerRecord.photoBlobId !== 'number' || !Number.isFinite(playerRecord.photoBlobId)) {
      errors.push('photoBlobId must be a number (FK to playerPhotos.blobId) or null');
    }
  }

  // Legacy-bool flags `hairSaltPepper` / `beardSaltPepper`. Phase 7 of the
  // identity-avatar work renamed these to hairTreatment/beardTreatment as
  // string enums (validated above). The legacy booleans are still accepted
  // for back-compat with pre-Phase-7 records.
  ['hairSaltPepper', 'beardSaltPepper'].forEach(field => {
    if (playerRecord[field] !== undefined && playerRecord[field] !== null) {
      if (typeof playerRecord[field] !== 'boolean') {
        errors.push(`${field} must be a boolean (legacy field)`);
      }
    }
  });

  // nameSource (PEO-1): enum 'user' | 'auto' | null
  if (playerRecord.nameSource !== undefined && playerRecord.nameSource !== null) {
    if (playerRecord.nameSource !== 'user' && playerRecord.nameSource !== 'auto') {
      errors.push('nameSource must be "user" or "auto"');
    }
  }

  // avatarFeatures (PEO-1): legacy nullable sub-object with string values.
  // Modern records derive avatar features from identification fields via
  // mapIdentityToAvatarFeatures; this field is accepted for back-compat.
  if (playerRecord.avatarFeatures !== undefined && playerRecord.avatarFeatures !== null) {
    if (typeof playerRecord.avatarFeatures !== 'object' || Array.isArray(playerRecord.avatarFeatures)) {
      errors.push('avatarFeatures must be an object');
    } else {
      for (const [key, value] of Object.entries(playerRecord.avatarFeatures)) {
        if (value !== null && value !== undefined && typeof value !== 'string') {
          errors.push(`avatarFeatures.${key} must be a string (namespaced feature id)`);
        }
      }
    }
  }

  // Legacy boolean fields kept for back-compat (read-shim derives modern
  // headwear/eyewear from these on render).
  const booleanFields = ['hat', 'sunglasses'];
  booleanFields.forEach(field => {
    if (playerRecord[field] !== undefined && playerRecord[field] !== null) {
      if (typeof playerRecord[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }
  });

  // styleTags validation
  if (playerRecord.styleTags !== undefined && playerRecord.styleTags !== null) {
    if (!Array.isArray(playerRecord.styleTags)) {
      errors.push('styleTags must be an array');
    } else if (!playerRecord.styleTags.every(tag => typeof tag === 'string')) {
      errors.push('styleTags must contain only strings');
    }
  }

  // Timestamp fields
  if (playerRecord.createdAt !== undefined && typeof playerRecord.createdAt !== 'number') {
    errors.push('createdAt must be a number');
  }
  if (playerRecord.lastSeenAt !== undefined && typeof playerRecord.lastSeenAt !== 'number') {
    errors.push('lastSeenAt must be a number');
  }

  // handCount validation
  if (playerRecord.handCount !== undefined) {
    if (typeof playerRecord.handCount !== 'number' || playerRecord.handCount < 0) {
      errors.push('handCount must be a non-negative number');
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// PLAYER DRAFT RECORD VALIDATION (PEO-1)
// =============================================================================

/**
 * Validate a playerDrafts record before persisting.
 *
 * Invariant I-PEO-1: At most one draft per userId. Key is userId.
 * The `draft` payload is intentionally loose — it mirrors in-progress form
 * state and should not fail save for missing fields. We validate envelope
 * shape + timestamp correctness only.
 *
 * @param {Object} draftRecord { userId, draft, seatContext, updatedAt }
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateDraftRecord = (draftRecord) => {
  const errors = [];

  if (!draftRecord || typeof draftRecord !== 'object') {
    return { valid: false, errors: ['Draft record must be an object'] };
  }

  if (typeof draftRecord.userId !== 'string' || draftRecord.userId.length === 0) {
    errors.push('draft.userId is required and must be a non-empty string');
  }

  if (draftRecord.draft !== undefined && draftRecord.draft !== null) {
    if (typeof draftRecord.draft !== 'object' || Array.isArray(draftRecord.draft)) {
      errors.push('draft.draft must be an object');
    }
  }

  if (draftRecord.seatContext !== undefined && draftRecord.seatContext !== null) {
    if (typeof draftRecord.seatContext !== 'object' || Array.isArray(draftRecord.seatContext)) {
      errors.push('draft.seatContext must be an object or null');
    } else {
      const { seat, sessionId } = draftRecord.seatContext;
      if (seat !== undefined && seat !== null && typeof seat !== 'number') {
        errors.push('draft.seatContext.seat must be a number if present');
      }
      if (sessionId !== undefined && sessionId !== null && typeof sessionId !== 'number') {
        errors.push('draft.seatContext.sessionId must be a number if present');
      }
    }
  }

  if (draftRecord.updatedAt !== undefined && draftRecord.updatedAt !== null) {
    if (typeof draftRecord.updatedAt !== 'number') {
      errors.push('draft.updatedAt must be a number');
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Logs validation errors with context
 * @param {string} context - Where validation failed (e.g., 'saveHand', 'createSession')
 * @param {string[]} errors - Array of error messages
 */
export const logValidationErrors = (context, errors) => {
  errors.forEach(error => {
    logger.warn(MODULE_NAME, `${context}: ${error}`);
  });
};

/**
 * Validates and logs errors, returning the validation result
 * @param {Object} record - Record to validate
 * @param {Function} validator - Validation function to use
 * @param {string} context - Context for error logging
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateWithLogging = (record, validator, context) => {
  const result = validator(record);
  if (!result.valid) {
    logValidationErrors(context, result.errors);
  }
  return result;
};
