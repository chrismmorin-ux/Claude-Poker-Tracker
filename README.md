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
│   ├── PokerTracker.jsx         # Main component (~620 lines)
│   ├── constants/
│   │   └── gameConstants.js     # Game configuration
│   ├── hooks/                   # Custom hooks (7 files)
│   │   ├── useActionUtils.js
│   │   ├── useStateSetters.js
│   │   ├── useSeatUtils.js
│   │   ├── useSeatColor.js
│   │   ├── useShowdownHandlers.js
│   │   ├── useCardSelection.js
│   │   └── useShowdownCardSelection.js
│   ├── reducers/                # State management (3 files)
│   │   ├── gameReducer.js
│   │   ├── uiReducer.js
│   │   └── cardReducer.js
│   ├── utils/                   # Utility functions (5 files)
│   │   ├── actionUtils.js
│   │   ├── cardUtils.js
│   │   ├── seatUtils.js
│   │   ├── displayUtils.js
│   │   └── validation.js
│   ├── components/
│   │   ├── views/               # Full-screen views (4 files)
│   │   └── ui/                  # Reusable UI (5 files)
│   ├── main.jsx                 # Entry point
│   └── index.css                # Tailwind imports
├── docs/
│   ├── SPEC.md                  # Complete specification
│   ├── CHANGELOG.md             # Version history
│   └── QUICK_REF.md             # Quick reference card
├── CLAUDE.md                    # Project context for AI
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Version

Current: **v108** (Custom Hooks Extraction - 36% reduction)

Previous versions:
- v107: Utils integration
- v106: State management refactoring (useReducer)
- v105: Component extraction
- v104: Mobile optimization
- v103: Full refactoring

## Documentation

See the `docs/` folder for:
- **SPEC.md** - Complete specification
- **CHANGELOG.md** - Version history and changes (includes v108 details)
- **QUICK_REF.md** - Fast reference for development

Also see:
- **CLAUDE.md** - Complete project context and architecture documentation

## Architecture Highlights

- **Modular design**: Main component reduced from 967 to 620 lines (36%)
- **Custom hooks**: 7 hooks encapsulate component logic
- **State management**: 3 useReducer hooks (game, UI, card state)
- **Pure utilities**: 5 utility modules for reusable functions
- **Component library**: 9 reusable components (4 views + 5 UI)
- **Constants**: Centralized game configuration
- **Debug mode**: Set `DEBUG = false` in PokerTracker.jsx to disable logging

## License

Private project
