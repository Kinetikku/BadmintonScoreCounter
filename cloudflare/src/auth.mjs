const SESSION_COOKIE = "badminton_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(secret, value) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

async function verifySignedValue(secret, value, signature) {
  const key = await importHmacKey(secret);
  return crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(value));
}

function parseCookies(header) {
  const cookieMap = new Map();
  const raw = header || "";

  for (const part of raw.split(/;\s*/)) {
    if (!part) {
      continue;
    }

    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookieMap.set(name, value);
  }

  return cookieMap;
}

async function createSessionCookie(secret, matchId) {
  const payload = JSON.stringify({
    matchId,
    issuedAt: Date.now()
  });
  const encodedPayload = toBase64Url(new TextEncoder().encode(payload));
  const signature = await signValue(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function readSession(request, secret) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const raw = cookies.get(SESSION_COOKIE);

  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return null;
  }

  const isValid = await verifySignedValue(secret, payload, signature);
  if (!isValid) {
    return null;
  }

  try {
    const decoded = new TextDecoder().decode(fromBase64Url(payload));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function buildSessionCookie(value) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

function buildLogoutCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function requireSecrets(env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    throw new Error("Missing ADMIN_PASSWORD or SESSION_SECRET in Worker environment.");
  }
}

export {
  buildLogoutCookie,
  buildSessionCookie,
  createSessionCookie,
  readSession,
  requireSecrets,
  SESSION_COOKIE
};
