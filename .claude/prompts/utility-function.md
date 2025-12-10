# Utility Function Prompt Template

## Project Context
- **Project**: Poker Tracker (React + IndexedDB)
- **Location**: `src/utils/`
- **Export style**: Named exports ONLY (`export const`)
- **Dependencies**: Receive as parameters (dependency injection)
- **No default exports**: NEVER use `export default`

## Import Path Rules
When importing from other directories:
- From `src/utils/` to `src/constants/`: `'../constants/fileName'`
- From `src/utils/persistence/` to `src/constants/`: `'../../constants/fileName'`
- Within `src/utils/`: `'./fileName'` or `'./subdir/fileName'`

## Code Template
```javascript
/**
 * functionName - Brief description
 * @param {type} param1 - Description
 * @param {type} param2 - Description
 * @returns {type} - Description
 */
export const functionName = (param1, param2, dependencies) => {
  // Implementation
  return result;
};
```

## Critical Rules (MUST FOLLOW)
1. **Named exports ONLY**: `export const foo`, NEVER `export default foo`
2. **Pure functions**: No side effects, same input = same output
3. **Dependency injection**: Pass constants/functions as parameters
4. **JSDoc**: Document all parameters and return type
5. **Error handling**: Return sensible defaults, don't throw unless critical
6. **No imports of constants directly**: Receive them as parameters

## Real Project Examples

### Example 1: Simple data transformation
```javascript
// src/utils/displayUtils.js

/**
 * Checks if a card is red (hearts or diamonds)
 * @param {string} card - Card string (e.g., "A♥", "K♦")
 * @returns {boolean} - True if card is red
 */
export const isRedCard = (card) => {
  return card && (card.includes('♥') || card.includes('♦'));
};

/**
 * Formats time in 12-hour format with AM/PM
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Formatted time (e.g., "2:30 PM")
 */
export const formatTime12Hour = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};
```

### Example 2: Dependency injection pattern
```javascript
// src/utils/seatUtils.js

/**
 * Gets the next seat in clockwise order, skipping absent seats
 * @param {number} currentSeat - Current seat number
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {number} numSeats - Total number of seats (passed as param, not imported)
 * @returns {number} - Next active seat
 */
export const getNextActiveSeat = (currentSeat, absentSeats, numSeats) => {
  let seat = (currentSeat % numSeats) + 1;
  let attempts = 0;
  while (absentSeats.includes(seat) && attempts < numSeats) {
    seat = (seat % numSeats) + 1;
    attempts++;
  }
  return seat;
};
```

### Example 3: Array/object manipulation
```javascript
// src/utils/displayUtils.js

/**
 * Calculates total from rebuy transactions
 * @param {Array} rebuyTransactions - Array of {timestamp, amount} objects
 * @returns {number} - Total rebuy amount
 */
export const calculateTotalRebuy = (rebuyTransactions = []) => {
  if (!Array.isArray(rebuyTransactions)) return 0;
  return rebuyTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
};
```

## Good For Local Models
✅ Data transformations (like isRedCard, formatTime12Hour)
✅ Array/object manipulation (like calculateTotalRebuy)
✅ String formatting
✅ Simple calculations
✅ Validation helpers

## Bad For Local Models (Use Claude)
❌ Complex business logic
❌ State management
❌ Async operations / API calls
❌ Functions with side effects
❌ Multi-file coordination

## Task Format (Copy and fill in)
```
Create utility function {functionName} in src/utils/{fileName}.js

Purpose: {what it does}

Parameters:
- param1 ({type}): {description}
- param2 ({type}): {description}

Returns: {type} - {description}

Example usage:
{show example with input/output}

Edge cases to handle:
- {list edge cases}

REQUIREMENTS:
- Use named export: export const {functionName}
- Add JSDoc comment
- Handle null/undefined inputs gracefully
- Pure function (no side effects)
```
