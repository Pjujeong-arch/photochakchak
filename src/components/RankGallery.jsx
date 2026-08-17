import { useEffect, useMemo, useState } from "react";
import { listRankItems, RankResults } from "./RankResults.jsx";

/**
 * @param {{
 *   mode: "sample" | "top10",
 *   result: import('../types/photochak').RankResult,
 *   subscribed?: boolean,
 *   copying?: boolean,
 *   onSubscribe: () => void,
 *   onCopyToFolder: (files: File[]) => void | Promise<void>,
 * }} props
 */
export function RankGallery({
  mode,
  result,
  subscribed = false,
  copying = false,
  onSubscribe,
  onCopyToFolder,
}) {
  const sample = mode === "sample";
  const items = useMemo(() => listRankItems(result, mode), [result, mode]);
  const [selected, setSelected] = useState(() => new Set(items.map((item) => item.id)));

  useEffect(() => {
    setSelected(new Set(items.map((item) => item.id)));
  }, [items]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOn = selected.size === items.length && items.length > 0;
  const picks = items.filter((item) => selected.has(item.id) && item.file).map((item) => item.file);

  return (
    <div className="rank-gallery">
      <p className="rank-gallery__lead">
        {sample
          ? "인물 3장 · 풍경 3장 샘플입니다. 고른 원본을 원하는 폴더로 복사할 수 있어요."
          : "최대 20장 시연의 베스트 10입니다. 고른 원본을 원하는 폴더로 복사할 수 있어요."}
      </p>
      <div className="rank-gallery__bar">
        <button
          className="btn btn--ghost"
          type="button"
          disabled={!items.length || copying}
          onClick={() =>
            setSelected(allOn ? new Set() : new Set(items.map((item) => item.id)))
          }
        >
          {allOn ? "선택 해제" : "전체 선택"}
        </button>
        <button
          className="btn btn--start"
          type="button"
          disabled={!picks.length || copying}
          onClick={() => onCopyToFolder(picks)}
        >
          {copying ? "복사 중…" : `선택 ${picks.length}장 폴더로 복사`}
        </button>
      </div>
      <RankResults result={result} mode={mode} selected={selected} onToggle={toggle} />
      {!subscribed ? (
        <div className="rank-gallery__cta">
          <p>
            {sample
              ? "매월 베스트 10과 골라 복사는 구독에서 열려요."
              : "다음 달 베스트 10을 계속 받으려면 구독해 주세요."}
          </p>
          <button className="btn btn--start" type="button" onClick={onSubscribe}>
            구독하고 계속 받기
          </button>
        </div>
      ) : null}
    </div>
  );
}
