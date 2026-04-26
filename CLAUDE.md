# WARDOGS — Claude Code Project Intelligence

## What is this?

WARDOGS is a mobile-first physics-based word game (React + TypeScript + Matter.js). Players drag across physically touching letter balls in a bucket to form words. It includes a Cloudflare Workers backend with D1 database, WebSocket multiplayer via Durable Objects, and i18n (FR/EN).

## Tech Stack

- **Frontend:** React 19, TypeScript 6, Vite 8, Matter.js 0.20
- **Backend:** Cloudflare Workers + D1 + Durable Objects (plain JS, `worker/`)
- **Styling:** Vanilla CSS, mobile-first dark theme
- **Testing:** Vitest + React Testing Library + happy-dom
- **Linting:** ESLint (flat config) + Prettier
- **CI:** GitHub Actions (lint, type-check, test, build)

## Commands

```bash
npm run dev          # Vite dev server on :3000
npm run build        # tsc + vite build -> dist/
npm run preview      # Preview production build
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npm run test:coverage # Vitest with coverage
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run format:check # Prettier check (CI)
npm run typecheck    # tsc --noEmit
npm run ci           # Full CI: lint + typecheck + test + build
```

### Worker (backend)

```bash
cd worker
npx wrangler dev     # Local dev
npx wrangler deploy  # Deploy to Cloudflare
```

## Architecture

```
src/
  App.tsx              — Screen state machine (splash→auth→menu→game→gameover)
  components/          — React screens (7 total), pure presentation
  game/                — Imperative game engine (NOT React)
    engine.ts          — Core loop: physics, rendering, combos, power-ups, slow-mo (679 lines)
    input.ts           — Touch/mouse word selection with adjacency checking
    letter.ts          — Weighted letter generation with vowel forcing
    scoring.ts         — Scrabble-style points with combo/powerup multipliers
    dictionary.ts      — Word validation with prefix-based fast checking
    seededRng.ts       — Deterministic PRNG (mulberry32) for replays + multiplayer
    types.ts           — All shared TypeScript interfaces
  api/client.ts        — REST client (auth, scores, leaderboard)
  multiplayer/client.ts — WebSocket matchmaking client
  i18n/index.ts        — FR/EN translations, letter weights, Scrabble points
public/dictionaries/   — fr.json (~85K words), en.json (~115K words) — refresh via `npm run fetch-dicts`
worker/
  src/index.js         — REST API + Matchmaker Durable Object
  schema.sql           — D1 schema (users, scores tables)
```

## Key Design Decisions

- **React + Canvas hybrid:** React manages screens; the game engine is fully imperative canvas (decoupled from React lifecycle).
- **engine.ts touches the DOM directly** — it reads `document.getElementById` for the canvas and score elements. Tests for engine logic must mock the DOM or test extracted pure functions.
- **Module-level mutable state** — `dictionary.ts`, `letter.ts`, `i18n/index.ts`, and `api/client.ts` all use module-level variables. Tests must reset state between runs (call `resetLetterHistory()`, reload dictionary, etc).
- **`getLangConfig()` is called at runtime** — scoring, letter generation, and dictionary all depend on the current language. Tests should set language explicitly via `setLang()` before running.
- **Seeded PRNG** — `SeededRng` is deterministic. Same seed = same sequence. Tests can assert exact outputs for a given seed.

## Testing Conventions

- Tests live in `src/__tests__/` organized by module (e.g., `scoring.test.ts`, `dictionary.test.ts`)
- Use `vi.mock()` for modules with side effects (localStorage, fetch, DOM)
- Component tests use `@testing-library/react` with happy-dom
- Game engine pure functions are tested directly; DOM-dependent functions are tested via integration or mocked
- Run `npm test` before committing

## Code Style

- Borderlands easter egg comments throughout (keep them, they're intentional)
- Terse, functional style — short variable names in rendering code is fine
- No CSS framework — all styles in `src/styles/index.css`
- Backend is vanilla JS (no TypeScript) — keep it that way for Cloudflare compatibility

## Gotchas

- `public/favicon.png` is 5.7MB — don't accidentally re-add it if optimized
- `js/` and `css/` and `data/` at root are **legacy vanilla JS** — NOT used by the Vite build. Don't modify them.
- `worker/wrangler.toml` contains production D1 database ID — don't change it
- The dictionary loads via fetch (remote GitHub first, then local). In tests, mock `fetch` or use `buildSets()` directly.
- `i18n/index.ts` reads `localStorage` at module load — tests need to mock localStorage before importing
