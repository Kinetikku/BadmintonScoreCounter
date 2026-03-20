const DEFAULT_SETTINGS = {
  eventName: "Badminton Championship",
  courtName: "Court 1",
  gameType: "singles",
  totalGames: 3,
  pointsToWin: 21,
  winBy: 2,
  hardCap: 30,
  logoUrl: "",
  showLogo: false,
  logoVersion: 0
};

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(numericValue)));
}

function cleanText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function createGame(index) {
  return {
    index,
    scoreA: 0,
    scoreB: 0,
    winner: null,
    completed: false,
    updatedAt: new Date().toISOString()
  };
}

function createDefaultState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    teams: {
      a: {
        displayName: "Court Left",
        players: ["Player A", "Player A2"],
        imageUrl: "",
        imageVersion: 0,
        profile: {
          racket: "",
          age: "",
          hand: "",
          nationality: "",
          club: ""
        }
      },
      b: {
        displayName: "Court Right",
        players: ["Player B", "Player B2"],
        imageUrl: "",
        imageVersion: 0,
        profile: {
          racket: "",
          age: "",
          hand: "",
          nationality: "",
          club: ""
        }
      }
    },
    presentation: {
      finalsTrigger: 0,
      finalsActive: false
    },
    games: [createGame(1)],
    summary: {
      activeGameNumber: 1,
      completedGames: 0,
      gamesNeededToWin: 2,
      winsA: 0,
      winsB: 0,
      currentGameComplete: false,
      canStartNextGame: false,
      matchWinner: null,
      matchComplete: false
    },
    meta: {
      lastUpdatedAt: new Date().toISOString()
    },
    history: []
  };
}

function normalizeSettings(rawSettings = {}) {
  const pointsToWin = clampNumber(rawSettings.pointsToWin ?? DEFAULT_SETTINGS.pointsToWin, 1, 99);
  const winBy = clampNumber(rawSettings.winBy ?? DEFAULT_SETTINGS.winBy, 1, 10);
  const hardCapFloor = Math.max(pointsToWin, pointsToWin + winBy - 1);
  const hardCap = clampNumber(rawSettings.hardCap ?? DEFAULT_SETTINGS.hardCap, hardCapFloor, 99);

  return {
    eventName: cleanText(rawSettings.eventName, DEFAULT_SETTINGS.eventName),
    courtName: cleanText(rawSettings.courtName, DEFAULT_SETTINGS.courtName),
    gameType: rawSettings.gameType === "doubles" ? "doubles" : "singles",
    totalGames: clampNumber(rawSettings.totalGames ?? DEFAULT_SETTINGS.totalGames, 1, 9),
    pointsToWin,
    winBy,
    hardCap,
    logoUrl: typeof rawSettings.logoUrl === "string" ? rawSettings.logoUrl.trim() : DEFAULT_SETTINGS.logoUrl,
    showLogo: Boolean(rawSettings.showLogo),
    logoVersion: clampNumber(rawSettings.logoVersion ?? DEFAULT_SETTINGS.logoVersion, 0, 9_999_999_999_999)
  };
}

function normalizeTeamProfile(rawProfile = {}) {
  return {
    racket: typeof rawProfile.racket === "string" ? rawProfile.racket.trim() : "",
    age: typeof rawProfile.age === "string" ? rawProfile.age.trim() : typeof rawProfile.age === "number" ? String(rawProfile.age) : "",
    hand: typeof rawProfile.hand === "string" ? rawProfile.hand.trim() : "",
    nationality: typeof rawProfile.nationality === "string" ? rawProfile.nationality.trim() : "",
    club: typeof rawProfile.club === "string" ? rawProfile.club.trim() : ""
  };
}

function normalizeTeams(rawTeams = {}) {
  const defaultState = createDefaultState();
  const teamA = rawTeams.a ?? {};
  const teamB = rawTeams.b ?? {};

  return {
    a: {
      displayName: cleanText(teamA.displayName, defaultState.teams.a.displayName),
      players: [
        cleanText(teamA.players?.[0], defaultState.teams.a.players[0]),
        cleanText(teamA.players?.[1], defaultState.teams.a.players[1])
      ],
      imageUrl: typeof teamA.imageUrl === "string" ? teamA.imageUrl.trim() : defaultState.teams.a.imageUrl,
      imageVersion: clampNumber(teamA.imageVersion ?? defaultState.teams.a.imageVersion, 0, 9_999_999_999_999),
      profile: normalizeTeamProfile(teamA.profile ?? defaultState.teams.a.profile)
    },
    b: {
      displayName: cleanText(teamB.displayName, defaultState.teams.b.displayName),
      players: [
        cleanText(teamB.players?.[0], defaultState.teams.b.players[0]),
        cleanText(teamB.players?.[1], defaultState.teams.b.players[1])
      ],
      imageUrl: typeof teamB.imageUrl === "string" ? teamB.imageUrl.trim() : defaultState.teams.b.imageUrl,
      imageVersion: clampNumber(teamB.imageVersion ?? defaultState.teams.b.imageVersion, 0, 9_999_999_999_999),
      profile: normalizeTeamProfile(teamB.profile ?? defaultState.teams.b.profile)
    }
  };
}

function normalizePresentation(rawPresentation = {}) {
  return {
    finalsTrigger: clampNumber(rawPresentation.finalsTrigger ?? 0, 0, 1_000_000_000),
    finalsActive: Boolean(rawPresentation.finalsActive)
  };
}

function deriveWinner(scoreA, scoreB, settings) {
  if (scoreA === scoreB) {
    return null;
  }

  const leader = scoreA > scoreB ? "a" : "b";
  const leadScore = Math.max(scoreA, scoreB);
  const trailScore = Math.min(scoreA, scoreB);

  if (leadScore >= settings.hardCap) {
    return leader;
  }

  if (leadScore >= settings.pointsToWin && leadScore - trailScore >= settings.winBy) {
    return leader;
  }

  return null;
}

function normalizeGames(rawGames, settings) {
  const games = Array.isArray(rawGames) && rawGames.length ? rawGames : [createGame(1)];
  const trimmed = games.slice(0, settings.totalGames);

  const normalizedGames = trimmed.map((rawGame, index) => {
    const scoreA = clampNumber(rawGame?.scoreA ?? 0, 0, settings.hardCap);
    const scoreB = clampNumber(rawGame?.scoreB ?? 0, 0, settings.hardCap);
    const winner = deriveWinner(scoreA, scoreB, settings);

    return {
      index: index + 1,
      scoreA,
      scoreB,
      winner,
      completed: Boolean(winner),
      updatedAt: typeof rawGame?.updatedAt === "string" ? rawGame.updatedAt : new Date().toISOString()
    };
  });

  return normalizedGames.length ? normalizedGames : [createGame(1)];
}

function gamesNeededToWin(totalGames) {
  return Math.floor(totalGames / 2) + 1;
}

function applyDerivedState(rawState = {}) {
  const settings = normalizeSettings(rawState.settings);
  const teams = normalizeTeams(rawState.teams);
  const presentation = normalizePresentation(rawState.presentation);
  const history = Array.isArray(rawState.history) ? rawState.history.slice(-50) : [];

  const games = normalizeGames(rawState.games, settings);
  const winsA = games.filter((game) => game.winner === "a").length;
  const winsB = games.filter((game) => game.winner === "b").length;
  const neededToWin = gamesNeededToWin(settings.totalGames);
  const matchWinner = winsA >= neededToWin ? "a" : winsB >= neededToWin ? "b" : null;
  const completedGames = games.filter((game) => game.completed).length;
  const activeGameIndex = games.findIndex((game) => !game.completed);
  const activeGameNumber = activeGameIndex === -1 ? Math.min(games.length, settings.totalGames) : activeGameIndex + 1;
  const currentGame = games[Math.max(activeGameIndex, games.length - 1)] ?? games[0];
  const canStartNextGame =
    !matchWinner &&
    completedGames < settings.totalGames &&
    Boolean(games[games.length - 1]?.completed) &&
    games.length < settings.totalGames;

  return {
    settings,
    teams,
    presentation,
    games,
    summary: {
      activeGameNumber,
      completedGames,
      gamesNeededToWin: neededToWin,
      winsA,
      winsB,
      currentGameComplete: currentGame?.completed ?? false,
      canStartNextGame,
      matchWinner,
      matchComplete: Boolean(matchWinner) || completedGames >= settings.totalGames
    },
    meta: {
      lastUpdatedAt: new Date().toISOString()
    },
    history
  };
}

function prepareUndoSnapshot(state) {
  const snapshot = structuredClone(state);
  snapshot.history = [];
  return snapshot;
}

function updateSettings(state, payload = {}) {
  const nextSettings = {
    ...state.settings,
    ...payload
  };

  if (Object.prototype.hasOwnProperty.call(payload, "logoUrl")) {
    nextSettings.logoVersion = Date.now();
  }

  return applyDerivedState({
    ...state,
    settings: nextSettings
  });
}

function updateTeams(state, payload = {}) {
  const nextTeams = {
    a: {
      ...state.teams.a,
      ...(payload.a ?? {}),
      profile: {
        ...state.teams.a.profile,
        ...(payload.a?.profile ?? {})
      }
    },
    b: {
      ...state.teams.b,
      ...(payload.b ?? {}),
      profile: {
        ...state.teams.b.profile,
        ...(payload.b?.profile ?? {})
      }
    }
  };

  if (payload.a && Object.prototype.hasOwnProperty.call(payload.a, "imageUrl")) {
    nextTeams.a.imageVersion = Date.now();
  }

  if (payload.b && Object.prototype.hasOwnProperty.call(payload.b, "imageUrl")) {
    nextTeams.b.imageVersion = Date.now();
  }

  return applyDerivedState({
    ...state,
    teams: nextTeams
  });
}

function triggerFinalsAnimation(state) {
  return applyDerivedState({
    ...state,
    presentation: {
      ...state.presentation,
      finalsTrigger: clampNumber((state.presentation?.finalsTrigger ?? 0) + 1, 0, 1_000_000_000),
      finalsActive: true
    }
  });
}

function endFinalsAnimation(state) {
  return applyDerivedState({
    ...state,
    presentation: {
      ...state.presentation,
      finalsActive: false
    }
  });
}

function applyScoreDelta(state, team, delta) {
  const nextState = structuredClone(state);
  const currentGameIndex = nextState.games.findIndex((game) => !game.completed);
  const targetIndex = currentGameIndex === -1 ? nextState.games.length - 1 : currentGameIndex;
  const currentGame = nextState.games[targetIndex];

  if (!currentGame || currentGame.completed) {
    return applyDerivedState(nextState);
  }

  if (team === "a") {
    currentGame.scoreA = clampNumber(currentGame.scoreA + delta, 0, nextState.settings.hardCap);
  } else {
    currentGame.scoreB = clampNumber(currentGame.scoreB + delta, 0, nextState.settings.hardCap);
  }

  currentGame.updatedAt = new Date().toISOString();
  return applyDerivedState(nextState);
}

function setCurrentGameScore(state, scoreA, scoreB) {
  const nextState = structuredClone(state);
  const currentGameIndex = nextState.games.findIndex((game) => !game.completed);
  const targetIndex = currentGameIndex === -1 ? nextState.games.length - 1 : currentGameIndex;
  const currentGame = nextState.games[targetIndex];

  if (!currentGame) {
    return applyDerivedState(nextState);
  }

  currentGame.scoreA = clampNumber(scoreA, 0, nextState.settings.hardCap);
  currentGame.scoreB = clampNumber(scoreB, 0, nextState.settings.hardCap);
  currentGame.updatedAt = new Date().toISOString();

  return applyDerivedState(nextState);
}

function startNextGame(state) {
  const nextState = applyDerivedState(structuredClone(state));

  if (!nextState.summary.canStartNextGame) {
    return nextState;
  }

  nextState.games.push(createGame(nextState.games.length + 1));
  return applyDerivedState(nextState);
}

function resetMatch(state, options = {}) {
  const keepSettings = options.keepSettings !== false;
  const keepTeams = options.keepTeams !== false;
  const defaultState = createDefaultState();

  return applyDerivedState({
    settings: keepSettings ? state.settings : defaultState.settings,
    teams: keepTeams ? state.teams : defaultState.teams,
    presentation: keepTeams ? state.presentation : defaultState.presentation,
    games: [createGame(1)],
    history: []
  });
}

function toPublicState(state) {
  const { history, ...publicState } = state;

  return {
    ...publicState,
    meta: {
      ...publicState.meta,
      undoDepth: history.length
    }
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  applyDerivedState,
  applyScoreDelta,
  createDefaultState,
  endFinalsAnimation,
  prepareUndoSnapshot,
  resetMatch,
  setCurrentGameScore,
  startNextGame,
  toPublicState,
  triggerFinalsAnimation,
  updateSettings,
  updateTeams
};



