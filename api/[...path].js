const { loadEnv } = require("../src/api/env");
loadEnv();

const { handleApi } = require("../src/api/router");

function withApiUrl(req) {
  const raw = String(req.url || "/");
  if (raw.startsWith("/api")) return;
  req.url = "/api" + (raw.startsWith("/") ? raw : `/${raw}`);
}

module.exports = async function handler(req, res) {
  withApiUrl(req);
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
