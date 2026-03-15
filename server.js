const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const {
  applyDerivedState,
  createDefaultState,
  prepareUndoSnapshot,
  resetMatch,
  setCurrentGameScore,
  startNextGame,
  toPublicState,
  updateSettings,
  updateTeams,
  applyScoreDelta
} = require("./src/match-logic");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STATE_FILE = path.join(DATA_DIR, "match-state.json");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const clients = new Set();
fs.mkdirSync(DATA_DIR, { recursive: true });
let state = loadState();

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      const freshState = applyDerivedState(createDefaultState());
      fs.writeFileSync(STATE_FILE, JSON.stringify(freshState, null, 2));
      return freshState;
    }

    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return applyDerivedState(parsed);
  } catch (error) {
    console.warn("Could not load saved state, starting fresh.", error);
    return applyDerivedState(createDefaultState());
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function broadcastState() {
  const payload = `data: ${JSON.stringify(toPublicState(state))}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

function mutateState(mutator) {
  const snapshot = prepareUndoSnapshot(state);
  const nextState = mutator(structuredClone(state));

  state = applyDerivedState(nextState);
  state.history = [...(state.history || []), snapshot].slice(-50);

  saveState();
  broadcastState();

  return toPublicState(state);
}

function undoState() {
  if (!state.history.length) {
    return toPublicState(state);
  }

  const previous = state.history[state.history.length - 1];
  const remainingHistory = state.history.slice(0, -1);
  state = applyDerivedState(previous);
  state.history = remainingHistory;

  saveState();
  broadcastState();

  return toPublicState(state);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath);
  const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

  try {
    const fileBuffer = fs.readFileSync(filePath);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=300"
    });
    response.end(fileBuffer);
  } catch (error) {
    sendJson(response, 404, { error: "Not found" });
  }
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

function resolveStaticPath(urlPath) {
  if (urlPath === "/" || urlPath === "/admin") {
    return path.join(PUBLIC_DIR, "admin.html");
  }

  if (urlPath === "/overlay") {
    return path.join(PUBLIC_DIR, "overlay.html");
  }

  const localPath = path.normalize(path.join(PUBLIC_DIR, urlPath.replace(/^\/+/, "")));
  if (!localPath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return localPath;
}

function getLocalUrls() {
  const urls = [`http://localhost:${PORT}`];
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${PORT}`);
      }
    }
  }

  return Array.from(new Set(urls));
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || `localhost:${PORT}`}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/state") {
    sendJson(response, 200, toPublicState(state));
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive"
    });
    response.write("retry: 1000\n");
    response.write(`data: ${JSON.stringify(toPublicState(state))}\n\n`);
    clients.add(response);

    request.on("close", () => {
      clients.delete(response);
      response.end();
    });

    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/settings") {
    try {
      const payload = await parseBody(request);
      const publicState = mutateState((draft) => updateSettings(draft, payload));
      sendJson(response, 200, publicState);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/teams") {
    try {
      const payload = await parseBody(request);
      const publicState = mutateState((draft) => updateTeams(draft, payload));
      sendJson(response, 200, publicState);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/score") {
    try {
      const payload = await parseBody(request);
      const publicState = mutateState((draft) => {
        if (typeof payload.teamAScore !== "undefined" || typeof payload.teamBScore !== "undefined") {
          const currentGame = draft.games.find((game) => !game.completed) || draft.games[draft.games.length - 1];
          return setCurrentGameScore(
            draft,
            payload.teamAScore ?? currentGame?.scoreA ?? 0,
            payload.teamBScore ?? currentGame?.scoreB ?? 0
          );
        }

        return applyScoreDelta(draft, payload.team, Number(payload.delta) || 0);
      });
      sendJson(response, 200, publicState);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/game/next") {
    const publicState = mutateState((draft) => startNextGame(draft));
    sendJson(response, 200, publicState);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/match/reset") {
    try {
      const payload = await parseBody(request);
      const publicState = mutateState((draft) => resetMatch(draft, payload));
      sendJson(response, 200, publicState);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/undo") {
    const publicState = undoState();
    sendJson(response, 200, publicState);
    return;
  }

  if (request.method === "GET") {
    const staticPath = resolveStaticPath(requestUrl.pathname);
    if (staticPath) {
      sendFile(response, staticPath);
      return;
    }
  }

  sendJson(response, 404, { error: "Route not found." });
});

setInterval(() => {
  for (const client of clients) {
    client.write(": keep-alive\n\n");
  }
}, 15_000).unref();

server.listen(PORT, HOST, () => {
  console.log("Badminton score server running.");
  for (const url of getLocalUrls()) {
    console.log(`  Admin:   ${url}/admin`);
    console.log(`  Overlay: ${url}/overlay`);
  }
});


