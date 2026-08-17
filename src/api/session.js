const crypto = require("crypto");

const COOKIE = "photochak_sid";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

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

function getSession(req) {
  const sid = parseCookies(req)[COOKIE];
  if (!sid) return null;
  const row = sessions.get(sid);
  if (!row || row.exp < Date.now()) {
    sessions.delete(sid);
    return null;
  }
  return row;
}

function createSession(user) {
  const sid = crypto.randomBytes(32).toString("hex");
  sessions.set(sid, {
    email: user.email,
    sub: user.sub,
    subscribed: true,
    exp: Date.now() + TTL_MS,
  });
  return sid;
}

function clearSession(req) {
  const sid = parseCookies(req)[COOKIE];
  if (sid) sessions.delete(sid);
}

function cookieHeader(sid, clear) {
  if (clear) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TTL_MS / 1000)}`;
}

module.exports = { getSession, createSession, clearSession, cookieHeader };
