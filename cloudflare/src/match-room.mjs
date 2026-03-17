import {
  applyScoreDelta,
  createDefaultState,
  endFinalsAnimation,
  resetMatch,
  setCurrentGameScore,
  startNextGame,
  triggerFinalsAnimation,
  updateSettings,
  updateTeams
} from "./match-logic.mjs";
import {
  applyManagedMutation,
  applyManagedUndo,
  getPublicState,
  hydrateState
} from "./match-state-store.mjs";

const STATE_KEY = "match_state";
const SSE_RETRY_MS = 1000;
const encoder = new TextEncoder();

function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export class MatchRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.cachedState = null;
    this.clients = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const endpoint = this.getEndpoint(url.pathname);

    if (!endpoint) {
      return new Response("Not found", { status: 404 });
    }

    try {
      if (request.method === "GET" && endpoint === "/state") {
        const state = await this.loadState();
        return jsonResponse(getPublicState(state));
      }

      if (request.method === "GET" && endpoint === "/events") {
        const state = await this.loadState();
        return this.openEventsStream(state, request.signal);
      }

      if (request.method === "POST" && endpoint === "/settings") {
        const payload = await this.readJsonBody(request);
        return jsonResponse(await this.mutate((draft) => updateSettings(draft, payload)));
      }

      if (request.method === "POST" && endpoint === "/teams") {
        const payload = await this.readJsonBody(request);
        return jsonResponse(await this.mutate((draft) => updateTeams(draft, payload)));
      }

      if (request.method === "POST" && endpoint === "/finals/trigger") {
        return jsonResponse(await this.mutate((draft) => triggerFinalsAnimation(draft)));
      }

      if (request.method === "POST" && endpoint === "/finals/end") {
        return jsonResponse(await this.mutate((draft) => endFinalsAnimation(draft)));
      }

      if (request.method === "POST" && endpoint === "/score") {
        const payload = await this.readJsonBody(request);
        return jsonResponse(await this.mutate((draft) => {
          if (typeof payload.teamAScore !== "undefined" || typeof payload.teamBScore !== "undefined") {
            const currentGame = draft.games.find((game) => !game.completed) || draft.games[draft.games.length - 1];
            return setCurrentGameScore(
              draft,
              payload.teamAScore ?? currentGame?.scoreA ?? 0,
              payload.teamBScore ?? currentGame?.scoreB ?? 0
            );
          }

          return applyScoreDelta(draft, payload.team, Number(payload.delta) || 0);
        }));
      }

      if (request.method === "POST" && endpoint === "/game/next") {
        return jsonResponse(await this.mutate((draft) => startNextGame(draft)));
      }

      if (request.method === "POST" && endpoint === "/match/reset") {
        const payload = await this.readJsonBody(request);
        return jsonResponse(await this.mutate((draft) => resetMatch(draft, payload)));
      }

      if (request.method === "POST" && endpoint === "/undo") {
        return jsonResponse(await this.undo());
      }
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Request failed." }, 400);
    }

    return new Response("Method not allowed", { status: 405 });
  }

  getEndpoint(pathname) {
    const matchPrefix = pathname.match(/^\/matches\/[^/]+(\/.*)$/);
    if (!matchPrefix) {
      return null;
    }

    return matchPrefix[1] || "/state";
  }

  async loadState() {
    if (this.cachedState) {
      return this.cachedState;
    }

    const stored = await this.state.storage.get(STATE_KEY);
    const hydrated = hydrateState(stored || createDefaultState());

    if (!stored) {
      await this.state.storage.put(STATE_KEY, hydrated);
    }

    this.cachedState = hydrated;
    return hydrated;
  }

  async saveState(nextState) {
    this.cachedState = nextState;
    await this.state.storage.put(STATE_KEY, nextState);
  }

  async mutate(mutator) {
    const currentState = await this.loadState();
    const nextState = applyManagedMutation(currentState, mutator);
    await this.saveState(nextState);
    await this.broadcastState(nextState);
    return getPublicState(nextState);
  }

  async undo() {
    const currentState = await this.loadState();
    const nextState = applyManagedUndo(currentState);
    await this.saveState(nextState);
    await this.broadcastState(nextState);
    return getPublicState(nextState);
  }

  async readJsonBody(request) {
    const text = await request.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON body.");
    }
  }

  openEventsStream(state, signal) {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const client = { writer };

    this.clients.add(client);

    if (signal) {
      signal.addEventListener("abort", () => {
        this.closeClient(client);
      }, { once: true });
    }

    void this.writeEvent(writer, `retry: ${SSE_RETRY_MS}\n`);
    void this.writeEvent(writer, this.buildSsePayload(state));

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive"
      }
    });
  }

  buildSsePayload(state) {
    return `data: ${JSON.stringify(getPublicState(state))}\n\n`;
  }

  async broadcastState(state) {
    const payload = this.buildSsePayload(state);
    const disconnectedClients = [];

    for (const client of this.clients) {
      try {
        await this.writeEvent(client.writer, payload);
      } catch {
        disconnectedClients.push(client);
      }
    }

    await Promise.all(disconnectedClients.map((client) => this.closeClient(client)));
  }

  async writeEvent(writer, value) {
    await writer.write(encoder.encode(value));
  }

  async closeClient(client) {
    if (!this.clients.has(client)) {
      return;
    }

    this.clients.delete(client);

    try {
      await client.writer.close();
    } catch {
      try {
        await client.writer.abort();
      } catch {
        // Ignore closed stream errors during client cleanup.
      }
    }
  }
}
