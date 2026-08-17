const crypto = require("crypto");

const COOKIE = "photochak_sid";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.GOOGLE_CLIENT_ID ||
    "photochak-dev-session"
  );
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 1) return;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function readToken(token) {
  const raw = String(token || "");
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  const expect = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const row = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!row || !row.email || !row.sub || row.exp < Date.now()) return null;
    return row;
  } catch {
    return null;
  }
}

function getSession(req) {
  return readToken(parseCookies(req)[COOKIE]);
}

function createSession(user) {
  return sign({
    email: user.email,
    sub: user.sub,
    subscribed: false,
    exp: Date.now() + TTL_MS,
  });
}

function activateSubscribe(req) {
  const row = getSession(req);
  if (!row) return null;
  row.subscribed = true;
  row.exp = Date.now() + TTL_MS;
  return { user: row, sid: sign(row) };
}

function clearSession() {
  /* cookie is cleared via Set-Cookie */
}

function cookieHeader(sid, clear) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  if (clear) {
    return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
  }
  return `${COOKIE}=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${Math.floor(TTL_MS / 1000)}`;
}

module.exports = { getSession, createSession, activateSubscribe, clearSession, cookieHeader };
