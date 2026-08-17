import { RankResults } from "./RankResults.jsx";

/**
 * @param {{
 *   mode: "sample" | "top10",
 *   result: import('../types/photochak').RankResult,
 *   subscribed?: boolean,
 *   onSubscribe: () => void,
 * }} props
 */
export function RankGallery({ mode, result, subscribed = false, onSubscribe }) {
  const sample = mode === "sample";

  return (
    <div className="rank-gallery">
      <p className="rank-gallery__lead">
        {sample
          ? "인물 3장 · 풍경 3장 샘플입니다. 축소본만 평가했어요."
          : "이번 범위에서 고른 베스트 10입니다. 축소본만 평가했어요."}
      </p>
      <RankResults result={result} mode={mode} />
      {!subscribed ? (
        <div className="rank-gallery__cta">
          <p>
            {sample
              ? "매월 베스트 10과 무제한 추천은 구독에서 열려요."
              : "다음 달 베스트 10을 자동으로 받으려면 구독해 주세요."}
          </p>
          <button className="btn btn--start" type="button" onClick={onSubscribe}>
            구독하고 계속 받기
          </button>
        </div>
      ) : null}
    </div>
  );
}
