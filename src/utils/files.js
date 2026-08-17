/** @param {File[]} files */
export function folderNameFromFiles(files) {
  const file = files && files[0];
  if (!file) return "";
  const rel = String(file.webkitRelativePath || "").replace(/\\/g, "/");
  if (rel.includes("/")) return rel.split("/").filter(Boolean)[0] || "";
  return "선택한 폴더";
}

export function canPickDir() {
  return typeof window.showDirectoryPicker === "function";
}

export function canUseOpfs() {
  return typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function";
}

/** @returns {string} */
export function destFolderName() {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `포토착착_${y}-${m}-${d}`;
}

/** @returns {Promise<FileSystemDirectoryHandle | null>} */
export async function pickCopyFolder() {
  if (canPickDir()) {
    try {
      try {
        return await window.showDirectoryPicker({
          mode: "readwrite",
          startIn: "downloads",
        });
      } catch (err) {
        if (/** @type {{ name?: string }} */ (err).name === "AbortError") return null;
        return await window.showDirectoryPicker({ mode: "readwrite" });
      }
    } catch (err) {
      if (/** @type {{ name?: string }} */ (err).name === "AbortError") return null;
      throw err;
    }
  }
  if (canUseOpfs()) {
    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle("포토착착_베스트", { create: true });
  }
  throw new Error("no_dest");
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
