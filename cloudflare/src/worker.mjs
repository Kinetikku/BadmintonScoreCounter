import { buildLogoutCookie, buildSessionCookie, createSessionCookie, readSession, requireSecrets } from "./auth.mjs";
import { uploadImageToCloudinary } from "./cloudinary.mjs";
import { MatchRoom } from "./match-room.mjs";
import {
  extractMatchId,
  html,
  redirectResponse,
  renderAdminAppPage,
  renderFinalsAppPage,
  renderOverlayAppPage,
  routeKind
} from "./html.mjs";

const DEFAULT_MATCH_ID = "default";
const PUBLIC_API_PATHS = new Set(["/state", "/events"]);
const HTML_REDIRECTS = new Map([
  ["/admin.html", "/admin"],
  ["/overlay.html", "/overlay"],
  ["/finals.html", "/finals"]
]);

function getRoomStub(env, matchId) {
  const id = env.MATCH_ROOM.idFromName(matchId);
  return env.MATCH_ROOM.get(id);
}

function getEffectiveMatchId(pathname) {
  return pathname === "/admin" || pathname === "/overlay" || pathname === "/finals"
    ? DEFAULT_MATCH_ID
    : extractMatchId(pathname);
}

function pageTitle(kind) {
  const titles = {
    admin: "Admin Route Scaffold",
    overlay: "Overlay Route Scaffold",
    finals: "Finals Route Scaffold"
  };

  return titles[kind] || "Route Scaffold";
}

function renderLoginPage(nextPath, errorMessage = "") {
  return new Response(
    html(
      "Admin Login",
      `
        <section class="panel stack">
          <div>
            <h1>Admin Login</h1>
            <p class="muted">Use the shared admin password to access the scoreboard controls from your phone or desktop.</p>
          </div>
          ${errorMessage ? `<p class="error">${errorMessage}</p>` : ""}
          <form method="post" action="/login" class="stack">
            <input type="hidden" name="next" value="${nextPath}">
            <label class="stack">
              <span>Password</span>
              <input name="password" type="password" autocomplete="current-password" required>
            </label>
            <button type="submit">Enter Admin</button>
          </form>
        </section>
      `
    ),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

async function renderScaffoldPage(kind, matchId, isAuthenticated) {
  const title = pageTitle(kind);
  const adminActions = isAuthenticated
    ? `<p><a class="link" href="/logout">Log out</a></p>`
    : `<p><a class="link" href="/login?next=/admin">Log in</a></p>`;
  const apiList = kind === "admin"
    ? `
      <ul>
        <li><code>GET /api/state</code> and <code>GET /api/events</code> are live on the Durable Object.</li>
        <li><code>POST /api/settings</code>, <code>/api/teams</code>, <code>/api/score</code>, <code>/api/game/next</code>, <code>/api/match/reset</code>, <code>/api/undo</code>, <code>/api/finals/trigger</code>, and <code>/api/finals/end</code> are wired and password-protected.</li>
        <li><code>POST /api/uploads/image</code> uploads selected finals images and logos to Cloudinary when Worker secrets are configured.</li>
        <li>The next slice is polishing deployment documentation and pushing the branch updates.</li>
      </ul>
    `
    : `<p class="muted">This route is intended to stay public for OBS browser sources.</p>`;

  return new Response(
    html(
      title,
      `
        <section class="panel stack">
          <h1>${title}</h1>
          <p>This is the production scaffold for match <code>${matchId}</code>.</p>
          ${apiList}
          ${kind === "admin" ? adminActions : ""}
        </section>
      `
    ),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

async function handleLogin(request, env) {
  requireSecrets(env);

  if (request.method === "GET") {
    const nextPath = new URL(request.url).searchParams.get("next") || "/admin";
    return renderLoginPage(nextPath);
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextPath = String(formData.get("next") || "/admin");

  if (password !== env.ADMIN_PASSWORD) {
    return renderLoginPage(nextPath, "The password was not correct.");
  }

  const sessionValue = await createSessionCookie(env.SESSION_SECRET, DEFAULT_MATCH_ID);
  const response = redirectResponse(nextPath.startsWith("/") ? nextPath : "/admin");
  response.headers.set("Set-Cookie", buildSessionCookie(sessionValue));
  return response;
}

async function handleLogout() {
  const response = redirectResponse("/login");
  response.headers.set("Set-Cookie", buildLogoutCookie());
  return response;
}

async function requireAdminSession(request, env) {
  requireSecrets(env);
  const session = await readSession(request, env.SESSION_SECRET);
  return Boolean(session && session.matchId === DEFAULT_MATCH_ID);
}

function parseApiTarget(pathname) {
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  if (pathname.startsWith("/api/matches/")) {
    const parts = pathname.split("/").filter(Boolean);
    const matchId = parts[2] || DEFAULT_MATCH_ID;
    const endpoint = `/${parts.slice(3).join("/")}`;
    return {
      matchId,
      endpoint: endpoint === "/" ? "/state" : endpoint
    };
  }

  return {
    matchId: DEFAULT_MATCH_ID,
    endpoint: pathname.replace(/^\/api/, "") || "/state"
  };
}

async function handleUploadRequest(request, env) {
  const uploaded = await uploadImageToCloudinary(request, env);
  return Response.json(uploaded, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

async function handleApiRequest(request, env) {
  const target = parseApiTarget(new URL(request.url).pathname);
  if (!target) {
    return new Response("Not found", { status: 404 });
  }

  if (!PUBLIC_API_PATHS.has(target.endpoint)) {
    const hasSession = await requireAdminSession(request, env);
    if (!hasSession) {
      return Response.json({ error: "Authentication required." }, {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      });
    }
  }

  if (target.endpoint === "/uploads/image") {
    return handleUploadRequest(request, env);
  }

  const room = getRoomStub(env, target.matchId);
  const roomUrl = new URL(`https://room.internal/matches/${target.matchId}${target.endpoint}`);
  return room.fetch(new Request(roomUrl, request));
}

export { MatchRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const kind = routeKind(url.pathname);
    const matchId = getEffectiveMatchId(url.pathname);

    if (url.pathname === "/") {
      return redirectResponse("/admin");
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, runtime: "cloudflare-worker-single-match" });
    }

    if (HTML_REDIRECTS.has(url.pathname)) {
      return redirectResponse(HTML_REDIRECTS.get(url.pathname));
    }

    if (url.pathname === "/login") {
      return handleLogin(request, env);
    }

    if (url.pathname === "/logout") {
      return handleLogout();
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env);
    }

    if (url.pathname === "/admin") {
      const hasSession = await requireAdminSession(request, env);
      if (!hasSession) {
        return redirectResponse(`/login?next=${encodeURIComponent("/admin")}`);
      }

      return renderAdminAppPage();
    }

    if (url.pathname === "/overlay") {
      return renderOverlayAppPage();
    }

    if (url.pathname === "/finals") {
      return renderFinalsAppPage();
    }

    if (kind === "admin") {
      const hasSession = await requireAdminSession(request, env);
      if (!hasSession) {
        return redirectResponse(`/login?next=${encodeURIComponent(url.pathname)}`);
      }

      return renderScaffoldPage(kind, matchId, true);
    }

    if ((kind === "overlay" || kind === "finals") && !env.ASSETS) {
      return renderScaffoldPage(kind, matchId, false);
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return new Response("Not found", { status: 404 });
  }
};
