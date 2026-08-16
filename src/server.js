const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 4173;
const PUBLIC_ROOT = path.join(__dirname, "..", "public");
const SRC_ROOT = __dirname;
const WEB_SRC = new Set(["app", "components", "hooks", "services", "lib", "types"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
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
  if (decoded === "/" || decoded === "") {
    return safeJoin(PUBLIC_ROOT, "/index.html");
  }
  if (decoded === "/src" || decoded.startsWith("/src/")) {
    const rel = decoded.slice("/src".length).replace(/^[/\\]+/, "").replace(/\\/g, "/");
    const top = rel.split("/")[0];
    if (!WEB_SRC.has(top) || path.extname(rel).toLowerCase() !== ".js") return null;
    return safeJoin(SRC_ROOT, "/" + rel);
  }
  return safeJoin(PUBLIC_ROOT, decoded);
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequest(req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const isImg = type.startsWith("image/");
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": isImg ? "public, max-age=86400" : "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`포토착착: http://localhost:${PORT}`);
});
