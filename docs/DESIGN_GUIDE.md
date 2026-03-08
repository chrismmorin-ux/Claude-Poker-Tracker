# Design Guide

Single source of truth for the app's visual system. All colors flow from `src/constants/designTokens.js`.

## Color System

### Where tokens live
- **`src/constants/designTokens.js`** - All hex values, helper functions
- Components consume tokens via `getActionBadgeStyle()`, `getActionGradient()`, `getActionSeatStyle()`, or direct imports

### How to add new colors
1. Add hex values to the appropriate section in `designTokens.js`
2. If needed, add a helper function that returns inline style objects
3. Components use `style={{ ... }}` instead of Tailwind color classes

## Action Colors

| Action | Base Hex | Dark Hex | Ring Hex | Usage |
|--------|----------|----------|----------|-------|
| fold   | `#dc2626` | `#b91c1c` | `#fca5a5` | Surrender actions |
| check  | `#0891b2` | `#0e7490` | `#67e8f9` | Pass (no bet) |
| call   | `#2563eb` | `#1d4ed8` | `#93c5fd` | Match bet |
| bet    | `#16a34a` | `#15803d` | `#86efac` | First chips in |
| raise  | `#ea580c` | `#c2410c` | `#fdba74` | Increase bet |
| won    | `#d4a847` | `#b8922e` | -         | Showdown winner |
| mucked | `#6b7280` | `#4b5563` | -         | Mucked hand |

### Helper functions
- `getActionGradient(action)` - CSS gradient string for buttons
- `getActionBadgeStyle(action)` - `{ backgroundColor, color }` for badges
- `getActionSeatStyle(action)` - `{ bg, ring }` hex values for seats

## Player Style Colors

### Dark theme (StatsView badges)
| Style | Background | Text |
|-------|-----------|------|
| Fish | `rgba(127,29,29,0.5)` | `#fca5a5` |
| LAG | `rgba(124,45,18,0.5)` | `#fdba74` |
| LP | `rgba(113,63,18,0.5)` | `#fde68a` |
| Nit | `rgba(30,58,138,0.5)` | `#93c5fd` |
| TAG | `rgba(20,83,45,0.5)` | `#86efac` |
| Reg | `rgba(88,28,135,0.5)` | `#d8b4fe` |
| Unknown | `#374151` | `#9ca3af` |

### Light context (PlayerRow, TendencyStats)
| Semantic | Styles | Background | Text |
|----------|--------|-----------|------|
| Exploitable | Fish, LP | `#dcfce7` | `#15803d` |
| Regular | TAG, Reg | `#fef9c3` | `#a16207` |
| Dangerous | LAG, Nit | `#fee2e2` | `#b91c1c` |

## Exploit Category Colors

| Category | Badge BG | Badge Text | Card BG | Card Text | Card Border |
|----------|----------|-----------|---------|-----------|-------------|
| weakness | `#ef4444` | `#ffffff` | `#fee2e2` | `#b91c1c` | `#fecaca` |
| strength | `#3b82f6` | `#ffffff` | `#dbeafe` | `#1d4ed8` | `#bfdbfe` |
| tendency | `#facc15` | `#111827` | `#fef9c3` | `#a16207` | `#fde68a` |
| note | `#9ca3af` | `#ffffff` | `#f3f4f6` | `#4b5563` | `#e5e7eb` |

## Button Variants

| Variant | BG | Hover | Text |
|---------|-----|-------|------|
| primary | `#2563eb` | `#1d4ed8` | `#ffffff` |
| danger | `#dc2626` | `#b91c1c` | `#ffffff` |
| secondary | `#374151` | `#4b5563` | `#e5e7eb` |
| success | `#16a34a` | `#15803d` | `#ffffff` |
| gold | `#d4a847` | `#b8922e` | `#1a1200` |

## Navigation Colors

| Screen | Base | Hover |
|--------|------|-------|
| stats | `#2563eb` | `#1d4ed8` |
| history | `#9333ea` | `#7e22ce` |
| sessions | `#ea580c` | `#c2410c` |
| players | `#0d9488` | `#0f766e` |
| analysis | `#4f46e5` | `#4338ca` |
| settings | `#4b5563` | `#6b7280` |

## Screen Layout

All views wrap content in `<ScaledContainer scale={scale}>`:
```jsx
<ScaledContainer scale={scale}>
  <div className="bg-gray-900 overflow-y-auto p-6"
    style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}>
    {/* content */}
  </div>
</ScaledContainer>
```

- `LAYOUT.TABLE_WIDTH = 1600`
- `LAYOUT.TABLE_HEIGHT = 720`
- Background: `bg-gray-900` (all screens)
- Scale formula: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`

## Typography

- **Screen headers**: `text-2xl font-bold text-white`
- **Section titles**: `text-lg font-bold` with `style={{ color: '#d4a847' }}` (gold accent)
- **Body text**: `text-gray-300` / `text-gray-200`
- **Muted text**: `text-gray-400` / `text-gray-500`
- **Back buttons**: `bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg font-medium`

## Component Patterns

### Badges
Use inline styles from `getActionBadgeStyle()`:
```jsx
<div className="rounded font-bold" style={getActionBadgeStyle(action)}>
  {label}
</div>
```

### Overlays (showdown)
```jsx
<div style={{ backgroundColor: OVERLAY_COLORS.folded }}>FOLD</div>
```

### Seat coloring
`useSeatColor` returns `{ className, style }`:
```jsx
const seatColor = getSeatColor(seat);
<button className={`... ${seatColor.className}`} style={{ ...seatColor.style }} />
```

### Action buttons (CommandStrip)
```jsx
style={{ background: getActionGradient(action) }}
```
