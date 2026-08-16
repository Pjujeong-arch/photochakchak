window.PhotoChak = (function () {
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".webp",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
]);
const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".webm",
  ".wmv",
  ".3gp",
]);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

const UNCLASSIFIED_DIR = "미분류";
const OTHER_DIR = "기타파일";
const MANIFEST_NAME = ".photochak_last_run.json";
const SKIP_NAMES = new Set([
  MANIFEST_NAME.toLowerCase(),
  "thumbs.db",
  "desktop.ini",
]);
const SOURCE_LABEL = {
  exif: "EXIF",
  filename: "파일명추정",
  filedate: "파일일추정",
  none: "미분류",
  other: "기타파일",
};

const FILENAME_DATE_PATTERNS = [
  /(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/,
  /(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_-]?\d{4,6}/,
];

function fileExt(name) {
  const dot = (name || "").lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

function isMediaFile(file) {
  return MEDIA_EXTENSIONS.has(fileExt(file.name || ""));
}

function fileKind(file) {
  const ext = fileExt(file.name || "");
  if (IMAGE_EXTENSIONS.has(ext)) return "photo";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "other";
}

function sourceFolder(file) {
  const rel = file.webkitRelativePath || file.name || "";
  const parts = String(rel).split("/").filter(Boolean);
  parts.pop();
  return parts.length ? parts.join("/") : "선택 폴더";
}

function isSkippedName(name) {
  const n = (name || "").toLowerCase();
  if (!n || n.startsWith(".")) return true;
  return SKIP_NAMES.has(n);
}

function isSortableFile(file) {
  return !isSkippedName(file.name || "");
}

function isImageFile(file) {
  return isSortableFile(file);
}

function formatBytes(n) {
  let value = n;
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (value < 1024 || unit === "TB") {
      return unit === "B" ? `${value} B` : `${value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${value.toFixed(1)} TB`;
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
    if (ifdOffset <= 0 || tiffStart + ifdOffset + 2 > view.byteLength) return { dates: [], exifPtr: 0 };
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

  const ifd0 = u32(tiffStart + 4);
  const first = readIfdDates(ifd0);
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
      const head = readAscii(view, start, 4);
      if (head === "Exif") {
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

function extractFileDate(file) {
  const dt = new Date(file.lastModified);
  if (!Number.isNaN(dt.getTime()) && validYear(dt)) return dt;
  return null;
}

async function resolveDate(file, useFallbacks) {
  try {
    const head = await file.slice(0, 65536).arrayBuffer();
    const exif = extractExifDate(head);
    if (exif) return { dt: exif, source: "exif" };
  } catch (_err) {
    /* ignore broken images */
  }
  if (!useFallbacks) return { dt: null, source: "none" };
  const byName = extractFilenameDate(file.name);
  if (byName) return { dt: byName, source: "filename" };
  const byFile = extractFileDate(file);
  if (byFile) return { dt: byFile, source: "filedate" };
  return { dt: null, source: "none" };
}

function yearMonthName(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function targetRel(guess, file) {
  if (file && !isMediaFile(file)) {
    return { rel: OTHER_DIR, status: "other" };
  }
  if (guess.dt && guess.source === "exif") {
    return { rel: yearMonthName(guess.dt), status: "ok" };
  }
  if (guess.dt && (guess.source === "filename" || guess.source === "filedate")) {
    return { rel: yearMonthName(guess.dt), status: "estimated" };
  }
  return { rel: UNCLASSIFIED_DIR, status: "unclassified" };
}

function statusLabel(status, guess) {
  if (status === "ok") return "EXIF";
  if (status === "estimated") return SOURCE_LABEL[guess.source];
  if (status === "other") return "기타파일";
  return "미분류";
}

async function fileHash(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function uniqueName(used, dir, filename) {
  let candidate = `${dir}/${filename}`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  const dot = filename.lastIndexOf(".");
  const stem = dot >= 0 ? filename.slice(0, dot) : filename;
  const suffix = dot >= 0 ? filename.slice(dot) : "";
  let i = 1;
  while (used.has(`${dir}/${stem}_${i}${suffix}`)) i += 1;
  candidate = `${dir}/${stem}_${i}${suffix}`;
  used.add(candidate);
  return candidate;
}

async function yieldUi() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function analyzeFiles(files, options, onProgress) {
  const { useFallbacks, skipDuplicates, cancelled } = options;
  const result = {
    total: files.length,
    byKind: { photo: 0, video: 0, other: 0 },
    bySource: { exif: 0, filename: 0, filedate: 0, none: 0, other: 0 },
    byFolder: {},
    duplicates: 0,
    bytesNeeded: 0,
    sampleLogs: [],
  };
  const seen = new Set();
  const hashBySize = new Map();

  for (let i = 0; i < files.length; i += 1) {
    if (cancelled()) throw new Error("cancelled_preview");
    const file = files[i];
    result.byKind[fileKind(file)] += 1;
    let isDup = false;

    if (skipDuplicates) {
      const bucket = hashBySize.get(file.size) || [];
      let digest = null;
      for (const prevHash of bucket) {
        digest = digest || (await fileHash(file));
        if (digest === prevHash) {
          isDup = true;
          break;
        }
      }
      if (!isDup) {
        digest = digest || (await fileHash(file));
        if (seen.has(digest)) isDup = true;
        else {
          seen.add(digest);
          bucket.push(digest);
          hashBySize.set(file.size, bucket);
        }
      }
    }

    if (isDup) {
      result.duplicates += 1;
      if (result.sampleLogs.length < 40) {
        result.sampleLogs.push(`[중복예정] ${file.name} — 복사 생략`);
      }
    } else if (!isMediaFile(file)) {
      result.bySource.other += 1;
      result.byFolder[OTHER_DIR] = (result.byFolder[OTHER_DIR] || 0) + 1;
      result.bytesNeeded += file.size;
      if (result.sampleLogs.length < 40) {
        result.sampleLogs.push(`[기타파일] ${file.name} → ${OTHER_DIR}/`);
      }
    } else {
      const guess = await resolveDate(file, useFallbacks);
      const { rel } = targetRel(guess, file);
      result.bySource[guess.source] += 1;
      result.byFolder[rel] = (result.byFolder[rel] || 0) + 1;
      result.bytesNeeded += file.size;
      if (result.sampleLogs.length < 40) {
        result.sampleLogs.push(`[${SOURCE_LABEL[guess.source]}] ${file.name} → ${rel}/`);
      }
    }

    if (i === 0 || i % 3 === 0 || i === files.length - 1) {
      onProgress(i + 1, files.length);
      await yieldUi();
    }
  }
  return result;
}

async function copyToDirectory(files, destHandle, options, onProgress) {
  const { useFallbacks, skipDuplicates, cancelled } = options;
  const stats = { ok: 0, estimated: 0, unclassified: 0, other: 0, duplicate: 0, error: 0, total: files.length };
  const copied = [];
  const skipped = [];
  const seen = new Set();
  const used = new Set();

  async function ensureDir(rel) {
    const parts = rel.split("/").filter(Boolean);
    let dir = destHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    return dir;
  }

  for (let i = 0; i < files.length; i += 1) {
    if (cancelled()) break;
    const file = files[i];
    try {
      if (skipDuplicates) {
        const digest = await fileHash(file);
        if (seen.has(digest)) {
          stats.duplicate += 1;
          const guess = isMediaFile(file)
            ? await resolveDate(file, useFallbacks)
            : { dt: null, source: "other" };
          const { rel } = targetRel(guess, file);
          skipped.push({ folder: rel, name: file.name, source: sourceFolder(file), reason: "중복스킵" });
          onProgress(i + 1, files.length, `[중복스킵] ${file.name} — 이미 같은 사진이 있어 건너뜀`);
          continue;
        }
        seen.add(digest);
      }
      const guess = isMediaFile(file)
        ? await resolveDate(file, useFallbacks)
        : { dt: null, source: "other" };
      const { rel, status } = targetRel(guess, file);
      const destPath = uniqueName(used, rel, file.name);
      const filename = destPath.slice(rel.length + 1);
      const dir = await ensureDir(rel);
      const handle = await dir.getFileHandle(filename, { create: true });
      const writable = await handle.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
      copied.push(destPath);
      stats[status] += 1;
      onProgress(i + 1, files.length, `[${statusLabel(status, guess)}] ${file.name} ──▶ ${rel}/`);
    } catch (err) {
      stats.error += 1;
      skipped.push({
        folder: sourceFolder(file),
        name: file.name,
        source: sourceFolder(file),
        reason: `실패 (${err.message || err})`,
      });
      onProgress(i + 1, files.length, `[실패] ${file.name} ──▶ ${err.message || err}`);
    }
    if (i % 4 === 0) await yieldUi();
  }

  if (cancelled()) {
    for (let j = copied.length + skipped.length; j < files.length; j += 1) {
      const left = files[j];
      skipped.push({
        folder: sourceFolder(left),
        name: left.name,
        source: sourceFolder(left),
        reason: "중지됨",
      });
    }
  }

  const manifest = {
    created_at: new Date().toISOString().slice(0, 19),
    copied_files: copied,
    stats,
  };
  try {
    const mh = await destHandle.getFileHandle(MANIFEST_NAME, { create: true });
    const w = await mh.createWritable();
    await w.write(JSON.stringify(manifest, null, 2));
    await w.close();
  } catch (_err) {
    /* ignore */
  }
  return { stats, copied, skipped };
}

async function undoLastRun(destHandle) {
  let data;
  try {
    const mh = await destHandle.getFileHandle(MANIFEST_NAME);
    const file = await mh.getFile();
    data = JSON.parse(await file.text());
  } catch (_err) {
    throw new Error("되돌릴 기록이 없습니다. 저장 폴더에 마지막 실행 기록이 있어야 합니다.");
  }
  const files = data.copied_files || [];
  let deleted = 0;
  let errors = 0;
  for (const rel of files) {
    try {
      const parts = rel.split("/").filter(Boolean);
      const name = parts.pop();
      let dir = destHandle;
      for (const part of parts) dir = await dir.getDirectoryHandle(part);
      await dir.removeEntry(name);
      deleted += 1;
    } catch (_err) {
      errors += 1;
    }
  }
  try {
    await destHandle.removeEntry(MANIFEST_NAME);
  } catch (_err) {
    /* ignore */
  }
  return { deleted, errors };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function encodeUtf8(str) {
  return new TextEncoder().encode(str);
}

async function copyToZip(files, options, onProgress) {
  const { useFallbacks, skipDuplicates, cancelled } = options;
  const stats = { ok: 0, estimated: 0, unclassified: 0, other: 0, duplicate: 0, error: 0, total: files.length };
  const skipped = [];
  const seen = new Set();
  const used = new Set();
  const locals = [];
  const centrals = [];
  let offset = 0;
  let entryCount = 0;

  function addEntry(path, data) {
    const nameBytes = encodeUtf8(path);
    const crc = crc32(data);
    const local = [
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ];
    const localSize = 30 + nameBytes.length + data.length;
    const central = [
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ];
    locals.push(...local);
    centrals.push(...central);
    offset += localSize;
    entryCount += 1;
  }

  for (let i = 0; i < files.length; i += 1) {
    if (cancelled()) break;
    const file = files[i];
    try {
      if (skipDuplicates) {
        const digest = await fileHash(file);
        if (seen.has(digest)) {
          stats.duplicate += 1;
          const guess = isMediaFile(file)
            ? await resolveDate(file, useFallbacks)
            : { dt: null, source: "other" };
          const { rel } = targetRel(guess, file);
          skipped.push({ folder: rel, name: file.name, source: sourceFolder(file), reason: "중복스킵" });
          onProgress(i + 1, files.length, `[중복스킵] ${file.name}`);
          continue;
        }
        seen.add(digest);
      }
      const guess = isMediaFile(file)
        ? await resolveDate(file, useFallbacks)
        : { dt: null, source: "other" };
      const { rel, status } = targetRel(guess, file);
      const destPath = uniqueName(used, rel, file.name);
      const data = new Uint8Array(await file.arrayBuffer());
      addEntry(destPath, data);
      stats[status] += 1;
      onProgress(i + 1, files.length, `[${statusLabel(status, guess)}] ${file.name} ──▶ ${rel}/`);
    } catch (err) {
      stats.error += 1;
      skipped.push({
        folder: sourceFolder(file),
        name: file.name,
        source: sourceFolder(file),
        reason: `실패 (${err.message || err})`,
      });
      onProgress(i + 1, files.length, `[실패] ${file.name} ──▶ ${err.message || err}`);
    }
    if (i % 4 === 0) await yieldUi();
  }

  if (cancelled()) {
    for (let j = entryCount + skipped.length; j < files.length; j += 1) {
      const left = files[j];
      skipped.push({
        folder: sourceFolder(left),
        name: left.name,
        source: sourceFolder(left),
        reason: "중지됨",
      });
    }
  }

  const centralBlob = centrals;
  let centralSize = 0;
  centralBlob.forEach((p) => {
    centralSize += p.length;
  });
  const eocd = [
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entryCount),
    u16(entryCount),
    u32(centralSize),
    u32(offset),
    u16(0),
  ];
  const blob = new Blob([...locals, ...centrals, ...eocd], { type: "application/zip" });
  return { stats, blob, skipped };
}

return {
  isImageFile,
  formatBytes,
  analyzeFiles,
  copyToDirectory,
  copyToZip,
  undoLastRun,
};
})();
