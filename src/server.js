const { loadEnv } = require("./api/env");
loadEnv();

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApi } = require("./api/router");

const PORT = Number(process.env.PORT) || 4173;
const DIST_ROOT = path.join(__dirname, "..", "dist");
const PUBLIC_ROOT = path.join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const rel = decoded.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!rel || rel.split("/").includes("..")) return null;
  const target = path.normalize(path.join(root, rel));
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(prefix)) return null;
  return target;
}

function resolveRequest(url) {
  const decoded = decodeURIComponent((url || "/").split("?")[0]);
  const webRoot = fs.existsSync(DIST_ROOT) ? DIST_ROOT : PUBLIC_ROOT;
  if (decoded === "/" || decoded === "") {
    return safeJoin(webRoot, "/index.html");
  }
  const fromWeb = safeJoin(webRoot, decoded);
  if (fromWeb && fs.existsSync(fromWeb) && fs.statSync(fromWeb).isFile()) {
    return fromWeb;
  }
  return safeJoin(PUBLIC_ROOT, decoded);
}

const server = http.createServer((req, res) => {
  handleApi(req, res)
    .then((hit) => {
      if (hit) return;
      const filePath = resolveRequest(req.url);
      if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.stat(filePath, (err, st) => {
        if (err || !st.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found — npm run build 후 npm start, 또는 npm run dev");
          return;
        }
        const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        const isImg = type.startsWith("image/");
        res.writeHead(200, {
          "Content-Type": type,
          "Cache-Control": isImg ? "public, max-age=86400" : "no-cache",
          "Access-Control-Allow-Origin": "*",
        });
        fs.createReadStream(filePath).pipe(res);
      });
    })
    .catch(() => {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "server_error" }));
    });
});

server.on("error", (err) => {
  const code = /** @type {NodeJS.ErrnoException} */ (err).code;
  if (code === "EADDRINUSE") {
    console.log(`이미 실행 중: http://localhost:${PORT}`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`포토착착 API/정적: http://localhost:${PORT}`);
});
