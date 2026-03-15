# Badminton Score Counter

Local live-score software for badminton streams. It gives you:

- an admin dashboard to update names, format, and scores
- a clean browser overlay for OBS
- built-in badminton win logic with configurable rules
- game-by-game history that stays on screen while the next game starts

## Why this stack

This project uses plain Node.js and browser JavaScript with no third-party packages. That keeps it simple to run, avoids dependency installs, and makes local OBS usage very reliable.

For low latency, the admin page and OBS overlay both subscribe to the same live event stream. On the same PC, updates should feel effectively instant.

## Game Day Quick Start

1. Open a terminal in this folder.
2. Start the scoreboard server:

```powershell
node server.js
```

3. Open the admin dashboard in your browser:

```text
http://localhost:3000/admin
```

4. Add this OBS Browser Source:

```text
http://localhost:3000/overlay
```

5. In OBS, set the Browser Source size to around `500 x 110` or `500 x 120` for the compact strip layout.
6. Leave the terminal window running during the event. If you close it, the local scoreboard server stops.

## Before You Go Live

- Enter player names in the admin page before the match starts.
- Choose `Singles` or `Doubles` depending on the fixture.
- Set total games and scoring rules if they differ from standard badminton.
- Refresh the OBS browser source once after major styling changes.
- If you restart the app, the last saved match state is restored from `data/match-state.json`.

## How It Works

- `Singles` shows one player name per side.
- `Doubles` reveals a second player field per side and the overlay updates automatically.
- `Total games` controls the match length. Best-of-3 means first to 2 games wins.
- `Points to win`, `Win by`, and `Hard cap score` let you match standard badminton or custom formats.
- When a game finishes, its score remains visible in the games strip. Click `Start next game` to move on.
- `Undo last action` restores the previous state.
- Match state is saved to `data/match-state.json`, so refreshes and restarts keep your latest scoreboard.

## OBS Notes

- Use a Browser Source, not a static local HTML file, if you want true live updates without reloading.
- If OBS runs on the same machine, `http://localhost:3000/overlay` is the easiest setup.
- If OBS runs on a different machine on your local network, start the server and use your LAN IP instead of `localhost`.

## Project Layout

- `server.js`: local HTTP server, persistence, and live event streaming
- `src/match-logic.js`: badminton scoring and match-state rules
- `public/admin.html`: control dashboard
- `public/overlay.html`: on-stream overlay
- `tests/match-logic.test.js`: rules smoke tests

## Test It

```powershell
node tests/match-logic.test.js
```

If your shell allows it, `npm test` runs the same command.
