async function readJson(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const err = new Error("payload_too_large");
      throw err;
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid_json");
  }
}

function sendJson(res, status, body, extraHeaders) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

function ymd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function monthKey(value) {
  const v = String(value || "");
  return v === "" || /^\d{4}-\d{2}$/.test(v);
}

module.exports = { readJson, sendJson, ymd, monthKey };
