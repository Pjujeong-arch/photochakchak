import { useCallback, useMemo, useState } from "react";
import {
  fileToThumb,
  isPhotoFile,
  requestRank,
  ApiError,
  toErrorMessage,
  copyFilesToDirectory,
} from "../services/index.js";
import { monthOf, pickSpread, pickCopyFolder } from "../utils/index.js";

/**
 * @param {{
 *   files: File[],
 *   preview: import('../types/photochak').SortPreview | null,
 *   me: import('../types/photochak').SubscribeUser | null,
 *   toast: { show: (msg: string) => void },
 *   onNeedLogin?: () => void,
 *   onNeedSubscribe?: () => void,
 * }} args
 */
export function useRank({ files, preview, me, toast, onNeedLogin, onNeedSubscribe }) {
  const [folder, setFolder] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [result, setResult] = useState(
    /** @type {import('../types/photochak').RankResult | null} */ (null)
  );
  const [gallery, setGallery] = useState(
    /** @type {"sample" | "top10" | null} */ (null)
  );

  const months = useMemo(() => {
    const plans = new Map();
    (preview?.items || []).forEach((item) => {
      if (item?.key) plans.set(item.key, item);
    });
    const set = new Set();
    files.filter(isPhotoFile).forEach((file) => {
      const m = monthOf(file, plans);
      if (m) set.add(m);
    });
    return [...set].sort();
  }, [files, preview]);

  const filteredPhotos = useCallback(() => {
    const plans = new Map();
    (preview?.items || []).forEach((item) => {
      if (item?.key) plans.set(item.key, item);
    });
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : 0;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : 0;
    return files.filter(isPhotoFile).filter((file) => {
      if (folder && monthOf(file, plans) !== folder) return false;
      if (fromTs && file.lastModified < fromTs) return false;
      if (toTs && file.lastModified > toTs) return false;
      return true;
    });
  }, [files, preview, folder, from, to]);

  const run = useCallback(
    async (mode) => {
      if (loading) return;
      if (!me?.email) {
        const msg = "구글 로그인 후 이용해 주세요.";
        setError(msg);
        toast.show(msg);
        onNeedLogin?.();
        return;
      }
      if (mode === "top10" && !me.subscribed) {
        const msg = "베스트 10은 구독 후 이용할 수 있습니다.";
        setError(msg);
        toast.show(msg);
        onNeedSubscribe?.();
        return;
      }
      if (!consent) {
        const msg = "Google AI 전송에 동의해 주세요. 원본은 보내지 않습니다.";
        setError(msg);
        toast.show(msg);
        return;
      }
      const photos = filteredPhotos();
      if (!photos.length) {
        const msg = "조건에 맞는 사진이 없습니다.";
        setError(msg);
        toast.show(msg);
        return;
      }
      const cap = mode === "sample" ? 12 : 20;
      const chosen = pickSpread(photos, cap);
      setLoading(true);
      setError(null);
      setStatus(`축소본 ${chosen.length}장을 Gemini에 보내는 중…`);
      try {
        const images = [];
        for (let i = 0; i < chosen.length; i += 1) {
          try {
            const thumb = await fileToThumb(chosen[i]);
            images.push({
              id: String(i),
              name: chosen[i].name,
              mime: thumb.mime,
              data: thumb.data,
            });
          } catch {
            /* skip */
          }
        }
        if (!images.length) {
          throw new Error(
            "이 기기에서 사진을 미리보기로 만들지 못했습니다. JPEG·PNG로 저장한 뒤 다시 시도해 주세요."
          );
        }
        const data = await requestRank({ mode, folder, from, to, images });
        const previewById = Object.fromEntries(
          images.map((img) => [img.id, `data:${img.mime};base64,${img.data}`])
        );
        const fileById = Object.fromEntries(
          images.map((img) => [img.id, chosen[Number(img.id)]])
        );
        /** @type {Array<'portraits' | 'landscapes' | 'top10'>} */
        const keys = ["portraits", "landscapes", "top10"];
        keys.forEach((key) => {
          const list = data[key] || [];
          list.forEach((item) => {
            if (!item) return;
            if (previewById[item.id]) item.preview = previewById[item.id];
            const src = fileById[item.id];
            if (src) item.file = src;
          });
        });
        setStatus("추천이 도착했습니다.");
        setResult(data);
        setGallery(mode);
      } catch (err) {
        const msg = toErrorMessage(err, "추천 요청에 실패했습니다.");
        setError(msg);
        setStatus("");
        toast.show(msg);
        if (err instanceof ApiError && err.status === 402) onNeedSubscribe?.();
      } finally {
        setLoading(false);
      }
    },
    [loading, me, consent, filteredPhotos, folder, from, to, toast, onNeedLogin, onNeedSubscribe]
  );

  const closeGallery = useCallback(() => setGallery(null), []);
  const openSampleGallery = useCallback(() => {
    if (result?.portraits?.length || result?.landscapes?.length) setGallery("sample");
  }, [result]);
  const openTop10Gallery = useCallback(() => {
    if (result?.top10?.length) setGallery("top10");
    else onNeedSubscribe?.();
  }, [result, onNeedSubscribe]);

  const copyPicks = useCallback(
    async (picks) => {
      const list = (picks || []).filter(Boolean);
      if (!list.length) {
        toast.show("복사할 사진을 선택해 주세요.");
        return;
      }
      try {
        const dest = await pickCopyFolder();
        if (!dest) return;
        const { copied } = await copyFilesToDirectory(list, dest);
        toast.show(`${copied}장을 복사했습니다. 원본은 그대로입니다.`);
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        toast.show(
          code === "no_dest"
            ? "이 브라우저는 폴더 저장이 안 됩니다. ZIP으로 받아 주세요."
            : "선택한 사진을 복사하지 못했습니다."
        );
      }
    },
    [toast]
  );

  return {
    folder,
    setFolder,
    from,
    setFrom,
    to,
    setTo,
    consent,
    setConsent,
    status,
    loading,
    error,
    result,
    gallery,
    closeGallery,
    openSampleGallery,
    openTop10Gallery,
    months,
    runSample: () => run("sample"),
    runTop10: () => run("top10"),
    copyPicks,
  };
}
