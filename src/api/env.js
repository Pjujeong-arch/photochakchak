const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq < 1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

/** Load `.env` then `.env.local` (local wins). Never commit secrets. */
function loadEnv() {
  parseEnvFile(path.join(ROOT, ".env"));
  parseEnvFile(path.join(ROOT, ".env.local"));
}

module.exports = { loadEnv };
