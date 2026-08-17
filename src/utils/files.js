/** @param {File[]} files */
export function folderNameFromFiles(files) {
  const file = files && files[0];
  if (!file) return "";
  const rel = String(file.webkitRelativePath || "").replace(/\\/g, "/");
  if (rel.includes("/")) return rel.split("/").filter(Boolean)[0] || "";
  return "선택한 폴더";
}

export function canPickDir() {
  if (typeof window === "undefined" || typeof window.showDirectoryPicker !== "function") {
    return false;
  }
  return !isPhoneLike();
}

export function canUseOpfs() {
  return typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function";
}

export function isPhoneLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

/** @returns {string} */
export function destFolderName() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `포토착착_${y}-${m}-${d}`;
}

/**
 * @param {string} folderName
 * @returns {Promise<{ handle: FileSystemDirectoryHandle, label: string, via: "picker" | "opfs" } | null>}
 */
export async function pickOrCreateDestFolder(folderName) {
  if (canPickDir()) {
    try {
      const parent = await window.showDirectoryPicker({ mode: "readwrite" });
      const handle = await parent.getDirectoryHandle(folderName, { create: true });
      return { handle, label: `${parent.name}/${folderName}`, via: "picker" };
    } catch (err) {
      if (/** @type {{ name?: string }} */ (err).name === "AbortError") return null;
    }
  }
  if (!canUseOpfs()) throw new Error("no_dest");
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => false);
  const root = await Promise.race([
    navigator.storage.getDirectory(),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("no_dest")), 8000);
    }),
  ]);
  const handle = await /** @type {FileSystemDirectoryHandle} */ (root).getDirectoryHandle(
    folderName,
    { create: true }
  );
  return { handle, label: folderName, via: "opfs" };
}

/** @returns {Promise<FileSystemDirectoryHandle | null>} */
export async function pickCopyFolder() {
  const picked = await pickOrCreateDestFolder("포토착착_베스트");
  return picked ? picked.handle : null;
}

/** @param {File} file */
export function fileKey(file) {
  return `${file.webkitRelativePath || file.name}|${file.size}|${file.lastModified}`;
}

/**
 * @param {File} file
 * @param {Map<string, { rel?: string }>} planByKey
 */
export function monthOf(file, planByKey) {
  const plan = planByKey.get(fileKey(file));
  if (plan && plan.rel && /^\d{4}-\d{2}$/.test(plan.rel)) return plan.rel;
  const dt = new Date(file.lastModified);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

/** @param {File[]} files @param {number} limit */
export function pickSpread(files, limit) {
  if (files.length <= limit) return files.slice();
  const out = [];
  const step = (files.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i += 1) out.push(files[Math.round(i * step)]);
  return out;
}

/** @param {import('../types/photochak').SortStats} stats */
export function doneSummary(stats) {
  return `완료 — EXIF ${stats.ok.toLocaleString()} · 추정 ${stats.estimated.toLocaleString()} · 미분류 ${stats.unclassified.toLocaleString()} · 기타 ${(stats.other || 0).toLocaleString()} · 중복스킵 ${stats.duplicate.toLocaleString()} · 실패 ${stats.error.toLocaleString()}`;
}
