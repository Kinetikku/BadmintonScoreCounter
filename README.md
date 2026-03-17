# Badminton Score Counter

Live badminton scoring software for OBS and browser-based broadcast graphics.

It supports:

- a password-protectable admin dashboard
- a compact live score overlay for OBS
- a separate finals intro overlay with player images and match details
- configurable badminton scoring rules
- completed game history that stays visible while the next game starts
- both local and Cloudflare-hosted deployment paths

## What Changed In The Production Refactor

This repo started as a local Node.js scoreboard. It now also includes a Cloudflare production path:

- `Cloudflare Workers` serve the app on a public `workers.dev` URL
- a `Durable Object` stores the live match state for one active match
- `Cloudinary` stores uploaded player images and event logos
- `/admin` is protected by a password login
- `/overlay` and `/finals` stay public for OBS browser sources

The local Node version still works, so you can run the app either:

- fully local with `node server.js`
- or online through Cloudflare with `wrangler`

## Two Ways To Run It

### Local mode

Use this if OBS and the operator are on the same machine or same network.

```powershell
node server.js
```

Routes:

- Admin: `http://localhost:3000/admin`
- Overlay: `http://localhost:3000/overlay`
- Finals: `http://localhost:3000/finals`

### Cloud mode

Use this if you want to open `/admin` on your phone over the internet and keep the overlays online for OBS.

```powershell
npm run worker:dev
```

Helpful commands:

- `npm run worker:dev`
  Starts the Cloudflare Worker locally
- `npm run worker:dry-run`
  Validates the Worker bundle without deploying
- `npm run worker:deploy`
  Deploys the Worker to `workers.dev`

## Game Day Quick Start

### Local game day

1. Open a terminal in this folder.
2. Run `node server.js`.
3. Open `http://localhost:3000/admin`.
4. Add `http://localhost:3000/overlay` as an OBS Browser Source.
5. Add `http://localhost:3000/finals` as a second OBS Browser Source.

### Cloud game day

1. Deploy the Worker.
2. Open the deployed `/admin` URL on your phone.
3. Log in with the configured admin password.
4. Add the deployed `/overlay` and `/finals` URLs as OBS Browser Sources.

For the scoreboard strip, start with an OBS Browser Source around `500 x 110` or `500 x 120`.

## Environment Setup For Cloudflare

Create a local `.dev.vars` file from `.dev.vars.example` with:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Those same values should exist as Cloudflare Worker secrets in production.

Important:

- `.dev.vars` is ignored by git
- do not commit real secrets
- if you ever paste a secret into chat or somewhere public, rotate it

## How The App Works

At a high level:

1. The admin page changes match state by calling `/api/*`.
2. The backend updates the single source of truth for the match.
3. The overlay and finals pages subscribe to live updates.
4. OBS shows those pages as Browser Sources.

### In local mode

- `server.js` is the backend
- state is persisted in `data/match-state.json`
- the browser pages listen to `/api/events` via Server-Sent Events

### In cloud mode

- `cloudflare/src/worker.mjs` is the main HTTP entrypoint
- `cloudflare/src/match-room.mjs` is the Durable Object that owns the match state
- state is stored in Durable Object storage instead of a local JSON file
- the same browser pages still talk to `/api/*`
- selected image files are uploaded through the Worker to Cloudinary

## How Scoring Works

The rules engine is intentionally separated from the server layer.

- `Singles` uses one player name per side
- `Doubles` shows two player inputs and renders two surnames per side where needed
- `Total games` controls match length
- `Points to win`, `Win by`, and `Hard cap score` control the badminton rules
- a game is only won when the configured rules are satisfied
- when a game ends, its score stays visible
- `Start next game` begins the next game beside the completed one
- `Undo` restores the previous state snapshot

## Image Upload Strategy

There are two image behaviors depending on runtime.

### Local mode

- if you pick a local image file, the browser converts it into a data URL
- that value is saved into local match state
- OBS can still display it because the image is embedded directly in the state

### Cloud mode

- if you pick a local image file, the admin tries `POST /api/uploads/image`
- the Worker uploads the file to Cloudinary
- Cloudinary returns a hosted URL
- the app saves that URL into match state
- the finals overlay then loads the hosted image from Cloudinary

This is why cloud mode does not rely on storing large image blobs in Durable Object state.

## File Guide

### Local runtime

- `server.js`
  Local Node server, file persistence, API routes, and SSE broadcasting
- `data/match-state.json`
  Saved local match state used by the Node runtime

### Shared scoring logic

- `src/match-logic.js`
  Core badminton rules and state transitions
- `src/shared/match-state-store.js`
  Shared mutation, undo, and public-state helpers used by the local server

### Browser UI

- `public/admin.html`
  Admin dashboard markup
- `public/admin.js`
  Admin behavior, API calls, form handling, and upload fallback logic
- `public/overlay.html`
  Compact OBS scoreboard shell for local mode
- `public/overlay.js`
  Live scoreboard rendering logic
- `public/finals.html`
  Finals overlay shell for local mode
- `public/finals.js`
  Finals animation and match-card rendering logic
- `public/styles.css`
  All admin, overlay, and finals styles

### Cloudflare runtime

- `wrangler.toml`
  Main Cloudflare deployment config for the repo root
- `.dev.vars.example`
  Example local Worker secrets file
- `cloudflare/src/worker.mjs`
  Main Cloudflare request router
- `cloudflare/src/auth.mjs`
  Password login and signed session cookie helpers
- `cloudflare/src/match-logic.mjs`
  ESM version of the scoring engine for the Worker runtime
- `cloudflare/src/match-state-store.mjs`
  Worker-side mutation and undo helpers
- `cloudflare/src/match-room.mjs`
  Durable Object that owns the live match state
- `cloudflare/src/cloudinary.mjs`
  Worker-side Cloudinary upload helper
- `cloudflare/src/html.mjs`
  Worker-served HTML pages for `/admin`, `/overlay`, and `/finals`

### Tests and docs

- `tests/match-logic.test.js`
  Rules smoke tests
- `cloudflare/README.md`
  Cloudflare-specific setup notes
- `docs/production-refactor-plan.md`
  Production refactor notes and architecture plan

## OBS Notes

- use Browser Sources, not static downloaded HTML files
- keep the finals source full-screen and transparent if you are layering it over live footage
- keep the compact scoreboard as a separate top layer
- if using local mode from another device on the same network, use your machine's LAN IP instead of `localhost`

## Test It

```powershell
npm test
```

You can also validate the Worker bundle with:

```powershell
npm run worker:dry-run
```
