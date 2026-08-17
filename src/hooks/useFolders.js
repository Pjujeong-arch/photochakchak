import { useCallback, useRef, useState } from "react";
import { formatBytes, isImageFile } from "../services/index.js";
import { canPickDir, canUseOpfs, destFolderName, folderNameFromFiles } from "../utils/index.js";

/**
 * @param {{ show: (msg: string) => void }} toast
 */
export function useFolders(toast) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [files, setFiles] = useState(/** @type {File[]} */ ([]));
  const [destHandle, setDestHandle] = useState(
    /** @type {FileSystemDirectoryHandle | null} */ (null)
  );
  const dirSupported = canPickDir();
  const opfsSupported = canUseOpfs();
  const canMakeDest = dirSupported || opfsSupported;
  const [sourcePick, setSourcePick] = useState({
    picked: false,
    name: "폴더 선택",
    meta: "정리할 사진·영상·기타를 담아요",
  });
  const [destPick, setDestPick] = useState({
    picked: false,
    name: canMakeDest ? "폴더 만들기" : "폴더 저장 불가",
    meta: dirSupported
      ? "위치를 고르면 정리본 폴더를 새로 만들어요"
      : opfsSupported
        ? "앱 저장 공간에 폴더를 만들어 복사해요"
        : "이 브라우저는 ZIP으로 받으세요",
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
    if (!canMakeDest) {
      toast.show("이 브라우저는 폴더 저장이 안 됩니다. ZIP으로 받으세요.");
      return;
    }
    const name = destFolderName();
    try {
      if (dirSupported) {
        /** @type {FileSystemDirectoryHandle} */
        let parent;
        try {
          parent = await window.showDirectoryPicker({
            mode: "readwrite",
            startIn: "downloads",
          });
        } catch (err) {
          if (/** @type {{ name?: string }} */ (err).name === "AbortError") return;
          parent = await window.showDirectoryPicker({ mode: "readwrite" });
        }
        const handle = await parent.getDirectoryHandle(name, { create: true });
        applyDest(
          handle,
          `${parent.name}/${name}`,
          "새로 만든 폴더에 연월·미분류·기타파일로 복사 · 다시 만들려면 누르기"
        );
        return;
      }
      if (navigator.storage?.persist) {
        await navigator.storage.persist().catch(() => false);
      }
      const root = await navigator.storage.getDirectory();
      const handle = await root.getDirectoryHandle(name, { create: true });
      let meta = "앱 저장 공간에 만든 폴더 · 다시 만들려면 누르기";
      try {
        const est = await navigator.storage.estimate();
        if (est && est.quota) {
          const left = Math.max(0, Number(est.quota) - Number(est.usage || 0));
          meta = `앱 저장 ${formatBytes(left)} 남음 · 여기에 복사`;
        }
      } catch {
        /* ignore */
      }
      applyDest(handle, name, meta);
    } catch (err) {
      if (/** @type {{ name?: string }} */ (err).name === "AbortError") return;
      toast.show("폴더를 만들지 못했습니다. ZIP으로 받아 보세요.");
    }
  }, [applyDest, canMakeDest, dirSupported, toast]);

  return {
    inputRef,
    files,
    setFiles,
    destHandle,
    setDestHandle,
    sourcePick,
    destPick,
    dirSupported: canMakeDest,
    openSourcePicker,
    onSourceChange,
    pickDest,
  };
}
