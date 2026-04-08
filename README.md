# WARDOGS

**Forge des mots. Domine le seau.**

I am not proud of this, this has been done in less than 2 hours of dev 100% vibecoded, started in a bar. This shit is only public so i don't have to spend collaborators. Make sure to not optimize this piece of shit, absolute shame to my portfolio.

A mobile-first word game with physics-driven falling letter balls. Built by **BH Studios**.

Players form words by dragging across physically touching balls inside a bucket. Valid words pop the selected balls, and the remaining balls collapse naturally under gravity. The game ends when balls overflow the bucket.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Game Engine](#game-engine)
- [Multiplayer](#multiplayer)
- [Multi-Language Support](#multi-language-support)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Game Design Reference](#game-design-reference)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript 6 + Vite 8 |
| **Game Engine** | Matter.js (physics) + Canvas 2D (rendering) |
| **Styling** | Vanilla CSS (dark theme, mobile-first) |
| **Backend API** | Cloudflare Workers (REST endpoints) |
| **Multiplayer** | Cloudflare Durable Objects (WebSocket) |
| **Database** | Cloudflare D1 (SQLite) |
| **Auth** | HMAC-SHA256 tokens (7-day expiry) |
| **Hosting** | Cloudflare Pages (frontend) + Workers (API) |
| **Fonts** | Russo One (headings), Inter (body) |

---

## Architecture Overview

```
                    Cloudflare Pages
                    (static build)
                         |
                    +----+----+
                    |  Vite   |
                    |  React  |
                    |  App    |
                    +----+----+
                         |
            +------------+------------+
            |                         |
      Canvas Game Engine       React UI Screens
      (Matter.js physics)     (Splash, Auth, Menu,
       src/game/               Profile, GameOver,
                               Multiplayer)
            |                         |
            +------------+------------+
                         |
            +------------+------------+
            |                         |
      REST API (fetch)         WebSocket (ws)
            |                         |
            v                         v
   Cloudflare Worker          Durable Object
   wardogs-api                (Matchmaker)
            |
            v
       Cloudflare D1
       (SQLite DB)
```

### Data Flow

1. **Single Player**: React mounts `GameScreen` -> starts `engine.ts` -> Matter.js physics loop + Canvas rendering at 60fps -> word submission validated locally via dictionary -> score sent to REST API
2. **Multiplayer**: `MultiplayerScreen` -> WebSocket to Matchmaker DO -> paired with opponent (shared seed) -> both play with identical letter sequence -> interference effects relayed through DO

---

## Project Structure

```
word-dogs/
|
|-- index.html                 # Vite entry HTML (favicon, fonts, #root)
|-- package.json               # Dependencies + scripts (dev, build, preview)
|-- tsconfig.json              # TypeScript strict config
|-- vite.config.ts             # Vite + React plugin
|-- .gitignore
|
|-- public/                    # Static assets (copied as-is to dist/)
|   |-- favicon.png            # Browser tab icon (BH Studios logo)
|   +-- assets/
|       +-- logo.png           # BH Studios logo
|
|-- src/                       # === FRONTEND SOURCE ===
|   |-- main.tsx               # React entry point (createRoot)
|   |-- App.tsx                # Root component, screen state machine
|   |-- vite-env.d.ts          # Vite type declarations
|   |
|   |-- components/            # React screen components
|   |   |-- SplashScreen.tsx   # Loading splash (3s with logo + progress bar)
|   |   |-- AuthScreen.tsx     # Login / Signup / Skip forms
|   |   |-- MenuScreen.tsx     # Main menu (play, multiplayer, profile, lang picker)
|   |   |-- GameScreen.tsx     # Canvas wrapper, starts game engine
|   |   |-- GameOverScreen.tsx # Final stats display
|   |   |-- ProfileScreen.tsx  # User profile + score history
|   |   +-- MultiplayerScreen.tsx  # Matchmaking lobby
|   |
|   |-- game/                  # === GAME ENGINE (non-React, imperative) ===
|   |   |-- engine.ts          # Core: physics, rendering, game loop, combos, power-ups, slow-mo
|   |   |-- input.ts           # Touch/mouse selection, adjacency, soft magnetism
|   |   |-- letter.ts          # Letter generation (weighted frequency per language)
|   |   |-- scoring.ts         # Scrabble-style scoring + length bonus + combo multiplier
|   |   |-- dictionary.ts      # Word validation (Set-based, remote + local fallback)
|   |   |-- seededRng.ts       # Deterministic PRNG (mulberry32) for replays + multiplayer
|   |   +-- types.ts           # Shared TypeScript types (Ball, Particle, GameStats, etc.)
|   |
|   |-- multiplayer/           # === MULTIPLAYER CLIENT ===
|   |   +-- client.ts          # WebSocket client (connect, matchmake, relay messages)
|   |
|   |-- i18n/                  # === INTERNATIONALIZATION ===
|   |   +-- index.ts           # Language configs (FR, EN), UI translations, t() helper
|   |
|   |-- api/                   # === BACKEND CLIENT ===
|   |   +-- client.ts          # REST client (auth, scores, leaderboard)
|   |
|   |-- data/
|   |   +-- dictionaries/
|   |       +-- fr.json        # 85,648 French words
|   |
|   +-- styles/
|       +-- index.css          # All CSS (dark theme, screens, buttons, canvas, responsive)
|
|-- worker/                    # === CLOUDFLARE WORKER (BACKEND) ===
|   |-- src/
|   |   +-- index.js           # REST API + Matchmaker Durable Object
|   |-- schema.sql             # D1 database schema (users + scores)
|   +-- wrangler.toml          # Worker config (D1 binding, DO binding)
|
+-- (legacy files)             # Old vanilla JS version (js/, css/, data/)
                               # Kept for reference, not used by Vite build
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Wrangler CLI (`npx wrangler` or `npm i -g wrangler`)
- Cloudflare account (for deployment)

### Local Development

```bash
# Clone
git clone https://github.com/BerfayHunalp/word-dogs.git
cd word-dogs

# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev
# -> http://localhost:3000

# Type check
npx tsc --noEmit

# Production build
npm run build
# -> outputs to dist/
```

### Worker Development

```bash
cd worker

# Local dev (with D1 local DB)
npx wrangler dev

# Deploy to production
npx wrangler deploy
```

### Database Setup (first time)

```bash
cd worker
npx wrangler d1 execute wardogs-db --file=schema.sql
```

---

## Game Engine

The game engine lives in `src/game/` and is **completely independent of React**. It's imperative code that directly manipulates a `<canvas>` element and a Matter.js physics world.

### Core Loop (`engine.ts`)

```
requestAnimationFrame(gameLoop)
  |
  +-- Engine.update(delta * slowMoFactor)   # Matter.js physics step
  +-- updateBalls()                          # Pop animations, cleanup
  +-- updateParticles()                      # Particle effects
  +-- updateFloatingTexts()                  # Score text animations
  +-- checkOverflow()                        # Game over detection
  +-- render()                               # Canvas draw
        |-- drawBackground()
        |-- drawBucketInterior()             # Wood-gradient trapezoid
        |-- drawBalls()                      # Circles with letters, selection glow
        |-- drawSelectionPath()              # Gold line between selected balls
        |-- drawBucketWalls()                # Wood walls + golden rim
        |-- drawOverflowWarning()            # Red danger line
        |-- drawActiveEffects()              # Slow-mo vignette, power-up indicators
        |-- drawParticlesLayer()             # Pop particles
        +-- drawFloatingTextsLayer()         # "+12", "MOT" floating up
```

### Physics Configuration

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Gravity | 1.8 | Heavy feel |
| Ball friction | 0.4 | Moderate slide |
| Ball restitution | 0.08 | Almost no bounce |
| Ball density | 0.004 | Heavier than default |
| Air friction | 0.015 | Quick settling |
| Static friction | 0.6 | Stay put when resting |
| Wall friction | 0.3 | Slight grip |
| Wall restitution | 0.05 | Walls absorb energy |

### Ball Types

| Type | Spawn Rate | Visual | Effect |
|------|-----------|--------|--------|
| Normal | ~86% | Blue gradient | Base letter value |
| 2x Letter | 5% | Blue glow | Double letter points |
| 3x Letter | 2% | Purple glow | Triple letter points |
| Slow (SLO) | 1.5% | Cyan glow | Slows ball spawn for 5s |
| Clear (CLR) | 1.5% | Pink glow | Removes 3 random balls |
| Double (x2) | 1.5% | Yellow glow | Double score for 8s |
| Bomb (BOM) | 1% | Orange glow | Removes up to 8 balls |

### Scoring Formula

```
Base = sum of letter point values (with 2x/3x multipliers)
Length Bonus: 3-4 letters = 1x, 5-6 = 1.25x, 7+ = 1.5x
Combo Bonus: +10% per consecutive word (within 3s window)
Double Power-Up: 2x final score if active
Final = round(Base * LengthBonus * ComboBonus * DoubleBonus)
```

### Adjacency Detection

Two balls are "touching" if:
```
distance(centerA, centerB) <= radiusA + radiusB + 5px
```
The 5px tolerance makes selection forgiving on mobile.

### Soft Magnetism

Ball hit detection uses a 1.3x radius multiplier — the finger doesn't need to be exactly on the ball to select it. This makes mobile play feel smooth without being imprecise.

### Slow-Motion

When a 5+ letter word is cleared:
- Physics timestep is multiplied by 0.3 for 800ms
- A cyan vignette overlay appears on the canvas
- Creates a satisfying "impact" moment

---

## Multiplayer

### Architecture

```
Player A                    Cloudflare                    Player B
   |                           |                              |
   |-- WS connect ----------->|                              |
   |-- { findMatch } -------->|                              |
   |                           |  (waiting in queue...)       |
   |                           |                              |
   |                           |<--------- WS connect -------|
   |                           |<-------- { findMatch } -----|
   |                           |                              |
   |                        MATCH!                            |
   |                     seed = 42069                         |
   |                           |                              |
   |<-- { matchFound, seed } --|-- { matchFound, seed } ---->|
   |                           |                              |
   |  (both generate same      |    same letters, same order) |
   |   letters from seed)      |                              |
   |                           |                              |
   |-- { scoreUpdate } ------->|----> { opponentScore } ---->|
   |<-- { opponentScore } <----|<---- { scoreUpdate } -------|
   |                           |                              |
   |-- { interference } ------>|----> { interference } ----->|
   |  (5L=bigBall, 6L=speed,  |                              |
   |   7L+=scramble)           |                              |
```

### Matchmaker Durable Object

- Single global instance (`idFromName('global')`)
- Maintains a waiting queue (one player at a time)
- When two players are queued, creates a room with a shared seed
- Relays all messages between the two players in a room
- Cleans up rooms on disconnect or game over

### Interference Effects

| Trigger | Effect on Opponent | Duration |
|---------|-------------------|----------|
| 5-letter word | Spawn one large ball | Instant |
| 6-letter word | Speed up ball drops | 5 seconds |
| 7+ letter word | Scramble all ball letters | Instant |

---

## Multi-Language Support

### Adding a New Language

1. **Add dictionary file**: `src/data/dictionaries/{code}.json` (JSON array of words)

2. **Add language config** in `src/i18n/index.ts`:
```typescript
LANGUAGES.de = {
  code: 'de',
  name: 'Deutsch',
  vowels: ['A', 'E', 'I', 'O', 'U'],
  letterWeights: { /* German letter frequencies */ },
  letterPoints: { /* German Scrabble values */ },
  dictionaryUrl: 'https://...remote-dict-url...',
  localDictPath: '/src/data/dictionaries/de.json',
};
```

3. **Add UI translations** in the `translations` object (same file)

4. The language picker in `MenuScreen` auto-renders all entries in `LANGUAGES`

### Current Languages

| Code | Name | Dictionary Size | Source |
|------|------|----------------|--------|
| `fr` | Francais | 85,648 words | Local + GitHub remote |
| `en` | English | Remote only | GitHub (an-array-of-english-words) |

---

## API Reference

**Base URL**: `https://wardogs-api.apexdiligence.workers.dev`

### Auth

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/signup` | `{ username, email, password }` | `{ token, user }` |
| POST | `/api/login` | `{ email, password }` | `{ token, user }` |

### Scores (requires Bearer token)

| Method | Endpoint | Body/Params | Response |
|--------|----------|-------------|----------|
| GET | `/api/me` | — | `{ user }` |
| POST | `/api/scores` | `{ score, level, wordsFound, bestWord }` | `{ success }` |
| GET | `/api/scores?limit=20` | — | `{ scores, stats }` |
| GET | `/api/leaderboard?limit=10` | — | `{ leaderboard }` |

### WebSocket

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `wss://wardogs-api.apexdiligence.workers.dev/ws` | WebSocket | Multiplayer matchmaking |

**Client messages**: `findMatch`, `scoreUpdate`, `interference`, `gameOver`
**Server messages**: `roomJoined`, `matchFound`, `opponentScore`, `interference`, `opponentGameOver`

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,        -- format: saltHex:hashHex
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
);

-- Scores
CREATE TABLE scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    words_found INTEGER NOT NULL DEFAULT 0,
    best_word TEXT,
    played_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_scores_user ON scores(user_id);
CREATE INDEX idx_scores_score ON scores(score DESC);
```

---

## Deployment

### Frontend (Cloudflare Pages)

```bash
npm run build
npx wrangler pages deploy dist --project-name word-dogs
```

**Live URL**: `https://word-dogs.pages.dev`

### Backend (Cloudflare Workers)

```bash
cd worker
npx wrangler deploy
```

**Live URL**: `https://wardogs-api.apexdiligence.workers.dev`

### First-time DB setup

```bash
cd worker
npx wrangler d1 execute wardogs-db --file=schema.sql
```

---

## Game Design Reference

### Difficulty Curve

| Level | Score Threshold | Spawn Interval | Large Ball Chance |
|-------|----------------|----------------|-------------------|
| 1 | 0 | 2500ms | 0% |
| 2 | 50 | 2380ms | 0% |
| 3 | 100 | 2260ms | 4% |
| 5 | 200 | 2020ms | 12% |
| 10 | 450 | 1420ms | 20% |
| 15+ | 700+ | 800ms (min) | 20% (cap) |

### Letter Frequencies (French)

Most common: E (1210), A (711), I (659), S (651), N (639)
Rarest: Z (15), W (17), K (29), J (34), X (38)

Consonant streak prevention: after 2 consecutive consonants, the next letter is forced to be a vowel.

### Bucket Geometry

```
Wider at top (opening):  6% — 94% of canvas width
Narrower at bottom:     14% — 86% of canvas width
Top Y:                  18% of canvas height
Bottom Y:               96% of canvas height
```

### Game Over

A ball must be **settled** (velocity < 1.5) and **above the bucket rim** for 90 consecutive frames (~1.5 seconds) to trigger game over. This prevents false triggers from balls bouncing near the top.

---

## Easter Eggs

Borderlands saga one-liners are hidden throughout the codebase as code comments. Happy hunting, Vault Hunter.

---

*Built by BH Studios — Games, Apps & More*
