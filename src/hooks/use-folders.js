import { isImageFile } from "../services/index.js";
import { paintPick } from "../components/index.js";

export function canPickDir() {
  return typeof window.showDirectoryPicker === "function";
}

function folderNameFromFiles(files) {
  const file = files && files[0];
  if (!file) return "";
  const rel = String(file.webkitRelativePath || "").replace(/\\/g, "/");
  if (rel.includes("/")) return rel.split("/").filter(Boolean)[0] || "";
  return "선택한 폴더";
}

export function bindFolders(els, state, toast) {
  els.sourceBtn.addEventListener("click", () => els.sourceInput.click());
  els.sourceInput.addEventListener("change", () => {
    state.files = Array.from(els.sourceInput.files || []).filter(isImageFile);
    state.preview = null;
    const folder = folderNameFromFiles(state.files);
    if (state.files.length && folder) {
      paintPick(els.sourceBtn, els.sourceName, els.sourceMeta, true, folder, `${state.files.length.toLocaleString()}개 담김 · 다시 고르려면 누르기`);
      toast.show(`${folder}에서 ${state.files.length}개 파일을 담았습니다.`);
    } else {
      paintPick(els.sourceBtn, els.sourceName, els.sourceMeta, false, "폴더 선택", "정리할 사진·영상·기타를 담아요");
      toast.show("파일이 없습니다.");
    }
  });

  if (!canPickDir()) {
    els.destBtn.disabled = true;
    paintPick(els.destBtn, els.destName, els.destMeta, false, "폴더 저장 불가", "이 브라우저는 ZIP으로 받으세요");
    toast.show("이 브라우저는 폴더 저장 미지원 · ZIP으로 받으세요");
    return;
  }
  els.destBtn.addEventListener("click", async () => {
    try {
      state.destHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      state.preview = null;
      const name = state.destHandle.name || "저장 폴더";
      paintPick(els.destBtn, els.destName, els.destMeta, true, name, "여기에 연월·미분류·기타파일로 복사 · 다시 고르려면 누르기");
      toast.show(`${name} 폴더에 저장합니다.`);
    } catch {
      /* cancelled */
    }
  });
}
