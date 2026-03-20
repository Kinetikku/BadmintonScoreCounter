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
    logoLibraryButton: document.querySelector("#logo-library-button"),
    logoLibrary: document.querySelector("#logo-library"),
    showLogo: document.querySelector("#show-logo")
  },
  teams: {
    aLabel: document.querySelector("#team-a-label"),
    aPlayer1: document.querySelector("#team-a-player-1"),
    aPlayer2: document.querySelector("#team-a-player-2"),
    aImageUrl: document.querySelector("#team-a-image-url"),
    aImageFile: document.querySelector("#team-a-image-file"),
    aLibraryButton: document.querySelector("#team-a-library-button"),
    aLibrary: document.querySelector("#team-a-library"),
    bLabel: document.querySelector("#team-b-label"),
    bPlayer1: document.querySelector("#team-b-player-1"),
    bPlayer2: document.querySelector("#team-b-player-2"),
    bImageUrl: document.querySelector("#team-b-image-url"),
    bImageFile: document.querySelector("#team-b-image-file"),
    bLibraryButton: document.querySelector("#team-b-library-button"),
    bLibrary: document.querySelector("#team-b-library")
  },
  doublesOnly: Array.from(document.querySelectorAll("[data-doubles-only]"))
};

let cloudinaryAssetsCache = null;
let cloudinaryLibraryUnavailable = false;
let toastTimer = 0;
let toastContainer = null;
function ensureToastContainer() {
  if (toastContainer) {
    return toastContainer;
  }

  toastContainer = document.createElement("div");
  toastContainer.className = "admin-toast";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.hidden = true;
  document.body.append(toastContainer);
  return toastContainer;
}

function showToast(message) {
  const container = ensureToastContainer();
  container.textContent = message;
  container.hidden = false;
  container.classList.add("is-visible");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    container.classList.remove("is-visible");
    container.hidden = true;
  }, 2600);
}

function getAssetLibraryPairs() {
  return [
    { button: elements.settings.logoLibraryButton, panel: elements.settings.logoLibrary },
    { button: elements.teams.aLibraryButton, panel: elements.teams.aLibrary },
    { button: elements.teams.bLibraryButton, panel: elements.teams.bLibrary }
  ];
}

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

async function tryUploadImageFile(file, assetKind) {
  const formData = new FormData();
  formData.append("file", file, file.name || `${assetKind}.png`);
  formData.append("assetKind", assetKind);

  let response;

  try {
    response = await fetch("/api/uploads/image", {
      method: "POST",
      body: formData
    });
  } catch {
    return null;
  }

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.warn("Cloud image upload failed; falling back to local data URL.", payload.error || response.statusText);
    return null;
  }

  cloudinaryAssetsCache = null;
  cloudinaryLibraryUnavailable = false;
  return typeof payload.secureUrl === "string" ? payload.secureUrl : null;
}

async function resolveImageValue(fileInput, targetInput, assetKind) {
  const [file] = fileInput.files || [];

  if (!file) {
    return targetInput.value;
  }

  const uploadedUrl = await tryUploadImageFile(file, assetKind);

  if (uploadedUrl) {
    targetInput.value = uploadedUrl;
    fileInput.value = "";
    return uploadedUrl;
  }

  if (!targetInput.value) {
    targetInput.value = await readFileAsDataUrl(file);
  }

  fileInput.value = "";
  return targetInput.value;
}

async function fetchCloudinaryAssets(forceRefresh = false) {
  if (!forceRefresh && cloudinaryAssetsCache) {
    return cloudinaryAssetsCache;
  }

  if (cloudinaryLibraryUnavailable) {
    return null;
  }

  let response;

  try {
    response = await fetch("/api/uploads/image");
  } catch {
    cloudinaryLibraryUnavailable = true;
    return null;
  }

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    cloudinaryLibraryUnavailable = true;
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Could not load Cloudinary images.");
  }

  cloudinaryAssetsCache = Array.isArray(payload.resources)
    ? payload.resources.slice().sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    : [];
  cloudinaryLibraryUnavailable = false;
  return cloudinaryAssetsCache;
}

function formatAssetDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function hideAssetLibrary(panel, button) {
  if (!panel) {
    return;
  }

  panel.hidden = true;
  if (button) {
    button.textContent = "Choose existing Cloudinary image";
  }
}

function closeAllAssetLibraries() {
  for (const pair of getAssetLibraryPairs()) {
    hideAssetLibrary(pair.panel, pair.button);
  }
}

function renderAssetLibrary(panel, assets, targetInput, fileInput, button) {
  if (!panel) {
    return;
  }

  if (assets === null) {
    panel.innerHTML = `
      <p class="asset-library__empty">
        Cloudinary image browsing is only available on the deployed cloud version.
      </p>
    `;
    panel.hidden = false;
    return;
  }

  if (!assets.length) {
    panel.innerHTML = `
      <p class="asset-library__empty">
        No previously uploaded Cloudinary images were found yet.
      </p>
    `;
    panel.hidden = false;
    return;
  }

  const selectedUrl = targetInput.value;

  panel.innerHTML = `
    <div class="asset-library__header">
      <p class="asset-library__title">Recent Cloudinary uploads</p>
      <button class="ghost-button asset-library-refresh" type="button">Refresh</button>
    </div>
    <div class="asset-library__grid">
      ${assets.map((asset) => {
        const isSelected = asset.secureUrl === selectedUrl;
        return `
          <article class="asset-tile${isSelected ? " is-selected" : ""}" data-secure-url="${asset.secureUrl}">
            <img class="asset-tile__image" src="${asset.thumbnailUrl}" alt="${asset.publicId}">
            <div class="asset-tile__body">
              <strong class="asset-tile__name">${asset.publicId}</strong>
              <span class="asset-tile__meta">${formatAssetDate(asset.createdAt)}</span>
            </div>
            <button class="secondary-button asset-tile__button${isSelected ? " is-selected" : ""}" type="button" data-secure-url="${asset.secureUrl}">
              ${isSelected ? "Selected" : "Use this image"}
            </button>
          </article>
        `;
      }).join("")}
    </div>
  `;

  panel.hidden = false;

  for (const useButton of panel.querySelectorAll(".asset-tile__button")) {
    useButton.addEventListener("click", () => {
      targetInput.value = useButton.dataset.secureUrl || "";
      if (fileInput) {
        fileInput.value = "";
      }
      showToast("Image updated locally. Click Save to confirm the change.");
      renderAssetLibrary(panel, assets, targetInput, fileInput, button);
      if (button) {
        button.textContent = "Hide Cloudinary images";
      }
    });
  }

  const refreshButton = panel.querySelector(".asset-library-refresh");
  refreshButton?.addEventListener("click", async () => {
    const freshAssets = await fetchCloudinaryAssets(true);
    renderAssetLibrary(panel, freshAssets, targetInput, fileInput, button);
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

function bindAssetLibrary(button, panel, targetInput, fileInput) {
  button?.addEventListener("click", async () => {
    if (!panel.hidden) {
      closeAllAssetLibraries();
      return;
    }

    closeAllAssetLibraries();
    button.textContent = "Loading Cloudinary images...";
    const assets = await fetchCloudinaryAssets();
    renderAssetLibrary(panel, assets, targetInput, fileInput, button);
    button.textContent = panel.hidden ? "Choose existing Cloudinary image" : "Hide Cloudinary images";
  });
}

function showActionToast(message) {
  closeAllAssetLibraries();
  showToast(message);
}

function attachEvents() {
  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const logoUrl = await resolveImageValue(elements.settings.logoFile, elements.settings.logoUrl, "event-logo");

    await postJson("/api/settings", {
      eventName: elements.settings.eventName.value,
      courtName: elements.settings.courtName.value,
      gameType: elements.settings.gameType.value,
      totalGames: Number(elements.settings.totalGames.value),
      pointsToWin: Number(elements.settings.pointsToWin.value),
      winBy: Number(elements.settings.winBy.value),
      hardCap: Number(elements.settings.hardCap.value),
      logoUrl,
      showLogo: elements.settings.showLogo.checked
    });

    showActionToast("Settings saved.");
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

  bindAssetLibrary(
    elements.settings.logoLibraryButton,
    elements.settings.logoLibrary,
    elements.settings.logoUrl,
    elements.settings.logoFile
  );
  bindAssetLibrary(
    elements.teams.aLibraryButton,
    elements.teams.aLibrary,
    elements.teams.aImageUrl,
    elements.teams.aImageFile
  );
  bindAssetLibrary(
    elements.teams.bLibraryButton,
    elements.teams.bLibrary,
    elements.teams.bImageUrl,
    elements.teams.bImageFile
  );

  elements.teamsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const teamAImageUrl = await resolveImageValue(elements.teams.aImageFile, elements.teams.aImageUrl, "team-a");
    const teamBImageUrl = await resolveImageValue(elements.teams.bImageFile, elements.teams.bImageUrl, "team-b");

    await postJson("/api/teams", {
      a: {
        displayName: elements.teams.aLabel.value,
        players: [elements.teams.aPlayer1.value, elements.teams.aPlayer2.value],
        imageUrl: teamAImageUrl
      },
      b: {
        displayName: elements.teams.bLabel.value,
        players: [elements.teams.bPlayer1.value, elements.teams.bPlayer2.value],
        imageUrl: teamBImageUrl
      }
    });

    showActionToast("Names and images saved.");
  });

  elements.triggerFinalsButton.addEventListener("click", async () => {
    setTemporaryDisabled(elements.triggerFinalsButton);
    await postJson("/api/finals/trigger");
    showActionToast("Finals animation started.");
  });

  elements.endFinalsButton.addEventListener("click", async () => {
    setTemporaryDisabled(elements.endFinalsButton);
    await postJson("/api/finals/end");
    showActionToast("Finals animation ended.");
  });

  for (const button of document.querySelectorAll(".score-button")) {
    button.addEventListener("click", async () => {
      await postJson("/api/score", {
        team: button.dataset.team,
        delta: Number(button.dataset.delta)
      });
      showActionToast("Score updated.");
    });
  }

  elements.directScoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    await postJson("/api/score", {
      teamAScore: Number(elements.directScoreA.value),
      teamBScore: Number(elements.directScoreB.value)
    });

    showActionToast("Exact score applied.");
  });

  elements.nextGameButton.addEventListener("click", async () => {
    await postJson("/api/game/next");
    showActionToast("Next game started.");
  });

  elements.undoButton.addEventListener("click", async () => {
    await postJson("/api/undo");
    showActionToast("Last action undone.");
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

    showActionToast("Match reset.");
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









