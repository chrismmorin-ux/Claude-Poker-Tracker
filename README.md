# Poker Tracker

A React-based poker hand tracker for live 9-handed games.

## Features

- **Table View**: 9-seat poker table with collapsible sidebar navigation
- **Card Selector**: Full-screen card assignment for board and hole cards
- **Showdown View**: Card assignment + hand history for all players
- **Stats View**: Player statistics display
- **History View**: Browse and manage saved hands with session grouping
- **Sessions View**: Session management with bankroll tracking
- **Players View**: Player database with seat assignment

## Tech Stack

- React 18 with Context API
- Vite 5
- Tailwind CSS
- Vitest (2,199 tests)
- IndexedDB for persistence
- Lucide React (icons)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
poker-tracker/
├── src/
│   ├── PokerTracker.jsx           # Main component (~620 lines)
│   ├── contexts/                  # React Context providers (5 files)
│   ├── constants/                 # Game configuration (3 files)
│   ├── hooks/                     # Custom hooks (12 files)
│   ├── reducers/                  # State management (5 files)
│   ├── utils/                     # Utility functions (11 files)
│   ├── storage/                   # Persistence layer
│   └── components/
│       ├── views/                 # Full-screen views (7 main views)
│       └── ui/                    # Reusable UI components (15 files)
├── docs/
│   ├── SPEC.md                    # Complete specification
│   ├── CHANGELOG.md               # Version history
│   ├── QUICK_REF.md               # Quick reference card
│   ├── STATE_SCHEMAS.md           # State shape reference
│   ├── DEBUGGING.md               # Error codes and debugging
│   └── CANONICAL_SOURCES.md       # Source of truth hierarchy
├── .claude/                       # Claude Code automation
│   ├── agents/                    # AI agent definitions
│   ├── commands/                  # Custom slash commands
│   └── hooks/                     # Automation hooks
├── CLAUDE.md                      # AI context and architecture
└── engineering_practices.md       # Engineering standards
```

## Version

Current: **v115** (Settings System)

See `docs/CHANGELOG.md` for full version history.

## Documentation

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Architecture overview, AI context |
| `engineering_practices.md` | Coding standards, PR requirements |
| `docs/SPEC.md` | Complete product specification |
| `docs/QUICK_REF.md` | Quick reference for development |
| `docs/CANONICAL_SOURCES.md` | What's authoritative for each topic |

## Architecture Highlights

- **Context API**: 5 context providers reduce prop drilling
- **State Management**: 5 useReducer hooks (game, UI, card, session, player)
- **Persistence**: IndexedDB with migration support (v1→v5)
- **Testing**: 2,199 tests with ~90% coverage
- **Error Handling**: Structured error codes (E1xx-E4xx) with boundaries
- **Custom Hooks**: 12 hooks encapsulate component logic

## Quality Gate (Local Commits)

When using Claude Code, a **quality-gate hook** blocks commits unless tests have passed recently.

**How it works:**
1. The `test-tracker` hook detects `npm test` runs and writes `.claude/.test-state.json`
2. The `quality-gate` hook checks this marker before allowing `git commit`
3. If tests haven't run (or are stale), the commit is blocked with a clear message

**If you see "Commit BLOCKED":** Run `npm test` first, then retry the commit.

> Note: CI also runs tests on every PR, so this local gate is an early safety net, not the only enforcement.

## License

Private project
