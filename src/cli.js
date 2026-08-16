const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const {
  MANIFEST_NAME,
  isSkippedName,
  fileKind,
  resolveDate,
  targetRel,
  uniqueName,
} = require("./lib/classify");

function usage() {
  console.log(`포토착착 CLI — 원본은 유지하고 복사만 합니다.

사용법:
  npm run preview -- <정리할폴더>
  npm run sort -- <정리할폴더> <저장폴더>
  npm run undo -- <저장폴더>

옵션:
  --no-fallback   EXIF 없으면 미분류
  --keep-dup      중복도 복사
`);
}

function parseArgs(argv) {
  const flags = { fallback: true, skipDup: true };
  const rest = [];
  for (const arg of argv) {
    if (arg === "--no-fallback") flags.fallback = false;
    else if (arg === "--keep-dup") flags.skipDup = false;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else rest.push(arg);
  }
  return { cmd: rest[0], paths: rest.slice(1), flags };
}

async function walkFiles(root) {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (_err) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        await walk(full);
      } else if (entry.isFile() && !isSkippedName(entry.name)) {
        const st = await fsp.stat(full);
        out.push({
          path: full,
          name: entry.name,
          size: st.size,
          mtimeMs: st.mtimeMs,
        });
      }
    }
  }
  await walk(root);
  return out;
}

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function readHead(filePath) {
  const fh = await fsp.open(filePath, "r");
  try {
    const buf = Buffer.alloc(65536);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    return toArrayBuffer(buf.subarray(0, bytesRead));
  } finally {
    await fh.close();
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

function inside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

async function classifyFile(file, flags, seen, hashBySize) {
  let digest = null;
  if (flags.skipDup) {
    const bucket = hashBySize.get(file.size) || [];
    for (const prev of bucket) {
      digest = digest || (await hashFile(file.path));
      if (digest === prev) return { duplicate: true };
    }
    digest = digest || (await hashFile(file.path));
    if (seen.has(digest)) return { duplicate: true };
    seen.add(digest);
    bucket.push(digest);
    hashBySize.set(file.size, bucket);
  }
  const head = await readHead(file.path);
  const guess = resolveDate(file.name, head, file.mtimeMs, flags.fallback);
  const { rel, status } = targetRel(guess, file.name);
  return { duplicate: false, rel, status, guess, kind: fileKind(file.name) };
}

async function preview(srcDir, flags) {
  const files = await walkFiles(srcDir);
  const seen = new Set();
  const hashBySize = new Map();
  const byFolder = {};
  const stats = { photo: 0, video: 0, other: 0, duplicate: 0, total: files.length };
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    stats[fileKind(file.name)] += 1;
    const result = await classifyFile(file, flags, seen, hashBySize);
    if (result.duplicate) {
      stats.duplicate += 1;
      continue;
    }
    byFolder[result.rel] = (byFolder[result.rel] || 0) + 1;
    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      process.stdout.write(`\r미리보기 ${i + 1}/${files.length}`);
    }
  }
  console.log("\n");
  console.log(`사진 ${stats.photo} · 영상 ${stats.video} · 기타 ${stats.other} · 중복 ${stats.duplicate}`);
  Object.entries(byFolder)
    .sort((a, b) => b[1] - a[1])
    .forEach(([folder, count]) => console.log(`  ${folder}: ${count}`));
}

async function copyCmd(srcDir, destDir, flags) {
  if (inside(srcDir, destDir) || path.resolve(srcDir) === path.resolve(destDir)) {
    throw new Error("저장 폴더는 원본과 달라야 하고, 원본 바깥이어야 합니다.");
  }
  const files = await walkFiles(srcDir);
  const seen = new Set();
  const hashBySize = new Map();
  const used = new Set();
  const copied = [];
  const stats = { ok: 0, estimated: 0, unclassified: 0, other: 0, duplicate: 0, error: 0, total: files.length };

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    try {
      const result = await classifyFile(file, flags, seen, hashBySize);
      if (result.duplicate) {
        stats.duplicate += 1;
      } else {
        const dir = path.join(destDir, result.rel);
        await fsp.mkdir(dir, { recursive: true });
        const name = uniqueName(used, result.rel, file.name);
        const dest = path.join(dir, name);
        await fsp.copyFile(file.path, dest);
        copied.push(path.join(result.rel, name).replace(/\\/g, "/"));
        stats[result.status] += 1;
      }
    } catch (_err) {
      stats.error += 1;
    }
    if ((i + 1) % 20 === 0 || i === files.length - 1) {
      process.stdout.write(`\r복사 ${i + 1}/${files.length}`);
    }
  }

  await fsp.writeFile(
    path.join(destDir, MANIFEST_NAME),
    JSON.stringify({ copied, at: new Date().toISOString() }, null, 2),
    "utf8"
  );
  console.log("\n완료 — 원본은 그대로입니다.");
  console.log(
    `EXIF ${stats.ok} · 추정 ${stats.estimated} · 미분류 ${stats.unclassified} · 기타 ${stats.other} · 중복스킵 ${stats.duplicate} · 실패 ${stats.error}`
  );
}

async function undoCmd(destDir) {
  const manifestPath = path.join(destDir, MANIFEST_NAME);
  const raw = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  let deleted = 0;
  for (const rel of raw.copied || []) {
    const full = path.join(destDir, rel);
    try {
      await fsp.unlink(full);
      deleted += 1;
    } catch (_err) {
      /* already gone */
    }
  }
  console.log(`실행 취소 — 복사본 ${deleted}개 삭제 (원본 유지)`);
}

async function main() {
  const { cmd, paths, flags } = parseArgs(process.argv.slice(2));
  if (!cmd || flags.help) {
    usage();
    process.exit(cmd ? 0 : 1);
  }
  try {
    if (cmd === "preview") {
      if (!paths[0]) throw new Error("정리할 폴더를 넣어 주세요.");
      await preview(path.resolve(paths[0]), flags);
    } else if (cmd === "copy") {
      if (!paths[0] || !paths[1]) throw new Error("정리할 폴더와 저장 폴더를 넣어 주세요.");
      await copyCmd(path.resolve(paths[0]), path.resolve(paths[1]), flags);
    } else if (cmd === "undo") {
      if (!paths[0]) throw new Error("저장 폴더를 넣어 주세요.");
      await undoCmd(path.resolve(paths[0]));
    } else {
      usage();
      process.exit(1);
    }
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
