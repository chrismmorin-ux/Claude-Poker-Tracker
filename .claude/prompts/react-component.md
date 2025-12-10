# React Component Prompt Template

## Project Context
- **Project**: Poker Tracker (React + Tailwind CSS)
- **UI Components**: `src/components/ui/` (reusable UI elements)
- **View Components**: `src/components/views/` (page-level views)
- **Export style**: Named exports ONLY (`export const ComponentName`)
- **Styling**: Tailwind CSS classes

## Import Path Rules (CRITICAL)
Count directories carefully from component location:
- From `src/components/ui/` to `src/utils/`: `'../../utils/fileName'`
- From `src/components/ui/` to `src/constants/`: `'../../constants/fileName'`
- From `src/components/views/` to `src/utils/`: `'../../utils/fileName'`
- From `src/components/views/` to `src/hooks/`: `'../../hooks/fileName'`
- From `src/components/views/` to `src/components/ui/`: `'../ui/ComponentName'`

## Code Template
```jsx
import React from 'react';
import { dependency } from '../../path/to/dependency';

/**
 * ComponentName - Brief description
 * @param {type} propName - Description
 */
export const ComponentName = ({
  prop1,
  prop2,
  prop3
}) => {
  return (
    <div className="tailwind-classes">
      {/* Component content */}
    </div>
  );
};
```

## Critical Rules (MUST FOLLOW)
1. **Named exports ONLY**: `export const Foo`, NEVER `export default Foo`
2. **Import paths**: Count `../` carefully (2 levels from ui/views to utils)
3. **Props for constants**: If you need ACTIONS, ACTION_ABBREV, SEAT_STATUS, pass as props
4. **Tailwind**: Space-separated classes in strings, avoid template literals for classes
5. **JSDoc**: Add brief comment above component with @param for each prop
6. **No inline styles**: Use Tailwind classes, only use style prop when necessary (e.g., dynamic values)

## Real Project Examples

### Example 1: Simple display component with config object
```jsx
// src/components/ui/PositionBadge.jsx
import React from 'react';

// Badge type configurations (local constant is OK for static config)
const BADGE_CONFIG = {
  dealer: {
    bg: 'bg-white',
    border: 'border-gray-800',
    text: 'text-black',
    label: 'D',
  },
  sb: {
    bg: 'bg-blue-400',
    border: 'border-blue-600',
    text: 'text-white',
    label: 'SB',
  },
  bb: {
    bg: 'bg-red-400',
    border: 'border-red-600',
    text: 'text-white',
    label: 'BB',
  },
};

/**
 * PositionBadge - Displays D, SB, BB, or ME indicators
 * @param {string} type - Badge type: 'dealer', 'sb', 'bb', 'me'
 * @param {string} size - 'small' (16px) for showdown view, 'large' (28px) for table view
 */
export const PositionBadge = ({ type, size = 'small' }) => {
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  const sizeClass = size === 'small' ? 'w-4 h-4' : 'w-7 h-7';
  const textSize = size === 'small' ? 'text-xs' : 'text-base';

  return (
    <div className={`${config.bg} rounded-full shadow flex items-center justify-center border-2 ${config.border} ${sizeClass}`}>
      <div className={`${textSize} font-bold ${config.text}`}>{config.label}</div>
    </div>
  );
};
```

### Example 2: Component with utility imports and props for constants
```jsx
// src/components/ui/ActionBadge.jsx
import React from 'react';
import { getActionColor, getActionAbbreviation } from '../../utils/actionUtils';
import { isFoldAction } from '../../constants/gameConstants';

/**
 * ActionBadge - Displays a single action as a colored badge
 * @param {string} action - Action constant (e.g., ACTIONS.OPEN)
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {Object} ACTIONS - Actions constants (passed as prop)
 * @param {Object} ACTION_ABBREV - Action abbreviations map (passed as prop)
 */
export const ActionBadge = ({ action, size = 'medium', ACTIONS, ACTION_ABBREV }) => {
  const sizeStyles = {
    small: 'h-5 min-w-[16px] text-xs px-1',
    medium: 'h-7 min-w-[20px] text-sm px-1.5',
    large: 'h-9 min-w-[24px] text-base px-2'
  };

  const colorClasses = getActionColor(action, isFoldAction, ACTIONS);
  const abbreviatedAction = getActionAbbreviation(action, ACTION_ABBREV);

  return (
    <div className={`inline-flex items-center justify-center rounded font-bold ${sizeStyles[size]} ${colorClasses}`}>
      {abbreviatedAction}
    </div>
  );
};
```

## Tailwind Classes Reference (Common Patterns)
```
Layout:     flex, inline-flex, items-center, justify-center, gap-2
Sizing:     w-4, h-4, w-full, min-w-[20px]
Spacing:    p-2, px-4, py-2, m-2, mx-auto
Text:       text-xs, text-sm, text-base, font-bold, text-white, text-gray-600
Background: bg-white, bg-gray-100, bg-blue-500, bg-red-400
Border:     border, border-2, border-gray-300, rounded, rounded-full
Shadow:     shadow, shadow-lg, shadow-xl
Interactive: cursor-pointer, hover:bg-gray-200, transition
```

## Good For Local Models
✅ Simple display components (badges, labels, status indicators)
✅ Static config-based components (like PositionBadge)
✅ Small components < 100 lines with < 5 props

## Bad For Local Models (Use Claude)
❌ Components with state (useState, useReducer)
❌ Components with effects (useEffect)
❌ Components that call hooks
❌ Components with complex event handling
❌ Components > 100 lines

## Task Format (Copy and fill in)
```
Create {ComponentName} component in src/components/ui/{ComponentName}.jsx

Purpose: {what it displays/does}

Props:
- prop1 ({type}): {description}
- prop2 ({type}): {description}

Imports needed:
- {list any utility imports with EXACT paths}

Visual spec:
- {describe the appearance}
- {Tailwind classes to use}

REQUIREMENTS:
- Use named export: export const {ComponentName}
- Import React from 'react'
- Add JSDoc comment with @param for each prop
- Use Tailwind CSS for styling
- Count import path levels carefully (../../ from ui/ to utils/)
```
