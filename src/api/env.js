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
    if (!value) return;
    process.env[key] = value;
  });
}

/** Load `.env` then `.env.local` (local wins). Never commit secrets. Never wipe a non-empty process.env with an empty file value. */
function loadEnv() {
  parseEnvFile(path.join(ROOT, ".env"));
  parseEnvFile(path.join(ROOT, ".env.local"));
}

function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
}

function missingGoogleClientIdError() {
  if (process.env.VERCEL) {
    return "Vercel Environment Variables에 GOOGLE_CLIENT_ID가 없습니다. Production에 추가한 뒤 Redeploy 하세요.";
  }
  return "GOOGLE_CLIENT_ID가 .env.local에 없습니다. .env.example을 복사해 값을 넣으세요.";
}

module.exports = { loadEnv, googleClientId, missingGoogleClientIdError };
