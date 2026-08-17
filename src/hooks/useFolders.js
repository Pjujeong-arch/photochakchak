import { useCallback, useRef, useState } from "react";
import { formatBytes, isImageFile } from "../services/index.js";
import {
  destFolderName,
  folderNameFromFiles,
  isPhoneLike,
  pickOrCreateDestFolder,
} from "../utils/index.js";

function sourceIdle() {
  if (isPhoneLike()) {
    return {
      picked: false,
      name: "사진·영상 고르기",
      meta: "앨범에서 여러 장을 고르세요. 이 폰은 폴더 앱을 못 엽니다.",
    };
  }
  return {
    picked: false,
    name: "폴더 선택",
    meta: "정리할 사진·영상·기타를 담아요",
  };
}

function destIdle() {
  if (isPhoneLike()) {
    return {
      picked: false,
      name: "저장 폴더 만들기",
      meta: "누르면 앱 안에 정리본 폴더를 만듭니다. 파일 앱에 안 보이면 ZIP",
    };
  }
  return {
    picked: false,
    name: "폴더 만들기",
    meta: "누르면 정리본을 담을 새 폴더를 만들어요",
  };
}

/**
 * @param {{ show: (msg: string) => void }} toast
 */
export function useFolders(toast) {
  const folderInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const pickingDest = useRef(false);
  const destHandleRef = useRef(/** @type {FileSystemDirectoryHandle | null} */ (null));
  const [files, setFiles] = useState(/** @type {File[]} */ ([]));
  const [destHandle, setDestHandle] = useState(
    /** @type {FileSystemDirectoryHandle | null} */ (null)
  );
  const [sourcePick, setSourcePick] = useState(sourceIdle);
  const [destPick, setDestPick] = useState(destIdle);
  destHandleRef.current = destHandle;

  const openSourcePicker = useCallback(() => {
    if (isPhoneLike()) fileInputRef.current?.click();
    else folderInputRef.current?.click();
  }, []);

  const applyDest = useCallback(
    (handle, name, meta) => {
      destHandleRef.current = handle;
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

  const ensureDest = useCallback(async () => {
    if (destHandleRef.current) return destHandleRef.current;
    if (pickingDest.current) return null;
    pickingDest.current = true;
    const name = destFolderName();
    try {
      const picked = await pickOrCreateDestFolder(name);
      if (!picked) return null;
      if (picked.via === "opfs") {
        let meta =
          "앱 안에 저장합니다. 파일 앱·갤러리에는 안 보여요. 보이는 파일은 ZIP으로 받으세요.";
        try {
          const est = await navigator.storage.estimate();
          if (est && est.quota) {
            const left = Math.max(0, Number(est.quota) - Number(est.usage || 0));
            meta = `앱 안에 저장 · ${formatBytes(left)} 남음 · 보이는 파일은 ZIP`;
          }
        } catch {
          /* ignore */
        }
        applyDest(picked.handle, picked.label, meta);
        return picked.handle;
      }
      applyDest(
        picked.handle,
        picked.label,
        "새로 만든 폴더에 연월·미분류·기타파일로 복사 · 다시 만들려면 누르기"
      );
      return picked.handle;
    } catch {
      setDestPick({
        picked: false,
        name: "ZIP으로 받기",
        meta: "이 폰은 폴더 저장이 안 됩니다. 아래 ZIP으로 받으세요.",
      });
      toast.show("이 폰에서는 저장 폴더가 파일 앱에 안 보입니다. ZIP으로 받으세요.");
      return null;
    } finally {
      pickingDest.current = false;
    }
  }, [applyDest, toast]);

  const onSourceChange = useCallback(
    (event) => {
      const input = /** @type {HTMLInputElement} */ (event.currentTarget);
      const next = Array.from(input.files || []).filter(isImageFile);
      input.value = "";
      setFiles(next);
      const folder = folderNameFromFiles(next);
      if (next.length) {
        setSourcePick({
          picked: true,
          name: folder || `선택한 파일 ${next.length.toLocaleString()}개`,
          meta: `${next.length.toLocaleString()}개 담김 · 다시 고르려면 누르기`,
        });
        toast.show(
          folder
            ? `${folder}에서 ${next.length}개 파일을 담았습니다.`
            : `${next.length}개 파일을 담았습니다.`
        );
        if (isPhoneLike() && !destHandleRef.current) ensureDest();
        return;
      }
      setSourcePick(sourceIdle());
      toast.show("파일이 없습니다.");
    },
    [toast, ensureDest]
  );

  const pickDest = useCallback(() => {
    toast.show("저장 폴더를 준비하는 중…");
    return ensureDest();
  }, [ensureDest, toast]);

  return {
    folderInputRef,
    fileInputRef,
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
    ensureDest,
    phone: isPhoneLike(),
  };
}
