const elements = {
  shell: document.querySelector("#finals-shell"),
  logoBadge: document.querySelector("#finals-logo-badge"),
  logo: document.querySelector("#finals-logo"),
  eventName: document.querySelector("#finals-event-name"),
  division: document.querySelector("#finals-division"),
  gameType: document.querySelector("#finals-game-type"),
  nameA: document.querySelector("#finals-name-a"),
  nameB: document.querySelector("#finals-name-b"),
  imageA: document.querySelector("#finals-image-a"),
  imageB: document.querySelector("#finals-image-b"),
  profile: {
    a: {
      racket: document.querySelector("#finals-a-racket"),
      age: document.querySelector("#finals-a-age"),
      hand: document.querySelector("#finals-a-hand"),
      nationality: document.querySelector("#finals-a-nationality"),
      club: document.querySelector("#finals-a-club")
    },
    b: {
      racket: document.querySelector("#finals-b-racket"),
      age: document.querySelector("#finals-b-age"),
      hand: document.querySelector("#finals-b-hand"),
      nationality: document.querySelector("#finals-b-nationality"),
      club: document.querySelector("#finals-b-club")
    }
  }
};

const ENTRY_DURATION_MS = 1500;
const INFO_FADE_DELAY_MS = ENTRY_DURATION_MS;
const EXIT_DURATION_MS = 2000;

let lastTrigger = null;
let enterTimer = 0;
let infoTimer = 0;
let hideTimer = 0;

function formatFinalsName(team, gameType) {
  const players = team.players.filter(Boolean).slice(0, gameType === "doubles" ? 2 : 1);
  return players.join(" / ") || team.displayName;
}

function formatGameType(gameType) {
  return gameType === "doubles" ? "Doubles" : "Singles";
}

function buildAssetUrl(url, version) {
  if (!url || /^(data:|blob:)/i.test(url)) {
    return url;
  }

  try {
    const resolved = new URL(url, window.location.href);
    if (version) {
      resolved.searchParams.set("_v", String(version));
    }
    return resolved.toString();
  } catch {
    if (!version) {
      return url;
    }

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}_v=${encodeURIComponent(String(version))}`;
  }
}

function setImage(targetImage, url, version, container = null) {
  if (url) {
    const nextSrc = buildAssetUrl(url, version);

    if (targetImage.dataset.assetSrc !== nextSrc) {
      targetImage.dataset.assetSrc = nextSrc;
      targetImage.removeAttribute("src");
      targetImage.src = nextSrc;
    }

    targetImage.hidden = false;
    if (container) {
      container.hidden = false;
    }
  } else {
    targetImage.removeAttribute("src");
    delete targetImage.dataset.assetSrc;
    targetImage.hidden = true;
    if (container) {
      container.hidden = true;
    }
  }
}

function setFact(target, value) {
  target.textContent = typeof value === "string" ? value.trim() : "";
}

function renderProfile(targets, profile = {}) {
  setFact(targets.racket, profile.racket);
  setFact(targets.age, profile.age);
  setFact(targets.hand, profile.hand);
  setFact(targets.nationality, profile.nationality);
  setFact(targets.club, profile.club);
}

function clearTimers() {
  window.clearTimeout(enterTimer);
  window.clearTimeout(infoTimer);
  window.clearTimeout(hideTimer);
}

function hideOverlay() {
  clearTimers();
  elements.shell.classList.remove("is-visible", "is-entering", "is-exiting", "is-info-visible");
}

function startEntry(triggerCount) {
  clearTimers();
  hideOverlay();
  void elements.shell.offsetWidth;
  elements.shell.classList.add("is-visible", "is-entering");
  lastTrigger = triggerCount;

  enterTimer = window.setTimeout(() => {
    elements.shell.classList.remove("is-entering");
    elements.shell.classList.add("is-visible");
  }, ENTRY_DURATION_MS);

  infoTimer = window.setTimeout(() => {
    elements.shell.classList.add("is-info-visible");
  }, INFO_FADE_DELAY_MS);
}

function startExit() {
  if (elements.shell.classList.contains("is-exiting")) {
    return;
  }

  clearTimers();

  if (!elements.shell.classList.contains("is-visible") && !elements.shell.classList.contains("is-entering")) {
    hideOverlay();
    return;
  }

  elements.shell.classList.remove("is-entering", "is-info-visible");
  elements.shell.classList.add("is-visible", "is-exiting");

  hideTimer = window.setTimeout(() => {
    hideOverlay();
  }, EXIT_DURATION_MS);
}

function renderFinals(state) {
  const leftName = formatFinalsName(state.teams.a, state.settings.gameType);
  const rightName = formatFinalsName(state.teams.b, state.settings.gameType);
  const triggerCount = Number(state.presentation?.finalsTrigger ?? 0);
  const isActive = Boolean(state.presentation?.finalsActive);

  elements.nameA.textContent = leftName;
  elements.nameB.textContent = rightName;
  elements.eventName.textContent = state.settings.eventName || "Upcoming Match";
  elements.division.textContent = state.settings.courtName || "Open Division";
  elements.gameType.textContent = formatGameType(state.settings.gameType);
  renderProfile(elements.profile.a, state.teams.a.profile || {});
  renderProfile(elements.profile.b, state.teams.b.profile || {});
  setImage(elements.imageA, state.teams.a.imageUrl, state.teams.a.imageVersion);
  setImage(elements.imageB, state.teams.b.imageUrl, state.teams.b.imageVersion);
  setImage(elements.logo, state.settings.showLogo ? state.settings.logoUrl : "", state.settings.logoVersion, elements.logoBadge);

  if (lastTrigger === null) {
    lastTrigger = triggerCount;
    if (isActive) {
      elements.shell.classList.add("is-visible", "is-info-visible");
    }
    return;
  }

  if (isActive && triggerCount !== lastTrigger) {
    startEntry(triggerCount);
    return;
  }

  if (isActive) {
    elements.shell.classList.remove("is-exiting");
    elements.shell.classList.add("is-visible", "is-info-visible");
    return;
  }

  lastTrigger = triggerCount;

  if (elements.shell.classList.contains("is-visible") || elements.shell.classList.contains("is-entering")) {
    startExit();
  } else {
    hideOverlay();
  }
}

async function bootFinals() {
  const initialState = await fetch("/api/state").then((response) => response.json());
  renderFinals(initialState);

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    renderFinals(JSON.parse(event.data));
  };
}

elements.imageA.addEventListener("error", () => {
  elements.imageA.hidden = true;
});

elements.imageB.addEventListener("error", () => {
  elements.imageB.hidden = true;
});

elements.logo.addEventListener("error", () => {
  elements.logo.hidden = true;
  elements.logoBadge.hidden = true;
});

bootFinals().catch((error) => {
  console.error(error);
});
