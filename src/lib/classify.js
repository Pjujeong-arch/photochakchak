const IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".bmp", ".gif", ".heic", ".heif",
]);
const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".wmv", ".3gp",
]);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const UNCLASSIFIED_DIR = "미분류";
const OTHER_DIR = "기타파일";
const MANIFEST_NAME = ".photochak_last_run.json";
const SKIP_NAMES = new Set([MANIFEST_NAME.toLowerCase(), "thumbs.db", "desktop.ini"]);
const FILENAME_DATE_PATTERNS = [
  /(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/,
  /(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_-]?\d{4,6}/,
];

function fileExt(name) {
  const dot = (name || "").lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

function isSkippedName(name) {
  const n = (name || "").toLowerCase();
  return !n || n.startsWith(".") || SKIP_NAMES.has(n);
}

function isMediaFile(name) {
  return MEDIA_EXTENSIONS.has(fileExt(name));
}

function fileKind(name) {
  const ext = fileExt(name);
  if (IMAGE_EXTENSIONS.has(ext)) return "photo";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "other";
}

function validYear(dt) {
  const year = dt.getFullYear();
  const now = new Date().getFullYear();
  return year >= 1995 && year <= now + 1;
}

function parseExifDatetime(value) {
  const raw = String(value).trim();
  const formats = [
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
    /^(\d{4}):(\d{2}):(\d{2})/,
  ];
  for (const re of formats) {
    const m = raw.match(re);
    if (!m) continue;
    const dt = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      m[4] ? Number(m[4]) : 0,
      m[5] ? Number(m[5]) : 0,
      m[6] ? Number(m[6]) : 0
    );
    if (!Number.isNaN(dt.getTime()) && validYear(dt)) return dt;
  }
  return null;
}

function readAscii(view, offset, length) {
  let s = "";
  const end = Math.min(offset + length, view.byteLength);
  for (let i = offset; i < end; i += 1) {
    const c = view.getUint8(i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function parseTiffDates(view, tiffStart) {
  if (tiffStart + 8 > view.byteLength) return null;
  const le = view.getUint16(tiffStart) === 0x4949;
  const u16 = (off) => view.getUint16(off, le);
  const u32 = (off) => view.getUint32(off, le);

  function readIfdDates(ifdOffset) {
    if (ifdOffset <= 0 || tiffStart + ifdOffset + 2 > view.byteLength) {
      return { dates: [], exifPtr: 0 };
    }
    const count = u16(tiffStart + ifdOffset);
    const dates = [];
    let exifPtr = 0;
    for (let i = 0; i < count; i += 1) {
      const entry = tiffStart + ifdOffset + 2 + i * 12;
      if (entry + 12 > view.byteLength) break;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const num = u32(entry + 4);
      const valueOff = entry + 8;
      const size = type === 2 ? num : 0;
      let dataOffset = valueOff;
      if (size > 4) dataOffset = tiffStart + u32(valueOff);
      if (tag === 0x8769) exifPtr = u32(valueOff);
      if (tag === 0x0132 || tag === 0x9003 || tag === 0x9004) {
        dates.push(readAscii(view, dataOffset, size || 20));
      }
    }
    return { dates, exifPtr };
  }

  const first = readIfdDates(u32(tiffStart + 4));
  const preferred = [...first.dates];
  if (first.exifPtr) preferred.push(...readIfdDates(first.exifPtr).dates);
  for (const raw of preferred) {
    const parsed = parseExifDatetime(raw);
    if (parsed) return parsed;
  }
  return null;
}

function extractExifDate(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0xe1 && size >= 8) {
      const start = offset + 4;
      if (readAscii(view, start, 4) === "Exif") {
        const found = parseTiffDates(view, start + 6);
        if (found) return found;
      }
    }
    offset += 2 + size;
  }
  return null;
}

function extractFilenameDate(filename) {
  const stem = filename.replace(/\.[^.]+$/, "");
  for (const pattern of FILENAME_DATE_PATTERNS) {
    const m = stem.match(pattern);
    if (!m) continue;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(dt.getTime()) && validYear(dt)) return dt;
  }
  return null;
}

function yearMonthName(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function resolveDate(name, headBuffer, mtimeMs, useFallbacks) {
  const exif = extractExifDate(headBuffer);
  if (exif) return { dt: exif, source: "exif" };
  if (!useFallbacks) return { dt: null, source: "none" };
  const byName = extractFilenameDate(name);
  if (byName) return { dt: byName, source: "filename" };
  const byFile = new Date(mtimeMs);
  if (!Number.isNaN(byFile.getTime()) && validYear(byFile)) {
    return { dt: byFile, source: "filedate" };
  }
  return { dt: null, source: "none" };
}

function targetRel(guess, name) {
  if (!isMediaFile(name)) return { rel: OTHER_DIR, status: "other" };
  if (guess.dt && guess.source === "exif") return { rel: yearMonthName(guess.dt), status: "ok" };
  if (guess.dt && (guess.source === "filename" || guess.source === "filedate")) {
    return { rel: yearMonthName(guess.dt), status: "estimated" };
  }
  return { rel: UNCLASSIFIED_DIR, status: "unclassified" };
}

function uniqueName(used, dir, filename) {
  let candidate = `${dir}/${filename}`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return filename;
  }
  const dot = filename.lastIndexOf(".");
  const stem = dot >= 0 ? filename.slice(0, dot) : filename;
  const suffix = dot >= 0 ? filename.slice(dot) : "";
  let i = 1;
  while (used.has(`${dir}/${stem}_${i}${suffix}`)) i += 1;
  const next = `${stem}_${i}${suffix}`;
  used.add(`${dir}/${next}`);
  return next;
}

module.exports = {
  UNCLASSIFIED_DIR,
  OTHER_DIR,
  MANIFEST_NAME,
  isSkippedName,
  isMediaFile,
  fileKind,
  resolveDate,
  targetRel,
  uniqueName,
};
