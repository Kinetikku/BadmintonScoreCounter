# Cloudflare Runtime

This folder contains the Cloudflare production runtime for the scoreboard.

## What Is Here

- `src/worker.mjs`
  Main Worker entrypoint. Handles:
  - `/admin` login protection
  - public `/overlay` and `/finals`
  - `/api/*` routing
  - Cloudinary upload endpoint at `/api/uploads/image`
- `src/match-room.mjs`
  Durable Object for the active match. It owns:
  - live match state
  - undo history
  - the same write actions as the local server
  - the SSE feed for overlays and admin refreshes
- `src/auth.mjs`
  Password-login and signed session-cookie helpers.
- `src/cloudinary.mjs`
  Uploads selected image files to Cloudinary and returns hosted URLs.
- `src/match-logic.mjs`
  ESM Worker version of the badminton scoring engine.
- `src/match-state-store.mjs`
  Worker-side mutation and undo helpers.
- `src/html.mjs`
  Worker-served HTML shells for `/admin`, `/overlay`, and `/finals`.
- `wrangler.toml.example`
  Example config if you want to run the Worker from inside this folder instead of the repo root.
- `.dev.vars.example`
  Example local Worker secrets.

## Production Shape

The deployed flow is:

1. Admin logs into `/admin`.
2. Admin updates names, settings, scores, and finals state.
3. The Worker forwards those changes to the single `MatchRoom` Durable Object.
4. The Durable Object stores the updated state and broadcasts it.
5. `/overlay` and `/finals` read the same state and update live in OBS.
6. When local image files are selected in cloud mode, the Worker uploads them to Cloudinary and stores the returned URLs.

## Repo Root Deploy Flow

The main deployment config lives in the repo root at `wrangler.toml`.

Useful commands from the repo root:

- `npm run worker:dev`
- `npm run worker:dry-run`
- `npm run worker:deploy`

## Required Secrets

Create `.dev.vars` from the repo root `.dev.vars.example` or configure the same values as Worker secrets:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Notes

- `/admin` is protected
- `/overlay` and `/finals` are intentionally public for OBS
- this runtime is currently single-match only
- local Node mode still exists for offline or LAN-only use
