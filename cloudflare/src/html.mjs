function html(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root { color-scheme: dark; }
      body { font-family: system-ui, sans-serif; background: #07111c; color: #f4f8fc; padding: 32px; margin: 0; }
      main { max-width: 720px; margin: 0 auto; }
      code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 6px; }
      .panel { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 24px; box-shadow: 0 24px 48px rgba(0,0,0,0.24); }
      .stack { display: grid; gap: 16px; }
      input { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(5,10,17,0.8); color: #f4f8fc; }
      button { padding: 12px 16px; border-radius: 14px; border: 0; background: linear-gradient(135deg, #6fefff 0%, #2ae4f2 100%); color: #03131a; font-weight: 700; cursor: pointer; }
      .muted { color: #9db1c8; }
      .error { color: #ff9e9e; }
      .link { color: #87e9ff; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function routeKind(pathname) {
  if (pathname === "/admin" || pathname === "/admin.html" || pathname.startsWith("/admin/")) {
    return "admin";
  }

  if (pathname === "/overlay" || pathname === "/overlay.html" || pathname.startsWith("/overlay/")) {
    return "overlay";
  }

  if (pathname === "/finals" || pathname === "/finals.html" || pathname.startsWith("/finals/")) {
    return "finals";
  }

  return "unknown";
}

function extractMatchId(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[1] || "default";
}

function redirectResponse(location) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store"
    }
  });
}

function pageResponse(markup) {
  return new Response(markup, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function renderAdminAppPage() {
  return pageResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Badminton Scoreboard Admin</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="admin-body">
    <div class="admin-shell">
      <header class="admin-header panel">
        <div>
          <p class="eyebrow">Live match control</p>
          <h1>Badminton Scoreboard Admin</h1>
          <p class="muted">Run the scoreboard, manage finals images, and trigger the stream intro from one control page.</p>
        </div>
        <div class="overlay-link-group">
          <span class="muted">OBS browser sources</span>
          <div class="overlay-link-list">
            <a id="overlay-link" class="overlay-link" href="/overlay" target="_blank" rel="noreferrer">Scoreboard overlay</a>
            <a id="finals-link" class="overlay-link" href="/finals" target="_blank" rel="noreferrer">Finals overlay</a>
          </div>
        </div>
      </header>

      <main class="admin-grid">
        <section class="panel admin-panel admin-panel--full">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Match setup</p>
              <h2>Settings</h2>
            </div>
            <span id="match-status" class="status-pill">Awaiting score</span>
          </div>

          <form id="settings-form" class="stack">
            <div class="form-grid settings-grid">
              <label>
                <span>Event name</span>
                <input id="event-name" name="eventName" type="text" maxlength="60">
              </label>
              <label>
                <span>Match division</span>
                <input id="court-name" name="courtName" type="text" maxlength="40">
              </label>
              <label>
                <span>Game type</span>
                <select id="game-type" name="gameType">
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                </select>
              </label>
              <label>
                <span>Total games</span>
                <input id="total-games" name="totalGames" type="number" min="1" max="9">
              </label>
              <label>
                <span>Points to win</span>
                <input id="points-to-win" name="pointsToWin" type="number" min="1" max="99">
              </label>
              <label>
                <span>Win by</span>
                <input id="win-by" name="winBy" type="number" min="1" max="10">
              </label>
              <label>
                <span>Hard cap score</span>
                <input id="hard-cap" name="hardCap" type="number" min="1" max="99">
              </label>
              <div class="settings-media">
                <div class="image-input-group">
                  <label>
                    <span>Logo image URL</span>
                    <input id="logo-url" name="logoUrl" type="url" placeholder="https://... or data:image/...">
                  </label>
                  <label class="file-picker">
                    <span>Upload logo file</span>
                    <input id="logo-file" type="file" accept="image/*">
                  </label>
                  <label class="checkbox-field">
                    <input id="show-logo" name="showLogo" type="checkbox">
                    <span>Display logo on finals overlay</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="actions-row">
              <button class="primary-button" type="submit">Save settings</button>
              <p class="helper-text">Default badminton format is 21 points, win by 2, capped at 30.</p>
            </div>
          </form>
        </section>

        <section class="panel admin-panel">
          <div class="section-heading section-heading--stacked">
            <div>
              <p class="eyebrow">Competitors</p>
              <h2>Names and finals images</h2>
            </div>
            <div class="button-cluster">
              <button id="trigger-finals-button" class="secondary-button" type="button">Run finals animation</button>
              <button id="end-finals-button" class="ghost-button" type="button">End animation</button>
            </div>
          </div>

          <form id="teams-form" class="stack">
            <div class="form-grid two-column team-grid">
              <fieldset class="team-fieldset">
                <legend>Left side</legend>
                <label>
                  <span>Side label</span>
                  <input id="team-a-label" type="text" maxlength="30">
                </label>
                <label>
                  <span>Player 1</span>
                  <input id="team-a-player-1" type="text" maxlength="40">
                </label>
                <label data-doubles-only>
                  <span>Player 2</span>
                  <input id="team-a-player-2" type="text" maxlength="40">
                </label>
                <div class="image-input-group">
                  <label>
                    <span>Finals image URL</span>
                    <input id="team-a-image-url" type="url" placeholder="https://... or data:image/...">
                  </label>
                  <label class="file-picker">
                    <span>Upload local file</span>
                    <input id="team-a-image-file" type="file" accept="image/*">
                  </label>
                </div>
              </fieldset>

              <fieldset class="team-fieldset">
                <legend>Right side</legend>
                <label>
                  <span>Side label</span>
                  <input id="team-b-label" type="text" maxlength="30">
                </label>
                <label>
                  <span>Player 1</span>
                  <input id="team-b-player-1" type="text" maxlength="40">
                </label>
                <label data-doubles-only>
                  <span>Player 2</span>
                  <input id="team-b-player-2" type="text" maxlength="40">
                </label>
                <div class="image-input-group">
                  <label>
                    <span>Finals image URL</span>
                    <input id="team-b-image-url" type="url" placeholder="https://... or data:image/...">
                  </label>
                  <label class="file-picker">
                    <span>Upload local file</span>
                    <input id="team-b-image-file" type="file" accept="image/*">
                  </label>
                </div>
              </fieldset>
            </div>

            <div class="actions-row">
              <button class="primary-button" type="submit">Save names and images</button>
              <p class="helper-text">Paste an image URL or choose a local file. Local files are converted into saved data URLs when you click save.</p>
            </div>
          </form>
        </section>

        <section class="panel admin-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Live scoring</p>
              <h2 id="game-heading">Game 1</h2>
            </div>
            <span id="games-summary" class="muted">Best of 3</span>
          </div>

          <div class="scoreboard-grid compact-scoreboard-grid">
            <article class="score-card">
              <p id="score-name-a" class="score-card__name">Player A</p>
              <div id="score-a" class="score-card__value">0</div>
              <div class="score-card__controls">
                <button type="button" class="secondary-button score-button" data-team="a" data-delta="-1">-1</button>
                <button type="button" class="primary-button score-button" data-team="a" data-delta="1">+1</button>
              </div>
            </article>

            <article class="score-card">
              <p id="score-name-b" class="score-card__name">Player B</p>
              <div id="score-b" class="score-card__value">0</div>
              <div class="score-card__controls">
                <button type="button" class="secondary-button score-button" data-team="b" data-delta="-1">-1</button>
                <button type="button" class="primary-button score-button" data-team="b" data-delta="1">+1</button>
              </div>
            </article>
          </div>

          <form id="direct-score-form" class="inline-form">
            <label>
              <span>Set exact score</span>
              <div class="inline-score-inputs">
                <input id="direct-score-a" type="number" min="0" max="99">
                <span class="score-separator">:</span>
                <input id="direct-score-b" type="number" min="0" max="99">
              </div>
            </label>
            <button class="secondary-button" type="submit">Apply score</button>
          </form>

          <div class="actions-row action-stack scoring-actions">
            <button id="next-game-button" class="primary-button" type="button">Start next game</button>
            <button id="undo-button" class="secondary-button" type="button">Undo last action</button>
            <button id="reset-button" class="danger-button" type="button">Reset match</button>
          </div>
        </section>

        <section class="panel admin-panel admin-panel--full">
          <div class="section-heading">
            <div>
              <p class="eyebrow">On-air layout</p>
              <h2>Games strip</h2>
            </div>
          </div>
          <div id="games-strip" class="games-strip"></div>
        </section>
      </main>
    </div>

    <script src="/admin.js" defer></script>
  </body>
</html>`);
}

function renderOverlayAppPage() {
  return pageResponse(`<!doctype html>
<html lang="en" class="overlay-page">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Badminton Scoreboard Overlay</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="overlay-body">
    <main class="overlay-shell">
      <section class="overlay-board overlay-board--compact" aria-label="Badminton live score overlay">
        <div id="overlay-grid" class="overlay-grid"></div>
      </section>
    </main>

    <script src="/overlay.js" defer></script>
  </body>
</html>`);
}

function renderFinalsAppPage() {
  return pageResponse(`<!doctype html>
<html lang="en" class="finals-page">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Badminton Finals Overlay</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="finals-body">
    <main class="finals-stage">
      <section id="finals-shell" class="finals-shell">
        <article class="finals-side finals-side--left">
          <img id="finals-image-a" class="finals-side__image" alt="Left competitor profile image" hidden>
          <div id="finals-name-a" class="finals-side__name"></div>
        </article>

        <section id="finals-card" class="finals-card" aria-label="Upcoming match details">
          <img id="finals-logo" class="finals-card__logo" alt="Tournament logo" hidden>
          <h2 id="finals-event-name" class="finals-card__title"></h2>
          <p class="finals-card__eyebrow">Upcoming Match</p>
          <div class="finals-card__rows">
            <div class="finals-card__row">
              <span class="finals-card__label">Division</span>
              <strong id="finals-division" class="finals-card__value"></strong>
            </div>
            <div class="finals-card__row">
              <span class="finals-card__label">Game Type</span>
              <strong id="finals-game-type" class="finals-card__value"></strong>
            </div>
            <div class="finals-card__row">
              <span class="finals-card__label">Total Games</span>
              <strong id="finals-total-games" class="finals-card__value"></strong>
            </div>
          </div>
        </section>

        <article class="finals-side finals-side--right">
          <img id="finals-image-b" class="finals-side__image" alt="Right competitor profile image" hidden>
          <div id="finals-name-b" class="finals-side__name"></div>
        </article>
      </section>
    </main>

    <script src="/finals.js" defer></script>
  </body>
</html>`);
}

export {
  extractMatchId,
  html,
  redirectResponse,
  renderAdminAppPage,
  renderFinalsAppPage,
  renderOverlayAppPage,
  routeKind
};


