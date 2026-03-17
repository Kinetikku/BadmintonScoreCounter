# Production Refactor Plan

This branch migrated the app from a local-only Node scoreboard into a repo that now supports both local and Cloudflare-hosted runtimes.

## Current Architecture

- `server.js`
  Local Node runtime for LAN and offline usage.
- `public/`
  Shared browser UI used by the local runtime and mirrored by the Worker runtime.
- `src/match-logic.js`
  Core badminton scoring engine.
- `src/shared/match-state-store.js`
  Shared state mutation and undo helpers for the local runtime.
- `cloudflare/src/worker.mjs`
  Cloudflare HTTP entrypoint.
- `cloudflare/src/match-room.mjs`
  Durable Object for one active match.
- `cloudflare/src/cloudinary.mjs`
  Cloudinary upload integration.

## Current Production Route Model

- `/admin`
  Protected admin control panel.
- `/overlay`
  Public OBS scoreboard overlay.
- `/finals`
  Public OBS finals overlay.
- `/api/*`
  Worker-managed API routed to the single default match.

## Durable Object Responsibilities

The `MatchRoom` Durable Object currently owns:

- authoritative live match state
- undo history
- score updates and match mutations
- SSE fanout for live browser updates

## Image Strategy

### Local runtime

- selected files are converted to data URLs in the browser
- the local server stores them in `data/match-state.json`

### Cloud runtime

1. Admin selects an image file.
2. `public/admin.js` posts it to `/api/uploads/image`.
3. `cloudflare/src/cloudinary.mjs` uploads it to Cloudinary.
4. The Worker saves only the returned hosted URL in match state.
5. Overlays read the hosted URL from shared state.

## Security Model

- Public routes: `/overlay`, `/finals`
- Protected routes: `/admin`, write APIs, upload API
- Current protection: app-level password login with signed session cookies

## What Was Implemented

- shared state/history store extracted to `src/shared/match-state-store.js`
- Worker-side scoring engine added in `cloudflare/src/match-logic.mjs`
- real Durable Object read/write API added in `cloudflare/src/match-room.mjs`
- Worker login and cookie auth added in `cloudflare/src/auth.mjs`
- Worker image upload route added via `cloudflare/src/cloudinary.mjs`
- repo-root `wrangler.toml` added for Cloudflare deployment
- public app deployed through Worker routes while static JS and CSS are served as assets

## Recommended Next Improvements

- add WebSockets for production instead of SSE if you want richer realtime behavior
- add support for multiple simultaneous matches instead of one default match
- add better deployment notes for rotating secrets and switching to a custom domain
- add archived matches or match presets
