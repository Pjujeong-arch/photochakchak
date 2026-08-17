import { useCallback, useRef, useState } from "react";
import { isImageFile } from "../services/index.js";
import { canPickDir, folderNameFromFiles } from "../utils/index.js";

/**
 * @param {{ show: (msg: string) => void }} toast
 */
export function useFolders(toast) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [files, setFiles] = useState(/** @type {File[]} */ ([]));
  const [destHandle, setDestHandle] = useState(
    /** @type {FileSystemDirectoryHandle | null} */ (null)
  );
  const [sourcePick, setSourcePick] = useState({
    picked: false,
    name: "폴더 선택",
    meta: "정리할 사진·영상·기타를 담아요",
  });
  const [destPick, setDestPick] = useState({
    picked: false,
    name: canPickDir() ? "폴더 선택" : "폴더 저장 불가",
    meta: canPickDir()
      ? "원본과 다른 위치에 복사해요"
      : "이 브라우저는 ZIP으로 받으세요",
  });
  const dirSupported = canPickDir();

  const openSourcePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onSourceChange = useCallback(() => {
    const next = Array.from(inputRef.current?.files || []).filter(isImageFile);
    setFiles(next);
    const folder = folderNameFromFiles(next);
    if (next.length && folder) {
      setSourcePick({
        picked: true,
        name: folder,
        meta: `${next.length.toLocaleString()}개 담김 · 다시 고르려면 누르기`,
      });
      toast.show(`${folder}에서 ${next.length}개 파일을 담았습니다.`);
    } else {
      setSourcePick({
        picked: false,
        name: "폴더 선택",
        meta: "정리할 사진·영상·기타를 담아요",
      });
      toast.show("파일이 없습니다.");
    }
  }, [toast]);

  const pickDest = useCallback(async () => {
    if (!dirSupported) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setDestHandle(handle);
      const name = handle.name || "저장 폴더";
      setDestPick({
        picked: true,
        name,
        meta: "여기에 연월·미분류·기타파일로 복사 · 다시 고르려면 누르기",
      });
      toast.show(`${name} 폴더에 저장합니다.`);
    } catch {
      /* cancelled */
    }
  }, [dirSupported, toast]);

  return {
    inputRef,
    files,
    setFiles,
    destHandle,
    setDestHandle,
    sourcePick,
    destPick,
    dirSupported,
    openSourcePicker,
    onSourceChange,
    pickDest,
  };
}
