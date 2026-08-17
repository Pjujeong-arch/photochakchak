const { loadEnv } = require("./env");
loadEnv();

const { handleApi } = require("./router");

function withApiUrl(req, forcedPath) {
  if (forcedPath) {
    req.url = forcedPath;
    return;
  }
  let raw = String(req.url || "/");
  try {
    if (/^https?:/i.test(raw)) raw = new URL(raw).pathname;
  } catch {
    /* keep raw */
  }
  const path = raw.split("?")[0];
  if (path.startsWith("/api")) {
    req.url = path;
    return;
  }
  req.url = "/api" + (path.startsWith("/") ? path : `/${path}`);
}

function vercelHandler(forcedPath) {
  return async function handler(req, res) {
    withApiUrl(req, forcedPath);
    try {
      const hit = await handleApi(req, res);
      if (!hit && !res.writableEnded) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "not found" }));
      }
    } catch {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "server_error" }));
      }
    }
  };
}

module.exports = { vercelHandler };
