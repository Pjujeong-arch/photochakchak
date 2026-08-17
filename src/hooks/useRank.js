import { useCallback, useMemo, useState } from "react";
import {
  fileToThumb,
  isPhotoFile,
  requestRank,
  toErrorMessage,
} from "../services/index.js";
import { monthOf, pickSpread } from "../utils/index.js";

/**
 * @param {{
 *   files: File[],
 *   preview: import('../types/photochak').SortPreview | null,
 *   me: import('../types/photochak').SubscribeUser | null,
 *   toast: { show: (msg: string) => void },
 * }} args
 */
export function useRank({ files, preview, me, toast }) {
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
        const msg = "구글 로그인 후 구독안을 이용해 주세요.";
        setError(msg);
        toast.show(msg);
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
          throw new Error("축소본을 만들 수 있는 사진이 없습니다.");
        }
        const data = await requestRank({ mode, folder, from, to, images });
        const previewById = Object.fromEntries(
          images.map((img) => [img.id, `data:${img.mime};base64,${img.data}`])
        );
        /** @type {Array<'portraits' | 'landscapes' | 'top10'>} */
        const keys = ["portraits", "landscapes", "top10"];
        keys.forEach((key) => {
          const list = data[key] || [];
          list.forEach((item) => {
            if (item && previewById[item.id]) item.preview = previewById[item.id];
          });
        });
        setStatus("추천이 도착했습니다.");
        setResult(data);
      } catch (err) {
        const msg = toErrorMessage(err, "추천 요청에 실패했습니다.");
        setError(msg);
        setStatus("");
        toast.show(msg);
      } finally {
        setLoading(false);
      }
    },
    [loading, me, consent, filteredPhotos, folder, from, to, toast]
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
    months,
    runSample: () => run("sample"),
    runTop10: () => run("top10"),
  };
}
