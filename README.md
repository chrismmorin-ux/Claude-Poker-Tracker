# Poker Tracker

A React-based poker hand tracker for live 9-handed games.

## Features

- **Table View**: 9-seat poker table with auto-selection workflow
- **Card Selector**: Full-screen card assignment for board and hole cards
- **Showdown View**: Card assignment + hand history summary for all 9 players
- **Stats View**: Player statistics display (placeholder)

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Lucide React (icons)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
poker-tracker/
├── src/
│   ├── PokerTracker.jsx    # Main component (single file)
│   ├── main.jsx            # Entry point
│   └── index.css           # Tailwind imports
├── docs/
│   ├── SPEC.md             # Complete specification
│   ├── CHANGELOG.md        # Version history
│   └── QUICK_REF.md        # Quick reference card
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Version

Current: v103 (All refactoring complete)

## Documentation

See the `docs/` folder for:
- **SPEC.md** - Complete specification (~3k tokens) - READ FIRST
- **CHANGELOG.md** - Version history and changes
- **QUICK_REF.md** - Fast reference for development

## Development Notes

- Single-file component architecture (~1957 lines)
- All constants extracted to top of file
- 11 helper functions outside component
- 4 reusable UI components (CardSlot, PositionBadge, etc.)
- Debug mode: Set `DEBUG = false` at line 8 to disable logging

## License

Private project
