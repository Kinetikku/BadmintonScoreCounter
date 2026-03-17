const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const {
  applyScoreDelta,
  createDefaultState,
  endFinalsAnimation,
  resetMatch,
  setCurrentGameScore,
  startNextGame,
  triggerFinalsAnimation,
  updateSettings,
  updateTeams
} = require("./src/match-logic");
const {
  applyManagedMutation,
  applyManagedUndo,
  getPublicState,
  hydrateState
} = require("./src/shared/match-state-store");

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

const MAX_REQUEST_BODY_BYTES = 15_000_000;
const clients = new Set();
fs.mkdirSync(DATA_DIR, { recursive: true });
let state = loadState();

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      const freshState = hydrateState(createDefaultState());
      fs.writeFileSync(STATE_FILE, JSON.stringify(freshState, null, 2));
      return freshState;
    }

    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return hydrateState(parsed);
  } catch (error) {
    console.warn("Could not load saved state, starting fresh.", error);
    return hydrateState(createDefaultState());
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function broadcastState() {
  const payload = `data: ${JSON.stringify(getPublicState(state))}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

function mutateState(mutator) {
  state = applyManagedMutation(state, mutator);
  saveState();
  broadcastState();
  return getPublicState(state);
}

function undoState() {
  state = applyManagedUndo(state);
  saveState();
  broadcastState();
  return getPublicState(state);
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
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > MAX_REQUEST_BODY_BYTES) {
        reject(new Error("Request body too large. Use smaller images or compressed PNG/WebP files."));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
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

  if (urlPath === "/finals") {
    return path.join(PUBLIC_DIR, "finals.html");
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
    sendJson(response, 200, getPublicState(state));
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive"
    });
    response.write("retry: 1000\n");
    response.write(`data: ${JSON.stringify(getPublicState(state))}\n\n`);
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
      sendJson(response, 200, mutateState((draft) => updateSettings(draft, payload)));
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/teams") {
    try {
      const payload = await parseBody(request);
      sendJson(response, 200, mutateState((draft) => updateTeams(draft, payload)));
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/finals/trigger") {
    sendJson(response, 200, mutateState((draft) => triggerFinalsAnimation(draft)));
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/finals/end") {
    sendJson(response, 200, mutateState((draft) => endFinalsAnimation(draft)));
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
    sendJson(response, 200, mutateState((draft) => startNextGame(draft)));
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/match/reset") {
    try {
      const payload = await parseBody(request);
      sendJson(response, 200, mutateState((draft) => resetMatch(draft, payload)));
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/undo") {
    sendJson(response, 200, undoState());
    return;
  }

  if (request.method === "GET") {
    const filePath = resolveStaticPath(requestUrl.pathname);

    if (!filePath) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    sendFile(response, filePath);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  const urls = getLocalUrls();
  console.log("Badminton scoreboard is live.");
  for (const url of urls) {
    console.log(`- Admin: ${url}/admin`);
    console.log(`- Overlay: ${url}/overlay`);
    console.log(`- Finals: ${url}/finals`);
  }
});
