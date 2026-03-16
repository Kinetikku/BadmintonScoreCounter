const elements = {
  overlayLink: document.querySelector("#overlay-link"),
  finalsLink: document.querySelector("#finals-link"),
  triggerFinalsButton: document.querySelector("#trigger-finals-button"),
  endFinalsButton: document.querySelector("#end-finals-button"),
  matchStatus: document.querySelector("#match-status"),
  gameHeading: document.querySelector("#game-heading"),
  gamesSummary: document.querySelector("#games-summary"),
  gamesStrip: document.querySelector("#games-strip"),
  settingsForm: document.querySelector("#settings-form"),
  teamsForm: document.querySelector("#teams-form"),
  directScoreForm: document.querySelector("#direct-score-form"),
  nextGameButton: document.querySelector("#next-game-button"),
  resetButton: document.querySelector("#reset-button"),
  undoButton: document.querySelector("#undo-button"),
  scoreA: document.querySelector("#score-a"),
  scoreB: document.querySelector("#score-b"),
  scoreNameA: document.querySelector("#score-name-a"),
  scoreNameB: document.querySelector("#score-name-b"),
  directScoreA: document.querySelector("#direct-score-a"),
  directScoreB: document.querySelector("#direct-score-b"),
  settings: {
    eventName: document.querySelector("#event-name"),
    courtName: document.querySelector("#court-name"),
    gameType: document.querySelector("#game-type"),
    totalGames: document.querySelector("#total-games"),
    pointsToWin: document.querySelector("#points-to-win"),
    winBy: document.querySelector("#win-by"),
    hardCap: document.querySelector("#hard-cap"),
    logoUrl: document.querySelector("#logo-url"),
    logoFile: document.querySelector("#logo-file"),
    showLogo: document.querySelector("#show-logo")
  },
  teams: {
    aLabel: document.querySelector("#team-a-label"),
    aPlayer1: document.querySelector("#team-a-player-1"),
    aPlayer2: document.querySelector("#team-a-player-2"),
    aImageUrl: document.querySelector("#team-a-image-url"),
    aImageFile: document.querySelector("#team-a-image-file"),
    bLabel: document.querySelector("#team-b-label"),
    bPlayer1: document.querySelector("#team-b-player-1"),
    bPlayer2: document.querySelector("#team-b-player-2"),
    bImageUrl: document.querySelector("#team-b-image-url"),
    bImageFile: document.querySelector("#team-b-image-file")
  },
  doublesOnly: Array.from(document.querySelectorAll("[data-doubles-only]"))
};

function setValueIfIdle(input, value) {
  if (document.activeElement === input) {
    return;
  }

  input.value = value;
}

function setCheckedIfIdle(input, checked) {
  if (document.activeElement === input) {
    return;
  }

  input.checked = Boolean(checked);
}

function formatTeamName(team, gameType) {
  const players = team.players.filter(Boolean);
  return gameType === "doubles" ? players.join(" / ") : players[0];
}

function buildGameCards(state) {
  const cards = [];

  for (let index = 1; index <= state.settings.totalGames; index += 1) {
    const game = state.games.find((entry) => entry.index === index);
    const isCurrent = index === state.summary.activeGameNumber && !state.summary.matchWinner;
    const classes = ["game-pill"];

    if (game?.completed) {
      classes.push("is-complete");
    } else if (isCurrent) {
      classes.push("is-current");
    }

    cards.push(`
      <article class="${classes.join(" ")}">
        <span class="game-pill__label">Game ${index}</span>
        <strong class="game-pill__score">${game ? `${game.scoreA} : ${game.scoreB}` : "Waiting"}</strong>
        <span class="game-pill__meta">${
          game?.winner === "a"
            ? `${state.teams.a.displayName} won`
            : game?.winner === "b"
              ? `${state.teams.b.displayName} won`
              : isCurrent
                ? "Live now"
                : "Upcoming"
        }</span>
      </article>
    `);
  }

  return cards.join("");
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read the selected image file."));
    reader.readAsDataURL(file);
  });
}

function updateVisibility(gameType) {
  const isDoubles = gameType === "doubles";
  for (const block of elements.doublesOnly) {
    block.hidden = !isDoubles;
  }
}

function render(state) {
  const currentGame = state.games.find((game) => !game.completed) || state.games[state.games.length - 1];
  const matchWinner = state.summary.matchWinner;

  elements.overlayLink.href = `${window.location.origin}/overlay`;
  elements.overlayLink.textContent = `${window.location.origin}/overlay`;
  elements.finalsLink.href = `${window.location.origin}/finals`;
  elements.finalsLink.textContent = `${window.location.origin}/finals`;

  setValueIfIdle(elements.settings.eventName, state.settings.eventName);
  setValueIfIdle(elements.settings.courtName, state.settings.courtName);
  setValueIfIdle(elements.settings.gameType, state.settings.gameType);
  setValueIfIdle(elements.settings.totalGames, state.settings.totalGames);
  setValueIfIdle(elements.settings.pointsToWin, state.settings.pointsToWin);
  setValueIfIdle(elements.settings.winBy, state.settings.winBy);
  setValueIfIdle(elements.settings.hardCap, state.settings.hardCap);
  setValueIfIdle(elements.settings.logoUrl, state.settings.logoUrl || "");
  setCheckedIfIdle(elements.settings.showLogo, state.settings.showLogo);

  setValueIfIdle(elements.teams.aLabel, state.teams.a.displayName);
  setValueIfIdle(elements.teams.aPlayer1, state.teams.a.players[0]);
  setValueIfIdle(elements.teams.aPlayer2, state.teams.a.players[1]);
  setValueIfIdle(elements.teams.aImageUrl, state.teams.a.imageUrl || "");
  setValueIfIdle(elements.teams.bLabel, state.teams.b.displayName);
  setValueIfIdle(elements.teams.bPlayer1, state.teams.b.players[0]);
  setValueIfIdle(elements.teams.bPlayer2, state.teams.b.players[1]);
  setValueIfIdle(elements.teams.bImageUrl, state.teams.b.imageUrl || "");

  setValueIfIdle(elements.directScoreA, currentGame.scoreA);
  setValueIfIdle(elements.directScoreB, currentGame.scoreB);

  updateVisibility(state.settings.gameType);

  elements.scoreA.textContent = currentGame.scoreA;
  elements.scoreB.textContent = currentGame.scoreB;
  elements.scoreNameA.textContent = formatTeamName(state.teams.a, state.settings.gameType);
  elements.scoreNameB.textContent = formatTeamName(state.teams.b, state.settings.gameType);
  elements.gamesSummary.textContent = `Best of ${state.settings.totalGames} • first to ${state.summary.gamesNeededToWin} games`;
  elements.gameHeading.textContent = `Game ${state.summary.activeGameNumber}`;
  elements.gamesStrip.innerHTML = buildGameCards(state);

  if (matchWinner) {
    const label = matchWinner === "a" ? state.teams.a.displayName : state.teams.b.displayName;
    elements.matchStatus.textContent = `${label} won the match`;
    elements.matchStatus.className = "status-pill status-pill--winner";
  } else if (state.summary.canStartNextGame) {
    elements.matchStatus.textContent = "Game complete";
    elements.matchStatus.className = "status-pill status-pill--ready";
  } else {
    elements.matchStatus.textContent = "Live scoring";
    elements.matchStatus.className = "status-pill";
  }

  elements.nextGameButton.disabled = !state.summary.canStartNextGame;
  elements.undoButton.disabled = state.meta.undoDepth < 1;
  elements.endFinalsButton.disabled = !state.presentation?.finalsActive;
}

async function postJson(url, payload = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({ error: "Request failed." }));
    throw new Error(errorPayload.error || "Request failed.");
  }

  return response.json();
}

async function handleImageFileSelection(fileInput, targetInput) {
  const [file] = fileInput.files || [];
  if (!file) {
    return;
  }

  targetInput.value = await readFileAsDataUrl(file);
}

function setTemporaryDisabled(button, duration = 600) {
  button.disabled = true;
  window.setTimeout(() => {
    button.disabled = false;
  }, duration);
}

function attachEvents() {
  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await postJson("/api/settings", {
      eventName: elements.settings.eventName.value,
      courtName: elements.settings.courtName.value,
      gameType: elements.settings.gameType.value,
      totalGames: Number(elements.settings.totalGames.value),
      pointsToWin: Number(elements.settings.pointsToWin.value),
      winBy: Number(elements.settings.winBy.value),
      hardCap: Number(elements.settings.hardCap.value),
      logoUrl: elements.settings.logoUrl.value,
      showLogo: elements.settings.showLogo.checked
    });
  });

  elements.settings.gameType.addEventListener("change", () => {
    updateVisibility(elements.settings.gameType.value);
  });

  elements.settings.logoFile.addEventListener("change", async () => {
    await handleImageFileSelection(elements.settings.logoFile, elements.settings.logoUrl);
  });

  elements.teams.aImageFile.addEventListener("change", async () => {
    await handleImageFileSelection(elements.teams.aImageFile, elements.teams.aImageUrl);
  });

  elements.teams.bImageFile.addEventListener("change", async () => {
    await handleImageFileSelection(elements.teams.bImageFile, elements.teams.bImageUrl);
  });

  elements.teamsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await postJson("/api/teams", {
      a: {
        displayName: elements.teams.aLabel.value,
        players: [elements.teams.aPlayer1.value, elements.teams.aPlayer2.value],
        imageUrl: elements.teams.aImageUrl.value
      },
      b: {
        displayName: elements.teams.bLabel.value,
        players: [elements.teams.bPlayer1.value, elements.teams.bPlayer2.value],
        imageUrl: elements.teams.bImageUrl.value
      }
    });
  });

  elements.triggerFinalsButton.addEventListener("click", async () => {
    setTemporaryDisabled(elements.triggerFinalsButton);
    await postJson("/api/finals/trigger");
  });

  elements.endFinalsButton.addEventListener("click", async () => {
    setTemporaryDisabled(elements.endFinalsButton);
    await postJson("/api/finals/end");
  });

  for (const button of document.querySelectorAll(".score-button")) {
    button.addEventListener("click", async () => {
      await postJson("/api/score", {
        team: button.dataset.team,
        delta: Number(button.dataset.delta)
      });
    });
  }

  elements.directScoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await postJson("/api/score", {
      teamAScore: Number(elements.directScoreA.value),
      teamBScore: Number(elements.directScoreB.value)
    });
  });

  elements.nextGameButton.addEventListener("click", async () => {
    await postJson("/api/game/next");
  });

  elements.undoButton.addEventListener("click", async () => {
    await postJson("/api/undo");
  });

  elements.resetButton.addEventListener("click", async () => {
    const confirmed = window.confirm("Reset the full match but keep the current settings and player names?");
    if (!confirmed) {
      return;
    }

    await postJson("/api/match/reset", {
      keepSettings: true,
      keepTeams: true
    });
  });
}

async function boot() {
  attachEvents();
  const initialState = await fetch("/api/state").then((response) => response.json());
  render(initialState);

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    render(JSON.parse(event.data));
  };
}

boot().catch((error) => {
  console.error(error);
  window.alert(error.message);
});
