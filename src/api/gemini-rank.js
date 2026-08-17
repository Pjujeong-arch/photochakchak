const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function systemPrompt() {
  return `당신은 사진 편집장이다. 한국어로만 답한다.
기준: 초점·노출·구도(삼분할·여백·깊이)·결정적 순간·빛. 인물은 눈·표정, 풍경은 수평·전경·빛의 시간을 우선한다.
문서·흐림·눈감김은 고르지 마라.
반드시 JSON만 출력한다. id는 입력 id만 사용한다. reason은 관측 한 문장.`;
}

function userPrompt(mode, folder, from, to) {
  const range = [folder && `월폴더 ${folder}`, from && `시작 ${from}`, to && `끝 ${to}`].filter(Boolean).join(", ");
  if (mode === "sample") {
    return `역할: 샘플 추천. 인물 사진 최대 3장, 풍경 사진 최대 3장을 고른다. ${range || "기간 제한 없음"}.
JSON: {"portraits":[{"id":"0","rank":1,"genre":"인물","name":"파일명","reason":""}],"landscapes":[...],"top10":[],"nextRun":"다음 실행 한 줄 추천"}`;
  }
  return `역할: 베스트 10 우선순위. 최대 10장. ${range || "기간 제한 없음"}.
JSON: {"portraits":[],"landscapes":[],"top10":[{"id":"0","rank":1,"genre":"인물|풍경|기타","name":"파일명","reason":""}],"nextRun":"다음 실행 한 줄 추천"}`;
}

function sanitizeList(items, allowed, limit) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "");
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    const name = allowed.get(id);
    out.push({
      id,
      rank: Math.min(99, Math.max(1, Number(raw.rank) || out.length + 1)),
      genre: String(raw.genre || "").slice(0, 20),
      name: String(name || "").slice(0, 180),
      reason: String(raw.reason || "").slice(0, 240),
    });
    if (out.length >= limit) break;
  }
  return out;
}

function parseModelJson(text) {
  const raw = String(text || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model_json");
  return JSON.parse(raw.slice(start, end + 1));
}

function validateImages(images, cap) {
  if (!Array.isArray(images) || images.length < 1 || images.length > cap) {
    throw new Error("images_range");
  }
  return images.map((img, i) => {
    const mime = String(img && img.mime ? img.mime : "");
    const data = String(img && img.data ? img.data : "").replace(/\s/g, "");
    const name = String(img && img.name ? img.name : `photo-${i}`).slice(0, 180);
    const id = String(img && img.id != null ? img.id : String(i)).slice(0, 16);
    if (!ALLOWED_MIME.has(mime)) throw new Error("mime");
    if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length > 280000) throw new Error("data");
    return { id, name, mime, data };
  });
}

async function rankWithGemini({ mode, folder, from, to, images }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("missing_gemini_key");
  const preferred = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const models = [
    preferred,
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
  ].filter((name, i, arr) => arr.indexOf(name) === i);
  const cap = mode === "sample" ? 12 : 20;
  const safe = validateImages(images, cap);
  const parts = /** @type {object[]} */ ([{ text: `${systemPrompt()}\n${userPrompt(mode, folder, from, to)}` }]);
  safe.forEach((img) => {
    parts.push({ text: `id=${img.id} name=${img.name}` });
    parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
  });
  let lastErr = "gemini_failed";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
    const body = /** @type {Record<string, any>} */ (await res.json().catch(() => ({})));
    if (res.status === 404) continue;
    if (!res.ok) {
      const raw = body.error && body.error.message ? String(body.error.message) : "gemini_failed";
      if (/prepayment|credits|billing|quota|RESOURCE_EXHAUSTED/i.test(raw)) {
        throw new Error("gemini_credits");
      }
      throw new Error(raw.slice(0, 280));
    }
    const text = (((body.candidates || [])[0] || {}).content || {}).parts
      ? body.candidates[0].content.parts.map((p) => p.text || "").join("")
      : "";
    const parsed = parseModelJson(text);
    const allowed = new Map(safe.map((img) => [img.id, img.name]));
    return {
      portraits: sanitizeList(parsed.portraits, allowed, 3),
      landscapes: sanitizeList(parsed.landscapes, allowed, 3),
      top10: sanitizeList(parsed.top10, allowed, 10),
      nextRun: String(parsed.nextRun || "").slice(0, 280),
    };
  }
  throw new Error(lastErr);
}

module.exports = { rankWithGemini };
