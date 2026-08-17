import { useCallback, useRef, useState } from "react";
import { formatBytes, isImageFile } from "../services/index.js";
import { destFolderName, folderNameFromFiles, pickOrCreateDestFolder } from "../utils/index.js";

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
    name: "폴더 만들기",
    meta: "누르면 정리본을 담을 새 폴더를 만들어요",
  });

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

  const applyDest = useCallback(
    (handle, name, meta) => {
      setDestHandle(handle);
      setDestPick({
        picked: true,
        name,
        meta,
      });
      toast.show(`${name} 폴더에 저장합니다.`);
    },
    [toast]
  );

  const pickDest = useCallback(async () => {
    const name = destFolderName();
    try {
      const picked = await pickOrCreateDestFolder(name);
      if (!picked) return;
      if (picked.via === "opfs") {
        let meta = "이 폰에서는 폴더 앱을 열 수 없어 앱 안에 저장합니다. 파일 앱에 안 보이면 ZIP으로 받으세요.";
        try {
          const est = await navigator.storage.estimate();
          if (est && est.quota) {
            const left = Math.max(0, Number(est.quota) - Number(est.usage || 0));
            meta = `앱 안에 저장 · ${formatBytes(left)} 남음 · 파일 앱에 안 보이면 ZIP`;
          }
        } catch {
          /* ignore */
        }
        applyDest(picked.handle, picked.label, meta);
        return;
      }
      applyDest(
        picked.handle,
        picked.label,
        "새로 만든 폴더에 연월·미분류·기타파일로 복사 · 다시 만들려면 누르기"
      );
    } catch {
      toast.show("이 폰에서는 저장 폴더를 못 엽니다. ZIP으로 받으세요.");
    }
  }, [applyDest, toast]);

  return {
    inputRef,
    files,
    setFiles,
    destHandle,
    setDestHandle,
    sourcePick,
    destPick,
    dirSupported: true,
    openSourcePicker,
    onSourceChange,
    pickDest,
  };
}
