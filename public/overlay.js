const overlayElements = {
  grid: document.querySelector("#overlay-grid")
};

const BOX_COUNT = 3;

function getLastName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return "";
  }

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

function getOverlayName(team, gameType) {
  const visiblePlayers = team.players
    .filter(Boolean)
    .slice(0, gameType === "doubles" ? 2 : 1)
    .map(getLastName)
    .filter(Boolean);

  return visiblePlayers.join("/") || team.displayName;
}

function buildScoreCells(state, teamKey) {
  const cells = [];

  for (let index = 1; index <= BOX_COUNT; index += 1) {
    const withinMatch = index <= state.settings.totalGames;
    const game = withinMatch ? state.games.find((entry) => entry.index === index) : null;
    const value = game ? (teamKey === "a" ? game.scoreA : game.scoreB) : "";
    const classes = ["overlay-box"];

    if (!withinMatch) {
      classes.push("is-unused");
    } else if (game?.completed) {
      classes.push("is-complete");
      if (game.winner === teamKey) {
        classes.push("is-winner");
      }
    } else if (!state.summary.matchWinner && index === state.summary.activeGameNumber) {
      classes.push("is-current");
    }

    cells.push(`
      <div class="${classes.join(" ")}">
        <span class="overlay-box__value">${value === "" ? "&nbsp;" : value}</span>
      </div>
    `);
  }

  return cells.join("");
}

function renderOverlay(state) {
  overlayElements.grid.innerHTML = `
    <div class="overlay-row">
      <div class="overlay-name">${getOverlayName(state.teams.a, state.settings.gameType)}</div>
      ${buildScoreCells(state, "a")}
    </div>
    <div class="overlay-row">
      <div class="overlay-name">${getOverlayName(state.teams.b, state.settings.gameType)}</div>
      ${buildScoreCells(state, "b")}
    </div>
  `;
}

async function bootOverlay() {
  const initialState = await fetch("/api/state").then((response) => response.json());
  renderOverlay(initialState);

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    renderOverlay(JSON.parse(event.data));
  };
}

bootOverlay().catch((error) => {
  console.error(error);
});


