const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PUBLIC = path.join(ROOT, "public");
const SRC = path.join(ROOT, "src");
const WEB_DIRS = ["app", "components", "hooks", "services", "types"];
const WEB_LIB = ["dom.js", "html.js", "time.js", "index.js"];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name);
    const dest = path.join(to, name);
    if (fs.statSync(src).isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
copyDir(PUBLIC, DIST);

for (const dir of WEB_DIRS) {
  copyDir(path.join(SRC, dir), path.join(DIST, "src", dir));
}

const libDest = path.join(DIST, "src", "lib");
fs.mkdirSync(libDest, { recursive: true });
for (const file of WEB_LIB) {
  fs.copyFileSync(path.join(SRC, "lib", file), path.join(libDest, file));
}

const required = ["index.html", "css/style.css", "src/app/main.js", "src/services/sort-engine.js"];
for (const rel of required) {
  const full = path.join(DIST, rel);
  if (!fs.existsSync(full)) throw new Error(`build missing: ${rel}`);
}

console.log(`build ok → ${DIST}`);
