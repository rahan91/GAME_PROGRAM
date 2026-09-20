# GAME PROGRAM — Product Requirements Document

## Overview

Browser-based arcade platform with 6 single-player games, 2 multiplayer games, a cosmetic shop, leaderboards, and an admin panel. Users earn points from games, spend them on cosmetics, and compete on ELO leaderboards.

**Live URL:** https://game-program.pages.dev  
**Stack:** Cloudflare Pages (static + Workers functions) + D1 SQLite database  
**Auth:** Stateless HMAC-SHA256 signed cookies (no session DB writes)

---

## Architecture

### Frontend (Static)
10 HTML pages, each self-contained with inline `<script>`. Shared CSS (`crt.css`, `ui.css`) and JS (`score.js`, `scoring.js`, `shop.js`, `crt.js`, `cursor.js`).

### Backend (Cloudflare Workers Functions)
32 API endpoints under `/api/*`. File-based routing via `_routes.json`:
- `include: ["/api/*"]` → routed to `functions/`
- `exclude: ["/assets/*"]` → static

### Database
Cloudflare D1 (SQLite). 18+ tables across 13 migrations. All in `migrations/` directory.

---

## Games

### Single-Player Games
| Game | File | Description |
|---|---|---|
| Maze | `maze.html` | Navigate a procedural maze. Score based on time + efficiency. |
| Target | `target.html` | Click targets. Score based on accuracy + speed. |
| Button | `button.html` | Hold/release button game. Score based on timing precision. |
| Cut | `cut.html` | Memory cut-out puzzle. Score = IoU accuracy × difficulty multiplier. |
| Circle | `circle.html` | Draw a perfect circle. Score = circularity metric (least-squares fit via `vendor/circle-fit.js`). |

### Multiplayer Games
| Game | File | Transport | Tick Rate |
|---|---|---|---|
| Pong | `pong.html` | HTTP polling (POST every 33ms) | Server-authoritative, subdivided physics steps |
| Tron | `tron.html` | HTTP polling (POST every 33ms) | Server-authoritative grid movement |

Both multiplayer games use:
- 6-char alphanumeric room codes
- 2-16 players per room
- Host controls start/rematch
- Server-side game state in D1
- ELO rating system

**Pong specifics:**
- Modes: FFA (2 players), Teams (left/right), Quads (4 sides)
- Speed settings: slow/medium/fast
- Rounds to win: configurable (default 3)
- Ball physics tick server-side on every POST poll
- Paddle position tracked in DB (`paddle_y` column)
- Ball position in `pong_ball` table

**Tron specifics:**
- Grid-based movement (up/down/left/right)
- Dynamic grid size based on max players
- Trail collision = death
- Last player alive wins

---

## Auth System

| Property | Value |
|---|---|
| Token format | `{payloadB64}.{hmacSHA256}` |
| Payload | `{ v:1, uid:userId, exp:expiresAt }` |
| Cookie | `game_session`, HttpOnly, SameSite=Lax, 30-day expiry |
| Password | bcryptjs, 10 salt rounds |
| Secret | `env.SESSION_SECRET` → `env.JWT_SECRET` → hardcoded fallback |

**Zero-write auth:** Login/register are the ONLY endpoints that write to the DB for session purposes. All other auth checks are stateless HMAC verification.

**Test credentials:** `test` / `test1234`, `player2test` / `testpass123`

---

## Database Tables

### Core
| Table | Purpose |
|---|---|
| `users` | id, username (unique), email, password_hash, created_at |
| `sessions` | **VESTIGIAL** — exists but unused (auth is HMAC cookie-based) |
| `scores` | user_id, total points, plays, spent, updated_at |
| `game_plays` | per-game play counters (auto-reset hourly) |
| `site_meta` | key/value config store |

### Shop
| Table | Purpose |
|---|---|
| `purchases` | PK(user_id, item_key) — what user owns |
| `equips` | PK(user_id, slot) — what's equipped per slot |
| `user_settings` | left_handed, cursor_style, auto_ready |

### Game Stats
| Table | Purpose |
|---|---|
| `game_stats` | PK(user_id, game) — per-game total/plays/best |
| `cut_runs` | Individual cut game runs with difficulty, accuracy, points |
| `circle_runs` | Individual circle runs with accuracy, coverage, points |

### Multiplayer — Pong
| Table | Purpose |
|---|---|
| `pong_rooms` | Room state: code, mode, status, host, scores, speed, rounds_target, last_tick_at |
| `pong_players` | Player in room: side, paddle_y, dir, alive, ready, color |
| `pong_ball` | PK(room_id) — single ball per room: x, y, vx, vy, speed |

### Multiplayer — Tron
| Table | Purpose |
|---|---|
| `tron_rooms` | Room state: code, status, host, grid_w, grid_h, speed |
| `tron_players` | Player in room: x, y, dir, alive, ready, color, trail (JSON) |

### ELO
| Table | Purpose |
|---|---|
| `elo_ratings` | PK(user_id, game) — rating, games, wins, losses, is_provisional |
| `elo_matches` | Match history with rating changes |

---

## API Endpoints (32 total)

### Auth (4)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/register` | Create account (username 3-24 chars, password 8+), returns session |
| POST | `/api/login` | Login (accepts `login` field, NOT `username`), returns session |
| POST | `/api/logout` | Clears cookie |
| GET | `/api/me` | Returns user + total/plays/spent/balance |

### Scores (4)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/score` | Submit points (max 100k), updates scores + game_stats + game_plays |
| GET | `/api/leaderboard` | Global leaderboard (`?game=&metric=&limit=`) |
| GET | `/api/plays` | Game play counts |
| POST | `/api/score/reset` | Reset user's scores/purchases/equips |

### Cut Game (2)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/cut/record` | Record run (difficulty, accuracy, points, elapsed) |
| GET | `/api/cut/leaderboard` | Per-difficulty leaderboard with percentile |

### Circle Game (2)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/circle/record` | Record run (accuracy, coverage, points, elapsed) |
| GET | `/api/circle/leaderboard` | Leaderboard with percentile |

### Pong (5)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/pong/room` | Room CRUD: create/join/leave/ready/start/rematch |
| POST | `/api/pong/move` | Update paddle direction |
| GET+POST | `/api/pong/state` | Get state + server tick (POST also updates dir) |
| POST | `/api/pong/elo` | Calculate + persist ELO changes |
| GET | `/api/pong/leaderboard` | ELO leaderboard |

### Tron (5)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/tron/room` | Room CRUD: create/join/leave/ready/start/end/rematch |
| POST | `/api/tron/move` | Update direction |
| GET+POST | `/api/tron/state` | Get state + server tick |
| POST | `/api/tron/elo` | Calculate + persist ELO changes |
| GET | `/api/tron/leaderboard` | ELO leaderboard |

### Shop (3)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/shop/state` | Owned items, equipped items, balance |
| POST | `/api/shop/buy` | Purchase (deducts balance = total - spent) |
| POST | `/api/shop/equip` | Equip/unequip item in slot |

### Settings (1)
| Method | Endpoint | Description |
|---|---|---|
| GET+POST | `/api/settings` | Read/update user settings |

### Admin (6) — requires username `ruruskaado`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users with scores |
| POST | `/api/admin/adjust` | Delta-adjust user scores |
| POST | `/api/admin/gift` | Gift item to user |
| POST | `/api/admin/strip` | Remove all items from user |
| POST | `/api/admin/reset` | Reset user completely |
| POST | `/api/admin/delete` | Delete user account |

---

## Shop System

7 equipment slots, 85 items total:

| Slot | Items | Price Range |
|---|---|---|
| maze (maze skin) | 10 | 2,000 - 5,000 pts |
| cursor | 13 | 700 - 2,800 pts |
| target | 6 | 5,200 - 7,800 pts |
| accent | 9 | 6,000 - 10,000 pts |
| nameplate | 16 | 6,000 - 200,000 pts (includes animated) |
| pong (paddle skin) | 10 | 1,000 - 20,000 pts |
| tron | 10 | 750 - 7,000 pts |

**Balance model:** `balance = total_earned - total_spent`. Points earned from games, spent in shop. Catalog duplicated in `shop.js` (frontend) and `functions/_lib/catalog.js` (server) — must be kept in sync.

---

## ELO System

- K-factor: 50 (<10 games), 40 (<30 games), 32 (30+)
- Initial rating: 1200
- Winner gains points, loser loses (standard ELO formula)
- Provisional flag cleared after 10 games
- Stored in `elo_ratings` table, keyed by (user_id, game)

---

## Key Technical Details

### Server-Authoritative Pong Physics
- Ball ticks server-side on every POST poll in `state.js`
- Large time gaps subdivided into ~16.67ms physics steps (max 8 per tick)
- Paddle positions tracked in DB (`paddle_y`), updated server-side
- Client only sends direction input and renders server state
- Collision detection: ball vs paddle, ball vs wall, score detection
- Ball speed: slow=0.02, medium=0.03, fast=0.045 per physics step

### D1 Type Coercion
D1 returns integers as strings. All JS comparisons must use `String(Number(value))` for ID matching.

### Migration 0011 Fix
`score_left`/`score_right` columns were added twice (0009 and 0011). Migration 0011 was fixed to remove duplicates.

### last_tick_at
Column exists in DB (added out-of-band) but no migration file creates it. Used by both `pong/state.js` and `tron/state.js` for delta-time physics. Defaults to 0, which requires special handling (`Number(0) || now` evaluates to `now` since 0 is falsy).

---

## Known Issues / Tech Debt

1. **`sessions` table is vestigial** — Auth uses HMAC cookies, not DB sessions
2. **Catalog duplicated** — `shop.js` and `catalog.js` must be kept in sync manually
3. **No rate limiting** on any API endpoint
4. **Stack traces leaked** in 500 responses from `login.js` and `register.js`
5. **Durable Objects defined but unused** — `durable/PongGame.js` and `TronGame.js` exist but `wrangler.toml` has no DO bindings
6. **Hardcoded admin username** `ruruskaado` in `functions/_lib/admin.js`
7. **Hardcoded auth fallback secret** if env vars not set
8. **`last_tick_at` no migration** — schema drift, column added manually

---

## Deployment

- **Git integration:** Push to `main` auto-deploys to Production
- **Manual deploy:** `npx wrangler pages deploy . --project-name game-program`
- **Check deploys:** `npx wrangler pages deployment list --project-name game-program`
- **D1 queries:** `npx wrangler d1 execute game-program-db --remote --command "SQL"`

### Environment Variables
| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC signing key (preferred) |
| `JWT_SECRET` | Fallback HMAC key |
| `DATABASE` | D1 binding (auto-configured in wrangler.toml) |

---

## File Structure

```
GAME_PROGRAM/
├── index.html, maze.html, target.html, button.html, cut.html,
│   circle.html, pong.html, tron.html, shop.html, admin.html
├── score.js, scoring.js, shop.js, crt.js, cursor.js
├── crt.css, ui.css
├── vendor/circle-fit.js
├── assets/            (cursor PNGs, game icons)
├── migrations/        (0001-0013 SQL)
├── functions/
│   ├── _lib/          (auth.js, admin.js, catalog.js, nameplates.js)
│   ├── api/           (32 endpoints)
│   │   ├── pong/      (room.js, state.js, move.js, elo.js, leaderboard.js)
│   │   ├── tron/      (room.js, state.js, move.js, elo.js, leaderboard.js)
│   │   ├── cut/       (record.js, leaderboard.js)
│   │   ├── circle/    (record.js, leaderboard.js)
│   │   ├── shop/      (state.js, buy.js, equip.js)
│   │   ├── admin/     (users.js, adjust.js, gift.js, strip.js, reset.js, delete.js)
│   │   └── ...        (login.js, register.js, logout.js, me.js, score.js, etc.)
├── durable/           (PongGame.js, TronGame.js — unused DO code)
├── tests/             (scoring.test.mjs, shop.test.mjs)
├── wrangler.toml
├── _routes.json
└── package.json
```
