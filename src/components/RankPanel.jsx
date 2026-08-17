/**
 * @param {{
 *   months: string[],
 *   folder: string,
 *   from: string,
 *   to: string,
 *   consent: boolean,
 *   status: string,
 *   loading?: boolean,
 *   error?: string | null,
 *   result: import('../types/photochak').RankResult | null,
 *   meLabel?: string,
 *   onFolder: (v: string) => void,
 *   onFrom: (v: string) => void,
 *   onTo: (v: string) => void,
 *   onConsent: (v: boolean) => void,
 *   onSample: () => void,
 *   onTop10: () => void,
 *   onOpenSample: () => void,
 *   onOpenTop10: () => void,
 *   onOpenSubscribe: () => void,
 * }} props
 */
export function RankPanel({
  months,
  folder,
  from,
  to,
  consent,
  status,
  loading = false,
  error = null,
  result,
  meLabel,
  onFolder,
  onFrom,
  onTo,
  onConsent,
  onSample,
  onTop10,
  onOpenSample,
  onOpenTop10,
  onOpenSubscribe,
}) {
  return (
    <div className={`rank-box${loading ? " is-loading" : ""}`}>
      <p className="rank-box__lead">
        구글 로그인 후 샘플(인물 3·풍경 3)을 볼 수 있어요. 베스트 10은 구독에서
        열리고, 최대 20장 시연입니다.
      </p>
      <p className="rank-box__note">
        축소 이미지만 구글 AI로 보내. 원본 파일은 서버에 저장하지 않아 왈.
      </p>
      {meLabel ? <p className="rank-user">{meLabel}</p> : null}
      <label className="check">
        <input
          type="checkbox"
          checked={consent}
          disabled={loading}
          onChange={(e) => onConsent(e.target.checked)}
        />
        축소본을 Google AI(Gemini)에 보내 구도·특징 평가에 쓰는 데 동의
      </label>
      <div className="rank-filters">
        <label>
          월 폴더
          <select
            value={folder}
            disabled={loading}
            onChange={(e) => onFolder(e.target.value)}
          >
            <option value="">전체 (이번 선택분)</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          시작일
          <input
            type="date"
            value={from}
            disabled={loading}
            onChange={(e) => onFrom(e.target.value)}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={to}
            disabled={loading}
            onChange={(e) => onTo(e.target.value)}
          />
        </label>
      </div>
      <div className="rank-actions">
        <button
          className="btn btn--safe"
          type="button"
          disabled={loading}
          onClick={onSample}
        >
          {loading ? "추천 중…" : "샘플 추천 (인물 3 · 풍경 3)"}
        </button>
        <button
          className="btn btn--start"
          type="button"
          disabled={loading}
          onClick={onTop10}
        >
          {loading ? "분석 중…" : "베스트 10 (최대 20장 시연)"}
        </button>
      </div>
      {loading ? (
        <p className="rank-status rank-status--loading" aria-live="polite">
          <span className="sub-bar__spinner" aria-hidden="true" />
          {status || "요청을 처리하는 중…"}
        </p>
      ) : null}
      {!loading && status ? <p className="rank-status">{status}</p> : null}
      {error ? (
        <p className="rank-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rank-actions rank-actions--view">
        {result ? (
          <>
            <button className="btn btn--ghost" type="button" onClick={onOpenSample}>
              샘플 창 다시 보기
            </button>
            <button className="btn btn--ghost" type="button" onClick={onOpenTop10}>
              베스트 10 창 다시 보기
            </button>
          </>
        ) : null}
        <button className="btn btn--ghost" type="button" onClick={onOpenSubscribe}>
          구독 안내
        </button>
      </div>
    </div>
  );
}
