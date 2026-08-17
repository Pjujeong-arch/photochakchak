const { readJson, sendJson, ymd, monthKey } = require("./http");
const { getSession, createSession, clearSession, cookieHeader } = require("./session");
const { verifyGoogleCredential } = require("./google-auth");
const { rankWithGemini } = require("./gemini-rank");

const lastCall = new Map();

function route(req) {
  const decoded = decodeURIComponent((req.url || "/").split("?")[0]);
  return { method: req.method || "GET", path: decoded };
}

async function handleApi(req, res) {
  const { method, path } = route(req);

  if (method === "GET" && path === "/api/config") {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    sendJson(res, 200, {
      googleClientId: clientId,
      authReady: Boolean(clientId),
    });
    return true;
  }

  if (method === "GET" && path === "/api/me") {
    const sess = getSession(req);
    sendJson(res, 200, sess ? { email: sess.email, subscribed: Boolean(sess.subscribed) } : { email: "", subscribed: false });
    return true;
  }

  if (method === "POST" && path === "/api/auth/google") {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    if (!clientId) {
      sendJson(res, 503, { error: "GOOGLE_CLIENT_ID가 .env.local에 없습니다." });
      return true;
    }
    try {
      const body = await readJson(req, 8000);
      const user = await verifyGoogleCredential(body.credential, clientId);
      const sid = createSession(user);
      sendJson(res, 200, { email: user.email, subscribed: true }, { "Set-Cookie": cookieHeader(sid, false) });
    } catch {
      sendJson(res, 401, { error: "구글 로그인 검증에 실패했습니다." });
    }
    return true;
  }

  if (method === "POST" && path === "/api/auth/logout") {
    clearSession(req);
    sendJson(res, 200, { ok: true }, { "Set-Cookie": cookieHeader("", true) });
    return true;
  }

  if (method === "POST" && path === "/api/rank") {
    const sess = getSession(req);
    if (!sess || !sess.subscribed) {
      sendJson(res, 401, { error: "구글 로그인(구독안)이 필요합니다." });
      return true;
    }
    const now = Date.now();
    const prev = lastCall.get(sess.sub) || 0;
    if (now - prev < 4000) {
      sendJson(res, 429, { error: "잠시 후 다시 시도해 주세요." });
      return true;
    }
    lastCall.set(sess.sub, now);
    try {
      const body = await readJson(req, 6 * 1024 * 1024);
      const mode = body.mode === "top10" ? "top10" : "sample";
      const folder = String(body.folder || "");
      const from = String(body.from || "");
      const to = String(body.to || "");
      if (!monthKey(folder) || (from && !ymd(from)) || (to && !ymd(to))) {
        sendJson(res, 400, { error: "폴더 또는 날짜 형식이 올바르지 않습니다." });
        return true;
      }
      const result = await rankWithGemini({
        mode,
        folder,
        from,
        to,
        images: body.images,
      });
      sendJson(res, 200, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "rank_failed";
      if (msg === "missing_gemini_key") {
        sendJson(res, 503, { error: "GEMINI_API_KEY가 .env.local에 없습니다." });
      } else if (msg === "payload_too_large" || msg === "invalid_json" || msg === "images_range" || msg === "mime" || msg === "data") {
        sendJson(res, 400, { error: "보낸 사진 데이터가 올바르지 않습니다." });
      } else {
        sendJson(res, 502, { error: "Google AI 추천에 실패했습니다." });
      }
    }
    return true;
  }

  if (path.startsWith("/api/")) {
    sendJson(res, 404, { error: "not found" });
    return true;
  }
  return false;
}

module.exports = { handleApi };
